import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import * as logic from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));
const options = { id: 'sheet', lang: 'en', today: new Date(2026, 9, 6, 23, 45) };

test('spacing presets use civil days across month and year boundaries', () => {
  assert.deepEqual(logic.presetDays, [2, 7, 14, 30]);
  for (const [today, dates] of [
    [new Date(2026, 9, 30, 23, 45), ['2026-11-01', '2026-11-06', '2026-11-13', '2026-11-29']],
    [new Date(2026, 11, 29, 23, 45), ['2026-12-31', '2027-01-05', '2027-01-12', '2027-01-28']]
  ]) {
    const before = today.getTime();
    assert.deepEqual(logic.presetDays.map(days => logic.dateAfterDays(today, days)), dates);
    assert.equal(logic.defaultDate(today), dates[1]);
    assert.equal(today.getTime(), before);
  }
});

test('spacing dates and short labels preserve civil days in non-UTC zones', () => {
  const code = `import { dateAfterDays, formatShortDate } from ${JSON.stringify(new URL('./logic.js', import.meta.url).href)};
    console.log(JSON.stringify([dateAfterDays(new Date(2026,9,30,23,45),2),dateAfterDays(new Date(2026,11,29,23,45),30),formatShortDate('2026-10-15','en'),formatShortDate('2026-10-15','fr')]));`;
  for (const zone of ['America/Toronto', 'Pacific/Honolulu']) {
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ: zone }, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(result), ['2026-11-01', '2027-01-28', 'Thu, Oct 15', 'jeu. 15 oct.']);
  }
});

test('server spacing choices have named radios and stay hidden without JavaScript', () => {
  const markup = render(content, strings.en, options);
  assert.match(markup, /<fieldset[^>]*data-lp-spacing/);
  assert.ok(markup.includes('When will you test yourself?'));
  assert.equal((markup.match(/type="radio"/g) || []).length, 5);
  assert.match(markup, /value="7" checked/);
  assert.match(markup, /data-lp-custom-date hidden/);
  assert.ok(markup.indexOf('data-lp-tabs') > markup.indexOf('</fieldset>'));
});

// The schema keywords used by this pattern, including the identity annotation.
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
  return typeof value === 'string' && value.length >= rule.minLength && (!rule.pattern || new RegExp(rule.pattern).test(value));
}

test('content validator and schema accept both languages and catch planted violations', () => {
  const fixtures = [[content, true], [french, true], [{ ...content, title: ' ' }, true]];
  const bad = (value, field) => fixtures.push([value, false, field]);
  for (const value of [null, [], 'text']) bad(value, 'content');
  for (const value of ['', 2, null, undefined]) bad({ ...content, title: value }, 'title');
  bad({ ...content, extra: true }, 'extra');
  for (const value of [[], null, 'text', undefined]) bad({ ...content, questions: value }, 'questions');
  bad({ ...content, questions: [null] }, 'questions[0]');
  for (const field of ['id', 'question', 'answer']) {
    for (const value of ['', 2, null, undefined]) bad({ ...content, questions: [{ ...content.questions[0], [field]: value }] }, field);
  }
  bad({ ...content, questions: [{ ...content.questions[0], id: 'bad id' }] }, 'id');
  bad({ ...content, questions: [{ ...content.questions[0], extra: 1 }] }, 'extra');
  bad({ ...content, questions: [content.questions[0], content.questions[0]] }, 'id');
  for (const [value, valid, field] of fixtures) {
    assert.equal(matches(value, schema), valid, `schema ${field}`);
    if (valid) assert.doesNotThrow(() => logic.validateContent(value));
    else assert.throws(() => logic.validateContent(value), error => error.message.includes(field), `validator ${field}`);
  }
  assert.throws(() => render({ ...content, title: '' }, strings.en, options), /title/);
});

test('default date is seven local calendar days ahead across month, year and leap boundaries', () => {
  for (const [date, expected] of [
    [new Date(2026, 9, 6, 23, 45), '2026-10-13'],
    [new Date(2026, 9, 30), '2026-11-06'],
    [new Date(2026, 11, 29), '2027-01-05'],
    [new Date(2028, 1, 22), '2028-02-29'],
    [new Date(2027, 1, 22), '2027-03-01']
  ]) {
    const before = date.getTime();
    assert.equal(logic.defaultDate(date), expected);
    assert.equal(date.getTime(), before);
  }
  const early = new Date(0); early.setFullYear(1, 0, 1);
  assert.equal(logic.defaultDate(early), '0001-01-08');
});

test('calendar scheduling survives DST and date display does not shift time zones', () => {
  const code = `import { defaultDate, formatDate } from ${JSON.stringify(new URL('./logic.js', import.meta.url).href)};
    console.log(JSON.stringify([defaultDate(new Date(2026,2,7,23,45)),defaultDate(new Date(2026,9,31,23,45)),formatDate('2026-10-13','en')]));`;
  for (const zone of ['America/Toronto', 'Pacific/Honolulu']) {
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ: zone }, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(result), ['2026-03-14', '2026-11-07', 'October 13, 2026']);
  }
  assert.equal(logic.formatDate('2028-02-29', 'fr-CA'), '29 février 2028');
});

