import { frenchTypography } from '../../lib/html.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MAX_LENGTH, validateContent, validateAnswer, validateState, emptyState, withFirstAnswer, withAnswerNow, withChecks } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));
const FIRST = '2026-10-06T09:05:00.000Z';
const END = '2026-10-07T09:40:00.000Z';
const initial = { first: null, now: null, checks: { specific: false, behaviour: false, view: false } };

// Mirror only the schema keywords used here, including the identity annotation.
function matches(value, rule) {
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (rule.required.some(key => !Object.hasOwn(value, key))) return false;
    if (Object.keys(value).some(key => !Object.hasOwn(rule.properties, key))) return false;
    return Object.entries(rule.properties).every(([key, child]) => matches(value[key], child));
  }
  if (rule.type === 'array') {
    return Array.isArray(value) && value.length >= rule.minItems && new Set(value.map(item => item?.id)).size === value.length && value.every(item => matches(item, rule.items));
  }
  return typeof value === 'string' && value.length >= rule.minLength && (!rule.pattern || new RegExp(rule.pattern).test(value));
}

test('content validator and schema agree on both examples and planted violations', async () => {
  const fr = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
  for (const value of [content, fr, { ...content, prompt: ' ' }]) {
    assert.doesNotThrow(() => validateContent(value)); assert.equal(matches(value, schema), true);
  }
  const bad = [[null, 'content'], [[], 'content'], [{ ...content, extra: '' }, 'extra']];
  for (const value of ['', 3, null, undefined]) bad.push([{ ...content, prompt: value }, 'prompt']);
  for (const value of [[], null, 'checks']) bad.push([{ ...content, checks: value }, 'checks']);
  bad.push([{ ...content, checks: [null] }, 'checks[0]']);
  for (const field of ['id', 'label']) for (const value of ['', 3, null, undefined]) bad.push([{ ...content, checks: [{ ...content.checks[0], [field]: value }] }, field]);
  bad.push([{ ...content, checks: [{ id: 'bad id', label: 'Bad' }] }, 'id']);
  bad.push([{ ...content, checks: [{ ...content.checks[0], extra: '' }] }, 'extra']);
  bad.push([{ ...content, checks: [content.checks[0], content.checks[0]] }, 'id']);
  for (const [value, field] of bad) {
    assert.equal(matches(value, schema), false, field);
    assert.throws(() => validateContent(value), error => error instanceof Error && error.message.includes(field));
  }
});

test('answer validation trims and refuses blank, nontext and overlong answers at the boundary', () => {
  assert.equal(MAX_LENGTH, 2000);
  for (const value of ['', ' \n ', undefined, 8, null]) assert.deepEqual(validateAnswer(value), { ok: false, error: 'empty' });
  assert.deepEqual(validateAnswer('x'.repeat(2001)), { ok: false, error: 'tooLong' });
  assert.deepEqual(validateAnswer('x'.repeat(2000)), { ok: true, text: 'x'.repeat(2000) });
  assert.deepEqual(validateAnswer('  Can I finish first?  '), { ok: true, text: 'Can I finish first?' });
});

test('first answer stores text and date once; comparisons replace only now', () => {
  assert.deepEqual(emptyState(content), initial);
  const first = withFirstAnswer(content, null, ' Stop interrupting me. ', FIRST);
  assert.deepEqual(first, { ...initial, first: { text: 'Stop interrupting me.', savedAt: FIRST } });
  assert.throws(() => withFirstAnswer(content, first, 'Better answer', END), /already saved/);
  const now = withAnswerNow(content, first, 'When you cut in, I lose my thread. What is happening for you?', END);
  const checked = withChecks(content, now, { specific: true, behaviour: false, view: true });
  const again = withAnswerNow(content, checked, 'Second try', END);
  assert.deepEqual(again.first, first.first);
  assert.deepEqual(again.now, { text: 'Second try', savedAt: END });
  assert.deepEqual(again.checks, checked.checks);
  assert.notEqual(again.first, checked.first);
  assert.deepEqual(first, { ...initial, first: { text: 'Stop interrupting me.', savedAt: FIRST } });
});

