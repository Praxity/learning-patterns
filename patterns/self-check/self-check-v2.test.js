import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as logic from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = {
  task: 'Write to Sam.', context: { to: 'Sam', initials: 'S', subject: 'Report' },
  model: 'Hi Sam. Late data. Tuesday?',
  parts: [
    { id: 'date', label: 'Date', missed: 'Ask for Tuesday.', evidence: 'Tuesday?' },
    { id: 'reason', label: 'Reason', missed: 'Explain the delay.', evidence: 'Late data' },
    { id: 'tone', label: 'Tone', missed: 'Avoid blame.', evidence: null }
  ]
};

test('context and evidence are required and invalid authored values name the field', () => {
  assert.doesNotThrow(() => logic.validateContent(content));
  for (const value of [undefined, null, [], 'Sam', { ...content.context, extra: 'x' }]) {
    assert.throws(() => logic.validateContent({ ...content, context: value }), /context/);
  }
  for (const field of ['to', 'initials', 'subject']) {
    for (const value of [undefined, null, '', 2]) {
      assert.throws(() => logic.validateContent({ ...content, context: { ...content.context, [field]: value } }), new RegExp(`context\\.${field}`));
    }
  }
  for (const evidence of [undefined, '', 2, 'Absent', 'a']) {
    assert.throws(() => logic.validateContent({ ...content, parts: [{ ...content.parts[0], evidence }] }), /parts\[0\]\.evidence/);
  }
  // Overlapping occurrences count too: "aa" occurs twice in "aaa".
  assert.throws(() => logic.validateContent({ ...content, model: 'aaa', parts: [{ ...content.parts[0], evidence: 'aa' }] }), /evidence/);
  assert.doesNotThrow(() => logic.validateContent({ ...content, parts: [{ ...content.parts[0], evidence: null }] }));
});

test('annotate returns plain segments in model order with original part indexes', () => {
  const before = structuredClone(content);
  assert.deepEqual(logic.annotate(content.model, content.parts, ['reason', 'tone']), [
    { text: 'Hi Sam. ', partIndex: null, included: false },
    { text: 'Late data', partIndex: 1, included: true },
    { text: '. ', partIndex: null, included: false },
    { text: 'Tuesday?', partIndex: 0, included: false }
  ]);
  assert.deepEqual(content, before);
  assert.deepEqual(logic.annotate('Hello', [{ ...content.parts[2] }], []), [{ text: 'Hello', partIndex: null, included: false }]);
  assert.deepEqual(logic.annotate('Tuesday?', [content.parts[0]], ['date']), [{ text: 'Tuesday?', partIndex: 0, included: true }]);
  const overlapping = [{ ...content.parts[0], evidence: 'Hi Sam' }, { ...content.parts[1], evidence: 'Sam. Late' }];
  assert.deepEqual(logic.annotate(content.model, overlapping, ['date']), [
    { text: 'Hi Sam', partIndex: 0, included: true },
    { text: '. Late data. Tuesday?', partIndex: null, included: false }
  ]);
});

test('composer renders escaped context, a labelled message, and accessible checklist meter', () => {
  const value = { ...content, context: { to: '<Sam>', initials: '&', subject: '"Report"' } };
  const markup = render(value, strings.en, { id: 'message', lang: 'en' });
  assert.ok(markup.includes('&lt;Sam&gt;'));
  assert.ok(markup.includes('&quot;Report&quot;'));
  assert.ok(markup.includes('Your message'));
  assert.ok(markup.includes('data-lp-meter'));
  assert.ok(markup.includes('Which parts did you include?'));
  assert.equal((markup.match(/role="status"/g) || []).length, 1);
});
