import { readFileSync, writeFileSync } from 'node:fs';

const names = ['check', 'x', 'question-mark', 'circle-dashed', 'refresh', 'arrow-back-up', 'alert-circle', 'mail', 'list-check', 'calendar', 'pencil', 'notebook', 'book', 'brain', 'history', 'target', 'circle-plus', 'circle-check', 'circle-x', 'info-circle', 'arrow-right', 'player-skip-forward', 'list-details', 'file-text', 'help-circle', 'presentation', 'arrows-shuffle', 'bulb'];
const dir = new URL('../node_modules/@tabler/icons/icons/outline/', import.meta.url);
const icons = Object.fromEntries(names.map(name => {
  const svg = readFileSync(new URL(`${name}.svg`, dir), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/class="[^"]*"/, 'class="lp-icon" aria-hidden="true" focusable="false"')
    .replace(/width="24" height="24"/, 'width="20" height="20"');
  return [name, svg];
}));

writeFileSync(new URL('../lib/icons.js', import.meta.url), `/** @type {Record<${names.map(n => `'${n}'`).join(' | ')}, string>} */
export const icons = ${JSON.stringify(icons, null, 2)};
`);
console.log(`wrote ${names.length} icons`);

for (const [pattern, keys] of Object.entries({
  'course-lookup': ['help-circle', 'x'],
  'conversation': ['alert-circle', 'refresh'],
  'write-distractors': ['check', 'pencil', 'refresh', 'alert-circle']
})) {
  writeFileSync(new URL(`../lib/${pattern}-icons.js`, import.meta.url), `export const icons = ${JSON.stringify(Object.fromEntries(keys.map(key => [key, icons[key]])), null, 2)};
`);
}