test('end without a first answer accepts an answer now and its self-checks', () => {
  const now = withAnswerNow(content, null, 'Can I finish my thought?', END);
  assert.deepEqual(now, { ...initial, now: { text: 'Can I finish my thought?', savedAt: END } });
  assert.deepEqual(withChecks(content, now, { specific: true, view: 'yes', extra: true }).checks, { specific: true, behaviour: false, view: false });
  assert.throws(() => withChecks(content, initial, {}), /Compare/);
  assert.throws(() => withFirstAnswer(content, now, 'Late first', END), /already started/);
});

test('action guards reject blank, overlong text, bad dates and malformed records', () => {
  for (const action of [withFirstAnswer, withAnswerNow]) {
    assert.throws(() => action(content, null, ' ', FIRST), /empty/);
    assert.throws(() => action(content, null, 'x'.repeat(2001), FIRST), /tooLong/);
    for (const date of ['yesterday', '2026-02-30T09:00:00.000Z', '2026-10-06', null, '2026-10-06T25:00:00Z']) assert.throws(() => action(content, null, 'Hello', date), /savedAt/);
    assert.throws(() => action(content, {}, 'Hello', FIRST), /state/);
  }
  assert.throws(() => withChecks(content, {}, {}), /state/);
});

test('state validation copies valid shapes and rejects damaged dates, text and checks', () => {
  const value = { first: { text: 'Stop.', savedAt: FIRST }, now: { text: 'May I finish?', savedAt: END }, checks: { specific: true, behaviour: false, view: true } };
  assert.deepEqual(validateState(content, value), value);
  const copy = validateState(content, value);
  copy.first.text = 'changed'; copy.now.text = 'changed'; copy.checks.view = false;
  assert.equal(value.first.text, 'Stop.'); assert.equal(value.now.text, 'May I finish?'); assert.equal(value.checks.view, true);
  assert.deepEqual(validateState(content, initial), initial);
  assert.deepEqual(validateState(content, { ...value, first: null }), { ...value, first: null });
  assert.ok(validateState(content, { ...value, first: { text: 'A', savedAt: '2026-10-06T09:05:00-04:00' } }));
  for (const bad of [null, undefined, [], {}, 'broken', { ...value, extra: true }, { ...value, now: undefined }, { ...value, first: [] }, { ...value, first: { ...value.first, extra: '' } }, ...['', ' Stop.', 'x'.repeat(2001), 7].map(text => ({ ...value, first: { ...value.first, text } })), ...['yesterday', '2026-02-30T09:00:00Z', '2026-10-06'].map(savedAt => ({ ...value, now: { ...value.now, savedAt } })), { ...value, checks: null }, { ...value, checks: [] }, { ...value, checks: {} }, { ...value, checks: { ...value.checks, view: 'yes' } }, { ...value, checks: { ...value.checks, extra: false } }, { ...initial, checks: { ...initial.checks, view: true } }]) assert.equal(validateState(content, bad), null, JSON.stringify(bad));
  const custom = { prompt: 'A', checks: [{ id: '__proto__', label: 'B' }] };
  assert.deepEqual(emptyState(custom).checks, JSON.parse('{"__proto__":false}'));
});