test('date guards reject impossible dates, invalid source dates and overflow', () => {
  for (const value of [null, undefined, 3, '', '2026-1-01', '2026-02-29', '2026-04-31', '2026-13-01', '2026-01-00', '0000-01-01', '10000-01-01']) {
    assert.equal(logic.isDate(value), false);
    assert.throws(() => logic.formatDate(value, 'en'), /date/);
    assert.throws(() => logic.formatShortDate(value, 'en'), /date/);
  }
  for (const value of ['0001-01-01', '2028-02-29', '9999-12-31']) assert.equal(logic.isDate(value), true);
  for (const value of [null, '2026-10-06', new Date(NaN)]) assert.throws(() => logic.defaultDate(value), /Date/);
  for (const year of [0, -1, 10000]) {
    const date = new Date(0); date.setFullYear(year);
    assert.throws(() => logic.defaultDate(date), /date range/);
  }
  assert.throws(() => logic.defaultDate(new Date(9999, 11, 30)), /date range/);
  for (const days of [NaN, Infinity, 1.5, '7', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => logic.dateAfterDays(new Date(2026, 9, 6), days), /safe integer/);
  }
  for (const days of [-1, 30]) {
    assert.throws(() => logic.dateAfterDays(days < 0 ? new Date('0001-01-01T12:00:00') : new Date(9999, 11, 20), days), /date range/);
  }
});

test('state copies a valid date and side and ignores malformed saved values', () => {
  const valid = { date: '2028-02-29', side: 'back' };
  assert.deepEqual(logic.validateState(valid), valid);
  const copy = logic.validateState(valid); copy.date = '2028-03-01';
  assert.equal(valid.date, '2028-02-29');
  assert.deepEqual(logic.validateState({ date: '2025-01-02', side: 'front' }), { date: '2025-01-02', side: 'front' });
  for (const value of [null, [], {}, { date: '2028-02-29' }, { ...valid, extra: true },
    ...['', 5, null, '2026-02-29', '2026-04-31'].map(date => ({ ...valid, date })),
    ...['', 'left', null, 'toString', 2].map(side => ({ ...valid, side }))]) assert.equal(logic.validateState(value), null);
});

test('server sheet includes scene header, six questions then answers, a printed date and hidden controls', () => {
  const markup = render(content, strings.en, options);
  assert.match(markup, /class="lp lp-retrieval-sheet" data-lp-pattern="retrieval-sheet" lang="en"/);
  assert.match(markup, /class="lp-scene"/);
  assert.doesNotMatch(markup, /Take it with you/);
  assert.match(markup, /<h2[^>]*id="sheet-title"[^>]*>The four horsemen<\/h2>/);
  assert.match(markup, /data-lp-controls hidden/);
  assert.match(markup, /type="date"/);
  assert.match(markup, /value="2026-10-13"/);
  assert.equal((markup.match(/datetime="2026-10-13"/g) || []).length, 2);
  assert.equal((markup.match(/data-lp-question=/g) || []).length, 12);
  assert.equal((markup.match(/data-lp-side="(?:front|back)"/g) || []).length, 2);
  assert.doesNotMatch(markup, /data-lp-side="(?:front|back)"[^>]*hidden/);
  assert.ok(markup.indexOf('data-lp-side="front"') < markup.indexOf('data-lp-side="back"'));
  assert.equal((markup.match(/role="status"/g) || []).length, 1);
  assert.match(markup, /role="status" aria-atomic="true"><\/p>/);
  for (const row of content.questions) {
    const escaped = text => text.replaceAll("'", '&#39;').replaceAll('"', '&quot;');
    assert.ok(markup.includes(escaped(row.question))); assert.ok(markup.includes(escaped(row.answer)));
  }
  assert.ok(markup.includes(strings.en.instruction));
});

test('render escapes every authored field, UI string and attribute, with distinct instance ids', () => {
  const hostile = '<script>alert("x")</script> & \'quoted\'';
  const value = { title: hostile, questions: [{ id: 'one', question: hostile, answer: hostile }] };
  const ui = Object.fromEntries(Object.keys(strings.en).map(key => [key, hostile]));
  const markup = render(value, ui, { ...options, id: 'first"', lang: 'fr"' });
  assert.doesNotMatch(markup, /<script>/);
  assert.match(markup, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &#39;quoted&#39;/);
  assert.match(markup, /lang="fr&quot;"/);
  const pair = ['a', 'b'].map(id => render(content, strings.en, { ...options, id })).join('');
  const ids = [...pair.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.ok(ids.length > 0); assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.every(id => id.startsWith('a-') || id.startsWith('b-')));
});

test('English and French keys and placeholders match and copy contains no em dashes', () => {
  assert.deepEqual(Object.keys(strings.en).sort(), Object.keys(strings.fr).sort());
  assert.equal(Object.hasOwn(strings.en, 'takeAway'), false);
  for (const key of Object.keys(strings.en)) assert.deepEqual(strings.en[key].match(/\{\w+\}/g), strings.fr[key].match(/\{\w+\}/g));
  assert.doesNotMatch(JSON.stringify([strings, content, french]), /\u2014/);
});

test('owner audit: scene contains only icon and title', () => {
  for (const lang of ['en', 'fr']) {
    const markup = render(content, strings[lang], { id: 'audit', lang });
    assert.doesNotMatch(markup, /lp-scene-label/);
  }
});

test('owner audit: one recall instruction survives printing', () => {
  for (const lang of ['en', 'fr']) {
    const markup = render(content, strings[lang], { id: 'audit', lang });
    assert.equal(Object.hasOwn(strings[lang], 'frontInstruction'), false);
    assert.equal(Object.hasOwn(strings[lang], 'summary'), false);
    assert.ok(markup.indexOf(strings[lang].instruction) > markup.indexOf('data-lp-side="front"'));
    assert.ok(markup.indexOf(strings[lang].instruction) < markup.indexOf('data-lp-side="back"'));
  }
});

test('a year with fewer than four digits is still being typed, not a date', () => {
  for (const value of ['0002-11-09', '0020-11-09', '0202-11-09', '0999-12-31']) assert.equal(logic.isPartialYear(value), true, value);
  for (const value of ['1000-01-01', '2027-11-09', '', 'nope', '2026-02-30', null]) assert.equal(logic.isPartialYear(value), false, String(value));
});
