import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateContent, check, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const chunks = [
  { id: 'withdraw', text: 'You withdraw.', key: true },
  { id: 'overwhelmed', text: 'You feel overwhelmed.', note: 'This explains your feelings.' },
  { id: 'ignored', text: 'They feel ignored.', key: true },
  { id: 'plain', text: 'The conversation stops.' }
];
const example = mode => ({ mode, title: 'A conversation', ...(mode === 'evidence' ? { question: 'How do they feel?' } : {}), paragraphs: [chunks.slice(0, 2), chunks.slice(2)] });
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));

// Interpret the keywords this pattern uses, including its global uniqueness annotation.
function matches(value, rule) {
  if (Object.hasOwn(rule, 'const') && value !== rule.const) return false;
  if (rule.enum && !rule.enum.includes(value)) return false;
  if (rule.type === 'string' && (typeof value !== 'string' || (rule.pattern && !new RegExp(rule.pattern).test(value)))) return false;
  if (rule.type === 'boolean' && typeof value !== 'boolean') return false;
  if (rule.type === 'integer' && (!Number.isInteger(value) || value < (rule.minimum ?? -Infinity))) return false;
  if (rule.type === 'object' && (!value || typeof value !== 'object' || Array.isArray(value))) return false;
  if (rule.type === 'array') {
    if (!Array.isArray(value) || value.length < (rule.minItems ?? 0)) return false;
    if (rule.items && !Array.from(value).every(item => matches(item, rule.items))) return false;
    if (rule.contains && !Array.from(value).some(item => matches(item, rule.contains))) return false;
    if (rule['x-uniqueChunkIds']) {
      const ids = value.flat().map(chunk => chunk.id);
      if (new Set(ids).size !== ids.length) return false;
    }
  }
  if (rule.required && rule.required.some(key => !Object.hasOwn(value, key))) return false;
  if (rule.additionalProperties === false && Object.keys(value).some(key => !Object.hasOwn(rule.properties, key))) return false;
  if (rule.properties && !Object.entries(rule.properties).every(([key, child]) => !Object.hasOwn(value, key) || matches(value[key], child))) return false;
  if (rule.if && matches(value, rule.if) && !matches(value, rule.then)) return false;
  return true;
}

for (const mode of ['key', 'evidence']) {
  test(`${mode}: check returns each outcome in passage order and counts unique marks`, () => {
    const content = example(mode);
    const result = check(content, ['withdraw', 'overwhelmed', 'withdraw']);
    assert.deepEqual(result, {
      found: 1, total: 2, marked: 2, wrong: 1,
      items: [
        { id: 'withdraw', text: 'You withdraw.', marked: true, outcome: 'correct', note: null },
        { id: 'overwhelmed', text: 'You feel overwhelmed.', marked: true, outcome: 'wrong', note: 'This explains your feelings.' },
        { id: 'ignored', text: 'They feel ignored.', marked: false, outcome: 'missed', note: null },
        { id: 'plain', text: 'The conversation stops.', marked: false, outcome: 'unmarked', note: null }
      ]
    });
    assert.equal(check(content, []).found, 0);
    assert.deepEqual(check(content, []).items.map(item => item.outcome), ['missed', 'unmarked', 'missed', 'unmarked']);
    assert.equal(check(content, ['withdraw', 'ignored']).found, 2);
    assert.equal(check(content, ['plain']).items[3].note, null);
    assert.throws(() => check(content, ['unknown']), /Unknown chunk: unknown/);
    for (const bad of [null, {}, 'withdraw', [3], [null], Array(1)]) assert.throws(() => check(content, bad), /marked/);
  });
}

