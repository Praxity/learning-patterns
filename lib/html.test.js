import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as html from './html.js';

test('French typography keeps punctuation, groups and currency together without doubling spaces', () => {
  assert.equal(typeof html.frenchTypography, 'function');
  const format = html.frenchTypography;
  assert.equal(format('Question : oui ; non ! pourquoi ? 1,5 % et 2 000 $', 'fr'), 'Question\u202f: oui\u202f; non\u202f! pourquoi\u202f? 1,5\u202f% et 2\u202f000\u202f$');
  assert.equal(format('Question\u00a0: 2\u202f000\u00a0$', 'fr'), 'Question\u00a0: 2\u202f000\u00a0$');
  assert.equal(format(format('2 000 $ !', 'fr'), 'fr'), format('2 000 $ !', 'fr'));
  assert.equal(format('Visit https://example.com at 17:00. Question?', 'en'), 'Visit https://example.com at 17:00. Question?');
});


for (const pattern of ['conversation', 'course-lookup', 'dont-know', 'explain-back', 'first-answer', 'highlight', 'journal', 'live-feedback', 'misconception', 'retrieval-sheet', 'review-prompts', 'self-check', 'test-out', 'write-distractors']) {
  test(`${pattern} renders French typography and leaves English prose alone`, async () => {
    const { readFile } = await import('node:fs/promises');
    const content = JSON.parse(await readFile(new URL(`../patterns/${pattern}/examples/fr.json`, import.meta.url)));
    const { render } = await import(`../patterns/${pattern}/render.js`);
    const { strings } = await import(`../patterns/${pattern}/strings.js`);
    const field = ['title', 'prompt', 'task', 'question', 'setup'].find(key => Object.hasOwn(content, key));
    content[field] = 'Question : pourquoi ? 2 000 $ et 1,5 % !';
    assert.ok(render(content, strings.fr, { id: 'french', lang: 'fr' }).includes('Question\u202f: pourquoi\u202f? 2\u202f000\u202f$ et 1,5\u202f% !'.replace('% !', '%\u202f!')));
    assert.ok(render(content, strings.en, { id: 'english', lang: 'en' }).includes(content[field]));
  });
}


test('French typography preserves URL queries and clocks and handles repeated digit groups', () => {
  assert.equal(html.frenchTypography('HTTPS://example.test/path?query=1;next=2 at 17:00', 'fr'), 'HTTPS://example.test/path?query=1;next=2 at 17:00');
  assert.equal(html.frenchTypography('1 234 567 euros : 20 %', 'fr-CA'), '1\u202f234\u202f567 euros\u202f: 20\u202f%');
});
