import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const name of ['misconception', 'self-check', 'dont-know', 'test-out']) {
  const { render } = await import(`../patterns/${name}/render.js`);
  const { strings } = await import(`../patterns/${name}/strings.js`);
  for (const lang of ['en', 'fr']) {
    const content = JSON.parse(await readFile(new URL(`../patterns/${name}/examples/${lang}.json`, import.meta.url)));
    test(`${name} choice structure (${lang})`, () => {
      const markup = render(content, strings[lang], { id: 'quiz', lang });
      const legends = [...markup.matchAll(/<legend[^>]*>(.*?)<\/legend>/gs)].map(m => m[1]);
      if (name === 'misconception') {
        assert.ok(!legends[0].includes(strings[lang].fallback));
        assert.match(markup, /<fieldset[^>]*aria-describedby="quiz-hint"/);
      } else if (name === 'self-check') {
        assert.ok(!legends[0].includes('data-lp-meter'));
        assert.doesNotMatch(markup, /data-lp-meter[^>]*role="status"/);
        assert.equal((markup.match(/role="status"/g) || []).length, 1);
        // The legend asks the question; no hint repeats it.
        assert.doesNotMatch(markup, /<fieldset[^>]*aria-describedby="quiz-hint"/);
      } else {
        assert.match(markup, /<p data-lp-explanation hidden>/);
        if (name === 'dont-know') {
          assert.match(legends[0], /Question 1 (of|sur) 3/);
          assert.match(legends[0], /lp-visually-hidden">, <\/span>/);
          assert.match(markup, /<div class="lp-dont-know-choice-divider">(or|ou)<\/div>\s*<label[^>]*><input[^>]*value="dont-know"/);
          assert.ok(strings[lang].choose.includes(strings[lang].unknown));
        }
      }
    });
  }
}

test('question caption stays in the regular body face', async () => {
  const css = await readFile(new URL('../patterns/dont-know/pattern.css', import.meta.url), 'utf8');
  assert.match(css, /\.lp-dont-know-question-number\s*\{[^}]*font-weight: 400;[^}]*font-family: var\(--lp-font-body\)/);
});

for (const lang of ['en', 'fr']) {
  test(`prolific unanswered messages include a decorative alert icon (${lang})`, async () => {
    const { render } = await import('../patterns/prolific-questions/render.js');
    const { strings } = await import('../patterns/prolific-questions/strings.js');
    const content = JSON.parse(await readFile(new URL(`../patterns/prolific-questions/examples/${lang}.json`, import.meta.url)));
    const markup = render(content, strings[lang], { id: 'facts', lang });
    const errors = [...markup.matchAll(/<p[^>]*data-lp-question-error[^>]*>(.*?)<\/p>/gs)];
    assert.equal(errors.length, 3);
    for (const [, message] of errors) assert.match(message, /<svg[^>]*aria-hidden="true"/);
  });
}
