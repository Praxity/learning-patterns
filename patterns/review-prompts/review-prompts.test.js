import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { scheduleReview, isoDate, validateContent, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));

// These are the schema keywords this content uses, including its uniqueness annotation.
function matches(value, rule) {
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (rule.required.some(key => !Object.hasOwn(value, key))) return false;
    if (Object.keys(value).some(key => !Object.hasOwn(rule.properties, key))) return false;
    return Object.entries(rule.properties).every(([key, child]) => matches(value[key], child));
  }
  if (rule.type === 'array') {
    if (!Array.isArray(value) || value.length < rule.minItems) return false;
    if (rule['x-uniqueBy'] && new Set(value.map(item => item?.[rule['x-uniqueBy']])).size !== value.length) return false;
    return value.every(item => matches(item, rule.items));
  }
  if (rule.type === 'integer') return Number.isInteger(value) && value >= rule.minimum && value <= rule.maximum;
  return typeof value === 'string' && value.length >= rule.minLength && (!rule.pattern || new RegExp(rule.pattern).test(value));
}

test('scheduleReview preserves the demo intervals and calendar rollovers at local midnight', () => {
  for (const [date, result, expected] of [
    [new Date(2026, 9, 6, 23, 45), 'remembered', '2026-10-09'],
    [new Date(2026, 9, 6), 'forgot', '2026-10-07'],
    [new Date(2026, 9, 30), 'remembered', '2026-11-02'],
    [new Date(2026, 11, 30), 'remembered', '2027-01-02'],
    [new Date(2026, 11, 31), 'forgot', '2027-01-01'],
    [new Date(2028, 1, 28), 'forgot', '2028-02-29'],
    [new Date(2027, 1, 27), 'remembered', '2027-03-02']
  ]) {
    const before = date.getTime();
    const next = scheduleReview(date, result);
    assert.equal(isoDate(next), expected);
    assert.deepEqual([next.getHours(), next.getMinutes(), next.getSeconds(), next.getMilliseconds()], [0, 0, 0, 0]);
    assert.notEqual(next, date); assert.equal(date.getTime(), before);
  }
  assert.equal(isoDate(scheduleReview(new Date(2027, 0, 2), 'remembered', { remembered: 7, forgot: 2 })), '2027-01-09');
});

test('calendar days span DST changes rather than fixed 24-hour periods', () => {
  const code = `import { scheduleReview, isoDate } from ${JSON.stringify(new URL('./logic.js', import.meta.url).href)};
    console.log(JSON.stringify([new Date(2026,2,7,23,45),new Date(2026,9,31,23,45)].map(date=> {
      const next=scheduleReview(date,'remembered'); return [isoDate(next),next.getHours()];
    })));`;
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ: 'America/Toronto' }, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(result), [['2026-03-10', 0], ['2026-11-03', 0]]);
});

test('a source day with a missing midnight does not move a later review to 1am', () => {
  const code = `import { scheduleReview, isoDate } from ${JSON.stringify(new URL('./logic.js', import.meta.url).href)};
    const next = scheduleReview(new Date(2018,10,4,12), 'remembered');
    console.log(JSON.stringify([isoDate(next), next.getHours()]));`;
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ: 'America/Sao_Paulo' }, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(result), ['2018-11-07', 0]);
});

test('scheduling and date serialization reject planted invalid inputs and date overflow', () => {
  for (const date of ['2026-10-06', undefined, null, new Date(NaN)]) {
    assert.throws(() => scheduleReview(date, 'forgot'), /valid Date/);
    assert.throws(() => isoDate(date), /valid Date/);
  }
  for (const result of ['skipped', undefined, 'toString', '__proto__', null]) assert.throws(() => scheduleReview(new Date(), result), /result/);
  for (const days of [null, {}, { remembered: 0, forgot: 1 }, { remembered: 1.5, forgot: 1 }, { remembered: 3, forgot: Infinity }, { remembered: 3, forgot: -1 }, { remembered: 3, forgot: 1, extra: 2 }]) {
    assert.throws(() => scheduleReview(new Date(), 'forgot', days), /reviewDays/);
  }
  assert.throws(() => scheduleReview(new Date(9999, 11, 31), 'forgot'), /date range/);
  for (const year of [-1, 10000]) {
    const outOfRange = new Date(0); outOfRange.setFullYear(year, 0, 1);
    assert.throws(() => isoDate(outOfRange), /date range/);
    assert.throws(() => scheduleReview(outOfRange, 'forgot'), /date range/);
  }
  assert.throws(() => scheduleReview(new Date(), 'remembered', { remembered: Number.MAX_SAFE_INTEGER, forgot: 1 }), /date range/);
  assert.equal(isoDate(new Date(2027, 0, 2)), '2027-01-02');
  const early = new Date(0); early.setFullYear(1, 0, 1);
  assert.equal(isoDate(scheduleReview(early, 'forgot')), '0001-01-02');
});

