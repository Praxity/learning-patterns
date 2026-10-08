import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRequest } from '../src/worker.js';
import { blocks } from '../src/registry.js';

const ids = ['03-branch', '06-misconceptions', '07-explain-back', '13-journal', '16-fixtures'];

test('the registry exposes exactly the five accepted blocks', () => {
  assert.deepEqual(Object.keys(blocks), ids);
  for (const id of ids) {
    const block = blocks[id];
    const fields = block.sample ?? { answer: 'A learner response' };
    const request = buildRequest({ block: id, fields });
    assert.equal(request.error, undefined, id);
    assert.deepEqual(request.questions, block.clefQuestions);
    assert.deepEqual(request.state, block.build(fields).state);
  }
});

test('unregistered and inherited names refuse requests without throwing', () => {
  for (const block of ['01-rubric', '02-live', '05-horsemen', '09-self-assess', '14-ask', '15-sincerity', '17-parity', 'constructor', 'toString', '__proto__', undefined, null, {}, []]) {
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