test('content validator catches every planted field violation, including global duplicate ids', () => {
  const content = example('evidence');
  const invalid = [];
  const bad = (value, field) => invalid.push([value, field]);
  for (const value of [null, [], 1, 'content']) bad(value, 'content');
  const sparseParagraphs = Array(2); sparseParagraphs[1] = chunks;
  bad({ ...content, paragraphs: sparseParagraphs }, 'paragraphs[0]');
  bad({ ...content, extra: true }, 'extra');
  for (const maxMarks of [0, -1, 1.5, null, undefined, '2', true, Infinity, NaN]) bad({ ...content, maxMarks }, 'maxMarks');
  for (const value of [null, '', 'other', true]) bad({ ...content, mode: value }, 'mode');
  for (const field of ['title', 'question']) {
    for (const value of [null, '', '  ', 3, undefined]) bad({ ...content, [field]: value }, field);
  }
  for (const value of [null, [], {}, 'paragraphs']) bad({ ...content, paragraphs: value }, 'paragraphs');
  bad({ ...content, paragraphs: [...Array(1), chunks] }, 'paragraphs[0]');
  bad({ ...content, paragraphs: [Array(1), chunks] }, 'paragraphs[0][0]');
  bad({ ...content, paragraphs: [chunks, ...Array(1)] }, 'paragraphs[1]');
  for (const value of [null, [], {}, 'paragraph']) bad({ ...content, paragraphs: [value] }, 'paragraphs[0]');
  for (const value of [null, [], 'chunk', 3]) bad({ ...content, paragraphs: [[value]] }, 'paragraphs[0][0]');
  for (const field of ['id', 'text']) {
    for (const value of [null, '', '  ', 3, undefined]) bad({ ...content, paragraphs: [[{ ...chunks[0], [field]: value }]] }, field);
  }
  bad({ ...content, paragraphs: [[{ ...chunks[0], id: 'bad id' }]] }, 'id');
  for (const suffix of ['\n', '\r', '\r\n', '\u2028', '\u2029']) bad({ ...content, paragraphs: [[{ ...chunks[0], id: `safe${suffix}` }]] }, 'id');
  for (const value of [' text', 'text ', 'text\n', 'text\r', 'text\r\n', 'text\u2028', 'text\u2029']) bad({ ...content, paragraphs: [[{ ...chunks[0], text: value }]] }, 'text');
  bad({ ...content, paragraphs: [[{ ...chunks[0], extra: true }]] }, 'extra');
  for (const value of [null, 'true', 1]) bad({ ...content, paragraphs: [[{ ...chunks[0], key: value }]] }, 'key');
  for (const value of [null, '', '  ', 1]) bad({ ...content, paragraphs: [[{ ...chunks[0], note: value }]] }, 'note');
  bad({ ...content, paragraphs: [[chunks[1]]] }, 'key');
  bad({ ...content, paragraphs: [[{ ...chunks[0], key: false }]] }, 'key');
  bad({ ...content, paragraphs: [[chunks[0]], [chunks[0]]] }, 'id');
  for (const [value, field] of invalid) {
    assert.throws(() => validateContent(value), error => error instanceof Error && error.message.includes(field), field);
    assert.equal(matches(value, schema), false, `schema: ${field}`);
  }
  assert.doesNotThrow(() => validateContent(content));
  assert.doesNotThrow(() => validateContent(example('key')));
  assert.doesNotThrow(() => validateContent({ ...example('key'), question: 'A useful optional question' }));
  assert.doesNotThrow(() => validateContent({ ...content, paragraphs: [[{ ...chunks[0], key: true }, { ...chunks[1], key: false }]] }));
  for (const value of [content, example('key'), { ...example('key'), question: 'Optional question' }]) assert.equal(matches(value, schema), true);
});

test('mark limits default by mode, accept positive overrides and reject excess selections', async () => {
  const { markLimit } = await import('./logic.js');
  assert.equal(markLimit(example('evidence')), 2);
  assert.equal(markLimit(example('key')), 3);
  for (const mode of ['key', 'evidence']) {
    const content = { ...example(mode), maxMarks: 1 };
    validateContent(content);
    assert.equal(matches(content, schema), true);
    assert.equal(markLimit(content), 1);
    assert.equal(check(content, ['withdraw', 'withdraw']).marked, 1);
    assert.throws(() => check(content, ['withdraw', 'ignored']), /maxMarks/);
    for (const shown of [false, true]) assert.equal(validateState(content, { marked: ['withdraw', 'ignored'], shown }), null);
  }
  assert.equal(validateState(example('evidence'), { marked: ['withdraw', 'ignored', 'plain'], shown: false }), null);
  assert.equal(markLimit({ ...example('key'), maxMarks: 10 }), 10);
  const inherited = Object.assign(Object.create({ maxMarks: 1 }), example('key'));
  assert.throws(() => validateContent(inherited), /maxMarks/);
});

test('render has one task instruction and no decorative scene label in either language', () => {
  for (const lang of ['en', 'fr']) {
    const html = render(example('evidence'), strings[lang], { id: lang, lang });
    assert.equal(html.includes('lp-scene-label'), false);
    assert.ok(html.includes(strings[lang].evidenceInstruction.replaceAll('{question}', 'How do they feel?')));
    assert.ok(html.includes(strings[lang].count.replaceAll('{n}', '0').replaceAll('{max}', '2')));
    assert.match(html, /data-lp-limit hidden/);
  }
});

test('inherited required and optional authored fields cannot change outcomes or return shapes', () => {
  const content = example('evidence');
  const inheritedQuestion = Object.assign(Object.create({ question: content.question }), { mode: content.mode, title: content.title, paragraphs: content.paragraphs });
  const invalid = [
    [Object.create(content), 'mode'],
    [inheritedQuestion, 'question'],
    [Object.assign(Object.create({ question: 42 }), example('key')), 'question'],
    [{ ...content, paragraphs: [[Object.create(chunks[0])]] }, 'id']
  ];
  for (const [field, value] of [['note', 42], ['key', true]]) {
    const inherited = Object.assign(Object.create({ [field]: value }), { id: 'inherited', text: 'Plain text.' });
    invalid.push([{ ...content, paragraphs: [[chunks[0], inherited]] }, field]);
  }
  // Prototypes are JavaScript inputs, outside the JSON Schema fixtures above.
  for (const [value, field] of invalid) {
    const namesField = error => error instanceof Error && error.message.includes(field);
    assert.throws(() => validateContent(value), namesField);
    assert.throws(() => check(value, []), namesField);
  }
});

