import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { clampPoint, movePlace, switchFormat, spokenLines, checkQuizAnswer, validateContent, validateState, FORMATS } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));
const readme = await readFile(new URL('./README.md', import.meta.url), 'utf8');
const index = await readFile(new URL('../../README.md', import.meta.url), 'utf8');

test('owner fix: opening and catalogue describe the same section and keeping your place', () => {
  const summary = 'The same section as text, slides, an audio script or a quiz. Switching keeps your place.';
  assert.ok(readme.includes(`summary: ${summary}\n`));
  assert.ok(readme.includes(`# Switch formats\n\n${summary}\n`));
  assert.ok(index.includes(`| [Switch formats](patterns/formats/README.md) | ${summary} |`));
});

test('owner fix: the retired outline format is refused and saved outline state is ignored', () => {
  assert.throws(() => switchFormat({ format: 'text', section: 1 }, 'outline'), /Invalid format/);
  assert.equal(validateState(content, { format: 'outline', section: 1 }), null);
});

// Same schema subset as review-prompts, plus optional fields, booleans and enum.
function matches(value, rule) {
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (rule.required.some(key => !Object.hasOwn(value, key))) return false;
    if (Object.keys(value).some(key => !Object.hasOwn(rule.properties, key))) return false;
    return Object.entries(value).every(([key, child]) => matches(child, rule.properties[key]));
  }
  if (rule.type === 'array') {
    if (!Array.isArray(value) || value.length < rule.minItems) return false;
    if (rule['x-uniqueBy'] && new Set(value.map(item => item?.[rule['x-uniqueBy']])).size !== value.length) return false;
    return value.every(item => matches(item, rule.items));
  }
  if (rule.type === 'boolean') return typeof value === 'boolean';
  return typeof value === 'string' && value.length >= rule.minLength && (!rule.pattern || new RegExp(rule.pattern).test(value));
}

test('demo content preserves the three points, two questions and narration order', () => {
  validateContent(content); validateContent(french);
  assert.deepEqual(content.points.map(point => point.title), ['Stonewalling is withdrawing', 'It leaves the problem open', 'Take a time-out instead']);
  assert.equal(content.quiz.length, 2);
  assert.deepEqual(spokenLines(content.points[2]), [
    'Take a time-out instead', 'Say that you need time to think.', 'Then come back to the conversation.',
    "The other person knows you haven't abandoned them.",
    'For example, Roxanne tends to pull back when someone upsets her.',
    'Now she says, "I need time to think. Can we talk tomorrow morning?"',
    'The next morning, she comes back to the conversation.'
  ]);
  assert.deepEqual(spokenLines(content.points[0]), [content.points[0].title, ...content.points[0].sentences]);
});

test('place keeping clamps demo indices and moves without mutating state', () => {
  for (const [input, expected] of [[-5, 0], [0, 0], [1.9, 1], [3, 2], [Infinity, 0], [NaN, 0]]) assert.equal(clampPoint(input, 3), expected);
  for (const count of [0, -1, 1.5, Infinity, NaN]) assert.throws(() => clampPoint(0, count), /count/);
  assert.equal(movePlace(1, 'next', 3), 2); assert.equal(movePlace(1, 'previous', 3), 0);
  assert.equal(movePlace(2, 'next', 3), 2); assert.equal(movePlace(0, 'previous', 3), 0);
  assert.equal(movePlace(0, { set: 100 }, 3), 2); assert.equal(movePlace(0, { set: -1 }, 3), 0);
  assert.throws(() => movePlace(0, 'jump', 3), /action/);
  const saved = { format: 'text', section: 2 };
  assert.deepEqual(FORMATS, ['text', 'slides', 'audio', 'quiz']);
  for (const format of FORMATS) assert.deepEqual(switchFormat(saved, format), { format, section: 2 });
  assert.deepEqual(saved, { format: 'text', section: 2 });
  for (const format of ['outline', 'video', 'toString', null]) assert.throws(() => switchFormat(saved, format), /format/);
});

