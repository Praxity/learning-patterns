import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compare, format, snap, trends, validateContent, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));

// Check this schema's keywords and its documented cross-field annotations.
function matches(value, rule, root = value) {
  if (rule.$ref) rule = schema.$defs.point;
  if (rule.type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value)
    && rule.required.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => Object.hasOwn(rule.properties, key))
    && Object.entries(rule.properties).every(([key, child]) => matches(value[key], child, root));
  if (rule.type === 'array') return Array.isArray(value) && value.length >= rule.minItems && value.length <= rule.maxItems && value.every(item => matches(item, rule.items, root));
  if (rule.type === 'string') return typeof value === 'string' && [...value].length >= rule.minLength && [...value].length <= rule.maxLength && new RegExp(rule.pattern).test(value);
  return typeof value === 'number' && Number.isFinite(value)
    && (rule.type !== 'integer' || Number.isInteger(value)) && value >= rule.minimum && value <= (rule.maximum ?? Infinity)
    && (!rule['x-maximumField'] || value <= root[rule['x-maximumField']])
    && (!rule['x-dividesField'] || root[rule['x-dividesField']] % value === 0);
}

test('English and French content match the schema and use identical interface keys', () => {
  for (const value of [content, french]) { validateContent(value); assert.equal(matches(value, schema), true); }
  assert.deepEqual(Object.keys(strings.en), Object.keys(strings.fr));
  assert.deepEqual(content.known.map(p => p.value), [116, 124, 121, 120]);
  assert.deepEqual(content.future.map(p => p.value), [95, 84, 80, 79]);
});

for (const [values, trend] of [
  [[115, 120, 100, 100], 'changedDirection'], [[115, 110, 105, 100], 'fell'],
  [[125, 130, 135, 140], 'rose'], [[120, 120, 120, 120], 'flat'],
  [[100, 90, 80, 80], 'fellThenFlat'], [[125, 130, 140, 140], 'roseThenFlat'],
  [[120, 120, 120, 115], 'fell'], [[120, 120, 120, 125], 'rose'],
  [[0, 0, 0, 0], 'fellThenFlat'], [[150, 150, 150, 150], 'roseThenFlat']
]) test(`comparison classifies ${values} as ${trend}`, () => {
  const result = compare(content, values);
  assert.equal(result.trend, trend); assert.equal(result.summary, content.feedback[trend]);
});

test('comparison returns signed differences without rounding real measurements', () => {
  assert.deepEqual(compare(content, [95, 85, 80, 80]).differences, [0, 1, 0, 1]);
  assert.equal(compare(content, [100, 90, 80, 80]).summary, 'Your line fell then levelled off, as the real line did.');
  for (const guesses of [[], [5], [null, 5, 5, 5], [151, 5, 5, 5], [5, 5, 5, 79], [NaN, 5, 5, 5]]) assert.throws(() => compare(content, guesses), /guesses/);
});

test('snapping rounds at half a step and clamps both boundaries', () => {
  for (const [input, expected] of [[-10, 0], [0, 0], [2.49, 0], [2.5, 5], [147.49, 145], [147.5, 150], [151, 150]]) assert.equal(snap(content, input), expected);
  for (const input of [NaN, Infinity, -Infinity]) assert.throws(() => snap(content, input), /value/);
});

