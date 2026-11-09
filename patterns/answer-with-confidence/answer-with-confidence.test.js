import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DONT_KNOW, SURE, UNSURE, feedback, format, summarize, validateContent, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));
const withDontKnow = { ...content, dontKnow: true };
const edit = change => { const copy = structuredClone(content); change(copy); return copy; };
const count = (markup, pattern) => (markup.match(pattern) ?? []).length;

test('examples validate, and English and French share ids, answers and where rightWhen appears', () => {
  validateContent(content);
  validateContent(french);
  const shape = c => c.questions.map(q => [q.id, q.correct, q.options.map(o => [o.id, Object.hasOwn(o, 'rightWhen')])]);
  assert.deepEqual(shape(french), shape(content));
  assert.deepEqual(content.questions.map(q => q.correct), ['to-cc', 'lower', 'still-there']);
  assert.deepEqual(Object.keys(strings.fr), Object.keys(strings.en));
});

test('validateContent names the bad field', () => {
  const bad = [
    [c => { c.extra = 1; }, /content\.extra/],
    [c => { c.title = '  '; }, /title/],
    [c => { c.context = ''; }, /context/],
    [c => { c.dontKnow = 'yes'; }, /dontKnow/],
    [c => { c.questions = []; }, /questions/],
    [c => { c.questions[1].id = 'reply-all'; }, /questions\[1\]\.id/],
    [c => { c.questions[0].points = 2; }, /questions\[0\]\.points/],
    [c => { c.questions[0].options.length = 1; }, /questions\[0\]\.options/],
    [c => { c.questions[0].options = Array.from({ length: 7 }, (_, i) => ({ id: `o${i}`, text: 'x', feedback: 'y' })); }, /questions\[0\]\.options/],
    [c => { c.questions[0].options[1].id = 'sender'; }, /options\[1\]\.id/],
    [c => { c.questions[0].options[0].id = DONT_KNOW; }, /options\[0\]\.id/],
    [c => { delete c.questions[0].options[0].feedback; }, /options\[0\]\.feedback/],
    [c => { c.questions[0].options[0].rightWhen = ' '; }, /options\[0\]\.rightWhen/],
    [c => { c.questions[0].correct = 'missing'; }, /questions\[0\]\.correct/],
    // "Why it can seem right" belongs to wrong options only.
    [c => { c.questions[0].options[1].rightWhen = 'It is right.'; }, /options\[1\]\.rightWhen/]
  ];
  for (const [change, message] of bad) assert.throws(() => validateContent(edit(change)), message);
  assert.throws(() => validateContent(null), /content/);
});

test('the schema carries the same limits and cross-field notes as validateContent', () => {
  const question = schema.properties.questions.items, option = question.properties.options.items;
  assert.deepEqual([option.properties.feedback.maxLength, option.properties.rightWhen.maxLength], [400, 300]);
  assert.deepEqual([question.properties.options.minItems, question.properties.options.maxItems], [2, 6]);
  assert.deepEqual(option.required, ['id', 'text', 'feedback']);
  assert.equal(option.properties.rightWhen['x-wrongOptionsOnly'], true);
  assert.equal(option.properties.id.not.const, DONT_KNOW);
  assert.equal(schema.properties.dontKnow.default, false);
});

test('feedback is the chosen option\'s only, and rightWhen needs a wrong answer the learner was sure of', () => {
  const sender = content.questions[0].options[0], correct = content.questions[0].options[1];
  assert.deepEqual(feedback(content, 'reply-all', 'sender', SURE), { result: 'wrong', correct, feedback: sender.feedback, rightWhen: sender.rightWhen });
  assert.equal(feedback(content, 'reply-all', 'sender', UNSURE).rightWhen, null);
  // A restored answer has no certainty.
  assert.equal(feedback(content, 'reply-all', 'sender').rightWhen, null);
  assert.deepEqual(feedback(content, 'reply-all', 'to-cc', SURE), { result: 'right', correct, feedback: correct.feedback, rightWhen: null });
  // A sure wrong answer whose option has no authored line.
  assert.equal(feedback(content, 'percent', 'higher', SURE).rightWhen, null);
  assert.throws(() => feedback(content, 'nope', 'sender', SURE), /Unknown question/);
  assert.throws(() => feedback(content, 'reply-all', 'lower', SURE), /Invalid answer/);
  assert.throws(() => feedback(content, 'reply-all', 'sender', 'guess'), /Invalid certainty/);
});