test('quiz returns only the selected authored feedback and rejects invalid indices', () => {
  assert.deepEqual(checkQuizAnswer(0, 1, content.quiz), { correct: true, feedback: 'He says he needs a pause and comes back.' });
  assert.deepEqual(checkQuizAnswer(1, 0, content.quiz), { correct: false, feedback: "Length isn't the test. A short silence with no word is still stonewalling." });
  for (const [q, o] of [[-1, 0], [2, 0], [0, -1], [0, 4], [0.5, 1], [0, NaN]]) assert.throws(() => checkQuizAnswer(q, o, content.quiz), /option/);
});

test('schema and validator catch planted content violations with field names', () => {
  const fixtures = [[content, true], [french, true]];
  const bad = (value, field) => fixtures.push([value, false, field]);
  for (const value of [null, [], 'text']) bad(value, 'content');
  for (const field of ['title', 'summary']) for (const value of ['', null, 4, undefined]) bad({ ...content, [field]: value }, field);
  bad({ ...content, extra: '' }, 'extra');
  for (const field of ['points', 'quiz']) for (const value of [[], null, {}, undefined]) bad({ ...content, [field]: value }, field);
  for (const field of ['id', 'title']) for (const value of ['', null, 4, undefined]) bad({ ...content, points: [{ ...content.points[0], [field]: value }] }, field);
  for (const field of ['sentences', 'outline', 'example']) for (const value of [[], null, 'text', [''], [4]]) bad({ ...content, points: [{ ...content.points[0], [field]: value }] }, field);
  bad({ ...content, points: [null] }, 'points[0]');
  bad({ ...content, points: [{ ...content.points[0], id: 'bad id' }] }, 'id');
  bad({ ...content, points: [{ ...content.points[0], extra: '' }] }, 'extra');
  bad({ ...content, points: [{ ...content.points[0], exampleOutline: '' }] }, 'exampleOutline');
  bad({ ...content, points: [content.points[0], content.points[0]] }, 'id');
  for (const field of ['section', 'prompt']) bad({ ...content, quiz: [{ ...content.quiz[0], [field]: '' }] }, field);
  bad({ ...content, quiz: [null] }, 'quiz[0]');
  bad({ ...content, quiz: [{ ...content.quiz[0], extra: '' }] }, 'extra');
  for (const value of [[], null, {}, [null]]) bad({ ...content, quiz: [{ ...content.quiz[0], options: value }] }, 'options');
  for (const field of ['text', 'feedback']) for (const value of ['', null, undefined]) bad({ ...content, quiz: [{ ...content.quiz[0], options: [{ ...content.quiz[0].options[1], [field]: value }] }] }, field);
  bad({ ...content, quiz: [{ ...content.quiz[0], options: [{ ...content.quiz[0].options[1], correct: 'yes' }] }] }, 'correct');
  bad({ ...content, quiz: [{ ...content.quiz[0], options: [{ ...content.quiz[0].options[1], extra: '' }] }] }, 'extra');
  for (const [value, valid, field] of fixtures) {
    assert.equal(matches(value, schema), valid, `schema ${field}`);
    if (valid) assert.doesNotThrow(() => validateContent(value));
    else assert.throws(() => validateContent(value), error => error.message.includes(field), `validator ${field}`);
  }
  // Cross-record constraints are recorded by schema annotations and enforced by logic.
  for (const value of [
    { ...content, quiz: [{ ...content.quiz[0], section: 'missing' }] },
    { ...content, quiz: [{ ...content.quiz[0], options: content.quiz[0].options.map(option => ({ ...option, correct: false })) }] },
    { ...content, quiz: [{ ...content.quiz[0], options: content.quiz[0].options.map(option => ({ ...option, correct: true })) }] }
  ]) assert.throws(() => validateContent(value), /section|correct/);
});

test('saved state restores only valid formats and in-range whole sections and copies the record', () => {
  for (const format of FORMATS) for (const section of [0, 2]) {
    const saved = { format, section }; const copy = validateState(content, saved);
    assert.deepEqual(copy, saved); assert.notEqual(copy, saved);
  }
  for (const value of [null, [], {}, { format: 'text' }, { section: 1 }, { format: 'video', section: 0 }, { format: 'toString', section: 0 }, ...[-1, 3, 0.5, '1', null, NaN, Infinity].map(section => ({ format: 'text', section })), { format: 'text', section: 0, extra: 1 }]) assert.equal(validateState(content, value), null);
});

