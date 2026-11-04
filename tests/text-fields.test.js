import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const names = ['misconception', 'explain-back', 'journal', 'live-feedback', 'conversation', 'course-lookup', 'first-answer', 'write-distractors'];
for (const name of names) test(`${name} keeps text unrestricted in server markup`, async () => {
  const { render } = await import(`../patterns/${name}/render.js`);
  const { strings } = await import(`../patterns/${name}/strings.js`);
  for (const lang of ['en', 'fr']) {
    const content = JSON.parse(await readFile(new URL(`../patterns/${name}/examples/${lang}.json`, import.meta.url)));
    const markup = render(content, strings[lang], { id: 'text', lang });
    assert.doesNotMatch(markup, /maxlength=/);
    assert.doesNotMatch(markup, /placeholder=/);
    if (['journal', 'live-feedback'].includes(name)) {
      assert.match(markup, /aria-describedby="text-starter"/);
      assert.match(markup, /id="text-starter"/);
    }
  }
});
test('one shared placeholder rule owns contrast', async () => {
  const base = await readFile(new URL('../lib/base.css', import.meta.url), 'utf8');
  assert.equal((base.match(/::placeholder/g) ?? []).length, 1);
  assert.match(base, /\.lp \.lp-input::placeholder\s*\{\s*color: var\(--lp-ink-2\);\s*opacity: 1;/);
  for (const name of [...names, 'self-check']) {
    assert.doesNotMatch(await readFile(new URL(`../patterns/${name}/pattern.css`, import.meta.url), 'utf8'), /::placeholder/);
  }
});

for (const [name, limit] of [['misconception', 1500], ['explain-back', 1500], ['live-feedback', 1200]]) {
  test(`${name} restores an oversized draft and self-check ticks intact`, async () => {
    const { validateState } = await import(`../patterns/${name}/logic.js`);
    const tick = { misconception: 'rereading', 'explain-back': 'pause', 'live-feedback': 'when' }[name];
    const saved = { answer: 'x'.repeat(limit + 1), ticked: [tick] };
    assert.deepEqual(validateState(saved), saved);
  });
}
test('conversation restores oversized draft without losing previous moves', async () => {
  const { validateState } = await import('../patterns/conversation/logic.js');
  const saved = { draft: 'x'.repeat(1201), conversation: { node: 'pause', round: 1, history: [{ branch: 'pause', reply: 'I need a moment.' }], end: false } };
  assert.deepEqual(validateState(saved), saved);
});
test('write-distractors restores oversized option and mistaken idea as editable drafts', async () => {
  const { validateState } = await import('../patterns/write-distractors/logic.js');
  const content = JSON.parse(await readFile(new URL('../patterns/write-distractors/examples/en.json', import.meta.url)));
  for (const [text, custom] of [['x'.repeat(301), 'Idea'], ['Option', 'x'.repeat(121)]]) {
    const saved = { answer: 'My answer', hadIt: true, shown: true, options: Array.from({ length: content.count }, (_, i) => ({ text: i ? `Option ${i}` : text, custom: i ? 'Another idea' : custom, misconception: 'other' })) };
    for (const shown of [false, true]) assert.deepEqual(validateState(content, { ...saved, shown }), { ...saved, shown: false });
    assert.deepEqual(validateState(content, { options: saved.options, shown: false }), { ...saved, answer: '', hadIt: null, shown: false });
  }
});
test('index previews use visible linked starters without placeholders', async () => {
  const source = await readFile(new URL('../scripts/build-demo.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /placeholder=/);
  for (const name of ['journal', 'live']) {
    assert.match(source, new RegExp(`id="${name}-preview-starter"`));
    assert.match(source, new RegExp(`aria-describedby="${name}-preview-starter"`));
  }
});
