import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radioGroupContract, numberedLegendName, webkitRadioArrows } from './browser/contracts/radio-group.js';

test('radio expectations have distinct IDs, outcomes and checkable standards sources', () => {
  assert.equal(new Set(radioGroupContract.map(row => row.id)).size, radioGroupContract.length);
  for (const row of radioGroupContract) {
    assert.ok(row.outcome.trim());
    assert.ok(row.sources.length);
    assert.ok(row.sources.some(source => source.includes('/patterns/radio/') || source.includes('/TR/WCAG22/#')));
    for (const source of row.sources) assert.ok(source === webkitRadioArrows.source || new URL(source).hostname === 'www.w3.org');
  }
});


test('numbered legend names allow layout whitespace and require every authored word', () => {
  const name = numberedLegendName('Question 1 of 3', 'What is an emergency fund for?');
  for (const actual of [
    'Question 1 of 3, What is an emergency fund for?',
    'Question 1 of 3 , What is an emergency fund for?',
    'Question 1 of 3  ,  What is an emergency fund for?'
  ]) assert.match(actual, name);
  for (const actual of [
    'Wrong Question 1 of 3 , What is an emergency fund for?',
    'Question 1 of 3 , What is an emergency fund for? extra',
    'Question 2 of 3 , What is an emergency fund for?',
    'Question 1 of 3 , What is an emergency fund for',
    'What is an emergency fund for?'
  ]) assert.doesNotMatch(actual, name);
  assert.match('Question 1 sur 3 , Combien (en $) ?', numberedLegendName('Question 1 sur 3', 'Combien (en $) ?'));
  assert.doesNotMatch('Question 1 sur 3 , Combien en $ ?', numberedLegendName('Question 1 sur 3', 'Combien (en $) ?'));
});
