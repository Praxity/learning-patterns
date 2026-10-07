import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { feedback, validateContent, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));

// Only the schema keywords used by this pattern. x-uniqueBy checks part identities.
function matches(value, rule, root = value) {
  if (Array.isArray(rule.type)) return rule.type.some(type => matches(value, { ...rule, type }, root));
  if (rule.type === 'null') return value === null;
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (rule.required.some(key => !Object.hasOwn(value, key))) return false;
    if (rule.additionalProperties === false && Object.keys(value).some(key => !Object.hasOwn(rule.properties, key))) return false;
    return Object.entries(rule.properties).every(([key, child]) => !Object.hasOwn(value, key) || matches(value[key], child, root));
  }
  if (rule.type === 'array') {
    if (!Array.isArray(value) || value.length < rule.minItems) return false;
    if (rule['x-uniqueBy'] && new Set(value.map(item => item?.[rule['x-uniqueBy']])).size !== value.length) return false;
    return value.every(item => matches(item, rule.items, root));
  }
  if (rule['x-occursOnceIn'] && typeof value === 'string' && value.length) {
    const model = root[rule['x-occursOnceIn']];
    if (typeof model !== 'string') return false;
    const at = model.indexOf(value);
    if (at < 0 || model.indexOf(value, at + 1) >= 0) return false;
  }
  return typeof value === 'string' && value.length >= (rule.minLength ?? 0) && (!rule.pattern || new RegExp(rule.pattern).test(value));
}

test('feedback counts unique known ticks and returns labels and missed hints in part order', () => {
  assert.equal(feedback(content, []).count, 0);
  const result = feedback(content, ['reason', 'reason', 'no_blame']);
  assert.equal(result.count, 2);
  assert.equal(result.total, 6);
  assert.deepEqual(result.items[1], { id: 'reason', included: true, label: 'Reason for the delay', hint: null });
  assert.deepEqual(result.items[5], { id: 'no_blame', included: true, label: 'No blame', hint: null });
  assert.deepEqual(result.items[0], { id: 'work_deadline', included: false, label: 'Client report and Friday deadline', hint: 'Name the client report and its Friday deadline.' });
  assert.equal(feedback(content, content.parts.map(part => part.id)).count, 6);
  assert.throws(() => feedback(content, ['unknown']), /Unknown part: unknown/);
});

test('content parts use evidence and reject the obsolete met field', () => {
  const value = { task: 'Explain the delay.', context: { to: 'Sam', initials: 'S', subject: 'Delay' }, parts: [{ id: 'reason', label: 'Reason', missed: 'Say why.', evidence: 'The data arrived late.' }], model: 'The data arrived late.' };
  assert.doesNotThrow(() => validateContent(value));
  assert.equal(matches(value, schema), true);
  const obsolete = { ...value, parts: [{ ...value.parts[0], met: 'Reason given.' }] };
  assert.throws(() => validateContent(obsolete), /parts\[0\]\.met/);
  assert.equal(matches(obsolete, schema), false);
});

test('content validator and schema agree on shared valid and planted invalid fields', async () => {
  const fr = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
  const fixtures = [[content, true], [fr, true], [{ ...content, task: ' ' }, true]];
  const bad = (value, field) => fixtures.push([value, false, field]);
  bad(null, 'content'); bad([], 'content'); bad({ ...content, extra: '' }, 'extra');
  for (const field of ['task', 'model']) {
    for (const value of ['', 3, null, undefined]) bad({ ...content, [field]: value }, field);
  }
  for (const value of [[], 'parts', null]) bad({ ...content, parts: value }, 'parts');
  for (const field of ['id', 'label', 'missed']) {
    for (const value of ['', 3, undefined]) bad({ ...content, parts: [{ ...content.parts[0], [field]: value }] }, field);
  }
  bad({ ...content, parts: [null] }, 'parts[0]');
  bad({ ...content, parts: [{ ...content.parts[0], id: 'bad id' }] }, 'id');
  bad({ ...content, parts: [{ ...content.parts[0], extra: 'x' }] }, 'extra');
  bad({ ...content, parts: [content.parts[0], { ...content.parts[0], label: 'Duplicate identity' }] }, 'id');
  for (const value of [undefined, null, [], 'Sam', { ...content.context, extra: 'x' }]) bad({ ...content, context: value }, 'context');
  for (const field of ['to', 'initials', 'subject']) {
    for (const value of [undefined, null, '', 3]) bad({ ...content, context: { ...content.context, [field]: value } }, `context.${field}`);
  }
  for (const evidence of [undefined, '', 3, 'Absent', 'a']) bad({ ...content, parts: [{ ...content.parts[0], evidence }] }, 'evidence');
  for (const [value, valid, field] of fixtures) {
    assert.equal(matches(value, schema), valid, `schema: ${field}`);
    if (valid) assert.doesNotThrow(() => validateContent(value));
    else assert.throws(() => validateContent(value), error => error instanceof Error && error.message.includes(field));
  }
});

