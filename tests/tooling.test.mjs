import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { inspectProject, inside, listFiles } from '../skills/embedded-reliability/scripts/lib/project.mjs';
import { maskNonCode, scanFiles, scanText } from '../skills/embedded-reliability/scripts/detect.mjs';
import { editedPaths, handleHook, relevantPrompt } from '../skills/embedded-reliability/scripts/hook.mjs';
import { manageHooks, mergeHooks } from '../skills/embedded-reliability/scripts/hook-admin.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptRoot = path.join(repoRoot, 'skills/embedded-reliability/scripts');

function fixture(t) {
  const temporaryRoot = fs.realpathSync(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(temporaryRoot, 'embedded-reliability-test-'));
  t.after(() => {
    const resolved = fs.realpathSync(directory);
    assert(inside(temporaryRoot, resolved));
    assert(path.basename(resolved).startsWith('embedded-reliability-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return directory;
}

function put(root, relative, text) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
}

const familyFixtures = [
  ['stm32', 'target.ioc', 'Mcu.CPN=STM32H743VIT6'],
  ['stm32', 'CMakeLists.txt', 'add_compile_definitions(STM32U575xx)'],
  ['stm32', 'prj.conf', 'CONFIG_SOC_STM32H743XX=y'],
  ['espressif', 'sdkconfig', 'CONFIG_IDF_TARGET="esp32s3"'],
  ['espressif', 'sdkconfig', 'CONFIG_IDF_TARGET="esp32c61"'],
  ['nxp', 'CMakeLists.txt', 'set(MCU MIMXRT1062DVL6A)'],
  ['nxp', 'CMakeLists.txt', 'set(MCU LPC55S69)'],
  ['nxp', 'src/device.h', '#define CPU_MIMXRT1062DVL6A 1'],
  ['nordic', 'prj.conf', 'CONFIG_SOC_NRF5340_CPUAPP=y'],
  ['raspberry-pi', 'CMakeLists.txt', 'set(PICO_PLATFORM rp2350)'],
  ['ti', 'Makefile', 'DEVICE=TMS320F28379D'],
  ['ti', 'Makefile', 'DEVICE=MSPM0G3507'],
  ['microchip', 'Makefile', 'MCU=atmega328p'],
  ['microchip', 'Makefile', 'MCU=ATSAMD21G18A'],
  ['gd32-ch32', 'Makefile', 'MCU=GD32VF103VBT6'],
  ['gd32-ch32', 'Makefile', 'MCU=CH32V307VCT6'],
  ['renesas', 'src/device.h', '#define BSP_MCU_GROUP_RA6M5 1']
];
for (const [family, file, content] of familyFixtures) {
  test(`project discovery: ${content}`, t => {
    const root = fixture(t);
    put(root, file, content);
    const report = inspectProject(root);
    assert.equal(report.embeddedEvidenceFound, true);
    assert.deepEqual(report.candidates.map(item => item.id), [family]);
    assert.equal(report.confirmation, 'CANDIDATES_ONLY_NOT_HARDWARE_VERIFIED');
    assert(report.candidates[0].evidence[0].token.length > 0);
  });
}

test('unknown MCU keeps RTOS clue without choosing a nearby family', t => {
  const root = fixture(t);
  put(root, 'board.ioc', 'Mcu.CPN=STM32N657XX');
  const report = inspectProject(root);
  assert.equal(report.candidates.length, 0);
  assert(report.profiles.includes('mcu-rtos'));
});

test('web content does not become firmware evidence', t => {
  const root = fixture(t);
  put(root, 'index.html', '<h1>STM32H743 dashboard</h1>');
  assert.equal(inspectProject(root).embeddedEvidenceFound, false);
});

test('nearest target build component isolates mixed MCU families', t => {
  const root = fixture(t);
  put(root, 'CMakeLists.txt', 'project(mixed)');
  put(root, 'stm/CMakeLists.txt', 'add_compile_definitions(STM32F407xx)');
  put(root, 'stm/src/sensor.c', 'int sample(void) { return 0; }');
  put(root, 'esp/CMakeLists.txt', 'idf_component_register()');
  put(root, 'esp/sdkconfig', 'CONFIG_IDF_TARGET="esp32c3"');
  assert.equal(inspectProject(root).candidates.length, 2);
  const selected = inspectProject(root, 'stm/src/sensor.c');
  assert.deepEqual(selected.candidates.map(item => item.id), ['stm32']);
  assert.equal(selected.scope, 'stm');
});

test('Linux kernel and userspace are separate hints', t => {
  const root = fixture(t);
  put(root, 'kernel/driver.c', '#include <linux/module.h>');
  put(root, 'app/main.c', '#include <pthread.h>');
  const report = inspectProject(root);
  assert(report.profiles.includes('linux-kernel'));
  assert(report.profiles.includes('linux-user'));
  assert.equal(report.candidates.length, 0);
});

test('target escape and prefix sibling paths are refused', t => {
  const root = fixture(t);
  const other = fixture(t);
  put(other, 'unsafe.c', 'gets(buf);');
  assert.equal(inside(root, `${root}-other`), false);
  assert.throws(() => inspectProject(root, path.join(other, 'unsafe.c')), /escapes/);
  assert.throws(() => scanFiles(root, [path.join(other, 'unsafe.c')]), /escapes/);
});

test('explicit symlink escape is refused', t => {
  const root = fixture(t);
  const other = fixture(t);
  put(other, 'unsafe.c', 'gets(buf);');
  try { fs.symlinkSync(other, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (error.code === 'EPERM') { t.skip('Symlink creation unavailable'); return; } throw error; }
  assert.throws(() => scanFiles(root, ['linked/unsafe.c']), /escapes/);
  assert(listFiles(root).gaps.includes('symlink-skipped'));
});

test('scan limits are disclosed; vendor is not traversed', t => {
  const root = fixture(t);
  put(root, 'src/a.c', 'gets(buf);');
  put(root, 'src/b.c', 'gets(buf);');
  put(root, 'vendor/driver.c', 'gets(buf);');
  const limited = listFiles(root, { maxFiles: 1 });
  assert(limited.gaps.includes('file-limit'));
  put(root, 'src/large.c', 'x'.repeat(140000));
  const report = scanFiles(root);
  assert.equal(report.status, 'PARTIAL_SCAN');
  assert(report.gaps.includes('oversize-or-binary-file'));
  assert(!report.findings.some(item => item.file.startsWith('vendor/')));
});

test('detector excludes comments and literals, preserves real source line', () => {
  const source = '// gets(fake);\nconst char *s = "strcpy(fake)";\ngets(buf);\n';
  const report = scanText(source, 'test.c');
  assert.equal(maskNonCode(source).length, source.length);
  assert.deepEqual(report.findings.map(item => [item.rule, item.line]), [['DET-GETS', 3]]);
});

test('detector reports risk leads without asserting proof', () => {
  const report = scanText('strcpy(dst, src);\np = malloc(n * sizeof(*p));\nx = *(const uint32_t *)raw;\n#pragma pack(push, 1)', 'sample.c');
  assert.deepEqual(new Set(report.findings.map(item => item.rule)), new Set(['DET-UNBOUNDED-COPY', 'DET-ALLOCATION-SIZE', 'DET-TYPED-BYTE-LOAD', 'DET-PACKED']));
  assert(report.findings.every(item => item.severity === 'review'));
});

test('strict CLI differentiates error, review and missing target', t => {
  const root = fixture(t);
  put(root, 'bad.c', 'gets(buf);');
  put(root, 'review.c', 'strcpy(dst, src);');
  const run = target => spawnSync(process.execPath, [path.join(scriptRoot, 'detect.mjs'), '--root', root, '--strict', target], { encoding: 'utf8' });
  assert.equal(run('bad.c').status, 1);
  assert.equal(run('review.c').status, 0);
  assert.equal(run('missing.c').status, 2);
});

test('prompt routing: positives, negatives and no prompt reflection', () => {
  for (const prompt of ['实现STM32H743的ADC DMA驱动', 'Debug ESP32-S3 firmware ISR', '使用 $embedded-reliability audit']) assert(relevantPrompt(prompt), prompt);
  for (const prompt of ['修改发票网页布局', '为 ESP32 设备设计 Web UI dashboard', 'ESP32 芯片选型对比', 'review desktop C++ business logic']) assert.equal(relevantPrompt(prompt), false, prompt);
  const response = handleHook({ hook_event_name: 'UserPromptSubmit', prompt: '修复 ESP32 firmware，密码 SECRET-DO-NOT-ECHO' });
  assert.equal(response.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert(!JSON.stringify(response).includes('SECRET-DO-NOT-ECHO'));
  assert.equal(handleHook({ hook_event_name: 'UserPromptSubmit', prompt: 'hello' }), null);
});

test('patch and direct edit path extraction covers actual modified files', () => {
  const event = { tool_input: { input: '*** Begin Patch\n*** Update File: src/a.c\n+x\n*** Add File: include/b.h\n+y\n*** Delete File: old.c\n*** End Patch' } };
  assert.deepEqual(editedPaths(event), ['src/a.c', 'include/b.h']);
  assert.deepEqual(editedPaths({ tool_input: JSON.stringify({ file_path: 'src/c.cpp' }) }), ['src/c.cpp']);
  assert.deepEqual(editedPaths({ tool_input: { command: 'python change_sources.py' } }), []);
});

test('post edit feedback is scoped to embedded projects and detects a lead', t => {
  const root = fixture(t);
  put(root, 'src/main.c', 'strcpy(dst, src);');
  const event = { cwd: root, hook_event_name: 'PostToolUse', tool_input: { file_path: 'src/main.c' } };
  assert.equal(handleHook(event), null);
  put(root, 'sdkconfig', 'CONFIG_IDF_TARGET="esp32s3"');
  const response = handleHook(event);
  assert(response.hookSpecificOutput.additionalContext.includes('DET-UNBOUNDED-COPY'));
  assert(!response.hookSpecificOutput.additionalContext.includes('strcpy(dst'));
});

test('hook merge is idempotent and keeps foreign handlers in shared groups', () => {
  const foreign = { type: 'command', command: 'another-tool', statusMessage: 'foreign' };
  const manifest = { custom: 'keep', hooks: { Stop: [{ hooks: [foreign] }], PostToolUse: [{ matcher: 'Edit', hooks: [{ statusMessage: 'embedded-reliability: previous' }, foreign] }] } };
  const once = mergeHooks(manifest, 'on', 'node script');
  assert.deepEqual(mergeHooks(once, 'on', 'node script'), once);
  const off = mergeHooks(once, 'off', 'node script');
  assert.equal(off.custom, 'keep');
  assert.deepEqual(off.hooks.Stop, manifest.hooks.Stop);
  assert.deepEqual(off.hooks.PostToolUse, [{ matcher: 'Edit', hooks: [foreign] }]);
  assert(!off.hooks.UserPromptSubmit);
  assert.throws(() => mergeHooks({ hooks: { PostToolUse: {} } }, 'on', 'x'), /event list/);
});

test('hook admin project round trip backs up changes without touching trust', t => {
  // Fast Linux runs can toggle twice in one millisecond; backup names must
  // remain unique even if the wall clock has not advanced.
  t.mock.method(Date, 'now', () => 1793947892868);
  const root = fixture(t);
  const foreign = { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo existing' }] }] } };
  const manifest = put(root, '.codex/hooks.json', JSON.stringify(foreign));
  const first = manageHooks({ action: 'on', root });
  assert.equal(first.changed, true);
  assert(fs.existsSync(first.backup));
  assert.equal(manageHooks({ action: 'on', root }).changed, false);
  assert.deepEqual(manageHooks({ action: 'status', root }).registered.sort(), ['PostToolUse', 'UserPromptSubmit']);
  const disabled = manageHooks({ action: 'off', root });
  assert.notEqual(first.backup, disabled.backup);
  assert(fs.existsSync(disabled.backup));
  assert.deepEqual(JSON.parse(fs.readFileSync(manifest, 'utf8')), foreign);
  assert.deepEqual(fs.readdirSync(path.join(root, '.codex')).filter(name => /trust|config\.toml/.test(name)), []);
});

test('invalid hook payload gives a bounded manual fallback without reflecting input', () => {
  const child = spawnSync(process.execPath, [path.join(scriptRoot, 'hook.mjs')], { input: 'bad-json-PRIVATE', encoding: 'utf8' });
  assert.equal(child.status, 0);
  const result = JSON.parse(child.stdout);
  assert(result.systemMessage.includes('manual'));
  assert(!child.stdout.includes('PRIVATE'));
});
