import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderChoiceMark } from './choice-mark.js';
import { icons } from './icons.js';

test('answer mark HTML owns each tone and decorative icon', () => {
  for (const [kind, tone, icon] of [
    ['correct', 'lp-met', 'check'], ['wrong', 'lp-missed', 'x'], ['missed', 'lp-neutral', 'circle-dashed']
  ]) {
    assert.equal(renderChoiceMark(kind, 'Authored word'), `<span class="lp-choice-mark ${tone}">${icons[icon]}<span>Authored word</span></span>`);
  }
});

test('answer mark HTML escapes authored words and applies French typography', () => {
  assert.ok(renderChoiceMark('correct', '<b>Oui !</b>', 'fr-CA').endsWith('<span>&lt;b&gt;Oui\u202f!&lt;/b&gt;</span></span>'));
  assert.ok(renderChoiceMark('wrong', 'No !', 'en').endsWith('<span>No !</span></span>'));
});

test('answer marks reject unknown kinds, including object property names', () => {
  for (const kind of ['unknown', 'right', 'toString', '__proto__', '', null]) {
    assert.throws(() => renderChoiceMark(kind, 'Word'), RangeError);
  }
});
