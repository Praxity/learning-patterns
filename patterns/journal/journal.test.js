import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { feedback, validateContent, validateAnswer, validateState, savedEntry, ANSWER_LIMIT } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';
import { blocks } from '../../proxy/src/registry.js';

const content = {
  prompt: 'What did you notice this week when you tried to stay assertive?',
  questions: [
    { id: 'situation', text: 'Want to describe one moment: where you were and what was said?' },
    { id: 'action', text: 'Want to add what you said or did?' },
    { id: 'next_step', text: "Want to name one thing you'll try next time?" },
    { id: 'when', text: "Want to say when you'll try it?" }
  ],
  complete: "Great. You've named a moment, what you did, and a next step with a when.",
  support: "If this is weighing on you, talk to someone you trust, your workplace's employee assistance programme or a local support service.",
  supportNote: "If something is weighing on you, talk to someone you trust, your workplace's employee assistance programme, or a local support service.",
  saved: 'Saved in this browser',
  changed: 'Entry changed. Select Get a suggestion for the revised entry.'
};
const answers = (values = [1, 1, 1, 1, 0]) => Object.fromEntries(['situation', 'action', 'next_step', 'when', 'distress'].map((key, i) => [key, { noul: values[i] }]));

test('the proxy returns a complete decision and journal content owns its wording', () => {
  assert.deepEqual(blocks['13-journal'].outcome(answers()), { kind: 'complete' });
  const custom = { ...content, complete: 'You have described every part.' };
  assert.deepEqual(feedback(custom, answers()), { kind: 'complete', text: 'You have described every part.' });
});

test('complete feedback uses authored bilingual content', async () => {
  for (const [lang, text] of [
    ['en', "Great. You've named a moment, what you did, and a next step with a when."],
    ['fr', "Très bien. Vous avez nommé un moment, ce que vous avez fait et une prochaine étape en précisant quand vous l'essaierez."]
  ]) {
    const example = JSON.parse(await readFile(new URL(`./examples/${lang}.json`, import.meta.url)));
    assert.deepEqual(feedback(example, answers()), { kind: 'complete', text });
  }
});

test('support wins over missing elements and complete entries, at and below the distress gate', () => {
  for (const values of [[0, 0, 0, 0], [1, 1, 1, 1]]) {
    for (const distress of [.5, 1]) assert.deepEqual(feedback(content, answers([...values, distress])), { kind: 'support', text: content.support });
    assert.notEqual(feedback(content, answers([...values, .4999])).kind, 'support');
  }
  const custom = { ...content, support: 'Contact your course support team.' };
  assert.equal(feedback(custom, answers([0, 0, 0, 0, .5])).text, custom.support);
});

test('one optional nudge follows the four-element order; unsure counts as missing', () => {
  for (let index = 0; index < 4; index++) for (const probability of [0, .35, .5, .6499]) {
    const input = answers([...Array.from({ length: 4 }, (_, i) => i < index ? 1 : probability), 0]);
    assert.deepEqual(feedback(content, input), { kind: 'nudge', key: content.questions[index].id, text: content.questions[index].text });
  }
  for (const probability of [.65, 1]) assert.deepEqual(feedback(content, answers([probability, probability, probability, probability, .49])), { kind: 'complete', text: content.complete });
});

test('invalid or missing model probabilities fail loudly for every criterion', () => {
  for (const key of ['situation', 'action', 'next_step', 'when', 'distress']) {
    for (const value of [NaN, Infinity, -.1, 1.1, '1', null]) {
      const input = answers(); input[key] = { noul: value };
      assert.throws(() => feedback(content, input), new RegExp(key));
    }
    const input = answers(); delete input[key]; assert.throws(() => feedback(content, input), new RegExp(key));
  }
  for (const input of [null, [], {}]) assert.throws(() => feedback(content, input), /answers/);
});

test('content rejects unknown fields, reordered or missing questions and blank authored text', () => {
  assert.doesNotThrow(() => validateContent(content));
  for (const key of ['prompt', 'complete', 'support', 'supportNote', 'saved', 'changed']) {
    for (const value of ['', '   ', null, 5]) assert.throws(() => validateContent({ ...content, [key]: value }), new RegExp(key));
  }
  for (const mutate of [c => { c.extra = true; }, c => { c.questions.pop(); }, c => { c.questions.reverse(); }, c => { c.questions[0].id = 'unknown'; }, c => { c.questions[0].text = ''; }, c => { c.questions[0].extra = true; }]) {
    const copy = structuredClone(content); mutate(copy); assert.throws(() => validateContent(copy), /Invalid/);
  }
});

test('saved entries preserve exact text, validate dates and never retain model judgments', () => {
  const iso = '2026-10-08T12:34:56.000Z', text = '  My entry\nAs written.  ';
  const entry = savedEntry(text, iso);
  assert.deepEqual(entry, { text, savedAt: iso });
  assert.deepEqual(validateState(entry), entry); assert.notEqual(validateState(entry), entry);
  assert.deepEqual(validateAnswer('x'.repeat(1500)), { ok: true, text: 'x'.repeat(1500) });
  assert.equal(ANSWER_LIMIT, 1500);
  assert.deepEqual(validateAnswer('x'.repeat(1501)), { ok: false, error: 'tooLong' });
  assert.deepEqual(validateAnswer(' \n '), { ok: false, error: 'empty' });
  for (const value of [null, {}, { ...entry, text: '' }, { ...entry, text: 'x'.repeat(1501) }, { ...entry, savedAt: '2026-02-30T12:34:56.000Z' }, { ...entry, savedAt: 'bad' }, { ...entry, savedAt: null }, { ...entry, judgment: 'support' }]) assert.equal(validateState(value), null);
  assert.throws(() => savedEntry('', iso), /empty/);
  assert.throws(() => savedEntry(text, 'bad'), /savedAt/);
});

test('server markup labels the journal with its title, escapes content, dates it and offers native questions', async () => {
  for (const lang of ['en', 'fr']) {
    const example = JSON.parse(await readFile(new URL(`./examples/${lang}.json`, import.meta.url)));
    validateContent(example);
    const markup = render({ ...example, prompt: '<script>bad</script>', supportNote: '<img onerror="bad">' }, strings[lang], { id: 'one', lang, date: new Date(2026, 9, 8) });
    assert.match(markup, /&lt;script&gt;bad&lt;\/script&gt;/);
    assert.match(markup, /&lt;img onerror=&quot;bad&quot;&gt;/);
    assert.match(markup, /datetime="2026-10-08"/);
    assert.match(markup, /aria-labelledby="one-prompt"/);
    assert.match(markup, /rows="8"/);
    assert.match(markup, /data-lp-questions open/);
    assert.equal([...markup.matchAll(/role="status"/g)].length, 1);
    assert.equal([...markup.matchAll(/<li>/g)].length, 4);
    for (const [, id] of markup.matchAll(/\sid="([^"]+)"/g)) assert.ok(id.startsWith('one-'), id);
    assert.deepEqual(Object.keys(strings.en), Object.keys(strings.fr));
  }
});

test('Save is the main action; the suggestion is secondary', () => {
  const markup = render(content, strings.en, { id: 'one', lang: 'en', date: new Date(2026, 9, 8) });
  assert.match(markup, /<button class="lp-button" type="button" data-lp-save>/);
  assert.match(markup, /<button class="lp-button lp-button-secondary" type="button" data-lp-suggest>/);
});