test('validator names each planted invalid field and agrees with schema', () => {
  const fixtures = [[null, 'content'], [[], 'content'], [{ ...content, extra: 1 }, 'extra']];
  const bad = (path, value) => {
    const next = structuredClone(content), parts = path.split('.');
    let target = next;
    for (const key of parts.slice(0, -1)) target = target[key];
    target[parts.at(-1)] = value; fixtures.push([next, path.replace(/\.(\d+)(?=\.|$)/g, '[$1]')]);
  };
  for (const field of ['title', 'context', 'question', 'unit', 'changeLabel', 'realLabel', 'resultTitle', 'explanationLabel', 'explanation', 'source']) {
    for (const value of [undefined, null, 4, '', ' ']) bad(field, value);
    bad(field, 'x'.repeat(schema.properties[field].maxLength + 1));
  }
  for (const field of ['known', 'future']) {
    for (const value of [null, {}, [], content[field].slice(0, 2), Array(7).fill(content[field][0])]) bad(field, value);
    for (const value of [null, 3, { ...content[field][0], extra: 1 }]) bad(`${field}.0`, value);
    for (const key of ['label', 'name']) for (const value of ['', ' ', 1, null, undefined, 'x'.repeat(121)]) bad(`${field}.0.${key}`, value);
    for (const value of [undefined, null, NaN, Infinity, -1, 151, '5']) bad(`${field}.0.value`, value);
  }
  for (const field of ['top', 'step']) for (const value of [0, -1, 1.5, NaN, Infinity, '5', undefined, Number.MAX_SAFE_INTEGER + 1]) bad(field, value);
  bad('step', 7); bad('step', 155);
  for (const value of [null, [], {}, { ...content.feedback, extra: 'x' }]) bad('feedback', value);
  for (const trend of trends) for (const value of [undefined, '', ' ', 1, 'x'.repeat(1501)]) bad(`feedback.${trend}`, value);
  for (const [value, field] of fixtures) {
    assert.throws(() => validateContent(value), error => error.message.includes(field), field);
    assert.equal(matches(value, schema), false, field);
  }
});

test('three to six points, fractional real values and maximum text lengths are accepted', () => {
  const value = structuredClone(content);
  value.title = 'x'.repeat(120); value.question = 'x'.repeat(400); value.source = 'x'.repeat(1500);
  value.known = value.known.slice(0, 3); value.known[0].value = 115.5;
  value.future.push(...value.future.slice(0, 2));
  validateContent(value); assert.equal(matches(value, schema), true);
});

test('state accepts partial and completed guesses, copies arrays and rejects invalid saves', () => {
  const seed = { guesses: [null, 0, 150, 80], shown: false };
  const saved = validateState(content, seed);
  assert.deepEqual(saved, seed); assert.notEqual(saved.guesses, seed.guesses);
  assert.deepEqual(validateState(content, { guesses: [0, 5, 145, 150], shown: true }), { guesses: [0, 5, 145, 150], shown: true });
  for (const value of [null, {}, { ...seed, shown: 1 }, { ...seed, shown: true }, { ...seed, guesses: [5] }, { ...seed, guesses: [undefined, 0, 0, 0] }, { ...seed, guesses: [-5, 0, 0, 0] }, { ...seed, guesses: [155, 0, 0, 0] }, { ...seed, guesses: [79, 0, 0, 0] }, { ...seed, guesses: [NaN, 0, 0, 0] }]) assert.equal(validateState(content, value), null);
});

test('render escapes all authored text and instance attributes', () => {
  const value = structuredClone(content);
  const attack = '<img src=x onerror="oops"> & \'text\'';
  for (const field of ['title', 'context', 'question', 'unit', 'changeLabel', 'realLabel', 'resultTitle', 'explanationLabel', 'explanation', 'source']) value[field] = attack;
  for (const point of [...value.known, ...value.future]) point.label = point.name = attack;
  const markup = render(value, strings.en, { id: 'one"<>', lang: 'en"<>' });
  assert.ok(!markup.includes('<img')); assert.ok(markup.includes('&lt;img')); assert.ok(markup.includes('one&quot;&lt;&gt;-point-0'));
  assert.equal((markup.match(/role="status"/g) ?? []).length, 1);
  assert.ok(markup.includes('role="status" aria-atomic="true"></p>'));
  assert.ok(markup.includes('lang="en&quot;&lt;&gt;"'));
});

test('no-JavaScript markup contains every real value, explanation and source, and hides JS controls', () => {
  const markup = render(content, strings.en, { id: 'chart', lang: 'en' });
  const fallback = markup.match(/<details[^>]*data-lp-fallback[\s\S]*?<\/details>/)[0];
  for (const point of [...content.known, ...content.future]) { assert.ok(fallback.includes(point.name)); assert.ok(fallback.includes(`<td>${point.value}</td>`)); }
  assert.ok(fallback.includes('password calls fell from 45 a day to about 4'));
  assert.ok(fallback.includes('IT help desk call log, December to July'));
  assert.ok(fallback.includes('<caption>Real calls</caption>'));
  assert.match(markup, /<fieldset class="lp-draw-your-guess-fieldset">/);
  assert.match(markup, /data-lp-future hidden/); assert.match(markup, /data-lp-check hidden/); assert.match(markup, /data-lp-try-again hidden/);
  const ids = [...markup.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size); assert.ok(ids.every(id => id.startsWith('chart-')));
});