test('content validation and schema agree on authored examples and planted violations', () => {
  const fixtures = [[content, true], [french, true], [{ ...content, parts: [{ ...content.parts[0], heading: ' ' }] }, true]];
  const bad = (value, field) => fixtures.push([value, false, field]);
  for (const value of [null, [], 'text']) bad(value, 'content');
  bad({ ...content, extra: '' }, 'extra');
  for (const value of [[], null, 'text', undefined]) bad({ ...content, parts: value }, 'parts');
  for (const field of ['id', 'heading', 'question', 'answer']) {
    for (const value of ['', 2, null, undefined]) bad({ ...content, parts: [{ ...content.parts[0], [field]: value }] }, field);
  }
  for (const value of [[], null, 'text', [''], [3]]) bad({ ...content, parts: [{ ...content.parts[0], paragraphs: value }] }, 'paragraphs');
  bad({ ...content, parts: [null] }, 'parts[0]');
  bad({ ...content, parts: [{ ...content.parts[0], id: 'bad id' }] }, 'id');
  bad({ ...content, parts: [{ ...content.parts[0], extra: '' }] }, 'extra');
  bad({ ...content, parts: [content.parts[0], content.parts[0]] }, 'id');
  for (const value of [null, undefined, [], {}, { remembered: 3, forgot: 1, extra: 2 }]) bad({ ...content, reviewDays: value }, 'reviewDays');
  for (const field of ['remembered', 'forgot']) for (const value of [undefined, '3', 0, -1, 1.2, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) bad({ ...content, reviewDays: { ...content.reviewDays, [field]: value } }, field);
  for (const [value, valid, field] of fixtures) {
    assert.equal(matches(value, schema), valid, `schema ${field}`);
    if (valid) assert.doesNotThrow(() => validateContent(value));
    else assert.throws(() => validateContent(value), error => error.message.includes(field), `validator ${field}`);
  }
});

test('render keeps native details, h3 headings, hidden rating controls and one empty status', () => {
  const markup = render(content, strings.en, { id: 'practice', lang: 'en' });
  assert.match(markup, /class="lp lp-unboxed lp-review-prompts" data-lp-pattern="review-prompts" lang="en"/);
  assert.equal((markup.match(/<h3\b/g) || []).length, 3);
  assert.equal((markup.match(/<details\b/g) || []).length, 3);
  assert.equal((markup.match(/<summary[^>]*>Show the answer<\/summary>/g) || []).length, 3);
  assert.equal((markup.match(/data-lp-rating[^>]* hidden/g) || []).length, 3);
  assert.match(markup, /role="status" aria-atomic="true"><\/p>/);
  assert.equal((markup.match(/role="status"/g) || []).length, 1);
  assert.doesNotMatch(markup, /<h[12]\b|<table\b|score|summary-banner/);
  for (const part of content.parts) for (const text of [part.heading, ...part.paragraphs, part.question, part.answer]) assert.ok(markup.includes(text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')));
});

test('render escapes all text and attributes and prefixes ids across instances', () => {
  const hostile = '<script>alert("x")</script> & \'quoted\'';
  const value = { ...content, parts: [{ id: 'one', heading: hostile, paragraphs: [hostile], question: hostile, answer: hostile }] };
  const ui = Object.fromEntries(Object.keys(strings.en).map(key => [key, hostile]));
  const markup = render(value, ui, { id: 'first"', lang: 'fr"' });
  assert.doesNotMatch(markup, /<script>/);
  assert.match(markup, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &#39;quoted&#39;/);
  assert.match(markup, /lang="fr&quot;"/);
  const pair = ['a', 'b'].map(id => render(content, strings.en, { id, lang: 'en' })).join('');
  const ids = [...pair.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.ok(ids.length > 0); assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.every(id => id.startsWith('a-') || id.startsWith('b-')));
});

test('English and French string keys and placeholders match', () => {
  assert.deepEqual(Object.keys(strings.en).sort(), Object.keys(strings.fr).sort());
  for (const key of Object.keys(strings.en)) assert.deepEqual(strings.en[key].match(/\{\w+\}/g), strings.fr[key].match(/\{\w+\}/g));
});

test('state validation rejects unknown parts, malformed results and impossible dates, and copies valid state', () => {
  const record = { result: 'remembered', reviewOn: '2026-10-09' };
  const valid = { results: { stonewalling: record } };
  for (const value of [null, [], {}, { results: [] }, { results: null }, { results: {}, extra: 1 }, { results: { unknown: record } }, ...[null, [], {}, { ...record, result: 'toString' }, { ...record, reviewOn: 4 }, { ...record, reviewOn: '2026-02-29' }, { ...record, reviewOn: '2026-04-31' }, { ...record, reviewOn: '2026-13-01' }, { ...record, reviewOn: '2026-1-01' }, { ...record, extra: true }].map(row => ({ results: { stonewalling: row } }))]) assert.equal(validateState(content, value), null);
  assert.deepEqual(validateState(content, valid), valid);
  const copy = validateState(content, valid); copy.results.stonewalling.reviewOn = '2026-10-10';
  assert.equal(valid.results.stonewalling.reviewOn, '2026-10-09');
  assert.deepEqual(validateState(content, { results: {} }), { results: {} });
  assert.ok(validateState(content, { results: { return: { result: 'forgot', reviewOn: '2028-02-29' } } }));
  const special = { ...content, parts: [{ ...content.parts[0], id: '__proto__' }] };
  assert.deepEqual(validateState(special, JSON.parse('{"results":{"__proto__":{"result":"forgot","reviewOn":"2026-10-07"}}}')), JSON.parse('{"results":{"__proto__":{"result":"forgot","reviewOn":"2026-10-07"}}}'));
});