test('render supplies the complete text baseline, scene, hidden controls and one empty status', () => {
  const markup = render(content, strings.en, { id: 'lesson', lang: 'en' });
  assert.match(markup, /class="lp lp-formats" data-lp-pattern="formats" lang="en"/);
  assert.doesNotMatch(markup, /Choose how to learn this/);
  assert.equal((markup.match(/data-lp-point=/g) || []).length, 3);
  assert.match(markup, /data-lp-formats hidden/); assert.match(markup, /data-lp-navigation hidden/);
  assert.equal((markup.match(/role="status"/g) || []).length, 1);
  assert.match(markup, /role="status" aria-atomic="true"><\/p>/);
  for (const point of content.points) for (const text of point.sentences) assert.ok(markup.includes(text.replaceAll("'", '&#39;')));
  assert.ok(markup.includes(content.summary));
  assert.doesNotMatch(markup, /speechSynthesis|<audio/);
  assert.match(markup, /disabled aria-label="Play unavailable: sample, no audio recording"/);
  assert.match(markup, /class="lp-scene"/);
  assert.equal((markup.match(/data-lp-slide-number/g) || []).length, 3);
  assert.match(markup, /data-lp-slide-number>1 \/ 3</);
  assert.match(markup, /<time datetime="PT0S">0:00<\/time>/);
  assert.doesNotMatch(markup, /data-lp-view="outline"|data-lp-format="outline"/);
});

test('all authored text and attributes are escaped, ids are prefixed and bilingual strings agree', () => {
  const hostile = '<script>alert("x")</script> & \'quoted\'';
  const value = { ...content, title: hostile, summary: hostile, points: [{ ...content.points[0], title: hostile, sentences: [hostile], outline: [hostile], example: [hostile], exampleOutline: hostile }], quiz: [{ ...content.quiz[0], prompt: hostile, options: [{ text: hostile, feedback: hostile, correct: true }] }] };
  const ui = Object.fromEntries(Object.keys(strings.en).map(key => [key, hostile]));
  const markup = render(value, ui, { id: 'first"', lang: 'fr"' });
  assert.doesNotMatch(markup, /<script>/); assert.match(markup, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &#39;quoted&#39;/);
  assert.match(markup, /lang="fr&quot;"/);
  const pair = ['a', 'b'].map(id => render(content, strings.en, { id, lang: 'en' })).join('');
  const ids = [...pair.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.ok(ids.length > 0); assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.every(id => id.startsWith('a-') || id.startsWith('b-')));
  assert.deepEqual(Object.keys(strings.en).sort(), Object.keys(strings.fr).sort());
  for (const key of Object.keys(strings.en)) assert.deepEqual(strings.en[key].match(/\{\w+\}/g), strings.fr[key].match(/\{\w+\}/g));
  assert.doesNotMatch(JSON.stringify([content, french, strings]), /\u2014/);
});

test('owner audit: scene contains only icon and title', () => {
  for (const lang of ['en', 'fr']) {
    const markup = render(content, strings[lang], { id: 'audit', lang });
    assert.doesNotMatch(markup, /lp-scene-label/);
  }
});

test('owner audit: place belongs to the lesson above its content', () => {
  const markup = render(content, strings.en, { id: 'audit', lang: 'en' });
  assert.ok(markup.indexOf('lp-formats-lesson') < markup.indexOf('data-lp-place'));
  assert.ok(markup.indexOf('data-lp-place') < markup.indexOf('data-lp-point'));
});

test('owner audit: narration has one sample instruction in each view', () => {
  for (const lang of ['en', 'fr']) {
    const markup = render(content, strings[lang], { id: 'audit', lang });
    assert.equal(Object.hasOwn(strings[lang], 'scriptNote'), false);
    assert.equal(markup.split(strings[lang].sample).length - 1, content.points.length);
  }
});
