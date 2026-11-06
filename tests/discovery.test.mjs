import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectProject, inside } from '../skills/embedded-reliability/scripts/lib/project.mjs';
import { relevantPrompt, handleHook } from '../skills/embedded-reliability/scripts/hook.mjs';
import { validateProfile } from '../skills/embedded-reliability/scripts/lib/profile.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function fixture(t) {
  const temporaryBase = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(temporaryBase, 'embedded-discovery-'));
  t.after(() => {
    const resolved = fs.realpathSync(root);
    assert(inside(temporaryBase, resolved) && path.basename(resolved).startsWith('embedded-discovery-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return root;
}
function put(root, file, text) {
  const absolute = path.join(root, file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, typeof text === 'string' ? text : JSON.stringify(text));
}

test('commented historical MCU names do not select a family', t => {
  const root = fixture(t);
  put(root, 'main.c', '// replaced STM32F407 code\n/* ESP32-S3 */\nint f(void){return 0;}');
  put(root, 'CMakeLists.txt', '# old NRF52840 target\nproject(host)');
  put(root, 'project.uvprojx', '<project><!-- historical STM32H743VIT6 --></project>');
  const report = inspectProject(root);
  assert.equal(report.candidates.length, 0);
  assert.equal(report.embeddedEvidenceFound, false);
});

test('same-family different configured parts remain distinct and conflict', t => {
  const root = fixture(t);
  put(root, 'a.ioc', 'Mcu.CPN=STM32H743VIT6');
  put(root, 'b.ioc', 'Mcu.CPN=STM32F407VGT6');
  const report = inspectProject(root);
  assert.deepEqual(new Set(report.candidates[0].parts), new Set(['STM32H743VIT6', 'STM32F407VGT6']));
  assert.equal(report.identityConflicts.length, 1);
  assert(report.candidates[0].evidence.every(item => item.rank === 90));
});

test('a generic device macro can agree with the configured full part', t => {
  const root = fixture(t);
  put(root, 'board.ioc', 'Mcu.CPN=STM32H743VIT6');
  put(root, 'CMakeLists.txt', 'add_compile_definitions(STM32H743xx)');
  assert.equal(inspectProject(root).identityConflicts.length, 0);
});

test('CLI launched under src discovers parent repository and metadata', t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, '.git'));
  put(root, 'fw/CMakeLists.txt', 'add_compile_definitions(STM32H743xx)');
  put(root, 'fw/EMBEDDED.md', 'Project facts');
  put(root, 'fw/src/main.c', 'int f(void){return 0;}');
  const cli = spawnSync(process.execPath, [path.join(repo, 'skills/embedded-reliability/scripts/context.mjs')], { cwd: path.join(root, 'fw/src'), encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  const report = JSON.parse(cli.stdout);
  assert.equal(report.root, fs.realpathSync(root));
  assert.equal(report.scope, 'fw');
  assert(report.contextFiles.includes('fw/EMBEDDED.md'));
  assert.equal(report.candidates[0].id, 'stm32');
});

test('post-edit hook does not borrow a sibling firmware identity', t => {
  const root = fixture(t);
  put(root, 'CMakeLists.txt', 'project(mixed)');
  put(root, 'firmware/sdkconfig', 'CONFIG_IDF_TARGET="esp32s3"');
  put(root, 'host/helper.c', 'strcpy(dst, src);');
  const response = handleHook({ cwd: root, hook_event_name: 'PostToolUse', tool_input: { file_path: 'host/helper.c' } });
  assert.equal(response, null);
});

test('JSON component declarations are parsed and matched by path specificity', t => {
  const root = fixture(t);
  put(root, 'embedded-profile.json', { schemaVersion: 1, components: [
    { path: '.', profile: 'mcu-rtos', part: 'STM32H743VIT6' },
    { path: 'tools', profile: 'linux-user' }
  ] });
  put(root, 'src/main.c', 'int f(void){return 0;}');
  put(root, 'tools/helper.c', 'strcpy(dst, src);');
  const firmware = inspectProject(root, 'src/main.c');
  assert.equal(firmware.candidates[0].evidence[0].kind, 'declared-profile');
  assert.equal(firmware.declaredComponent.part, 'STM32H743VIT6');
  const host = inspectProject(root, 'tools/helper.c');
  assert.equal(host.embeddedEvidenceFound, false);
  assert.deepEqual(host.profiles, ['linux-user']);
  assert.equal(handleHook({ cwd: root, hook_event_name: 'PostToolUse', tool_input: { file_path: 'tools/helper.c' } }), null);
});

test('declared part disagrees with hardware project file without silently winning', t => {
  const root = fixture(t);
  put(root, 'embedded-profile.json', { schemaVersion: 1, components: [{ path: '.', profile: 'mcu-rtos', part: 'STM32H743VIT6' }] });
  put(root, 'board.ioc', 'Mcu.CPN=STM32F407VGT6');
  assert.equal(inspectProject(root).identityConflicts.length, 1);
});

test('invalid, misspelled and escaping declarations are explicit issues', t => {
  const root = fixture(t);
  put(root, 'embedded-profile.json', { schemaVersion: 1, components: [{ path: '.', profile: 'mcu-rtos', mcu: 'STM32H743' }] });
  assert.equal(inspectProject(root).issues[0].code, 'INVALID_PROJECT_PROFILE');
  put(root, 'embedded-profile.json', { schemaVersion: 1, components: [{ path: '../escape', profile: 'mcu-rtos' }] });
  assert.equal(inspectProject(root).issues[0].code, 'INVALID_PROJECT_PROFILE');
  assert.throws(() => validateProfile({ schemaVersion: 1, components: [{ path: '.', profile: 'mcu-rtos' }, { path: './', profile: 'linux-user' }] }), /Duplicate/);
});

test('compilation definitions are selected for the requested translation unit', t => {
  const root = fixture(t);
  put(root, 'src/a.c', 'int f(void){return 0;}');
  put(root, 'src/b.c', 'int g(void){return 0;}');
  put(root, 'compile_commands.json', [
    { directory: root, file: 'src/a.c', arguments: ['cc', '-DSTM32H743xx', '-c', 'src/a.c'] },
    { directory: root, file: 'src/b.c', arguments: ['cc', '-D', 'NRF52840_XXAA', '-c', 'src/b.c'] }
  ]);
  const report = inspectProject(root, 'src/a.c');
  assert.deepEqual(report.candidates.map(item => item.id), ['stm32']);
  assert.equal(report.candidates[0].evidence[0].kind, 'compile-definition');
  assert.equal(inspectProject(root, 'src').candidates.length, 2);
});

test('large nonembedded edits stay silent even when feedback path limit is reached', t => {
  const root = fixture(t);
  const files = [];
  for (let index = 0; index < 13; ++index) {
    const file = `host/file${index}.c`;
    files.push(file);
    put(root, file, 'strcpy(dst, src);');
  }
  const patch = `*** Begin Patch\n${files.map(file => `*** Update File: ${file}\n+x`).join('\n')}\n*** End Patch`;
  assert.equal(handleHook({ cwd: root, hook_event_name: 'PostToolUse', tool_input: { input: patch } }), null);
});

test('post-edit feedback reports its finding truncation', t => {
  const root = fixture(t);
  put(root, 'sdkconfig', 'CONFIG_IDF_TARGET="esp32s3"');
  put(root, 'main.c', 'strcpy(dst,src);\n'.repeat(20));
  const result = handleHook({ cwd: root, hook_event_name: 'PostToolUse', tool_input: { file_path: 'main.c' } });
  assert(result.hookSpecificOutput.additionalContext.includes('feedback-finding-limit'));
});

test('targeted discovery skips unrelated product source trees', t => {
  const root = fixture(t);
  put(root, 'CMakeLists.txt', 'project(mixed)');
  put(root, 'fw/board.ioc', 'Mcu.CPN=STM32H743VIT6');
  put(root, 'fw/src/main.c', 'int f(void){return 0;}');
  for (let index = 0; index < 100; ++index) put(root, `other/file${index}.c`, 'int unrelated;');
  const report = inspectProject(root, 'fw/src/main.c');
  assert(report.scannedFiles < 6);
  assert.equal(report.gaps.length, 0);
});

test('family route data also drives MCX, RA and other prompt recognition', () => {
  for (const prompt of ['Implement NXP MCXN947 DMA firmware driver', 'Implement RA6M5 DMA driver', '修复ATSAMD51的SPI驱动', 'Implement CH32V307 interrupt handler']) assert(relevantPrompt(prompt), prompt);
  for (const prompt of ['MCXN947 芯片选型对比', '为RA6M5设计网页dashboard']) assert.equal(relevantPrompt(prompt), false, prompt);
});

test('doctor does not require MCU identity for declared Linux work', t => {
  const root = fixture(t);
  put(root, 'embedded-profile.json', { schemaVersion: 1, components: [{ path: '.', profile: 'linux-user' }] });
  const child = spawnSync(process.execPath, [path.join(repo, 'skills/embedded-reliability/scripts/doctor.mjs'), '--root', root], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert(!JSON.parse(child.stdout).findings.includes('MCU_IDENTITY_NOT_DISCOVERED'));
});
