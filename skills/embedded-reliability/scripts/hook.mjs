import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectProject, resolveScope, skillRoot } from './lib/project.mjs';
import { scanFiles } from './detect.mjs';
import { relevantPrompt } from './lib/identity.mjs';
export { relevantPrompt } from './lib/identity.mjs';

export function editedPaths(event) {
  let input = event.tool_input;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { input = { input }; }
  }
  if (!input || typeof input !== 'object') return [];
  const paths = [];
  for (const key of ['file_path', 'filePath', 'path']) if (typeof input[key] === 'string') paths.push(input[key]);
  const patch = [input.input, input.patch, input.command].find(value => typeof value === 'string' && value.includes('*** Begin Patch'));
  if (patch) {
    for (const match of patch.matchAll(/^\*\*\* (?:Add File|Update File|Move to): (.+)$/gm)) paths.push(match[1].trim());
  }
  return [...new Set(paths)].filter(file => /\.(?:c|h|cpp|hpp|cc|cxx)$/i.test(file));
}

function feedback(eventName, text) {
  return { hookSpecificOutput: { hookEventName: eventName, additionalContext: text } };
}

export function handleHook(event) {
  const name = event.hook_event_name;
  const skillFile = path.join(skillRoot, 'SKILL.md');
  if (name === 'UserPromptSubmit') {
    if (!relevantPrompt(event.prompt)) return null;
    return feedback(name, `Embedded task: use $embedded-reliability at ${skillFile}. Load only task-relevant context and references. Preserve read-only scope; verify hardware facts needed for this change. Use the simplest correct implementation, reuse internal contracts, and ask before adding optional costly protection mechanisms. No hardware validation is implied.`);
  }
  if (name !== 'PostToolUse') return null;
  const paths = editedPaths(event);
  if (!paths.length || typeof event.cwd !== 'string') return null;
  const reports = [];
  const contexts = new Map();
  const contextGaps = [];
  let embeddedFiles = 0;
  for (const file of paths.slice(0, 12)) {
    try {
      const scope = resolveScope(event.cwd, file, { discover: true });
      const key = `${scope.root}|${scope.scanScope}`;
      let context = contexts.get(key);
      if (!context) {
        context = inspectProject(event.cwd, file, { discover: true });
        // Compilation records may choose different targets for adjacent files.
        if (!context.hasCompilationDatabase) contexts.set(key, context);
      }
      if (!context.embeddedEvidenceFound) continue;
      ++embeddedFiles;
      contextGaps.push(...context.gaps, ...context.issues.map(item => item.code), ...context.identityConflicts.map(item => item.code));
      reports.push(scanFiles(context.root, [path.resolve(event.cwd, file)]));
    }
    catch { reports.push({ findings: [], gaps: ['edited-file-unavailable-or-outside-root'] }); }
  }
  if (embeddedFiles === 0) return null;
  const allFindings = reports.flatMap(report => report.findings);
  const findings = allFindings.slice(0, 16);
  const gaps = [...new Set([...contextGaps, ...reports.flatMap(report => report.gaps), ...(paths.length > 12 ? ['edit-path-limit'] : []), ...(allFindings.length > 16 ? ['feedback-finding-limit'] : [])])];
  if (!findings.length && !gaps.length) return null;
  const summary = findings.map(item => `${item.rule} ${item.file}:${item.line}: ${item.message}`).join('\n');
  return feedback(name, `Embedded review leads; use ${skillFile} if needed.\n${summary}\n${gaps.length ? `Coverage gaps: ${gaps.join(', ')}. ` : ''}Verify the local contract before changing code: a review lead does not require redundant guards or a recovery framework. Repair confirmed defects within scope. Lexical feedback is not semantic/hardware proof and cannot undo edits.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let raw = '';
    for await (const chunk of process.stdin) {
      raw += chunk;
      if (Buffer.byteLength(raw) > 1048576) throw new Error('hook-input-limit');
    }
    const result = handleHook(JSON.parse(raw));
    if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch {
    /* Never reflect raw prompt, source, tool arguments or credentials. */
    process.stdout.write(`${JSON.stringify({ systemMessage: 'Embedded reliability hook could not inspect this event; use the manual context/detect workflow. No validation pass was recorded.' })}\n`);
  }
}
