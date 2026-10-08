import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DONT_KNOW, score, validateContent, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));
const all = pick => Object.fromEntries(content.questions.map(q => [q.id, pick(q)]));

// These are the schema keywords used here, including documented identity/reference extensions.
function matches(value, rule) {
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (rule.required.some(key => !Object.hasOwn(value, key))) return false;
    if (Object.keys(value).some(key => !Object.hasOwn(rule.properties, key))) return false;
    if (!Object.entries(rule.properties).every(([key, child]) => matches(value[key], child))) return false;
    return !rule['x-optionReference'] || value.options.some(option => option.id === value.correct);
  }
  if (rule.type === 'array') {
    if (!Array.isArray(value) || value.length < rule.minItems) return false;
    if (rule['x-uniqueBy'] && new Set(value.map(item => item?.id)).size !== value.length) return false;
    return value.every(item => matches(item, rule.items));
  }
  if (rule.type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === 'string' && value.length >= rule.minLength && (!rule.pattern || new RegExp(rule.pattern).test(value)) && (!rule.not || value !== rule.not.const);
}

test('four money questions retain their text, answers and descriptive option identities', () => {
  assert.equal(content.title, 'Money basics');
  assert.equal(french.title, "Notions de base en finances personnelles");
  assert.deepEqual(content.questions.map(q => q.text), [
    'What is an emergency fund for?',
    "What usually happens if you pay only your credit card's minimum each month?",
    'How does compound interest help savings grow over time?',
    'What does a budget help you do?'
  ]);
  assert.deepEqual(content.questions.map(q => q.correct), ['unexpected-expenses', 'longer-more-interest', 'interest-on-interest', 'plan-spending-saving']);
  assert.deepEqual(french.questions.map(q => q.options.map(o => o.id)), content.questions.map(q => q.options.map(o => o.id)));
});

test('score distinguishes right, wrong, unknown and unanswered, in question order', () => {
  assert.deepEqual(score(content, all(q => q.correct)), { points: 4, total: 4, right: ['q1', 'q2', 'q3', 'q4'], wrong: [], unknown: [], unanswered: [] });
  assert.deepEqual(score(content, all(q => q.options.find(o => o.id !== q.correct).id)), { points: -4, total: 4, right: [], wrong: ['q1', 'q2', 'q3', 'q4'], unknown: [], unanswered: [] });
  assert.deepEqual(score(content, all(() => DONT_KNOW)), { points: 0, total: 4, right: [], wrong: [], unknown: ['q1', 'q2', 'q3', 'q4'], unanswered: [] });
  assert.deepEqual(score(content, { q1: 'unexpected-expenses', q2: 'no-interest', q3: DONT_KNOW }), { points: 0, total: 4, right: ['q1'], wrong: ['q2'], unknown: ['q3'], unanswered: ['q4'] });
  assert.deepEqual(score(content, {} ).unanswered, ['q1', 'q2', 'q3', 'q4']);
});

test('authored points determine score and total, including fractions and negative values', () => {
  const authored = { ...content, points: { right: 2.5, wrong: -0.5, unknown: 0.25 } };
  assert.equal(score(authored, all(q => q.correct)).points, 10);
  assert.equal(score(authored, all(() => DONT_KNOW)).points, 1);
  assert.equal(score(authored, { q1: 'unexpected-expenses', q2: 'no-interest', q3: DONT_KNOW, q4: 'plan-spending-saving' }).points, 4.75);
  assert.equal(score(authored, {}).total, 10);
  assert.equal(score({ ...content, points: { right: -2, wrong: -3, unknown: 0 } }, {}).total, -8);
});

test('score rejects invalid picks and unknown question keys rather than hiding them', () => {
  for (const picks of [null, [], { q1: null }, { q1: 3 }, { q1: 'maybe' }, { other: 'dont-know' }, { q1: undefined }]) assert.throws(() => score(content, picks), /picks|q1|other/);
  const inherited = Object.create({ q1: 'unexpected-expenses' });
  assert.deepEqual(score(content, inherited).unanswered, ['q1', 'q2', 'q3', 'q4']);
});

