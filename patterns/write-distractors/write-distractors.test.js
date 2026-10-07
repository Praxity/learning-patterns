import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateContent, validateOptions, validateState, coverage, coverageMessage, targetOf } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const fr = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const option = (text = 'Yes, keep working.', misconception = 'push-through', custom = '') => ({ text, misconception, custom });

// Check precisely the schema keywords and relational annotations this content uses.
function matches(value, rule, root = value) {
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return rule.required.every(key => Object.hasOwn(value, key))
      && Object.keys(value).every(key => rule.additionalProperties !== false || Object.hasOwn(rule.properties, key))
      && Object.entries(rule.properties).every(([key, child]) => matches(value[key], child, root));
  }
  if (rule.type === 'array') return Array.isArray(value) && value.length >= rule.minItems
    && (!rule['x-uniqueBy'] || new Set(value.map(item => item?.[rule['x-uniqueBy']])).size === value.length)
    && value.every(item => matches(item, rule.items, root));
  if (rule.type === 'integer') return Number.isSafeInteger(value) && value >= rule.minimum && value <= rule.maximum;
  return typeof value === 'string' && value.length >= rule.minLength
    && (!rule.pattern || new RegExp(rule.pattern).test(value))
    && (!rule.not || value !== rule.not.const)
    && (!rule['x-reference'] || root.misconceptions.some(item => item.id === value));
}

test('example preserves the demo question, labels and author options with topic IDs', () => {
  assert.equal(content.question, 'Is taking a real break during the workday a waste of time?');
  assert.equal(content.rightAnswer, 'No. Short breaks restore attention and reduce mistakes.');
  assert.equal(content.count, 2);
  assert.deepEqual(content.misconceptions.map(item => item.id), ['busy', 'push-through', 'phone', 'exhausted']);
  assert.deepEqual(content.authorOptions.map(item => targetOf(content, item)), content.misconceptions.map(item => item.label));
});

test('validator and schema agree on valid content and planted violations', async () => {
  const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));
  const fixtures = [[content, true], [fr, true], [{ ...content, count: 3, question: ' ' }, true]];
  const bad = (value, field) => fixtures.push([value, false, field]);
  for (const value of [null, [], {}]) bad(value, 'content');
  bad({ ...content, extra: 1 }, 'extra');
  for (const field of ['question', 'rightAnswer']) for (const value of ['', null, 2, undefined]) bad({ ...content, [field]: value }, field);
  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, null, '2']) bad({ ...content, count: value }, 'count');
  for (const field of ['misconceptions', 'authorOptions']) {
    for (const value of [[], null, 'x']) bad({ ...content, [field]: value }, field);
    bad({ ...content, [field]: [null] }, `${field}[0]`);
    bad({ ...content, [field]: [{ ...content[field][0], extra: true }] }, 'extra');
    for (const key of Object.keys(content[field][0])) for (const value of ['', undefined, 7]) bad({ ...content, [field]: [{ ...content[field][0], [key]: value }] }, key);
  }
  for (const id of ['other', 'bad id']) bad({ ...content, misconceptions: [{ id, label: 'Label' }] }, 'id');
  bad({ ...content, misconceptions: [content.misconceptions[0], content.misconceptions[0]] }, 'id');
  bad({ ...content, authorOptions: [{ text: 'X', misconception: 'unknown' }] }, 'misconception');
  for (const [value, valid, field] of fixtures) {
    assert.equal(matches(value, schema), valid, `schema: ${field}`);
    if (valid) assert.doesNotThrow(() => validateContent(value));
    else assert.throws(() => validateContent(value), error => error.message.includes(field));
  }
});

test('submission returns field errors for blanks, unknown targets and missing custom text', () => {
  assert.deepEqual(validateOptions(content, [option(' ', ''), option('Wrong', 'other', ' ')]), { ok: false, errors: [
    { option: 0, field: 'text', code: 'empty' },
    { option: 0, field: 'misconception', code: 'choose' },
    { option: 1, field: 'custom', code: 'describe' }
  ] });
  assert.equal(validateOptions(content, [option('Wrong', 'unknown'), option('Different')]).errors[0].code, 'choose');
});