test('"Don\'t know" is an answer only when the content turns it on, and shows the correct option\'s feedback', () => {
  const correct = content.questions[0].options[1];
  assert.throws(() => feedback(content, 'reply-all', DONT_KNOW), /Invalid answer/);
  assert.deepEqual(feedback(withDontKnow, 'reply-all', DONT_KNOW), { result: 'unknown', correct, feedback: correct.feedback, rightWhen: null });
});

test('certainty never changes how many answers are right', () => {
  const answers = { 'reply-all': 'sender', percent: 'lower', redact: 'still-there' };
  const expected = { total: 3, right: ['percent', 'redact'], wrong: ['reply-all'], unknown: [], unanswered: [] };
  const groups = ({ sureWrong, unsureRight, ...rest }) => rest;
  for (const first of [SURE, UNSURE]) for (const second of [SURE, UNSURE]) {
    assert.deepEqual(groups(summarize(content, answers, { 'reply-all': first, percent: second, redact: SURE })), expected);
  }
  assert.deepEqual(groups(summarize(content, answers)), expected);
});

test('the summary lists sure-but-wrong and right-but-unsure questions in content order', () => {
  const answers = { 'reply-all': 'sender', percent: 'lower', redact: 'covered' };
  const all = (first, second, third) => summarize(content, answers, { 'reply-all': first, percent: second, redact: third });
  assert.deepEqual(all(SURE, UNSURE, SURE), { total: 3, right: ['percent'], wrong: ['reply-all', 'redact'], unknown: [], unanswered: [], sureWrong: ['reply-all', 'redact'], unsureRight: ['percent'] });
  // Unsure and wrong, or sure and right, are not mismatches.
  assert.deepEqual([all(UNSURE, SURE, UNSURE).sureWrong, all(UNSURE, SURE, UNSURE).unsureRight], [[], []]);
  // Without certainty (restored answers) nothing is listed.
  assert.deepEqual([summarize(content, answers).sureWrong, summarize(content, answers).unsureRight], [[], []]);
  assert.deepEqual(summarize(content, { percent: 'same' }, { percent: SURE }).unanswered, ['reply-all', 'redact']);
  assert.deepEqual(summarize(withDontKnow, { 'reply-all': DONT_KNOW, percent: 'lower' }, { percent: SURE }).unknown, ['reply-all']);
});

test('summarize rejects answers and certainties it cannot place', () => {
  assert.throws(() => summarize(content, { nope: 'sender' }), /Unknown question/);
  assert.throws(() => summarize(content, { 'reply-all': 'lower' }), /answers\.reply-all/);
  assert.throws(() => summarize(content, { 'reply-all': DONT_KNOW }), /answers\.reply-all/);
  assert.throws(() => summarize(content, { 'reply-all': 'sender' }, { 'reply-all': 'guess' }), /certainties\.reply-all/);
  assert.throws(() => summarize(content, {}, { 'reply-all': SURE }), /certainties\.reply-all/);
  assert.throws(() => summarize(withDontKnow, { 'reply-all': DONT_KNOW }, { 'reply-all': SURE }), /certainties\.reply-all/);
});

test('saved state holds answers only: a value that carries certainty is ignored', () => {
  const answers = { 'reply-all': 'sender' };
  const saved = validateState(content, { answers });
  assert.deepEqual(saved, { answers });
  assert.notEqual(saved.answers, answers);
  assert.equal(validateState(content, { answers, certainties: { 'reply-all': SURE } }), null);
  assert.equal(validateState(content, { answers: { 'reply-all': { option: 'sender', certainty: SURE } } }), null);
  assert.equal(validateState(content, { answers: { 'reply-all': 'lower' } }), null);
  assert.equal(validateState(content, { answers: { nope: 'sender' } }), null);
  assert.equal(validateState(content, { answers: { 'reply-all': DONT_KNOW } }), null);
  assert.deepEqual(validateState(withDontKnow, { answers: { 'reply-all': DONT_KNOW } }), { answers: { 'reply-all': DONT_KNOW } });
  for (const value of [null, undefined, 'x', [], {}, { answers: null }]) assert.equal(validateState(content, value), null);
});

