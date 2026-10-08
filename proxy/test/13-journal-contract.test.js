import assert from 'node:assert/strict';
import test from 'node:test';
import block from '../src/demos/13-journal.js';
import { ANSWER_LIMIT, NUDGE_KEYS, journalDecision, journalFeedback } from '../logic/13-journal.js';

const answers = values => Object.fromEntries([...NUDGE_KEYS, 'distress'].map((key, index) => [key, { noul: values[index] }]));

test('journal contract owns the input limit and ordered decisions, preserving demo feedback', () => {
  assert.equal(ANSWER_LIMIT, 1500);
  assert.equal(block.fields.answer, ANSWER_LIMIT);
  assert.deepEqual(NUDGE_KEYS, ['situation', 'action', 'next_step', 'when']);
  for (let index = 0; index < 4; index++) {
    const input = answers([...NUDGE_KEYS.map((_, i) => i < index ? 1 : 0), 0]);
    assert.deepEqual(journalDecision(input), { kind: 'nudge', key: NUDGE_KEYS[index] });
    assert.equal(journalFeedback(input).key, NUDGE_KEYS[index]);
  }
  assert.deepEqual(journalDecision(answers([1, 1, 1, 1, 0])), { kind: 'complete' });
  assert.deepEqual(journalDecision(answers([0, 0, 0, 0, .5])), { kind: 'support' });
  assert.equal(journalFeedback(answers([0, 0, 0, 0, .5])).text, "That sounds hard. If it's weighing on you, talk to someone you trust. You can also contact your workplace support, such as an employee assistance programme, or a local support service.");
});
