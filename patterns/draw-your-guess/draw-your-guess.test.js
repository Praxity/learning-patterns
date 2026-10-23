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
});

test('no-JavaScript markup contains every real value, explanation and source, and hides JS controls', () => {
  const markup = render(content, strings.en, { id: 'chart', lang: 'en' });
  const fallback = markup.match(/<details[^>]*data-lp-fallback[\s\S]*?<\/details>/)[0];
  for (const point of [...content.known, ...content.future]) { assert.ok(fallback.includes(point.name)); assert.ok(fallback.includes(`<td>${point.value}</td>`)); }
  assert.ok(fallback.includes('password calls fell from 45 a day to about 4'));
  assert.ok(fallback.includes('The figures in this sample are made up.'));
  assert.match(markup, /data-lp-future hidden/); assert.match(markup, /data-lp-check hidden/); assert.match(markup, /data-lp-try-again hidden/);
  const ids = [...markup.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size); assert.ok(ids.every(id => id.startsWith('chart-')));
});

test('French render retains accents, French punctuation and translated fallback', () => {
  const markup = render(french, strings.fr, { id: 'fr', lang: 'fr-CA' });
  assert.ok(markup.includes('lang="fr-CA"')); assert.ok(markup.includes('Prévoyez'));
  assert.ok(markup.includes('Contexte\u202f:')); assert.ok(markup.includes('juillet\u202f?'));
  assert.ok(markup.includes('Décembre')); assert.ok(markup.includes('chiffres de cet exemple sont inventés.'));
});

test('format leaves placeholder syntax inside author values literal', () => {
  assert.equal(format('{names} {missing}', { names: '{missing}' }), '{missing} {missing}');
});
