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

test('supplied context and evidence are validated and invalid authored values name the field', () => {
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

test('composer renders escaped context, a labelled answer, and accessible checklist meter', () => {
  const value = { ...content, context: { to: '<Sam>', initials: '&', subject: '"Report"' } };
  const markup = render(value, strings.en, { id: 'message', lang: 'en' });
  assert.ok(markup.includes('&lt;Sam&gt;'));
  assert.ok(markup.includes('&quot;Report&quot;'));
  assert.ok(markup.includes('Your answer'));
  assert.ok(markup.includes('data-lp-meter'));
  assert.ok(markup.includes('Select each part you can point to in your answer.'));
  assert.equal((markup.match(/role="status"/g) || []).length, 1);
});

test('optional authored placeholder is escaped and never becomes the learner answer', () => {
  const placeholder = 'Hi Sam,\n\nType "here" <please> & continue…';
  const value = { ...content, context: { ...content.context, placeholder } };
  assert.doesNotThrow(() => logic.validateContent(value));
  assert.doesNotThrow(() => logic.validateContent({ ...value, context: { ...content.context, placeholder: '' } }));
  const markup = render(value, strings.en, { id: 'message', lang: 'en' });
  assert.match(markup, /placeholder="Hi Sam,\n\nType &quot;here&quot; &lt;please&gt; &amp; continue…"/);
  assert.match(markup, /<textarea[^>]*><\/textarea>/);
  assert.doesNotMatch(render(content, strings.en, { id: 'message', lang: 'en' }), /placeholder=/);
  for (const placeholder of [null, 2, false, [], {}, undefined]) {
    assert.throws(() => logic.validateContent({ ...content, context: { ...content.context, placeholder } }), /context\.placeholder/);
  }
});

test('scene has only the task and checklist instruction is one fieldset legend', () => {
  const markup = render(content, strings.en, { id: 'message', lang: 'en' });
  assert.doesNotMatch(markup, /lp-scene-label|Your task|Read your answer again/);
  assert.equal((markup.match(/Select each part you can point to in your answer\./g) || []).length, 1);
  assert.match(markup, /<legend[^>]*>[\s\S]*?Select each part you can point to in your answer\.[\s\S]*?<\/legend>/);
  assert.match(markup, /<summary>Check your answer for these parts\.<\/summary>/);
  assert.doesNotMatch(markup, /Did your answer include these parts/);
});

test('result guidance adds a next step without repeating the count summary', () => {
  assert.equal(strings.en.resultAll, 'Compare your wording with the model.');
  assert.equal(strings.en.resultMany, 'Compare the marked parts with your answer.');
  assert.equal(strings.fr.resultAll, 'Comparez votre formulation avec le modèle.');
  assert.equal(strings.fr.resultMany, 'Comparez les éléments marqués avec votre réponse.');
});
