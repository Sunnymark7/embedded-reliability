import fs from 'node:fs';

export const familyData = JSON.parse(fs.readFileSync(new URL('../data/families.json', import.meta.url), 'utf8'));
const patterns = familyData.families.map(family => ({ ...family, regex: new RegExp(family.pattern.replace(/^\\b/, '(?<![A-Z0-9])'), 'gi') }));

export function identifyParts(text) {
  const hits = [];
  for (const family of patterns) {
    family.regex.lastIndex = 0;
    for (const hit of text.matchAll(family.regex)) {
      hits.push({ family: family.id, reference: family.reference, part: hit[0].toUpperCase(), index: hit.index });
    }
  }
  return hits;
}

/* Keep literals: IDF targets and include filenames are useful evidence. */
export function stripComments(text, hashComments = false) {
  const clean = text.replace(/<!--[\s\S]*?-->|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,
    token => token.startsWith('/') || token.startsWith('<!--') ? token.replace(/[^\r\n]/g, ' ') : token);
  return hashComments ? clean.replace(/#[^\r\n]*/g, token => token.replace(/./g, ' ')) : clean;
}

export function compatibleParts(left, right) {
  const normalize = part => part.replace(/^(?:CONFIG_SOC_|CPU_)/, '').replace(/_CPU(?:APP|NET).*$/, '').replace(/[-_]/g, '').replace(/X+$/g, '');
  const a = normalize(left.toUpperCase());
  const b = normalize(right.toUpperCase());
  return a.startsWith(b) || b.startsWith(a);
}

export function relevantPrompt(prompt) {
  if (typeof prompt !== 'string') return false;
  if (/\$embedded-reliability\b/.test(prompt)) return true;
  const family = identifyParts(prompt).length > 0;
  const identity = family || /\b(?:STM32|ESP32|NXP|nRF|TI|Microchip|Renesas|MCU|FreeRTOS|Zephyr|AVR|i[.]?MX\s*RT)\b|嵌入式|单片机|固件/i.test(prompt);
  const task = /固件|驱动|中断|寄存器|移植|烧录|采样|缓存一致|单片机|RTOS|\b(?:DMA|ISR|ADC|DAC|UART|I[2²]C|SPI|CAN|firmware|driver|interrupt|bare[- ]metal|porting)\b/i.test(prompt);
  const uiOnly = /网页|前端|Web\s*UI|dashboard/i.test(prompt) && !/固件|驱动|中断|寄存器|移植|\b(?:firmware|ISR|DMA)\b/i.test(prompt);
  return identity && task && !uiOnly;
}
