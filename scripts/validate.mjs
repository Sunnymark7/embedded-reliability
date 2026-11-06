import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skill = path.join(root, 'skills/embedded-reliability');
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (entry.isFile()) files.push(file);
    else throw new Error(`Unexpected link/special file: ${file}`);
  }
}
walk(skill);
const decoder = new TextDecoder('utf-8', { fatal: true });
const texts = new Map(files.map(file => [file, decoder.decode(fs.readFileSync(file))]));
for (const [file, text] of texts) {
  assert(!text.includes('\u0000') && !text.includes('\ufffd'), `Encoding: ${file}`);
  assert(!text.includes('[TODO:'), `Unfinished scaffold: ${file}`);
}
const entry = texts.get(path.join(skill, 'SKILL.md'));
const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(entry)?.[1];
assert(frontmatter, 'Missing frontmatter');
assert(/^name: embedded-reliability$/m.test(frontmatter));
assert(/^description: .+/m.test(frontmatter));
const metadata = texts.get(path.join(skill, 'agents/openai.yaml'));
assert(/policy:\s*\n\s+allow_implicit_invocation: true/.test(metadata));
assert(metadata.includes('$embedded-reliability'));

let localLinks = 0;
const urls = new Set();
const edges = new Map();
for (const [file, text] of texts) {
  if (!file.endsWith('.md')) continue;
  const linked = [];
  for (const [, destination] of text.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^https?:\/\//.test(destination)) { urls.add(destination); continue; }
    const [target, anchor] = destination.split('#');
    const resolved = target ? path.resolve(path.dirname(file), decodeURIComponent(target)) : file;
    const relative = path.relative(skill, resolved);
    assert(relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), `Link escapes skill: ${destination}`);
    assert(fs.existsSync(resolved), `Missing link ${destination} in ${file}`);
    if (anchor) assert(texts.get(resolved)?.includes(decodeURIComponent(anchor)), `Missing anchor ${destination}`);
    linked.push(resolved);
    ++localLinks;
  }
  edges.set(file, linked);
}
const reachable = new Set();
function traverse(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  for (const linked of edges.get(file) ?? []) traverse(linked);
}
traverse(path.join(skill, 'SKILL.md'));
for (const file of files.filter(file => file.includes(`${path.sep}references${path.sep}`) && file.endsWith('.md'))) {
  assert(reachable.has(file), `Unreachable reference: ${file}`);
}
const data = JSON.parse(texts.get(path.join(skill, 'scripts/data/families.json')));
assert.equal(data.schemaVersion, 1);
assert.equal(new Set(data.families.map(item => item.id)).size, data.families.length);
for (const family of data.families) {
  new RegExp(family.pattern, 'i');
  assert(texts.has(path.join(skill, family.reference)), `Missing family route: ${family.reference}`);
}
const definitions = [...texts.entries()].filter(([file]) => file.includes(`${path.sep}references${path.sep}`)).flatMap(([, text]) => [...text.matchAll(/`([A-Z]+-\d{2})`\s*(?:必须|建议|配置项)/g)].map(item => item[1]));
assert.equal(new Set(definitions).size, definitions.length, 'Duplicate rule definitions');
console.log(JSON.stringify({ status: 'PASS', skillFiles: files.length, references: files.filter(file => file.includes(`${path.sep}references${path.sep}`) && file.endsWith('.md')).length, familyRoutes: data.families.length, internalRules: definitions.length, localLinks, uniqueExternalURLs: urls.size }, null, 2));
