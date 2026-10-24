import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bandsFor, scaleFor, positionOf, score, validateContent, validateState } from './logic.js';
import { format, numberText, render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const clone = () => structuredClone(content);

test('integer logarithmic stops reach ten times the largest answer, with fixed tenfold bands', () => {
  const { stops, bands, start } = scaleFor(content);
  assert.deepEqual(stops, [1, 5, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 500000]);
  assert.ok(stops.every(Number.isInteger));
  assert.equal(start, 4);
  for (const [low, high] of bands) assert.equal(high / low, 10);
  assert.ok(stops.at(-1) >= 10 * Math.max(...content.questions.map(q => q.answer)));
  assert.equal(positionOf(1, stops), 0);
  assert.equal(positionOf(stops.at(-1), stops), 100);
  const widths = bands.map(([low, high]) => positionOf(high, stops) - positionOf(low, stops));
  assert.ok(widths.every(width => Math.abs(width - widths[0]) < 1e-10));
});

test('configured ratios give whole, equal-width bands and inclusive scoring', () => {
  assert.deepEqual(bandsFor([1, 5, 10, 50, 100, 500], 100), [[1, 100], [5, 500]]);
  for (const ratio of [10, 100, 1000]) {
    const value = { ...clone(), ratio };
    value.questions.forEach(q => { q.answer = 1e12; });
    const { stops, bands } = scaleFor(value);
    assert.ok(stops.at(-1) >= ratio * 1e12);
    assert.ok(stops.every(Number.isSafeInteger));
    for (const [low, high] of bands) assert.equal(high / low, ratio);
    const widths = bands.map(([low, high]) => positionOf(high, stops) - positionOf(low, stops));
    assert.ok(widths.every(width => Math.abs(width - widths[0]) < 1e-10));
  }
  const value = { ...clone(), ratio: 100 };
  value.questions.forEach((q, i) => { q.answer = [1, 100, 101][i]; });
  assert.equal(score(value, [0, 0, 0]).count, 2);
  for (const ratio of [1, 2, 5, 50, 500, 10000, null, '100', NaN, Infinity]) {
    assert.throws(() => validateContent({ ...content, ratio }), /ratio/);
    assert.throws(() => bandsFor([1, 5, 10, 50, 100, 500], ratio), /ratio/);
  }
});

test('scoring includes both boundaries and distinguishes misses above and below', () => {
  const value = clone();
  value.questions.forEach((q, i) => { q.answer = [1, 10, 11][i]; });
  assert.deepEqual(score(value, [0, 0, 0]), {
    count: 2, total: 3, items: [
      { low: 1, high: 10, answer: 1, relation: 'inside' },
      { low: 1, high: 10, answer: 10, relation: 'inside' },
      { low: 1, high: 10, answer: 11, relation: 'above' }
    ]
  });
  assert.equal(score(value, [1, 0, 0]).items[0].relation, 'below');
  for (const picks of [[], [0, 0], [0, 0, 0, 0], [-1, 0, 0], [0.5, 0, 0], [999, 0, 0], ['0', 0, 0], Array(3), null]) {
    assert.throws(() => score(value, picks), /ranges/);
  }
});

test('content validation names every invalid field and accepts three to five questions', () => {
  assert.doesNotThrow(() => validateContent(content));
  assert.doesNotThrow(() => validateContent(french));
  const five = clone(); five.questions.push(...structuredClone(five.questions.slice(0, 2)));
  assert.doesNotThrow(() => validateContent(five));
  for (const invalid of [null, [], 4]) assert.throws(() => validateContent(invalid), /content/);
  for (const field of ['title', 'context']) {
    for (const bad of ['', '   ', null, 7, undefined]) {
      const value = clone(); value[field] = bad;
      assert.throws(() => validateContent(value), new RegExp(field));
    }
  }
  for (const bad of [null, {}, [], Array(3), content.questions.slice(0, 2), Array(6).fill(content.questions[0])]) {
    const value = clone(); value.questions = bad;
    assert.throws(() => validateContent(value), /questions/);
  }
  for (const bad of [null, [], 'question']) {
    const value = clone(); value.questions[0] = bad;
    assert.throws(() => validateContent(value), /questions\[0\]/);
  }
  for (const field of ['question', 'unit', 'source']) {
    for (const bad of ['', ' ', null, 7, undefined]) {
      const value = clone(); value.questions[0][field] = bad;
      assert.throws(() => validateContent(value), new RegExp(field));
    }
  }
  for (const answer of [0, -1, 0.5, NaN, Infinity, 1e12 + 1, 1e307, '4', null, undefined]) {
    const value = clone(); value.questions[0].answer = answer;
    assert.throws(() => validateContent(value), /questions\[0\].answer/);
  }
  for (const answer of [1, 1.5, 1e12]) {
    const value = clone(); value.questions[0].answer = answer;
    assert.doesNotThrow(() => validateContent(value));
    assert.ok(scaleFor(value).stops.every(Number.isFinite));
  }
  for (const path of ['root', 'question']) {
    const value = clone(); (path === 'root' ? value : value.questions[0]).extra = true;
    assert.throws(() => validateContent(value), /extra/);
  }
});

test('render escapes authored and interface text, prefixes ids and supplies complete no-JS answers', () => {
  const hostile = '<script>"x" & \'y\'</script>';
  const value = clone(); value.title = value.context = hostile;
  value.questions.forEach(q => { q.question = q.unit = q.source = hostile; });
  const ui = Object.fromEntries(Object.keys(strings.en).map(key => [key, hostile]));
  const escaped = render(value, ui, { id: 'first"', lang: 'en"' });
  assert.ok(!escaped.includes('<script>'));
  assert.ok(escaped.includes('&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;'));
  assert.ok(escaped.includes('lang="en&quot;"'));
  const a = render(content, strings.en, { id: 'a', lang: 'en' });
  const b = render(content, strings.en, { id: 'b', lang: 'en' });
  const ids = [...(a + b).matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.every(id => id.startsWith('a-') || id.startsWith('b-')));
  assert.match(a, /<p[^>]*role="status"[^>]*><\/p>/);
  assert.equal((a.match(/role="status"/g) || []).length, 1);
  assert.match(a, /<div data-lp-interaction>/);
  assert.match(a, /data-lp-instructions hidden/);
  assert.equal((a.match(/class="lp-estimate-magnitude-scale" hidden/g) || []).length, 3);
  assert.match(a, /data-lp-check hidden/);
  assert.match(a, /data-lp-fallback>/);
  const fallback = a.slice(a.indexOf('<details'), a.indexOf('</details>'));
  for (const q of content.questions) {
    assert.ok(fallback.includes(q.question));
    assert.ok(fallback.includes(q.source));
    assert.ok(fallback.includes(q.answer.toLocaleString('en')));
  }
});

test('French render and strings use identical keys and placeholders', () => {
  assert.deepEqual(Object.keys(strings.en), Object.keys(strings.fr));
  for (const key of Object.keys(strings.en)) assert.deepEqual(strings.en[key].match(/\{\w+\}/g), strings.fr[key].match(/\{\w+\}/g));
  const output = render(french, strings.fr, { id: 'fr', lang: 'fr' });
  assert.ok(output.includes('lang="fr"'));
  assert.ok(output.includes('Estimez à partir des registres du bureau'));
  assert.ok(output.includes('26\u202f000') || output.includes('26\u00a0000'));
  assert.ok(output.includes('100 à 1\u00a0000') || output.includes('100 à 1\u202f000'));
});

test('render anchors range labels at the band midpoint', () => {
  const value = { ...clone(), ratio: 1000 };
  value.questions.forEach(question => { question.answer = 1e12; });
  const output = render(value, strings.en, { id: 'centre', lang: 'en' });
  const labels = [...output.matchAll(/data-lp-value style="([^"]+)"/g)];
  assert.equal(labels.length, 3);
  // The starting band is 1e6 to 1e9, at 40% to 60% on the 1 to 1e15 track.
  for (const [, style] of labels) assert.equal(style, '--lp-estimate-magnitude-at:50;text-align:start');
});

test('formatting replaces placeholders once and localizes numbers and ratios', () => {
  assert.equal(format('{value} {x}', { value: '{x}', x: 'answer' }), '{x} answer');
  assert.equal(numberText(1.5, 'fr'), '1,5');
  const expected = {
    en: {
      10: 'Slide each range to hold your estimate. Each range is limited to ten times its low end.',
      100: 'Slide each range to hold your estimate. Each range is limited to 100 times its low end.',
      1000: 'Slide each range to hold your estimate. Each range is limited to 1,000 times its low end.'
    },
    fr: {
      10: 'Faites glisser chaque plage pour y inclure votre estimation. Chaque plage est limitée à dix fois sa borne inférieure.',
      100: 'Faites glisser chaque plage pour y inclure votre estimation. Chaque plage est limitée à 100 fois sa borne inférieure.',
      1000: 'Faites glisser chaque plage pour y inclure votre estimation. Chaque plage est limitée à 1\u00a0000 fois sa borne inférieure.'
    }
  };
  for (const lang of ['en', 'fr']) {
    for (const ratio of [undefined, 10, 100, 1000]) {
      const value = { ...clone(), ratio };
      const output = render(value, strings[lang], { id: lang, lang });
      const instructions = output.match(/data-lp-instructions hidden>([^<]+)</)[1];
      assert.equal(instructions.replaceAll('\u202f', '\u00a0'), expected[lang][ratio ?? 10]);
      assert.ok(!output.includes('{ratio}'));
    }
  }
});

test('saved ranges are copied; invalid, incomplete checked and out-of-scale states are ignored', () => {
  const good = { ranges: [0, 3, 8], touched: [true, true, true], shown: true };
  assert.deepEqual(validateState(content, good), good);
  assert.notEqual(validateState(content, good).ranges, good.ranges);
  assert.notEqual(validateState(content, good).touched, good.touched);
  const partial = { ranges: [4, 4, 4], touched: [true, false, false], shown: false };
  assert.deepEqual(validateState(content, partial), partial);
  assert.equal(validateState(content, { ...partial, ranges: [4, 7, 4] }), null);
  for (const value of [null, [], {}, { ...good, ranges: [0] }, { ...good, touched: [] }, { ...good, ranges: Array(3) }, { ...good, touched: Array(3) }, { ...good, ranges: [0, 3, 999] }, { ...good, ranges: [0, 0.2, 8] }, { ...good, ranges: ['0', 3, 8] }, { ...good, touched: [true, 1, true] }, { ...good, touched: [true, false, true] }, { ...good, shown: 'yes' }]) {
    assert.equal(validateState(content, value), null);
  }
});

test('each band slider has its own short name, so screen readers do not repeat the question legend', () => {
  for (const [lang, name] of [['en', 'Range for question'], ['fr', 'Plage de la question']]) {
    const output = render(lang === 'en' ? content : french, strings[lang], { id: 'n', lang });
    const sliders = output.match(/<button[^>]*role="slider"[^>]*>/g);
    assert.equal(sliders.length, content.questions.length);
    for (const [index, slider] of sliders.entries()) {
      assert.ok(slider.includes(`aria-label="${name} ${index + 1}"`));
      assert.ok(!slider.includes('aria-labelledby'));
    }
  }
});
