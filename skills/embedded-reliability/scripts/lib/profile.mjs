import fs from 'node:fs';
import path from 'node:path';

export const profiles = new Set(['mcu-rtos', 'linux-kernel', 'linux-user', 'portable-core']);

/* Validate only the small declared contract. No commands, plugins or defaults
 * are executed. Null optional facts mean unknown, never a capability claim. */
export function validateProfile(value) {
  if (!value || Array.isArray(value) || value.schemaVersion !== 1 || !Array.isArray(value.components) || !value.components.length) throw new Error('Expected schemaVersion=1 and nonempty components');
  if (Object.keys(value).some(key => !['schemaVersion', 'components'].includes(key))) throw new Error('Unknown top-level profile field');
  const allowed = new Set(['path', 'profile', 'part', 'siliconRevision', 'sdk', 'toolchain', 'abi']);
  const paths = new Set();
  for (const component of value.components) {
    if (!component || typeof component !== 'object' || Array.isArray(component)) throw new Error('Component must be an object');
    if (Object.keys(component).some(key => !allowed.has(key))) throw new Error('Unknown component field');
    if (typeof component.path !== 'string' || !component.path || path.isAbsolute(component.path) || /^[A-Za-z]:/.test(component.path) || component.path.includes('\\')) throw new Error('Component path must be a relative slash-separated directory');
    if (!profiles.has(component.profile)) throw new Error('Unknown component profile');
    const normalized = path.normalize(component.path).replace(/[\\/]+$/, '') || '.';
    if (paths.has(normalized)) throw new Error('Duplicate component path');
    paths.add(normalized);
    for (const key of ['part', 'siliconRevision', 'sdk', 'toolchain', 'abi']) {
      if (component[key] !== undefined && component[key] !== null && (typeof component[key] !== 'string' || !component[key].trim())) throw new Error(`Invalid ${key}`);
    }
  }
  return value;
}

export function readProfile(file) {
  if (fs.lstatSync(file).isSymbolicLink() || fs.statSync(file).size > 65536) throw new Error('Profile must be a small regular local file');
  return validateProfile(JSON.parse(fs.readFileSync(file, 'utf8')));
}
