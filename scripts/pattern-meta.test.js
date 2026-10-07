import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { readMeta } from './pattern-meta.mjs';

const valid = `---
title: Check your own answer
title_fr: Vérifiez votre réponse
summary: Write an answer, tick the parts it includes, then compare.
section: question
ai: no
offline: yes
learners: not tried
---
# Check your own answer
`;

test('reads titles, summary, section and facets', () => {
  assert.deepEqual(readMeta('x', valid), {
    title: { en: 'Check your own answer', fr: 'Vérifiez votre réponse' },
    summary: 'Write an answer, tick the parts it includes, then compare.',
    section: 'question',
    ai: false,
    offline: true,
    learners: 'not tried'
  });
});

test('refuses missing front matter, missing keys, bad values and unknown keys', () => {
  assert.throws(() => readMeta('x', '# Title\n'), /x\/README.md: missing front matter/);
  assert.throws(() => readMeta('x', valid.replace('summary: Write an answer, tick the parts it includes, then compare.\n', '')), /needs summary/);
  assert.throws(() => readMeta('x', valid.replace('section: question', 'section: widgets')), /section must be one of/);
  assert.throws(() => readMeta('x', valid.replace('ai: no', 'ai: maybe')), /ai must be one of/);
  assert.throws(() => readMeta('x', valid.replace('learners: not tried', 'learners: not tried\nicon: bulb')), /unknown front matter key icon/);
});

test('every pattern README has valid front matter', async () => {
  const root = new URL('../patterns/', import.meta.url);
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const readme = await readFile(new URL(`${entry.name}/README.md`, root), 'utf8');
    assert.doesNotThrow(() => readMeta(entry.name, readme), entry.name);
  }
});
