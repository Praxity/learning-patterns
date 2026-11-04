import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { CAP_MESSAGES, noticeConfig } from '../lib/data-notice.js';
import { readMeta } from '../scripts/pattern-meta.mjs';

function check(value, source) {
  assert.doesNotMatch(JSON.stringify(value), /\p{L}'\p{L}/u, source);
}

test('the French apostrophe guard rejects a straight apostrophe between letters', () => {
  assert.throws(() => check({ text: "l'exemple" }, 'planted violation'));
  check({ text: 'l’exemple' }, 'typographic apostrophe');
});

test('French catalogues, examples and shared notices use typographic apostrophes', async () => {
  for (const entry of await readdir(new URL('../patterns/', import.meta.url), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const { strings } = await import(`../patterns/${entry.name}/strings.js`);
    check(strings.fr, `${entry.name}/strings.js`);
    check(readMeta(entry.name, await readFile(new URL(`../patterns/${entry.name}/README.md`, import.meta.url), 'utf8')).title.fr, `${entry.name}/README.md title_fr`);
    const examples = new URL(`../patterns/${entry.name}/examples/`, import.meta.url);
    for (const file of await readdir(examples)) {
      if (/^fr.*\.json$/.test(file)) check(JSON.parse(await readFile(new URL(file, examples), 'utf8')), `${entry.name}/examples/${file}`);
    }
  }
  // The offline demo notices are literals inside the build script.
  const demo = await readFile(new URL('../scripts/build-demo.mjs', import.meta.url), 'utf8');
  for (const [, fr] of demo.matchAll(/fr: "([^"]*)"/g)) check(fr, 'scripts/build-demo.mjs');
  for (const [reason, messages] of Object.entries(CAP_MESSAGES)) check(messages.fr, `CAP_MESSAGES.${reason}`);
  for (const provider of ['perplexity', 'clef', 'jev']) {
    for (const [key, value] of Object.entries(noticeConfig(provider))) {
      if (typeof value === 'object') check(value.fr, `${provider}.${key}`);
    }
  }
});