test('French render retains accents, French punctuation and translated fallback', () => {
  const markup = render(french, strings.fr, { id: 'fr', lang: 'fr-CA' });
  assert.ok(markup.includes('lang="fr-CA"')); assert.ok(markup.includes('Prévoyez'));
  assert.ok(markup.includes('Contexte\u202f:')); assert.ok(markup.includes('juillet\u202f?'));
  assert.ok(markup.includes('décembre')); assert.ok(markup.includes("Journal des appels au soutien informatique, de décembre à juillet"));
});

test('axis ticks follow the authored step and always include both scale boundaries', () => {
  for (const [top, step, expected] of [[100, 5, [0, 35, 70, 100]], [40, 5, [0, 15, 30, 40]], [150, 5, [0, 50, 100, 150]], [10, 10, [0, 10]]]) {
    const value = { ...content, top, step, known: content.known.map(p => ({ ...p, value: 0 })), future: content.future.map(p => ({ ...p, value: 0 })) };
    const markup = render(value, strings.en, { id: 'axis', lang: 'en' });
    const axis = markup.match(/<div class="lp-draw-your-guess-y"[^>]*>(.*?)<\/div>/)[1];
    assert.deepEqual([...axis.matchAll(/<span[^>]*>(.*?)<\/span>/g)].map(match => Number(match[1])), expected);
  }
});

test('French known-point descriptions and answer tables format fractional real values', () => {
  const value = structuredClone(french);
  value.known[0].value = 115.5; value.future[0].value = 95.5;
  const markup = render(value, strings.fr, { id: 'fr', lang: 'fr-CA' });
  assert.ok(markup.includes('décembre, 115,5 appels par jour'));
  assert.ok(markup.includes('<td>115,5</td>'));
  assert.ok(markup.includes('<td>95,5</td>'));
  assert.ok(!markup.includes('>115.5<'));
});

test('real values retain more than three decimals and small nonzero values in both locales', () => {
  for (const [lang, messages, decimal] of [['en', strings.en, '.'], ['fr-CA', strings.fr, ',']]) {
    const value = structuredClone(content);
    value.known[0].value = 115.5555; value.future[0].value = 0.0004;
    const markup = render(value, messages, { id: 'precision', lang });
    assert.ok(markup.includes(`115${decimal}5555 ${value.unit}`));
    assert.ok(markup.includes(`<td>115${decimal}5555</td>`));
    assert.ok(markup.includes(`<td>0${decimal}0004</td>`));
  }
});

test('language tags use the same French detection as typography and malformed tags stay safe', () => {
  const value = structuredClone(content);
  value.known[0].value = 115.5555;
  for (const [lang, expected] of [['en_US', '115.5555'], ['fr', '115,5555'], ['FR-ca', '115,5555'], ['fr-invalid_tag', '115,5555'], ['fr_CA', '115.5555']]) {
    const markup = render(value, strings.en, { id: 'locale', lang });
    assert.ok(markup.includes(`<td>${expected}</td>`), lang);
  }
});

test('French axis ticks use locale grouping', () => {
  const markup = render({ ...french, top: 10000 }, strings.fr, { id: 'fr', lang: 'fr-CA' });
  const axis = markup.match(/<div class="lp-draw-your-guess-y"[^>]*>(.*?)<\/div>/)[1];
  assert.ok(axis.includes('>3\u00a0335</span>'));
  assert.ok(axis.includes('>10\u00a0000</span>'));
});

test('server chart places points at column centres and scales real values from the top', () => {
  const markup = render(content, strings.en, { id: 'chart', lang: 'en' });
  const line = markup.match(/data-lp-real points="([^"]+)"/)[1];
  const points = line.split(' ').map(point => point.split(',').map(Number));
  for (const [i, expected] of [[0, [50, 68]], [1, [150, 52]], [2, [250, 58]], [3, [350, 60]]]) {
    assert.equal(points[i][0], expected[0]);
    assert.ok(Math.abs(points[i][1] - expected[1]) < 1e-10);
  }
});

test('format leaves placeholder syntax inside author values literal', () => {
  assert.equal(format('{names} {missing}', { names: '{missing}' }), '{missing} {missing}');
});
