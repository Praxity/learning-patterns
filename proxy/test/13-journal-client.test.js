import assert from 'node:assert/strict';
import test from 'node:test';
import { journalDecision } from '../logic/13-journal.js';

const answers = (situation, action, next_step, when, distress = 0) => ({
  situation: { noul: situation }, action: { noul: action }, next_step: { noul: next_step }, when: { noul: when }, distress: { noul: distress }
});

test('at most one nudge, in the fixed order', () => {
  for (const [input, key] of [
    [answers(.1, .1, .1, .1), 'situation'],
    [answers(.9, .2, .1, .1), 'action'],
    [answers(.9, .9, .5, .1), 'next_step'],
    [answers(.9, .9, .9, .1), 'when']
  ]) assert.deepEqual(journalDecision(input), { kind: 'nudge', key });
});

test('all present returns a decision without authored text', () => {
  assert.deepEqual(journalDecision(answers(.9, .9, .9, .9)), { kind: 'complete' });
});

test('distress at 0.5 or more replaces a nudge or completion', () => {
  for (const values of [[.1, .1, .1, .1], [.9, .9, .9, .9]]) {
    assert.deepEqual(journalDecision(answers(...values, .5)), { kind: 'support' });
    assert.deepEqual(journalDecision(answers(...values, 1)), { kind: 'support' });
    assert.notEqual(journalDecision(answers(...values, .4999)).kind, 'support');
  }
});
