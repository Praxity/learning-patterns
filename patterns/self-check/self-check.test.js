import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { feedback, validateContent, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));

// Only the schema keywords used by this pattern. x-uniqueBy checks part identities.
function matches(value, rule) {
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (rule.required.some(key => !Object.hasOwn(value, key))) return false;
    if (rule.additionalProperties === false && Object.keys(value).some(key => !Object.hasOwn(rule.properties, key))) return false;
    return Object.entries(rule.properties).every(([key, child]) => matches(value[key], child));
  }
  if (rule.type === 'array') {
    if (!Array.isArray(value) || value.length < rule.minItems) return false;
    if (rule['x-uniqueBy'] && new Set(value.map(item => item?.[rule['x-uniqueBy']])).size !== value.length) return false;
    return value.every(item => matches(item, rule.items));
  }
  return typeof value === 'string' && value.length >= rule.minLength && (!rule.pattern || new RegExp(rule.pattern).test(value));
}

test('feedback counts unique known ticks and returns authored messages in part order', () => {
  assert.equal(feedback(content, []).count, 0);
  const result = feedback(content, ['reason', 'reason', 'no_blame']);
  assert.equal(result.count, 2);
  assert.equal(result.total, 6);
  assert.equal(result.items[1].text, 'Reason given.');
  assert.equal(result.items[5].text, 'No blame.');
  assert.equal(result.items[0].text, 'Name the client report and its Friday deadline.');
  assert.equal(feedback(content, content.parts.map(part => part.id)).count, 6);
  assert.throws(() => feedback(content, ['unknown']), /Unknown part: unknown/);
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
  for (const field of ['id', 'label', 'met', 'missed']) {
    for (const value of ['', 3, undefined]) bad({ ...content, parts: [{ ...content.parts[0], [field]: value }] }, field);
  }
  bad({ ...content, parts: [null] }, 'parts[0]');
  bad({ ...content, parts: [{ ...content.parts[0], id: 'bad id' }] }, 'id');
  bad({ ...content, parts: [{ ...content.parts[0], extra: 'x' }] }, 'extra');
  bad({ ...content, parts: [content.parts[0], { ...content.parts[0], label: 'Duplicate identity' }] }, 'id');
  for (const [value, valid, field] of fixtures) {
    assert.equal(matches(value, schema), valid, `schema: ${field}`);
    if (valid) assert.doesNotThrow(() => validateContent(value));
    else assert.throws(() => validateContent(value), error => error instanceof Error && error.message.includes(field));
  }
});

test('render escapes all plain text and attribute values and prefixes every id', () => {
  const hostile = '<script>alert("x")</script> & \'quoted\'';
  const value = { task: hostile, model: hostile, parts: [{ id: 'one', label: hostile, met: hostile, missed: hostile }] };
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
  assert.equal(a.includes('placeholder='), false);
  for (const part of content.parts) assert.ok(a.includes(part.missed));
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
