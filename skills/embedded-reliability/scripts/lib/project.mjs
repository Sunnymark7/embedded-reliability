import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compatibleParts, identifyParts, stripComments } from './identity.mjs';
import { readProfile } from './profile.mjs';
export { familyData } from './identity.mjs';

export const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ignored = new Set(['node_modules', 'build', 'dist', 'vendor', 'vendors', 'third_party', 'external', 'target', 'coverage']);
const codeExts = new Set(['.c', '.h', '.cpp', '.hpp', '.cc', '.cxx']);
const evidenceExts = new Set([...codeExts, '.ioc', '.ld', '.lds', '.s', '.uvprojx', '.ewp', '.cmake', '.dts', '.dtsi', '.conf']);
const configNames = new Set(['CMakeLists.txt', 'Kconfig', 'Makefile', 'platformio.ini', 'sdkconfig', 'sdkconfig.defaults', 'prj.conf', 'west.yml', 'EMBEDDED.md', 'compile_commands.json']);

export function parseArgs(argv, { values = [], flags = [] } = {}) {
  const result = { positionals: [] };
  for (let i = 0; i < argv.length; ++i) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { result.positionals.push(arg); continue; }
    const name = arg.slice(2);
    if (flags.includes(name)) result[name] = true;
    else if (values.includes(name)) {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value: ${arg}`);
      result[name] = argv[++i];
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return result;
}

export function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export function checkedPath(root, value) {
  const selected = fs.realpathSync(path.resolve(root, value));
  if (!inside(root, selected)) throw new Error('Target escapes the selected root');
  return selected;
}

function namesAt(directory) { return fs.readdirSync(directory); }
function isBoundary(names) {
  return names.some(name => ['CMakeLists.txt', 'Makefile', 'platformio.ini', 'sdkconfig', 'embedded-profile.json', 'EMBEDDED.md'].includes(name) || name.endsWith('.ioc'));
}
function ancestors(start, stop) {
  const result = [];
  for (let directory = start; inside(stop, directory); directory = path.dirname(directory)) {
    result.push(directory);
    if (directory === stop) break;
  }
  return result;
}

export function resolveScope(rootValue, target, { discover = rootValue === undefined } = {}) {
  const cwd = fs.realpathSync(rootValue ?? process.cwd());
  if (!fs.statSync(cwd).isDirectory()) throw new Error('Root must be a directory');
  let root = cwd;
  if (discover) {
    let nearestProject;
    for (let directory = cwd; ; directory = path.dirname(directory)) {
      const names = namesAt(directory);
      if (!nearestProject && isBoundary(names)) nearestProject = directory;
      if (names.includes('.git')) { root = directory; break; }
      if (path.dirname(directory) === directory) { root = nearestProject ?? cwd; break; }
    }
  }
  const selected = target ? checkedPath(root, path.resolve(cwd, target)) : cwd;
  const isDirectory = fs.statSync(selected).isDirectory();
  const start = isDirectory ? selected : path.dirname(selected);
  const directories = ancestors(start, root);
  const scope = directories.find(directory => isBoundary(namesAt(directory))) ?? start;
  // A target within a root-level build needs ancestor metadata, not recursive
  // traversal of unrelated sibling products. An explicit directory is honored.
  const scanScope = isDirectory ? selected : start;
  return { root, cwd, scope, scanScope, selected, target: isDirectory ? undefined : selected, directories };
}

export function listFiles(scope, { sourceOnly = false, maxEntries = 5000, maxFiles = 1200, maxDepth = 8 } = {}) {
  const files = [];
  const gaps = [];
  let entries = 0;
  let stopped = false;
  function walk(directory, depth) {
    if (stopped) return;
    if (depth > maxDepth) { gaps.push('depth-limit'); return; }
    let children;
    try { children = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => Number(configNames.has(b.name) || b.name.endsWith('.ioc')) - Number(configNames.has(a.name) || a.name.endsWith('.ioc')) || a.name.localeCompare(b.name)); }
    catch { gaps.push('unreadable-directory'); return; }
    for (const item of children) {
      if (++entries > maxEntries) { gaps.push('entry-limit'); stopped = true; return; }
      if (item.isSymbolicLink()) { gaps.push('symlink-skipped'); continue; }
      const file = path.join(directory, item.name);
      if (item.isDirectory()) {
        if (!item.name.startsWith('.') && !ignored.has(item.name.toLowerCase())) walk(file, depth + 1);
      } else if (item.isFile() && (sourceOnly ? codeExts.has(path.extname(item.name).toLowerCase()) : evidenceExts.has(path.extname(item.name).toLowerCase()) || configNames.has(item.name))) {
        if (files.length >= maxFiles) { gaps.push('file-limit'); stopped = true; return; }
        files.push(file);
      }
      if (stopped) return;
    }
  }
  walk(scope, 0);
  return { files, gaps: [...new Set(gaps)], entries };
}

export function readBounded(file, maxBytes = 131072) {
  if (fs.statSync(file).size > maxBytes) return null;
  const bytes = fs.readFileSync(file);
  return bytes.includes(0) ? null : bytes.toString('utf8');
}

function projectDeclaration(selected, relative) {
  const contextFiles = [];
  const issues = [];
  let declaration = null;
  let profileFound = false;
  for (const directory of selected.directories) {
    for (const name of ['AGENTS.md', 'EMBEDDED.md', 'embedded-profile.json']) {
      const file = path.join(directory, name);
      if (!fs.existsSync(file) || !fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) continue;
      contextFiles.push(relative(file));
      if (name !== 'embedded-profile.json' || profileFound) continue;
      profileFound = true;
      try {
        const config = readProfile(file);
        const components = config.components.map(component => {
          const proposed = path.resolve(directory, component.path);
          if (!inside(selected.root, proposed)) throw new Error('Component escapes project root');
          const componentRoot = fs.existsSync(proposed) ? fs.realpathSync(proposed) : proposed;
          if (!inside(selected.root, componentRoot)) throw new Error('Component symlink escapes project root');
          return { ...component, absolutePath: componentRoot, evidenceFile: relative(file) };
        });
        declaration = components.filter(component => inside(component.absolutePath, selected.selected)).sort((a, b) => b.absolutePath.length - a.absolutePath.length)[0] ?? null;
      } catch (error) { issues.push({ code: 'INVALID_PROJECT_PROFILE', file: relative(file), message: error.message }); }
    }
  }
  return { contextFiles, issues, declaration };
}

function evidenceFiles(selected, declaration) {
  const listing = listFiles(selected.scanScope);
  const gaps = [...listing.gaps];
  const files = new Set(listing.files);
  for (const directory of selected.directories) {
    // A declared component establishes its own boundary. Parent AGENTS still
    // apply, but parent device declarations must not leak into host components.
    if (declaration && !inside(declaration.absolutePath, directory)) continue;
    for (const name of namesAt(directory)) {
      if (!configNames.has(name) && !name.endsWith('.ioc')) continue;
      const file = path.join(directory, name);
      if (fs.lstatSync(file).isFile() && !fs.lstatSync(file).isSymbolicLink()) files.add(file);
    }
  }
  return { files, gaps };
}

function compilationDefinitions(raw, file, selected) {
  const definitions = [];
  const commands = JSON.parse(raw);
  if (!Array.isArray(commands)) throw new Error('Expected compilation database array');
  for (const command of commands) {
    if (typeof command.file !== 'string') continue;
    const compiledFile = path.resolve(command.directory ?? path.dirname(file), command.file);
    if (!inside(selected.root, compiledFile) || (selected.target ? compiledFile !== selected.target : !inside(selected.scanScope, compiledFile))) continue;
    const args = command.arguments ?? (typeof command.command === 'string' ? command.command.split(/\s+/) : []);
    if (!Array.isArray(args)) continue;
    const defines = args.flatMap((arg, index) => typeof arg === 'string' && /^(?:-D|\/D).+/.test(arg) ? [arg.slice(2)] : arg === '-D' && typeof args[index + 1] === 'string' ? [args[index + 1]] : []);
    definitions.push(...defines);
  }
  return definitions.join('\n');
}

function summarizeIdentity(evidence) {
  const candidates = new Map();
  for (const row of evidence) {
    const candidate = candidates.get(row.family) ?? { id: row.family, reference: row.reference, parts: [], evidence: [] };
    if (!candidate.parts.includes(row.part)) candidate.parts.push(row.part);
    if (candidate.evidence.length < 12) candidate.evidence.push({ file: row.file, token: row.part, line: row.line, kind: row.kind, rank: row.rank });
    candidates.set(row.family, candidate);
  }
  // A compilation database can repeat one part for every translation unit.
  const strongest = [...new Map(evidence.filter(row => row.rank >= 70).map(row => [row.part, row])).values()];
  const identityConflicts = [];
  for (let index = 0; index < strongest.length; ++index) {
    const left = strongest[index];
    const right = strongest.slice(index + 1).find(row => !compatibleParts(left.part, row.part));
    if (right) { identityConflicts.push({ code: 'TARGET_IDENTITY_CONFLICT', parts: [left.part, right.part], files: [left.file, right.file] }); break; }
  }
  return { candidates: [...candidates.values()], identityConflicts };
}

export function inspectProject(rootValue, target, options) {
  const selected = resolveScope(rootValue, target, options);
  const relative = file => path.relative(selected.root, file).replaceAll(path.sep, '/') || '.';
  const { contextFiles, issues, declaration } = projectDeclaration(selected, relative);
  const { files, gaps } = evidenceFiles(selected, declaration);
  const evidence = [];
  const profiles = new Set(declaration ? [declaration.profile] : []);
  let embeddedMarker = declaration?.profile === 'mcu-rtos' || declaration?.profile === 'linux-kernel';
  const addEvidence = (text, file, kind, rank) => {
    for (const hit of identifyParts(text)) {
      const row = { ...hit, file, line: text.slice(0, hit.index).split('\n').length, kind, rank };
      delete row.index;
      evidence.push(row);
    }
  };
  if (declaration?.part) addEvidence(declaration.part, declaration.evidenceFile, 'declared-profile', 100);

  for (const file of files) {
    let raw;
    try { raw = readBounded(file, path.basename(file) === 'compile_commands.json' ? 1048576 : 131072); }
    catch { gaps.push('unreadable-file'); continue; }
    if (raw === null) { gaps.push('oversize-or-binary-file'); continue; }
    const name = path.basename(file);
    if (name === 'compile_commands.json') {
      try {
        addEvidence(compilationDefinitions(raw, file, selected), relative(file), 'compile-definition', 95);
      } catch { gaps.push('invalid-compilation-database'); }
      continue;
    }
    if (name === 'EMBEDDED.md') { if (!declaration) embeddedMarker = true; continue; }
    const isCode = codeExts.has(path.extname(file).toLowerCase());
    const isConfig = configNames.has(name) || name.endsWith('.ioc');
    const text = stripComments(raw, !isCode && !/\.(?:uvprojx|ewp)$/.test(file));
    const rank = name.endsWith('.ioc') || name === 'sdkconfig' ? 90 : isConfig || /\.(?:uvprojx|ewp)$/.test(file) ? 70 : 30;
    addEvidence(text, relative(file), rank >= 70 ? 'build-configuration' : 'source-clue', rank);
    if (!declaration && /#\s*include\s*<linux\/(?:module|platform_device|dma-mapping|iio\/iio)\.h>|obj-\$\(CONFIG_/m.test(text)) { profiles.add('linux-kernel'); embeddedMarker = true; }
    if (!declaration && (/\b(?:FreeRTOS|configMAX_SYSCALL_INTERRUPT_PRIORITY|idf_component_register|CONFIG_ZEPHYR|pico_sdk_init|FSP_VERSION)\b|CONFIG_SOC_/m.test(text) || name.endsWith('.ioc'))) { profiles.add('mcu-rtos'); embeddedMarker = true; }
    if (!declaration && /#\s*include\s*<(?:pthread|unistd|sys\/epoll|poll)\.h>/m.test(text)) profiles.add('linux-user');
  }

  const { candidates, identityConflicts } = summarizeIdentity(evidence);
  if (!declaration && evidence.length && !profiles.has('linux-kernel') && !profiles.has('linux-user')) profiles.add('mcu-rtos');
  if ([...files].some(file => /\.(?:cpp|hpp|cc|cxx)$/i.test(file))) profiles.add('cpp-overlay');
  const isEmbedded = declaration ? ['mcu-rtos', 'linux-kernel'].includes(declaration.profile) : embeddedMarker || (evidence.length > 0 && !profiles.has('linux-user'));
  return {
    schemaVersion: 2, root: selected.root, scope: relative(declaration?.absolutePath ?? selected.scope), scanScope: relative(selected.scanScope),
    embeddedEvidenceFound: isEmbedded, profiles: [...profiles], candidates, identityConflicts, issues, contextFiles,
    declaredComponent: declaration ? Object.fromEntries(Object.entries(declaration).filter(([key]) => key !== 'absolutePath')) : null,
    hasCompilationDatabase: [...files].some(file => path.basename(file) === 'compile_commands.json'),
    scannedFiles: files.size, gaps: [...new Set(gaps)], confirmation: 'CANDIDATES_ONLY_NOT_HARDWARE_VERIFIED',
    requiredEvidence: profiles.has('mcu-rtos') ? ['exact-part-and-package', 'silicon-revision-and-errata-when-relevant', 'sdk-toolchain-abi', 'task-specific-memory-irq-contract'] : [],
    directives: ['Apply only task-relevant references and checks; reuse established internal contracts.', 'Configuration/source matches are evidence, not hardware confirmation; build expressions are not evaluated.', 'Ask about optional costly protection mechanisms before adding them; necessary boundary correctness stays in scope.']
  };
}

export function printError(error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