test('right answer, duplicates anywhere, and raw length limits are refused', () => {
  assert.equal(validateOptions(content, [option(`  ${content.rightAnswer.toUpperCase()} `), option('B')]).errors[0].code, 'right');
  const larger = { ...content, count: 3 };
  assert.deepEqual(validateOptions(larger, [option('A'), option('B'), option(' b  ')]).errors, [{ option: 2, field: 'text', code: 'duplicate' }]);
  assert.equal(validateOptions(content, [option('x'.repeat(301)), option('B')]).errors[0].code, 'longText');
  assert.equal(validateOptions(content, [option(' '.repeat(301) + 'A'), option('B')]).errors[0].code, 'longText');
  assert.equal(validateOptions(content, [option('A', 'other', 'x'.repeat(121)), option('B')]).errors[0].code, 'longCustom');
  assert.equal(validateOptions(content, [option('A', 'other', ' '.repeat(121) + 'X'), option('B')]).errors[0].code, 'longCustom');
  assert.equal(validateOptions(content, [option('x'.repeat(300), 'other', 'y'.repeat(120)), option('B')]).ok, true);
  for (const options of [null, [], [option()], [null, option()], [option(3), option()], [option('A', 4), option()], [{ text: 'A', misconception: 'busy' }, option()], [option('A', 'busy', null), option()]]) {
    assert.throws(() => validateOptions(content, options), /Invalid options/);
  }
});

test('clean options normalize spaces and omit irrelevant custom text by emptying it', () => {
  assert.deepEqual(validateOptions(content, [option('  A  B  ', 'busy', 'ignored'), option('C', 'other', '  Focus  lost  ')]), {
    ok: true, options: [option('A B', 'busy'), option('C', 'other', 'Focus lost')]
  });
});

test('coverage identifies targeted, missed, extra and matching targets without repeats', () => {
  const value = coverage(content, [option('A'), option('B', 'other', 'Breaks disrupt focus')]);
  assert.deepEqual(value.targeted, ['Pushing through is always more productive', 'Breaks disrupt focus']);
  assert.deepEqual(value.missed, [content.misconceptions[0].label, content.misconceptions[2].label, content.misconceptions[3].label]);
  assert.deepEqual(value.extra, ['Breaks disrupt focus']);
  assert.deepEqual(value.matches, [true, false]);
  assert.deepEqual(coverage(content, [option('A', 'other', ' PUSHING through is always more productive '), option('B')]).matches, [true, true]);
  assert.deepEqual(coverage(content, [option('A', 'other', ' New tag '), option('B', 'other', 'new TAG')]).extra, ['New tag']);
  const partial = { ...content, authorOptions: [content.authorOptions[0]] };
  assert.deepEqual(coverage(partial, [option('A'), option('B', 'phone')]).extra, [content.misconceptions[1].label, content.misconceptions[2].label]);
  assert.throws(() => targetOf(content, option('A', 'unknown')), /misconception/);
  assert.throws(() => coverage(content, [option('', '') , option()]), /Invalid options/);
});

test('coverageMessage returns counts and untargeted author labels without formatting strings', () => {
  assert.deepEqual(coverageMessage(content, [option('A'), option('B', 'other', 'Focus lost')]), {
    authorTargeted: 1, authorTotal: 4, ownExtra: 1,
    untargeted: [content.misconceptions[0].label, content.misconceptions[2].label, content.misconceptions[3].label]
  });
  assert.deepEqual(coverageMessage(content, [option('A', 'other', 'Focus lost'), option('B', 'other', 'focus  LOST')]), {
    authorTargeted: 0, authorTotal: 4, ownExtra: 1, untargeted: content.misconceptions.map(item => item.label)
  });
  assert.deepEqual(coverageMessage({ ...content, count: 4 }, content.authorOptions.map(item => option(item.text, item.misconception))), {
    authorTargeted: 4, authorTotal: 4, ownExtra: 0, untargeted: []
  });
  assert.equal(coverageMessage({ ...content, count: 3 }, [option('A', 'other', 'X'), option('B', 'other', 'Y'), option('C', 'other', 'Z')]).ownExtra, 3);
});

test('coverage counts unique normalized author targets rather than the whole taxonomy', () => {
  const partial = { ...content, authorOptions: [content.authorOptions[0], { text: 'Another busy answer', misconception: 'busy' }] };
  assert.deepEqual(coverageMessage(partial, [option('A'), option('B', 'phone')]), {
    authorTargeted: 0, authorTotal: 1, ownExtra: 2, untargeted: [content.misconceptions[0].label]
  });
  assert.deepEqual(coverage(partial, [option('A'), option('B', 'phone')]).missed, [content.misconceptions[0].label]);
  const aliases = { ...partial, misconceptions: [...content.misconceptions, { id: 'alias', label: "  BREAKS are for people who aren't busy  " }], authorOptions: [...partial.authorOptions, { text: 'Alias answer', misconception: 'alias' }] };
  assert.deepEqual(coverageMessage(aliases, [option('A', 'alias'), option('B', 'other', "BREAKS are for people who aren't BUSY")]), {
    authorTargeted: 1, authorTotal: 1, ownExtra: 0, untargeted: []
  });
});

