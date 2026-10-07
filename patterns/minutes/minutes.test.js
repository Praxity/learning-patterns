import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { estimateMinutes, overLimit, parseCount, validateContent, validateState, courseEstimate, RATES, LIMIT_MINUTES } from './logic.js';
import { render } from './render.js';
import { strings, formatText } from './strings.js';

const content = {
  title: 'A course', rates: { readingWordsPerMinute: 200, minutesPerQuestion: 0.75 },
  sections: [{ id: 'one', title: 'First', words: 1200, questions: 2, narrationSeconds: 60 },
    { id: 'two', title: 'Second', words: 300, questions: 3, narrationSeconds: 840 }]
};
const copy = () => structuredClone(content);

test('demo formula takes the longer concurrent activity, adds questions, then rounds up', () => {
  assert.deepEqual(RATES, { readingWordsPerMinute: 200, minutesPerQuestion: 0.75 });
  assert.equal(Object.isFrozen(RATES), true);
  assert.equal(LIMIT_MINUTES, 15);
  assert.equal(estimateMinutes(1200, 2, 60), 8);
  assert.equal(estimateMinutes(300, 3, 840), 17);
  assert.equal(estimateMinutes(0, 0, 0), 0);
  assert.equal(estimateMinutes(201, 0, 0), 2);
  assert.equal(estimateMinutes(600, 2, 180), 5);
  assert.equal(estimateMinutes(600, 2, 180, { readingWordsPerMinute: 100, minutesPerQuestion: 1.5 }), 9);
  assert.equal(overLimit(15), false);
  assert.equal(overLimit(16), true);
  assert.deepEqual(courseEstimate(content), { sections: [{ id: 'one', minutes: 8, overLimit: false }, { id: 'two', minutes: 17, overLimit: true }], total: 25 });
});

test('count parsing rejects blank, fractional, negative, scientific and unsafe text', () => {
  for (const value of ['', ' ', '-1', '1.5', '1e3', 'Infinity', 'abc', '9007199254740992']) assert.equal(parseCount(value), null, value);
  assert.equal(parseCount(' 0012 '), 12);
  assert.equal(parseCount('0'), 0);
  assert.equal(parseCount('9007199254740991'), Number.MAX_SAFE_INTEGER);
  for (const field of ['words', 'questions', 'narrationSeconds']) {
    for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '2', null]) {
      const counts = { words: 1, questions: 1, narrationSeconds: 1, [field]: value };
      assert.throws(() => estimateMinutes(counts.words, counts.questions, counts.narrationSeconds), new RegExp(field));
    }
  }
});

test('rates and estimates reject invalid or unrepresentable values', () => {
  for (const field of ['readingWordsPerMinute', 'minutesPerQuestion']) {
    for (const value of [-1, NaN, Infinity, '200', null, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => estimateMinutes(1, 1, 1, { ...RATES, [field]: value }), new RegExp(field));
    }
  }
  assert.throws(() => estimateMinutes(1, 1, 1, { ...RATES, readingWordsPerMinute: 0 }), /readingWordsPerMinute/);
  assert.throws(() => estimateMinutes(1, 1, 1, null), /rates/);
  assert.throws(() => estimateMinutes(1, 1, 1, { ...RATES, extra: 1 }), /rates.extra/);
  assert.equal(estimateMinutes(1, 3, 0, { ...RATES, minutesPerQuestion: 0 }), 1);
  assert.throws(() => estimateMinutes(Number.MAX_SAFE_INTEGER, 0, 0, { ...RATES, readingWordsPerMinute: 0.1 }), /estimate/);
  const huge = copy(); huge.rates.minutesPerQuestion = Number.MAX_SAFE_INTEGER;
  huge.sections.forEach(section => { section.words = 0; section.questions = 1; section.narrationSeconds = 0; });
  assert.throws(() => courseEstimate(huge), /total/);
  for (const value of [-1, NaN, Infinity, 1.5, '16']) assert.throws(() => overLimit(value), /minutes/);
});

