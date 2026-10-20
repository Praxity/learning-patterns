import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { feedback, validateContent, validateState } from './logic.js';
import { confidenceGate, MISCONCEPTION_KEYS, ANSWER_LIMIT } from '../../proxy/logic/06-misconceptions.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const answers = (choice, confidence) => ({ misconception: { choice, confidence } });

test('default feedback uses the Jev gate used by Perplexity', () => {
  assert.equal(feedback(content, answers('correct', 0.5)).kind, 'unsure-key');
  assert.equal(feedback(content, answers('correct', 0.9)).kind, 'correct');
  assert.equal(feedback(content, answers('rereading', 0.5)).kind, 'unsure-misconception');
});

test('Choice outcomes use the proxy gate at and below every model boundary', () => {
  for (const model of ['pplx-decider-v1.1-27b', '@cf/cloudflare/clef', '@cf/cloudflare/clef-flash', 'jev']) {
    const gate = confidenceGate(model);
    assert.deepEqual(feedback(content, answers('correct', gate), model), { kind: 'correct', heading: '', text: content.keyIdea });
    assert.equal(feedback(content, answers('correct', gate - .0001), model).text, content.unsureKeyIdea);
    assert.equal(feedback(content, answers('correct', gate - .0001), model).kind, 'unsure-key');
    for (const id of MISCONCEPTION_KEYS) {
      const item = content.misconceptions.find(item => item.id === id);
      assert.deepEqual(feedback(content, answers(id, gate), model), { kind: 'misconception', heading: item.label, text: item.why });
      assert.deepEqual(feedback(content, answers(id, gate - .0001), model), { kind: 'unsure-misconception', heading: '', text: content.unsureMisconception.replaceAll('{idea}', item.idea).replaceAll('{why}', item.why) });
    }
    for (const confidence of [0, gate, 1]) assert.deepEqual(feedback(content, answers('none', confidence), model), { kind: 'none', heading: '', text: content.noMatch });
  }
});

test('unknown labels and invalid probabilities fail loudly', () => {
  assert.throws(() => feedback(content, answers('invented', 1)), /choice/);
  for (const confidence of [NaN, Infinity, -.1, 1.1, '1', null]) assert.throws(() => feedback(content, answers('correct', confidence)), /confidence/);
  for (const value of [null, {}, { misconception: null }, { misconception: { noul: 1 } }]) assert.throws(() => feedback(content, value), /answers/);
});

test('content guard rejects planted schema and catalogue violations', () => {
  assert.doesNotThrow(() => validateContent(content));
  for (const mutate of [c => { c.question = ''; }, c => { c.extra = true; }, c => { c.misconceptions.pop(); }, c => { c.misconceptions[0].id = 'unknown'; }, c => { c.misconceptions[0].id = 'highlighting'; }, c => { c.misconceptions[0].why = ''; }, c => { c.misconceptions[0].extra = true; }, c => { c.unsureMisconception = '{idea}'; }]) {
    const copy = structuredClone(content); mutate(copy);
    assert.throws(() => validateContent(copy), /Invalid/);
  }
});

test('draft and native ticks restore, judgments and invalid state do not', () => {
  const draft = { answer: 'My answer', ticked: ['rereading'] };
  assert.deepEqual(validateState(draft), draft);
  assert.notEqual(validateState(draft).ticked, draft.ticked);
  for (const value of [null, {}, { answer: 'x', ticked: ['unknown'] }, { answer: 'x', ticked: ['rereading', 'rereading'] }, { answer: 'x'.repeat(ANSWER_LIMIT + 1), ticked: [] }]) assert.equal(validateState(value), null);
});

test('server HTML is escaped, prefixed, bilingual and usable without JavaScript', async () => {
  for (const lang of ['en', 'fr']) {
    const example = JSON.parse(await readFile(new URL(`./examples/${lang}.json`, import.meta.url)));
    const markup = render({ ...example, question: '<script>bad</script>' }, strings[lang], { id: 'one', lang });
    assert.match(markup, /&lt;script&gt;bad&lt;\/script&gt;/);
    assert.match(markup, new RegExp(`lang="${lang}"`));
    assert.match(markup, /rows="3"/);
    assert.equal([...markup.matchAll(/role="status"/g)].length, 1);
    assert.equal([...markup.matchAll(/type="checkbox"/g)].length, 4);
    assert.match(markup, /data-lp-model open/);
    for (const [, id] of markup.matchAll(/\sid="([^"]+)"/g)) assert.ok(id.startsWith('one-'), id);
  }
});
