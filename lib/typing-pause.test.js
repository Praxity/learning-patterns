import test from 'node:test';
import assert from 'node:assert/strict';
import { typingPause } from './typing-pause.js';

test('adaptive wait uses recent median gaps, defaults until three samples, and clamps', () => {
  const pause = typingPause();
  assert.equal(pause.wait(), 700);
  for (const time of [0, 200, 440]) pause.key(time);
  assert.equal(pause.wait(), 700);
  pause.key(660);
  assert.equal(pause.wait(), 550);
  for (let time = 700; time < 1400; time += 50) pause.key(time);
  assert.equal(pause.wait(), 400);
  for (let time = 2000; time < 15000; time += 600) pause.key(time);
  assert.equal(pause.wait(), 900);
});

test('question mark and Enter bypass the wait, but never length or changed-text guards', () => {
  const pause = typingPause();
  assert.equal(pause.delay('How do I say no', ''), 700);
  assert.equal(pause.delay('How do I say no?  ', ''), 0);
  assert.equal(pause.delay('How do I say no', '', true), 0);
  assert.equal(pause.delay(' 123456789 ', '', true), null);
  assert.equal(pause.delay('1234567890', ''), 700);
  assert.equal(pause.delay(' How do I say no? ', 'How do I say no?', true), null);
});

test('plan options keep a 20-character minimum and wait after a question mark', () => {
  const pause = typingPause({ minChars: 20, questionMark: false });
  assert.equal(pause.delay(' 1234567890123456789 ', ''), null);
  assert.equal(pause.delay('1234567890123456789?', ''), 700);
  assert.equal(pause.delay('1234567890123456789?', '1234567890123456789?'), null);
  for (const time of [0, 200, 400, 600]) pause.key(time);
  assert.equal(pause.delay('12345678901234567890', ''), 500);
  assert.equal(pause.delay('1234567890123456789?', ''), 500);
});

test('minimum length and question-mark options work independently', () => {
  assert.equal(typingPause({ minChars: 20 }).delay('1234567890?', ''), null);
  assert.equal(typingPause({ minChars: 20 }).delay('1234567890123456789?', ''), 0);
  assert.equal(typingPause({ questionMark: false }).delay('123456789?', ''), 700);
});