test('schema and validator allow omitted or string placeholders and reject other values', () => {
  const without = structuredClone(content);
  delete without.context.placeholder;
  for (const value of [without, ...['', 'Hi Sam,\n\nType here…'].map(placeholder => ({ ...without, context: { ...without.context, placeholder } }))]) {
    assert.equal(matches(value, schema), true);
    assert.doesNotThrow(() => validateContent(value));
  }
  for (const placeholder of [null, 2, false, [], {}]) {
    const value = { ...without, context: { ...without.context, placeholder } };
    assert.equal(matches(value, schema), false);
    assert.throws(() => validateContent(value), /context\.placeholder/);
  }
});

test('render escapes all plain text and attribute values and prefixes every id', () => {
  const hostile = '<script>alert("x")</script> & \'quoted\'';
  const value = { task: hostile, context: { to: hostile, initials: hostile, subject: hostile }, model: hostile, parts: [{ id: 'one', label: hostile, missed: hostile, evidence: hostile }] };
  const ui = Object.fromEntries(Object.keys(strings.en).map(key => [key, hostile]));
  const html = render(value, ui, { id: 'first"', lang: 'en"' });
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;quoted&#39;'));
  assert.ok(html.includes('lang="en&quot;"'));
  const a = render(content, strings.en, { id: 'a', lang: 'en' });
  const b = render(content, strings.en, { id: 'b', lang: 'en' });
  const ids = [...(a + b).matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => id.startsWith('a-') || id.startsWith('b-')));
  assert.equal((a.match(/role="status"/g) || []).length, 1);
  assert.ok(a.includes('rows="5"'));
  assert.ok(a.includes('placeholder="Hi Sam,\n\nType your message here…"'));
  for (const part of content.parts) assert.ok(a.includes(part.missed));
});

test('render keeps Start over hidden until the checklist step', () => {
  const html = render(content, strings.en, { id: 'practice', lang: 'en' });
  assert.match(html, /<button\b[^>]*data-lp-restart[^>]*\bhidden\b[^>]*>(?:<svg[\s\S]*?<\/svg>)?Start over<\/button>/);
});

test('English and French UI keys and placeholders match', () => {
  assert.deepEqual(Object.keys(strings.en).sort(), Object.keys(strings.fr).sort());
  for (const key of Object.keys(strings.en)) {
    assert.deepEqual(strings.en[key].match(/\{\w+\}/g), strings.fr[key].match(/\{\w+\}/g));
  }
});

test('invalid saved shapes are ignored, valid state is copied', () => {
  for (const value of [null, [], {}, { answer: 7, ticked: [], shown: false }, { answer: '', ticked: 'reason', shown: false }, { answer: '', ticked: ['unknown'], shown: true }, { answer: '', ticked: ['reason', 'reason'], shown: false }, { answer: '', ticked: [], shown: 'yes' }, { answer: '', ticked: [3], shown: false }]) {
    assert.equal(validateState(content, value), null);
  }
  const saved = { answer: 'Draft', ticked: ['reason'], shown: true };
  assert.deepEqual(validateState(content, saved), saved);
  assert.notEqual(validateState(content, saved).ticked, saved.ticked);
  assert.deepEqual(validateState(content, { answer: '', ticked: [], shown: false }), { answer: '', ticked: [], shown: false });
});