test('render escapes every authored value and prefixes all ids and references', () => {
  const hostile = '<script>alert("x")</script> & \'quoted\'';
  const value = { prompt: hostile, checks: [{ id: 'one', label: hostile }] };
  const ui = Object.fromEntries(Object.keys(strings.en).map(key => [key, hostile]));
  const html = render(value, ui, { id: 'first"', lang: 'en"' });
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quoted&#39;'));
  assert.ok(html.includes('lang="en&quot;"'));
  const a = render(content, strings.en, { id: 'a', lang: 'en' });
  const b = render(content, strings.en, { id: 'b', lang: 'fr' });
  const ids = [...(a + b).matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.ok(ids.length > 0); assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(id.startsWith('a-') || id.startsWith('b-'));
  for (const reference of [...(a + b).matchAll(/(?:for|aria-labelledby|aria-describedby)="([^"]+)"/g)]) assert.ok(ids.includes(reference[1]));
  assert.equal((a.match(/role="status"/g) || []).length, 1);
  assert.match(a, /role="status"[^>]*><\/p>/);
  assert.match(a, /maxlength="2000"/); assert.ok(a.includes('Saving your answer needs JavaScript.'));
});

test('render stages select the two placements; only both has the course skip', () => {
  const both = render(content, strings.en, { id: 'p', lang: 'en' });
  assert.ok(both.includes('data-lp-stage="both"')); assert.ok(both.includes('data-lp-skip'));
  assert.ok(both.includes('Take the course, then answer again.'));
  const first = render(content, strings.en, { id: 'p', lang: 'en', stage: 'first' });
  const end = render(content, strings.en, { id: 'p', lang: 'en', stage: 'end' });
  assert.ok(first.includes('data-lp-first-step')); assert.equal(first.includes('data-lp-end-step'), false);
  assert.ok(end.includes('data-lp-end-step')); assert.equal(end.includes('data-lp-first-step'), false);
  assert.equal(first.includes('data-lp-skip'), false); assert.equal(end.includes('data-lp-skip'), false);
  assert.throws(() => render(content, strings.en, { id: 'p', lang: 'en', stage: 'bad' }), /stage/);
});

test('journal scene, day headings and dated cards render in both languages and every placement', () => {
  for (const [lang, journal, day, end, note] of [
    ['en', 'Your journal', 'Day one', 'End of the course', 'It stays as you wrote it.'],
    ['fr', 'Votre journal', 'Premier jour', 'Fin du cours', "Elle reste telle que vous l'avez écrite."]
  ]) for (const stage of ['first', 'end', 'both']) {
    const markup = render(content, strings[lang], { id: 'journal', lang, stage });
    assert.match(markup, /<header class="lp-scene">/);
    assert.equal(markup.includes(journal), false);
    assert.equal(markup.split(frenchTypography(content.prompt, lang)).length - 1, 1);
    assert.equal(markup.includes('Step 1'), false); assert.equal(markup.includes('Étape 1'), false);
    if (stage !== 'end') assert.ok(markup.includes(`id="journal-start">${day}</h3>`));
    if (stage !== 'first') {
      assert.ok(markup.includes(`tabindex="-1">${end}</h3>`));
      assert.match(markup, /data-lp-panel-first-card/);
    }
    assert.equal(markup.includes(note.replaceAll("'", '&#39;')), false);
    assert.match(markup, /lp-first-answer-date[^>]*>.*<svg[^>]*aria-hidden="true"/s);
    if (stage === 'both') assert.match(markup, /class="lp-first-answer-timeline" data-lp-course hidden/);
  }
});

test('English and French strings are nonempty with matching keys and placeholders', () => {
  assert.ok(Object.keys(strings.en).length >= 20);
  assert.deepEqual(Object.keys(strings.en).sort(), Object.keys(strings.fr).sort());
  for (const key of Object.keys(strings.en)) {
    assert.ok(strings.en[key]); assert.ok(strings.fr[key]);
    assert.deepEqual(strings.en[key].match(/\{\w+\}/g), strings.fr[key].match(/\{\w+\}/g));
  }
});

test('owner audit: scene contains only icon and title', () => {
  for (const lang of ['en', 'fr']) {
    const markup = render(content, strings[lang], { id: 'audit', lang });
    assert.doesNotMatch(markup, /lp-scene-label/);
  }
});

test('owner audit: saved entry notes removed from both placements and languages', () => {
  for (const lang of ['en', 'fr']) {
    assert.equal(Object.hasOwn(strings[lang], 'kept'), false);
    const markup = render(content, strings[lang], { id: 'audit', lang });
    assert.doesNotMatch(markup, /lp-first-answer-note|data-lp-panel-note/);
    assert.match(markup, /data-lp-first-date/);
    assert.match(markup, /data-lp-panel-first-date/);
  }
});