test('validator names every planted invalid field and rejects unknown properties', () => {
  validateContent(content);
  for (const value of [null, [], 1]) assert.throws(() => validateContent(value), /content/);
  for (const [path, edit] of [
    ['title', c => c.title = ''], ['title', c => c.title = 1],
    ['content.extra', c => c.extra = 1], ['rates', c => c.rates = null],
    ['rates.readingWordsPerMinute', c => delete c.rates.readingWordsPerMinute],
    ['rates.minutesPerQuestion', c => c.rates.minutesPerQuestion = -1],
    ['sections', c => c.sections = []], ['sections', c => c.sections = {}],
    ['sections\\[0\\]', c => c.sections[0] = null],
    ['sections\\[0\\].id', c => c.sections[0].id = 'bad id'],
    ['sections\\[1\\].id', c => c.sections[1].id = 'one'],
    ['sections\\[0\\].title', c => c.sections[0].title = ''],
    ['sections\\[0\\].words', c => c.sections[0].words = -1],
    ['sections\\[0\\].questions', c => c.sections[0].questions = 1.5],
    ['sections\\[0\\].narrationSeconds', c => delete c.sections[0].narrationSeconds],
    ['sections\\[0\\].extra', c => c.sections[0].extra = 1]
  ]) { const value = copy(); edit(value); assert.throws(() => validateContent(value), new RegExp(path)); }
});

test('state copies all author counts, handles special ids and ignores invalid snapshots', () => {
  const saved = { authorView: true, sections: Object.fromEntries(content.sections.map(({ id, words, questions, narrationSeconds }) => [id, { words, questions, narrationSeconds }])) };
  const valid = validateState(content, saved); assert.deepEqual(valid, saved);
  saved.sections.one.words = 0; assert.equal(valid.sections.one.words, 1200);
  const bad = [null, [], {}, { ...saved, extra: 1 }, { ...saved, authorView: 'true' }, { ...saved, sections: [] }, { ...saved, sections: {} },
    { ...saved, sections: { ...saved.sections, extra: saved.sections.one } }];
  for (const field of ['words', 'questions', 'narrationSeconds']) {
    for (const value of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1, '12', null]) bad.push({ ...saved, sections: { ...saved.sections, one: { ...saved.sections.one, [field]: value } } });
    const missing = structuredClone(saved); delete missing.sections.one[field]; bad.push(missing);
  }
  bad.push({ ...saved, sections: { ...saved.sections, one: { ...saved.sections.one, extra: 1 } } });
  bad.push({ ...saved, sections: { ...saved.sections, one: null } });
  for (const value of bad) assert.equal(validateState(content, value), null);
  const special = copy(); special.sections[0].id = '__proto__';
  assert.ok(validateState(special, { authorView: false, sections: Object.fromEntries(special.sections.map(({ id, words, questions, narrationSeconds }) => [id, { words, questions, narrationSeconds }])) }));
  const changedRates = copy(); changedRates.rates.minutesPerQuestion = Number.MAX_SAFE_INTEGER;
  assert.equal(validateState(changedRates, saved), null);
});

test('render escapes authored text and attributes, prefixes ids and keeps static estimates', () => {
  const value = copy(); value.title = '<script>"&'; value.sections[0].title = '<img src=x>';
  const output = render(value, { ...strings.en, outline: '<outline>' }, { id: 'x"', lang: 'en"' });
  assert.match(output, /class="lp lp-minutes" data-lp-pattern="minutes"/);
  assert.match(output, /&lt;script&gt;&quot;&amp;/); assert.match(output, /&lt;img src=x&gt;/); assert.match(output, /&lt;outline&gt;/);
  assert.match(output, /lang="en&quot;"/); assert.doesNotMatch(output, /<script>|<img/);
  for (const match of output.matchAll(/\bid="([^"]+)"/g)) assert.ok(match[1].startsWith('x&quot;-'));
  assert.equal((output.match(/role="status"/g) ?? []).length, 1);
  assert.match(output, /role="status"[^>]*><\/p>/);
  assert.match(output, /data-lp-toggle[^>]*hidden/); assert.match(output, /data-lp-inputs[^>]*hidden/);
  assert.match(output, /Total 25 min/); assert.match(output, /Over 15 minutes/);
  const ids = [...output.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]); assert.equal(new Set(ids).size, ids.length);
});

test('bilingual fixtures, schema and strings follow the same contract', async () => {
  const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));
  assert.deepEqual(schema.required, ['title', 'rates', 'sections']);
  assert.equal(schema.properties.sections['x-uniqueBy'], 'id');
  assert.deepEqual(Object.keys(strings.en), Object.keys(strings.fr));
  assert.equal(formatText('{n} / {n}', { n: 1200 }, 'en'), '1,200 / 1,200');
  for (const lang of ['en', 'fr']) {
    const example = JSON.parse(await readFile(new URL(`./examples/${lang}.json`, import.meta.url)));
    validateContent(example);
    assert.deepEqual(courseEstimate(example).sections.map(section => section.minutes), [1, 3, 4, 3, 17]);
    assert.equal(courseEstimate(example).total, 28);
    assert.ok(render(example, strings[lang], { id: 'example', lang }).includes(example.title));
    assert.equal(Object.values(strings[lang]).some(text => text.includes('—')), false);
  }
});
