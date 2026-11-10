import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const name of ['draw-your-guess', 'estimate-magnitude', 'if-then-plan', 'mark-colleague', 'prolific-questions', 'self-check', 'split-by-proportion']) {
  const { render } = await import(`../patterns/${name}/render.js`);
  const { strings } = await import(`../patterns/${name}/strings.js`);
  const { validateContent } = await import(`../patterns/${name}/logic.js`);
  const example = JSON.parse(await readFile(new URL(`../patterns/${name}/examples/en.json`, import.meta.url)));
  test(`${name}: scenario content renders without a scene bar`, () => {
    const content = { ...example };
    if (name === 'self-check') {
      content.task = 'Write a reply.';
      content.context = { to: 'Sam', initials: 'S', subject: 'Report' };
    } else {
      content.context = 'A short situation.';
      content.title = 'A card title.';
      content.question = 'What would you choose?';
      if (['estimate-magnitude', 'if-then-plan', 'mark-colleague'].includes(name)) delete content.question;
    }
    const output = render(content, strings.en, { id: 'scenario', lang: 'en' });
    assert.doesNotMatch(output, /lp-scene|Context:|Contexte/);
    if (name === 'self-check') {
      assert.ok(output.includes('<h2 class="lp-stem">Write a reply.</h2>'));
      assert.ok(output.indexOf('<h2') < output.indexOf('lp-self-check-composer'));
      assert.match(output, /<div class="lp-self-check-composer">\s*<div class="lp-self-check-meta-list">/);
      assert.ok(output.indexOf('Report</span>') < output.indexOf('<textarea'));
    } else {
      assert.ok(output.includes('<p class="lp-context">A short situation.</p>'));
      assert.ok(output.indexOf('A short situation.</p>') < output.indexOf('<fieldset'));
      assert.doesNotMatch(output, /<legend[^>]*>(?:(?!<\/legend>)[^])*A short situation/);
      if (['draw-your-guess', 'split-by-proportion'].includes(name)) {
        assert.ok(output.includes('<legend class="lp-stem"><h2 class="lp-heading">What would you choose?</h2></legend>'));
        assert.doesNotMatch(output, /<section[^>]*aria-labelledby|id="scenario-title"/);
        assert.ok(!output.includes('A card title.'));
      } else assert.ok(output.includes('<h2 class="lp-heading">A card title.</h2>'));
    }
  });
  if (['draw-your-guess', 'split-by-proportion'].includes(name)) test(`${name}: legacy title is optional but validated when supplied`, async () => {
    const content = { ...example }; delete content.title;
    assert.doesNotThrow(() => validateContent(content));
    assert.doesNotThrow(() => validateContent({ ...content, title: 'Legacy title' }));
    assert.doesNotThrow(() => render(content, strings.en, { id: 'scenario', lang: 'en' }));
    for (const title of [null, '', ' ', 1, 'x'.repeat(121)]) assert.throws(() => validateContent({ ...content, title }), /title/);
    const schema = JSON.parse(await readFile(new URL(`../patterns/${name}/content.schema.json`, import.meta.url)));
    assert.ok(!schema.required.includes('title'));
  });
}