for (const [lang, example] of [['en', content], ['fr', french]]) {
  test(`render keeps the question's own options and adds one submit control with two segments (${lang})`, () => {
    const markup = render(example, strings[lang], { id: 'quiz', lang });
    assert.match(markup, new RegExp(`<section class="lp lp-answer-with-confidence" data-lp-pattern="answer-with-confidence" lang="${lang}">`));
    assert.equal(count(markup, /<input type="radio"/g), 9);
    // Each option reserves the same hidden room for a mark, whichever option is correct.
    const spaces = markup.match(/<span class="lp-answer-with-confidence-mark-space" aria-hidden="true">.*?<\/span><\/span><\/label>/g);
    assert.equal(spaces.length, 9);
    assert.equal(new Set(spaces).size, 1);
    for (const word of [strings[lang].markCorrect, strings[lang].markWrong, strings[lang].markAnswer]) assert.ok(spaces[0].includes(`<span>${word}</span>`));
    assert.doesNotMatch(markup, /value="dont-know"|data-lp-dont-know|data-lp-feedback="dont-know"/);
    assert.equal(count(markup, /<button class="lp-button lp-answer-with-confidence-segment"/g), 6);
    assert.equal(count(markup, /role="group" aria-label="/g), 3);
    assert.match(markup, lang === 'en' ? /aria-label="Submit your answer to question 2"/ : /aria-label="Soumettre votre réponse à la question 2"/);
    // French punctuation takes its no-break space.
    assert.match(markup, lang === 'en' ? />Submit:</ : />Soumettre :</);
    assert.equal(count(markup, /id="quiz-/g), count(markup, / id="/g));
    assert.equal(count(markup, /role="status" aria-atomic="true"><\/p>/g), 1);
    // Without JavaScript the submit controls, feedback and summary stay hidden and the answers disclosure shows.
    assert.equal(count(markup, /data-lp-stage hidden>/g), 3);
    assert.match(markup, /data-lp-intro hidden>/);
    assert.match(markup, /data-lp-result hidden>/);
    assert.match(markup, /<details class="lp-details lp-section" data-lp-fallback>/);
    const fallback = markup.split('data-lp-fallback>')[1];
    for (const q of example.questions) assert.ok(fallback.includes(q.options.find(o => o.id === q.correct).feedback.slice(0, 20)));
  });
}

test('each option has one feedback box; only wrong options with an authored line carry "Why it can seem right"', () => {
  const markup = render(content, strings.en, { id: 'quiz', lang: 'en' });
  assert.equal(count(markup, /data-lp-feedback="/g), 9);
  assert.equal(count(markup, /data-lp-right-when/g), 5);
  assert.equal(count(markup, /data-lp-outcome="right"/g), 3);
  // Wrong answers name the correct option for screen readers; the row mark shows it to everyone else.
  assert.equal(count(markup, /<p class="lp-visually-hidden">Correct answer: /g), 6);
  for (const key of ['verdictSureRight', 'verdictUnsureRight', 'verdictSureWrong', 'verdictUnsureWrong']) assert.ok(markup.includes(`>${strings.en[key]}<`), key);
});

test('"Don\'t know" is a third segment, never an option row', () => {
  const markup = render(withDontKnow, strings.en, { id: 'quiz', lang: 'en' });
  assert.equal(count(markup, /<input type="radio"/g), 9);
  assert.doesNotMatch(markup, /value="dont-know"/);
  assert.equal(count(markup, /data-lp-dont-know>Don&#39;t know</g), 3);
  assert.equal(count(markup, /data-lp-feedback="dont-know" data-lp-outcome="unknown"/g), 3);
  assert.ok(markup.includes(strings.en.chooseOrDontKnow.replaceAll('"', '&quot;').replaceAll("'", '&#39;')));
});

test('one question drops the numbering; hostile text is escaped', () => {
  const single = edit(c => { c.questions.length = 1; c.questions[0].text = '<b>Who</b> & "why"?'; c.questions[0].options[0].rightWhen = '<i>x</i>'; });
  const markup = render(single, strings.en, { id: 'one', lang: 'en' });
  assert.doesNotMatch(markup, /lp-answer-with-confidence-question-number/);
  assert.match(markup, /aria-label="Submit your answer"/);
  assert.ok(markup.includes('&lt;b&gt;Who&lt;/b&gt; &amp; &quot;why&quot;?'));
  assert.ok(markup.includes('&lt;i&gt;x&lt;/i&gt;'));
  assert.doesNotMatch(markup, /<b>|<i>/);
  assert.throws(() => render(edit(c => { c.questions[0].correct = 'x'; }), strings.en, { id: 'bad', lang: 'en' }), /correct/);
});

test('learner-facing text never says "belief", and certainty labels stay free of scores', () => {
  const words = JSON.stringify([strings, content, french]);
  assert.doesNotMatch(words, /belie[fv]|croyance|croire|croyez/i);
  assert.doesNotMatch(words, /\bpoints?\b|\bscore\b/i);
  assert.equal(format('{a} {b} {a}', { a: '{b}', b: 2 }), '{b} 2 {b}');
});
