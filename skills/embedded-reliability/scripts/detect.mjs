import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkedPath, listFiles, parseArgs, printError, readBounded } from './lib/project.mjs';

/* Preserve offsets/newlines while removing comments and literals. This is a
 * lexical hint pass, not a C parser, preprocessor or control-flow analysis. */
export function maskNonCode(text) {
  return text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g,
    value => value.replace(/[^\n\r]/g, ' '));
}

const rules = [
  { id: 'DET-GETS', severity: 'error', regex: /\bgets\s*\(/g, message: 'Unbounded gets() is prohibited; use a bounded input API and verify truncation.' },
  { id: 'DET-UNBOUNDED-COPY', severity: 'review', regex: /\b(?:strcpy|strcat|sprintf|vsprintf)\s*\(/g, message: 'Review destination capacity and source bounds; this API carries no destination size. This is a lead, not proof of overflow.' },
  { id: 'DET-ALLOCATION-SIZE', severity: 'review', regex: /\b(?:malloc|realloc)\s*\([^;\n]{0,100}\*\s*sizeof\b/g, message: 'Verify allocation multiplication was range-checked before evaluation; an earlier check may already satisfy this.' },
  { id: 'DET-TYPED-BYTE-LOAD', severity: 'review', regex: /\*\s*\(\s*\(?\s*(?:const\s+)?(?:uint(?:16|32|64)_t|u(?:16|32|64))\s*\*\s*\)/g, message: 'Review byte-buffer cast/load for alignment, aliasing, length and endianness; use explicit decode or an appropriate platform helper.' },
  { id: 'DET-PACKED', severity: 'review', regex: /#\s*pragma\s+pack\b|\b__attribute__\s*\(\(\s*packed\s*\)\)/g, message: 'Packed layout requires ABI/hardware evidence; review unaligned member addresses and explicit wire encoding.' }
];

export function scanText(text, file) {
  const masked = maskNonCode(text);
  const findings = [];
  for (const rule of rules) {
    rule.regex.lastIndex = 0;
    for (const match of masked.matchAll(rule.regex)) {
      if (findings.length >= 60) return { findings, truncated: true };
      findings.push({ rule: rule.id, severity: rule.severity, file, line: text.slice(0, match.index).split('\n').length, message: rule.message });
    }
  }
  return { findings, truncated: false };
}

export function scanFiles(rootValue, targets = []) {
  const root = fs.realpathSync(rootValue ?? process.cwd());
  const listing = targets.length ? { files: targets.map(target => checkedPath(root, target)), gaps: [] } : listFiles(root, { sourceOnly: true });
  const findings = [];
  const gaps = [...listing.gaps];
  let scanned = 0;
  for (const file of [...new Set(listing.files)]) {
    if (!/\.(?:c|h|cpp|hpp|cc|cxx)$/i.test(file)) continue;
    let text;
    try { text = readBounded(file); } catch { gaps.push('unreadable-file'); continue; }
    if (text === null) { gaps.push('oversize-or-binary-file'); continue; }
    const result = scanText(text, path.relative(root, file).replaceAll(path.sep, '/'));
    findings.push(...result.findings);
    if (result.truncated) gaps.push('finding-limit');
    ++scanned;
    if (findings.length >= 200) { findings.splice(200); gaps.push('total-finding-limit'); break; }
  }
  return { schemaVersion: 1, status: gaps.length ? 'PARTIAL_SCAN' : findings.length ? 'REVIEW_FINDINGS' : 'NO_PATTERN_MATCHES', scannedFiles: scanned, findings, gaps: [...new Set(gaps)], limitation: 'Lexical hints only; not MISRA, lifetime, DMA, race, hardware or preprocessor verification.' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2), { values: ['root'], flags: ['strict'] });
    const report = scanFiles(args.root, args.positionals);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.gaps.length) process.exitCode = 2;
    else if (args.strict && report.findings.some(item => item.severity === 'error')) process.exitCode = 1;
  } catch (error) { printError(error); }
}
