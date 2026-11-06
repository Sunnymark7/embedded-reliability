import fs from 'node:fs';
import path from 'node:path';
import { inspectProject, parseArgs, printError, skillRoot } from './lib/project.mjs';

try {
  const args = parseArgs(process.argv.slice(2), { values: ['root', 'target'] });
  if (args.positionals.length) throw new Error('Usage: doctor.mjs [--root directory] [--target path]');
  const context = inspectProject(args.root, args.target);
  const metadata = fs.readFileSync(path.join(skillRoot, 'agents/openai.yaml'), 'utf8');
  const hookFile = path.join(context.root, '.codex/hooks.json');
  const findings = [];
  if (!/allow_implicit_invocation:\s*true/.test(metadata)) findings.push('IMPLICIT_INVOCATION_NOT_EXPLICITLY_ENABLED');
  if (!context.candidates.length) findings.push('MCU_IDENTITY_NOT_DISCOVERED');
  if (context.candidates.length > 1) findings.push('MULTIPLE_FAMILIES_VERIFY_COMPONENT_SCOPE');
  if (!context.contextFiles.some(file => /(?:EMBEDDED\.md|embedded-profile\.json)$/.test(file))) findings.push('NO_DURABLE_HARDWARE_CONTRACT_USE_EXISTING_EVIDENCE');
  if (!fs.existsSync(hookFile)) findings.push('NO_PROJECT_HOOK_MANIFEST_USER_HOOK_OR_MANUAL_CHECK_MAY_APPLY');
  findings.push('HOOK_TRUST_AND_LIVE_EXECUTION_CANNOT_BE_PROVEN_BY_FILE_PRESENCE');
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, mode: 'READ_ONLY', findings, context }, null, 2)}\n`);
} catch (error) { printError(error); }