test('state copies drafts, rejects bad shapes and requires a valid shown submission', () => {
  const draft = { options: [option('', ''), option('', 'other', '')], shown: false };
  assert.deepEqual(validateState(content, draft), draft);
  const saved = { options: [option('A'), option('B', 'other', 'Focus')], shown: true };
  const copy = validateState(content, saved);
  assert.deepEqual(copy, saved); assert.notEqual(copy.options, saved.options); assert.notEqual(copy.options[0], saved.options[0]);
  for (const value of [null, [], {}, { ...saved, shown: 'yes' }, { ...saved, options: [] }, { ...saved, options: [null, option()] }, { options: [option('A', 'unknown'), option()], shown: false }, { options: [option('x'.repeat(301)), option()], shown: false }, { options: [option('A', 'other', 'x'.repeat(121)), option()], shown: false }, { ...draft, shown: true }, { ...saved, extra: 1 }, { options: [{ ...option('A'), extra: 1 }, option('B')], shown: false }]) {
    assert.equal(validateState(content, value), null);
  }
});

test('render escapes text and attributes, prefixes IDs, supplies field associations and native fallback', () => {
  const hostile = '<script>alert("x")</script> & \'quoted\'';
  const value = { ...content, question: hostile, rightAnswer: hostile, misconceptions: [{ id: 'x', label: hostile }], authorOptions: [{ text: hostile, misconception: 'x' }] };
  const ui = Object.fromEntries(Object.keys(strings.en).map(key => [key, hostile]));
  const output = render(value, ui, { id: 'a"', lang: 'fr"' });
  assert.ok(!output.includes('<script>')); assert.ok(output.includes('&lt;script&gt;'));
  assert.ok(output.includes('lang="fr&quot;"'));
  const a = render(content, strings.en, { id: 'a', lang: 'en' });
  const b = render(content, strings.en, { id: 'b', lang: 'en' });
  const ids = [...(a + b).matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every(id => id.startsWith('a-') || id.startsWith('b-')));
  for (const match of a.matchAll(/(?:for|aria-describedby)="([^"]+)"/g)) assert.ok(ids.includes(match[1]));
  assert.equal((a.match(/role="status"/g) || []).length, 1);
  assert.match(a, /role="status" aria-atomic="true"><\/p>/);
  assert.equal((a.match(/<fieldset/g) || []).length, 2);
  assert.equal((a.match(/maxlength="300"/g) || []).length, 2);
  assert.equal((a.match(/maxlength="120"/g) || []).length, 2);
  assert.ok(a.includes('<details')); assert.ok(a.includes('data-lp-flow hidden'));
  assert.match(a, /data-lp-clear hidden/);
  assert.ok(!a.includes('data-lp-selected'));
  for (const item of content.authorOptions) assert.ok(a.includes(item.text.replaceAll("'", '&#39;')));
});

test('English and French keys and placeholders match', () => {
  assert.deepEqual(Object.keys(strings.en).sort(), Object.keys(strings.fr).sort());
  for (const key of Object.keys(strings.en)) assert.deepEqual(strings.en[key].match(/\{\w+\}/g), strings.fr[key].match(/\{\w+\}/g));
});

test('render uses the shared frame, text roles, sectioned fields and quiet Start over', () => {
  const output = render(content, strings.en, { id: 'design', lang: 'en' });
  assert.match(output, /class="lp lp-write-distractors"/);
  assert.match(output, /<p class="lp-stem">Is taking a real break/);
  assert.match(output, /<p class="lp-run-in">Right answer<\/p>/);
  assert.match(output, /<p class="lp-small">Write 2 wrong answers/);
  assert.equal((output.match(/class="lp-section"[^>]*>\s*<fieldset/g) || []).length, 2);
  assert.equal((output.match(/<legend class="lp-run-in">Wrong option/g) || []).length, 2);
  assert.equal((output.match(/class="lp-input"/g) || []).length, 6);
  assert.equal((output.match(/class="lp-error-text"/g) || []).length, 6);
  assert.match(output, /class="lp-section" data-lp-result hidden/);
  assert.match(output, /class="lp-button lp-button-quiet"[^>]*data-lp-clear hidden><svg[\s\S]*?<\/svg>Start over<\/button>/);
  assert.match(render(fr, strings.fr, { id: 'fr', lang: 'fr' }), /<\/svg>Recommencer<\/button>/);
});
