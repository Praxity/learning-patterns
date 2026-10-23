import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bandsFor, scaleFor, positionOf, score, validateContent, validateState } from './logic.js';
import { render } from './render.js';
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

test('floating-point boundary regression keeps the full tenfold band', () => {
  assert.ok(0.003 / 0.0003 > 10);
  assert.deepEqual(bandsFor([0.0003, 0.001, 0.003, 0.01, 0.03]), [[0.0003, 0.003], [0.001, 0.01], [0.003, 0.03]]);
  assert.deepEqual(bandsFor([1, 5, 10.0001, 50]), [[1, 5], [5, 50]]);
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
  for (const answer of [0, -1, 0.5, NaN, Infinity, 1e308, '4', null, undefined]) {
    const value = clone(); value.questions[0].answer = answer;
    assert.throws(() => validateContent(value), /questions\[0\].answer/);
  }
  for (const answer of [1, 1.5, 1e307]) {
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
  assert.match(a, /data-lp-interaction hidden/);
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
  assert.ok(output.includes('100 à 1'));
});

test('saved ranges are copied; invalid, incomplete checked and out-of-scale states are ignored', () => {
  const good = { ranges: [0, 3, 8], touched: [true, true, true], shown: true };
  assert.deepEqual(validateState(content, good), good);
  assert.notEqual(validateState(content, good).ranges, good.ranges);
  assert.notEqual(validateState(content, good).touched, good.touched);
  const partial = { ranges: [4, 4, 4], touched: [true, false, false], shown: false };
  assert.deepEqual(validateState(content, partial), partial);
  for (const value of [null, [], {}, { ...good, ranges: [0] }, { ...good, touched: [] }, { ...good, ranges: Array(3) }, { ...good, touched: Array(3) }, { ...good, ranges: [0, 3, 999] }, { ...good, ranges: [0, 0.2, 8] }, { ...good, ranges: ['0', 3, 8] }, { ...good, touched: [true, 1, true] }, { ...good, touched: [true, false, true] }, { ...good, shown: 'yes' }]) {
    assert.equal(validateState(content, value), null);
  }
});