test('content validator and schema agree, with planted violations for every guard', () => {
  const fixtures = [[content, true], [french, true], [{ ...content, questions: [{ ...content.questions[0], text: ' ' }] }, true]];
  const bad = (value, field) => fixtures.push([value, false, field]);
  bad(null, 'content'); bad([], 'content'); bad({ ...content, extra: '' }, 'extra');
  for (const title of ['', null, 3, undefined]) bad({ ...content, title }, 'title');
  for (const value of [[], null, 'questions', undefined]) bad({ ...content, questions: value }, 'questions');
  const q = content.questions[0], option = q.options[0];
  const question = value => ({ ...content, questions: [value] });
  bad(question(null), 'questions[0]'); bad(question({ ...q, extra: 1 }), 'extra');
  for (const field of ['id', 'text', 'correct', 'explanation']) for (const value of ['', null, 3, undefined]) bad(question({ ...q, [field]: value }), field);
  bad(question({ ...q, id: 'bad id' }), 'id');
  bad({ ...content, questions: [q, q] }, 'id');
  bad(question({ ...q, correct: 'missing' }), 'correct');
  for (const value of [[], null, 'options', undefined]) bad(question({ ...q, options: value }), 'options');
  bad(question({ ...q, options: [null] }), 'options[0]');
  for (const field of ['id', 'text']) for (const value of ['', null, 3, undefined]) bad(question({ ...q, options: [{ ...option, [field]: value }] }), field);
  for (const id of ['bad id', DONT_KNOW]) bad(question({ ...q, options: [{ ...option, id }] }), 'id');
  bad(question({ ...q, options: [option, option] }), 'id');
  bad(question({ ...q, options: [{ ...option, extra: 1 }] }), 'extra');
  for (const value of [null, [], undefined, 'points']) bad({ ...content, points: value }, 'points');
  bad({ ...content, points: { ...content.points, extra: 1 } }, 'extra');
  for (const field of ['right', 'wrong', 'unknown']) for (const value of [null, '1', undefined, Infinity, NaN]) bad({ ...content, points: { ...content.points, [field]: value } }, field);
  for (const [value, valid, field] of fixtures) {
    assert.equal(matches(value, schema), valid, `schema: ${field}`);
    if (valid) assert.doesNotThrow(() => validateContent(value));
    else assert.throws(() => validateContent(value), error => error instanceof Error && error.message.includes(field));
  }
});

test('saved state must have valid own picks, and shown results need complete answers', () => {
  for (const value of [null, [], {}, { picks: [], shown: false }, { picks: { q1: 'bad' }, shown: false }, { picks: { other: DONT_KNOW }, shown: false }, { picks: { q1: 3 }, shown: false }, { picks: {}, shown: 'yes' }, { picks: {}, shown: true }, { picks: { q1: 'unexpected-expenses' }, shown: true }, { picks: {}, shown: false, extra: 1 }]) assert.equal(validateState(content, value), null);
  const saved = { picks: all(() => DONT_KNOW), shown: true };
  assert.deepEqual(validateState(content, saved), saved);
  assert.notEqual(validateState(content, saved).picks, saved.picks);
  assert.deepEqual(validateState(content, { picks: {}, shown: false }), { picks: {}, shown: false });
  assert.deepEqual(validateState(content, { picks: { q1: 'unexpected-expenses' }, shown: false }), { picks: { q1: 'unexpected-expenses' }, shown: false });
});

