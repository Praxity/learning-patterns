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
        assert.match(markup, /data-lp-meter[^>]*role="status"/);
        assert.match(markup, /<fieldset[^>]*aria-describedby="quiz-hint"/);
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
