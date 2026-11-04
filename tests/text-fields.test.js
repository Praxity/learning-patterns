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
  assert.match(base, /\.lp-input::placeholder\s*\{\s*color: var\(--lp-ink-2\);\s*opacity: 1;/);
  for (const name of [...names, 'self-check']) {
    assert.doesNotMatch(await readFile(new URL(`../patterns/${name}/pattern.css`, import.meta.url), 'utf8'), /::placeholder/);
  }
});