test('render escapes text, strings and attributes; ids and radio groups are instance-specific', () => {
  const hostile = '<script>alert("x")</script> & \'quoted\'';
  const q = content.questions[0];
  const value = { ...content, title: hostile, questions: [{ ...q, text: hostile, explanation: hostile, options: [{ ...q.options[0], text: hostile }] }] };
  const ui = Object.fromEntries(Object.keys(strings.en).map(key => [key, hostile]));
  const output = render(value, ui, { id: 'first"', lang: 'en"' });
  assert.equal(output.includes('<script>'), false);
  assert.ok(output.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quoted&#39;'));
  assert.ok(output.includes('lang="en&quot;"'));
  const a = render(content, strings.en, { id: 'a', lang: 'en' });
  const b = render(content, strings.en, { id: 'b', lang: 'en' });
  const ids = [...(a + b).matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => id.startsWith('a-') || id.startsWith('b-')));
  assert.equal((a.match(/role="status"/g) || []).length, 1);
  assert.match(a, /role="status"[^>]*><\/p>/);
  assert.match(a, /A right answer scores a point\. A wrong answer costs a point\. &quot;I don&#39;t know&quot; costs nothing\./);
  assert.match(a, /data-lp-restart hidden/);
  assert.match(a, /<details[^>]*data-lp-fallback/);
  assert.equal((a.match(/type="radio"/g) || []).length, 16);
  for (const q of content.questions) assert.ok(a.includes(q.explanation));
});

test('render explains authored scoring in words, including sign, zero, singular and plural in both languages', () => {
  const cases = [
    ['en', { right: 1, wrong: -1, unknown: 0 }, 'A right answer scores a point. A wrong answer costs a point. &quot;I don&#39;t know&quot; costs nothing.'],
    ['en', { right: 2, wrong: -0.5, unknown: 0.25 }, 'A right answer scores 2 points. A wrong answer costs 0.5 points. &quot;I don&#39;t know&quot; scores 0.25 points.'],
    ['en', { right: -2, wrong: 1, unknown: -1 }, 'A right answer costs 2 points. A wrong answer scores a point. &quot;I don&#39;t know&quot; costs a point.'],
    ['en', { right: 0, wrong: -0, unknown: 1 }, 'A right answer scores no points. A wrong answer costs nothing. &quot;I don&#39;t know&quot; scores a point.'],
    ['fr', { right: 1, wrong: -1, unknown: 0 }, 'Une bonne réponse rapporte un point. Une mauvaise réponse coûte un point. « Je ne sais pas » ne coûte rien.'],
    ['fr', { right: 2.5, wrong: -2, unknown: 0.25 }, 'Une bonne réponse rapporte 2,5 points. Une mauvaise réponse coûte 2 points. « Je ne sais pas » rapporte 0,25 point.'],
    ['fr', { right: -1, wrong: 0, unknown: 2 }, 'Une bonne réponse coûte un point. Une mauvaise réponse ne coûte rien. « Je ne sais pas » rapporte 2 points.'],
    ['fr', { right: 0, wrong: 1, unknown: -0.5 }, 'Une bonne réponse ne rapporte aucun point. Une mauvaise réponse rapporte un point. « Je ne sais pas » coûte 0,5 point.']
  ];
  for (const [lang, points, expected] of cases) {
    assert.ok(render({ ...content, points }, strings[lang], { id: 'scoring', lang }).includes(expected), expected);
  }
});

test('server markup uses shared course styles and focusable question targets without inner boxes', () => {
  const output = render(content, strings.en, { id: 'practice', lang: 'en' });
  assert.match(output, /class="lp lp-dont-know"/);
  assert.equal((output.match(/class="lp-choices"/g) || []).length, 4);
  assert.equal((output.match(/<legend class="lp-stem"/g) || []).length, 4);
  assert.equal((output.match(/class="lp-choice"/g) || []).length, 16);
  assert.equal((output.match(/id="practice-question-\d" tabindex="-1"/g) || []).length, 4);
  assert.match(output, /class="lp-details lp-section"/);
  assert.match(output, /class="lp-button lp-button-quiet"[^>]*data-lp-restart hidden/);
  assert.match(output, /lp-error-text[^>]*data-lp-question-error hidden><svg[\s\S]*?Choose an answer/);
});

test('English and French keys and template placeholders match', () => {
  assert.deepEqual(Object.keys(strings.en).sort(), Object.keys(strings.fr).sort());
  for (const key of Object.keys(strings.en)) assert.deepEqual(strings.en[key].match(/\{\w+\}/g), strings.fr[key].match(/\{\w+\}/g));
});

test('quiz scene renders escaped authored titles, bilingual question numbers and explanation panels', () => {
  for (const [lang, source, title, label, number] of [
    ['en', content, 'Money basics', 'Quick check', 'Question 1 of 4'],
    ['fr', french, "Notions de base en finances personnelles", 'Vérification rapide', 'Question 1 sur 4']
  ]) {
    const output = render({ ...source, title }, strings[lang], { id: 'quiz', lang });
    assert.match(output, /<header class="lp-scene">/);
    assert.equal(output.includes(label), false);
    assert.ok(output.includes(title.replaceAll("'", '&#39;')));
    assert.ok(output.includes(number));
    assert.equal((output.match(/class="lp-small lp-dont-know-question-number"/g) || []).length, 4);
    assert.equal((output.match(/class="lp-quote lp-dont-know-explanation"/g) || []).length, 4);
    assert.match(output, /data-lp-explanation hidden><svg[^>]+aria-hidden="true"/);
  }
});

test('owner audit: scene contains only icon and title', () => {
  for (const lang of ['en', 'fr']) {
    const markup = render(content, strings[lang], { id: 'audit', lang });
    assert.doesNotMatch(markup, /lp-scene-label/);
  }
});
