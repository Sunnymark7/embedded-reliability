import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectProject, skillRoot } from './lib/project.mjs';
import { scanFiles } from './detect.mjs';

export function relevantPrompt(prompt) {
  if (typeof prompt !== 'string') return false;
  if (/\$embedded-reliability\b/.test(prompt)) return true;
  const identity = /\b(?:STM32\w*|ESP32[-_\w]*|nRF\d+\w*|RP2040|RP2350|MSP430\w*|MSPM0\w*|C2000|C28x|GD32\w*|CH32\w*|MCU|FreeRTOS|Zephyr|i[.]?MX\s*RT\w*|LPC55\w*|AVR|PIC\d+\w*|dsPIC\w*|SAM[DE]\d+\w*)\b|嵌入式|单片机|固件/i.test(prompt);
  const task = /固件|驱动|中断|寄存器|移植|烧录|采样|缓存一致|单片机|RTOS|\b(?:DMA|ISR|ADC|DAC|UART|I2C|SPI|CAN|firmware|driver|interrupt|bare[- ]metal|porting)\b/i.test(prompt);
  const uiOnly = /网页|前端|Web\s*UI|dashboard/i.test(prompt) && !/固件|驱动|中断|寄存器|移植|\b(?:firmware|ISR|DMA)\b/i.test(prompt);
  return identity && task && !uiOnly;
}

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
    return feedback(name, `Embedded firmware/driver task detected. Use $embedded-reliability at ${skillFile}. Read its workflow and relevant MCU family before hardware-dependent edits. Confirm exact part/revision/SDK and memory/IRQ contracts; preserve user scope and read-only requests. No hardware validation is implied.`);
  }
  if (name !== 'PostToolUse') return null;
  const paths = editedPaths(event);
  if (!paths.length || typeof event.cwd !== 'string') return null;
  const context = inspectProject(event.cwd);
  if (!context.embeddedEvidenceFound) return null;
  const reports = [];
  for (const file of paths.slice(0, 12)) {
    try { reports.push(scanFiles(event.cwd, [file])); }
    catch { reports.push({ findings: [], gaps: ['edited-file-unavailable-or-outside-root'] }); }
  }
  const findings = reports.flatMap(report => report.findings).slice(0, 16);
  const gaps = [...new Set([...context.gaps, ...reports.flatMap(report => report.gaps), ...(paths.length > 12 ? ['edit-path-limit'] : [])])];
  if (!findings.length && !gaps.length) return null;
  const summary = findings.map(item => `${item.rule} ${item.file}:${item.line}: ${item.message}`).join('\n');
  return feedback(name, `Embedded reliability review leads after edit. Read ${skillFile} if not loaded.\n${summary}\n${gaps.length ? `Coverage gaps: ${gaps.join(', ')}. ` : ''}Review relevant evidence and repair confirmed issues within authorization; do not suppress a true defect or treat this lexical pass as compliance/hardware proof. A post-edit hook cannot undo the edit.`);
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
