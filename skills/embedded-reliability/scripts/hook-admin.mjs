import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, printError, skillRoot } from './lib/project.mjs';

const owner = 'embedded-reliability:';
const owned = entry => Array.isArray(entry?.hooks) && entry.hooks.some(hook => hook?.statusMessage?.startsWith(owner));

export function mergeHooks(manifest, mode, command) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Hook manifest must be an object');
  if (manifest.hooks !== undefined && (!manifest.hooks || typeof manifest.hooks !== 'object' || Array.isArray(manifest.hooks))) throw new Error('Invalid hooks map');
  const result = structuredClone(manifest);
  result.hooks ??= {};
  for (const eventName of ['UserPromptSubmit', 'PostToolUse']) {
    const existing = result.hooks[eventName] ?? [];
    if (!Array.isArray(existing)) throw new Error(`Invalid event list: ${eventName}`);
    /* Keep foreign handlers even if they share a matcher group with ours. */
    const preserved = existing.flatMap(entry => {
      if (!owned(entry)) return [entry];
      const hooks = entry.hooks.filter(hook => !hook?.statusMessage?.startsWith(owner));
      return hooks.length ? [{ ...entry, hooks }] : [];
    });
    if (mode === 'on') preserved.push({
      ...(eventName === 'PostToolUse' ? { matcher: '^(apply_patch|Edit|Write)$' } : {}),
      hooks: [{ type: 'command', command, timeout: 10, statusMessage: `${owner} ${eventName === 'UserPromptSubmit' ? 'routing embedded task' : 'reviewing edited firmware'}` }]
    });
    if (preserved.length) result.hooks[eventName] = preserved;
    else delete result.hooks[eventName];
  }
  return result;
}

export function manageHooks({ action, root = process.cwd(), user = false }) {
  if (!['on', 'off', 'status'].includes(action)) throw new Error('Usage: hook-admin.mjs on|off|status [--root directory] [--user]');
  const base = user ? (process.env.CODEX_HOME || path.join(os.homedir(), '.codex')) : path.join(fs.realpathSync(root), '.codex');
  const manifestPath = path.join(base, 'hooks.json');
  const hookScript = path.join(skillRoot, 'scripts/hook.mjs');
  const nodeBinary = process.execPath;
  for (const value of [manifestPath, hookScript, nodeBinary]) {
    /* These are local resolved paths, never shell-interpolate arbitrary text. */
    if (/["\r\n$`%&|<>!]/.test(value)) throw new Error('Path cannot be represented safely in a cross-shell hook command');
  }
  let manifest = {};
  if (fs.existsSync(manifestPath)) {
    if (fs.lstatSync(manifestPath).isSymbolicLink()) throw new Error('Refusing to mutate symlinked hook manifest');
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }
  const command = `"${nodeBinary}" "${hookScript}"`;
  if (action === 'status') {
    return { action, scope: user ? 'user' : 'project', path: manifestPath, registered: Object.entries(manifest.hooks ?? {}).filter(([, entries]) => Array.isArray(entries) && entries.some(owned)).map(([event]) => event), trust: 'NOT_CHECKED_USE_CODEX_HOOK_REVIEW', scriptExists: fs.existsSync(hookScript) };
  }
  if (fs.existsSync(base) && fs.lstatSync(base).isSymbolicLink()) throw new Error('Refusing symlinked config directory');
  const next = mergeHooks(manifest, action, command);
  if (JSON.stringify(next) === JSON.stringify(manifest)) return { action, changed: false, path: manifestPath };
  fs.mkdirSync(base, { recursive: true });
  let backup = null;
  if (fs.existsSync(manifestPath)) {
    backup = `${manifestPath}.embedded-backup-${Date.now()}-${process.pid}`;
    fs.copyFileSync(manifestPath, backup, fs.constants.COPYFILE_EXCL);
  }
  const temporary = `${manifestPath}.embedded-${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, manifestPath);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  return { action, changed: true, path: manifestPath, backup, trust: action === 'on' ? 'REVIEW_REQUIRED_IN_CODEX_SETTINGS_HOOKS_OR_CLI_HOOKS' : 'NO_TRUST_CHANGED', coverage: 'Prompt routing and direct Edit/Write/apply_patch feedback only; Bash/MCP edits require manual detect.' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2), { values: ['root'], flags: ['user'] });
    if (args.positionals.length !== 1) throw new Error('Expected on, off, or status');
    if (args.user && args.root) throw new Error('--root and --user are mutually exclusive');
    process.stdout.write(`${JSON.stringify(manageHooks({ action: args.positionals[0], root: args.root, user: args.user }), null, 2)}\n`);
  } catch (error) { printError(error); }
}