test('saved state is strict, copied and ignores planted invalid values', () => {
  const content = example('key');
  for (const value of [null, [], {}, Object.create({ marked: [], shown: true }), { marked: Array(1), shown: true }, { marked: [], shown: true, extra: 1 }, { marked: [], shown: 'yes' }, { marked: 'withdraw', shown: false }, { marked: [3], shown: false }, { marked: ['unknown'], shown: false }, { marked: ['withdraw', 'withdraw'], shown: false }]) {
    assert.equal(validateState(content, value), null);
  }
  for (const shown of [false, true]) {
    const value = { marked: ['withdraw'], shown };
    const copy = validateState(content, value);
    assert.deepEqual(copy, value); assert.notEqual(copy.marked, value.marked);
  }
  assert.deepEqual(validateState(content, { marked: [], shown: true }), { marked: [], shown: true });
});

test('render has a plain passage, authored fallback, hidden controls and one empty status', () => {
  const content = example('evidence');
  const html = render(content, strings.en, { id: 'one', lang: 'en' });
  assert.match(html, /class="lp lp-highlight" data-lp-pattern="highlight" lang="en"/);
  assert.ok(html.includes('How do they feel?'));
  assert.match(html, /data-lp-chunk="withdraw"[^>]*>You withdraw\.<\/span><span[^>]*data-lp-feedback[^>]*hidden[^>]*><\/span> <span/);
  assert.equal(html.includes('role="button"'), false);
  assert.equal(html.includes('tabindex='), false);
  assert.match(html, /data-lp-flow hidden/);
  assert.match(html, /data-lp-fallback/);
  assert.ok(html.includes('This explains your feelings.'));
  assert.equal((html.match(/role="status"/g) || []).length, 1);
  assert.match(html, /role="status" aria-atomic="true"><\/p>/);
  assert.ok(html.includes('data-lp-count'));
});

test('render escapes every plain-text field and prefixes every id; key optional question is shown', () => {
  const hostile = '<script>"&\'hello\'</script>';
  const content = { mode: 'key', title: hostile, question: hostile, paragraphs: [[{ id: 'one', text: hostile, key: true, note: hostile }]] };
  const ui = Object.fromEntries(Object.keys(strings.en).map(key => [key, hostile]));
  const html = render(content, ui, { id: 'one"', lang: 'fr"' });
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('&lt;script&gt;&quot;&amp;&#39;hello&#39;&lt;/script&gt;'));
  assert.ok(html.includes('lang="fr&quot;"'));
  const pair = render(content, strings.en, { id: 'a', lang: 'en' }) + render(content, strings.fr, { id: 'b', lang: 'fr' });
  const ids = [...pair.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => /^(a|b)-/.test(id)));
  assert.ok(render({ ...example('key'), question: 'Optional question' }, strings.en, { id: 'k', lang: 'en' }).includes('Optional question'));
});

test('English and French UI keys and placeholders match, and all four examples validate', async () => {
  assert.ok(Object.keys(strings.en).length > 0);
  assert.deepEqual(Object.keys(strings.en).sort(), Object.keys(strings.fr).sort());
  for (const key of Object.keys(strings.en)) assert.deepEqual(strings.en[key].match(/\{\w+\}/g), strings.fr[key].match(/\{\w+\}/g));
  for (const lang of ['en', 'fr']) {
    const evidence = JSON.parse(await readFile(new URL(`./examples/${lang}.json`, import.meta.url)));
    const key = JSON.parse(await readFile(new URL(`./examples/${lang}-key.json`, import.meta.url)));
    assert.equal(evidence.mode, 'evidence'); assert.equal(key.mode, 'key');
    validateContent(evidence); validateContent(key);
    assert.equal(matches(evidence, schema), true); assert.equal(matches(key, schema), true);
    const source = JSON.parse(await readFile(new URL(`../review-prompts/examples/${lang}.json`, import.meta.url)));
    assert.deepEqual(evidence.paragraphs.map(p => p.map(c => c.text).join(' ')), source.parts[0].paragraphs);
    assert.deepEqual(evidence.paragraphs.map(p => p.map(c => c.text)), key.paragraphs.map(p => p.map(c => c.text)));
    assert.equal(check(evidence, []).total, 1);
    assert.equal(check(key, []).total, 4);
  }
});
