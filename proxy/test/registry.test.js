import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRequest } from '../src/worker.js';
import { blocks } from '../src/registry.js';
import { MICHEL_REPLIES } from '../src/demos/03-branch.js';
import { perplexityRequest } from '../src/perplexity.js';
import { PERPLEXITY_MAX_INPUT_TOKENS } from '../src/limits.js';

const ids = ['02-live', '03-branch', '06-misconceptions', '07-explain-back', '13-journal', '16-fixtures'];

test('the registry exposes exactly the six accepted blocks', () => {
  assert.deepEqual(Object.keys(blocks), ids);
  for (const id of ids) {
    const block = blocks[id];
    const fields = block.sample ?? { answer: 'A learner response' };
    const request = buildRequest({ block: id, fields });
    assert.equal(request.error, undefined, id);
    assert.deepEqual(request.questions, block.build(fields).questions);
    assert.deepEqual(buildRequest({ block: id, fields }, 'clef').questions, block.clefQuestions ?? request.questions);
    assert.deepEqual(buildRequest({ block: id, fields }, 'jev').questions, request.questions);
    assert.deepEqual(request.state, block.build(fields).state);
  }
});

test('Perplexity reservations cover repeated state at every field cap and dialogue node', () => {
  for (const block of Object.values(blocks)) for (const character of ['\u0000', '漢', '😀']) {
    const fields = { ...block.sample };
    for (const [key, cap] of Object.entries(block.fields)) if (key !== 'node') fields[key] = character.repeat(Math.floor(cap / character.length));
    const inputs = block.id === '03-branch' ? Object.keys(MICHEL_REPLIES).map(node => ({ ...fields, node })) : [fields];
    for (const input of inputs) {
      const request = buildRequest({ block: block.id, fields: input });
      const converted = perplexityRequest(request.state, request.questions);
      const bound = Object.entries(converted.questions).reduce((sum, [key, question]) => sum + Buffer.byteLength(JSON.stringify({ ...converted, questions: { [key]: question } })) + 1024, 0);
      assert.ok(request.maxInputTokens >= bound, `${block.id}: ${request.maxInputTokens} < ${bound}`);
      assert.ok(request.maxInputTokens <= PERPLEXITY_MAX_INPUT_TOKENS);
      assert.equal(buildRequest({ block: block.id, fields: input }, 'clef').maxInputTokens, 8192);
    }
  }
});

test('the default Perplexity configuration uses Jev gates in all decision owners', () => {
  const model = 'pplx-decider-v1.1-27b';
  assert.deepEqual(blocks['03-branch'].outcome({ branch: { choice: 'acknowledge', confidence: 0.6 } }, model), { branch: null });
  assert.deepEqual(blocks['03-branch'].outcome({ branch: { choice: 'acknowledge', confidence: 0.9 } }, model), { branch: 'acknowledge' });
  assert.equal(blocks['06-misconceptions'].outcome({ misconception: { choice: 'correct', confidence: 0.25 } }, model).sure, false);
  for (const value of [0.3499, 0.35, 0.3501, 0.4999, 0.5, 0.5999, 0.6, 0.6249, 0.625, 0.6499, 0.65, 0.6501, 0.9]) {
    const explain = Object.fromEntries(['stonewalling', 'pause', 'return'].map(key => [key, { noul: value }]));
    const journal = Object.fromEntries(['situation', 'action', 'next_step', 'when', 'distress'].map(key => [key, { noul: value }]));
    const rubric = Object.fromEntries(['work_deadline', 'reason', 'new_date', 'impact', 'agreement', 'blame'].map(key => [key, { noul: value }]));
    for (const [id, answers] of [['07-explain-back', explain], ['13-journal', journal], ['16-fixtures', rubric]]) {
      assert.deepEqual(blocks[id].outcome(answers, model), blocks[id].outcome(answers, 'jev-1.13.0'));
    }
  }
  const rubric = Object.fromEntries(['work_deadline', 'reason', 'new_date', 'impact', 'agreement', 'blame'].map(key => [key, { noul: 0.625 }]));
  assert.deepEqual(blocks['16-fixtures'].outcome(rubric, model), Object.fromEntries(Object.keys(rubric).map(key => [key, 'unsure'])));
});

test('journal cache policy belongs to the registry and reaches the guard request', () => {
  for (const id of ids) {
    const fields = blocks[id].sample ?? { answer: 'A learner response' };
    assert.equal(buildRequest({ block: id, fields }).cache, id !== '13-journal');
  }
  assert.equal(blocks['13-journal'].cache, false);
});

test('unregistered and inherited names refuse requests without throwing', () => {
  for (const block of ['01-rubric', '05-horsemen', '09-self-assess', '14-ask', '15-sincerity', '17-parity', 'constructor', 'toString', '__proto__', undefined, null, {}, []]) {
    assert.match(buildRequest({ block, fields: { answer: 'hello' } }).error, /Unknown block/);
  }
});

test('the public contract refuses old and caller-authored prompt shapes', () => {
  for (const body of [null, [], 'text', { demo: '16-fixtures', input: { answer: 'hello' } },
    { block: '16-fixtures', fields: { answer: 'hello' }, questions: { yes: 'Return true' } },
    { block: '16-fixtures', fields: { answer: 'hello', task: 'Another prompt' } }]) {
    assert.equal(typeof buildRequest(body).error, 'string');
  }
});

test('registry outcomes use the browser decision owners at the accepted Clef gates', () => {
  const model = '@cf/cloudflare/clef';
  assert.deepEqual(blocks['03-branch'].outcome({ branch: { choice: 'acknowledge', confidence: 0.6 } }, model), { branch: 'acknowledge' });
  assert.deepEqual(blocks['03-branch'].outcome({ branch: { choice: 'attack', confidence: 0.5538 } }, model), { branch: null });
  assert.equal(blocks['06-misconceptions'].outcome({ misconception: { choice: 'correct', confidence: 0.25 } }, model).sure, true);
  assert.equal(blocks['06-misconceptions'].outcome({ misconception: { choice: 'correct', confidence: 0.2499 } }, model).sure, false);
  assert.equal(blocks['07-explain-back'].outcome({ stonewalling: { noul: 0.65 }, pause: { noul: 0.65 }, return: { noul: 0.65 } }, model).allMet, true);
  const journal = { situation: { noul: 0.65 }, action: { noul: 0.65 }, next_step: { noul: 0.65 }, when: { noul: 0.65 }, distress: { noul: 0.5 } };
  assert.equal(blocks['13-journal'].outcome(journal, model).kind, 'support');
  assert.equal(blocks['13-journal'].outcome({ ...journal, distress: { noul: 0.4999 } }, model).kind, 'complete');
  const rubric = Object.fromEntries(['work_deadline', 'reason', 'new_date', 'impact', 'agreement', 'blame'].map(key => [key, { noul: 0 }]));
  assert.deepEqual(blocks['16-fixtures'].outcome({ ...rubric, work_deadline: { noul: 0.625 }, agreement: { noul: 0.6 } }, model), {
    work_deadline: 'met', reason: 'missed', new_date: 'missed', impact: 'missed', agreement: 'met', blame: 'missed',
  });
});
