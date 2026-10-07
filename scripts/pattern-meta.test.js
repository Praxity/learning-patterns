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

const README_SECTIONS = [
  'When to use it', 'How it works', 'Evidence', 'Accessibility',
  'Content fields', 'Logic', 'Use it', 'Adapt it with your agent', 'Licence'
];

/** @param {string} readme */
function checkReadmeStructure(readme) {
  readMeta('pattern', readme);
  assert.match(readme, /^---\r?\n[\s\S]*?\r?\n---\r?\n# [^\r\n]+\r?\n/);
  // Code examples may contain Markdown headings; they are not README sections.
  const prose = readme.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, '');
  assert.deepEqual([...prose.matchAll(/^## ([^\r\n]+)\r?$/gm)].map(match => match[1]), README_SECTIONS);
  const how = readme.split(/^## How it works\r?$/m)[1].split(/^## /m)[0];
  assert.doesNotMatch(how, /`|\b[A-Za-z_$][\w.$]*\s*\(/, 'How it works contains code');
}

test('README structure guard catches missing, reordered and technical sections', () => {
  const readme = `${valid}\nA short description.\n\n${README_SECTIONS.map(section =>
    `## ${section}\n\n${section === 'How it works' ? '1. You read the question.' : 'Plain text.'}\n`
  ).join('\n')}`;
  assert.doesNotThrow(() => checkReadmeStructure(readme));
  assert.doesNotThrow(() => checkReadmeStructure(readme.replace('## Use it\n\nPlain text.', '## Use it\n\n```js\n## Example heading inside code\n```')));
  for (const section of README_SECTIONS) {
    assert.throws(() => checkReadmeStructure(readme.replace(`## ${section}\n`, '')), section);
  }
  assert.throws(() => checkReadmeStructure(readme.replace('## Evidence', '## Temporary').replace('## Logic', '## Evidence').replace('## Temporary', '## Logic')));
  assert.doesNotThrow(() => checkReadmeStructure(readme.replaceAll('\n', '\r\n')));
  for (const code of ['`answer`', 'readingMinutes(content)', 'scheduleReview (date)']) {
    assert.throws(() => checkReadmeStructure(readme.replace('1. You read the question.', `1. You use ${code}.`)), /contains code/);
  }
  assert.throws(() => checkReadmeStructure(readme.replace(/^---\n[\s\S]*?\n---\n/, '')), /missing front matter/);
  assert.throws(() => checkReadmeStructure(readme.replace('# Check your own answer\n', '')));
});

test('every pattern README has the shared structure and plain learner steps', async () => {
  const root = new URL('../patterns/', import.meta.url);
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const readme = await readFile(new URL(`${entry.name}/README.md`, root), 'utf8');
    assert.doesNotThrow(() => checkReadmeStructure(readme), `${entry.name}/README.md`);
  }
});

test('the root README lists every pattern folder', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  for (const entry of await readdir(new URL('../patterns/', import.meta.url), { withFileTypes: true })) {
    if (entry.isDirectory()) assert.ok(readme.includes(`](patterns/${entry.name}/README.md)`), `README.md does not list ${entry.name}`);
  }
});
