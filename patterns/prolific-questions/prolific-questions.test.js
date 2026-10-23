import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deal, shuffle, score, validateContent, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';
import { escapeHtml } from '../../lib/html.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));

// Covers this schema's keywords plus its documented cross-field annotations.
function matches(value, rule, root = value) {
  if (rule.type === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      && rule.required.every(key => Object.hasOwn(value, key))
      && (rule.additionalProperties !== false || Object.keys(value).every(key => Object.hasOwn(rule.properties, key)))
      && Object.entries(rule.properties).every(([key, child]) => !Object.hasOwn(value, key) || matches(value[key], child, root));
  }
  if (rule.type === 'array') {
    return Array.isArray(value) && value.length >= rule.minItems
      && (!rule['x-lengthFrom'] || value.length === root[rule['x-lengthFrom']].length)
      && (!rule['x-uniqueBy'] || new Set(value.map(item => item?.[rule['x-uniqueBy']])).size === value.length)
      && Array.from(value).every(item => matches(item, rule.items, root));
  }
  return typeof value === 'string' && [...value].length >= rule.minLength && [...value].length <= rule.maxLength && new RegExp(rule.pattern).test(value);
}

test('each case is dealt once per round, with no repeat across round boundaries', () => {
  // Exercise both ends of the random interval, including a forced boundary collision.
  for (const random of [() => 0, () => 1 - Number.EPSILON, Math.random]) {
    let previous = -1;
    let deck = { deck: [], last: -1 };
    for (let round = 0; round < 100; round++) {
      const cases = [];
      for (let i = 0; i < 10; i++) {
        const before = structuredClone(deck);
        const next = deal(10, deck, random);
        assert.deepEqual(deck, before, 'dealing does not mutate host state');
        assert.notEqual(next.last, previous);
        previous = next.last;
        cases.push(next.last);
        deck = next;
      }
      assert.deepEqual(cases.toSorted((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      assert.deepEqual(deck.deck, []);
    }
  }
  assert.deepEqual(deal(2, { deck: [], last: 1 }, () => 1 - Number.EPSILON), { deck: [1], last: 0 });
});

test('shuffle copies values and deal rejects invalid deck, count and randomness', () => {
  const input = [0, 1, 2];
  assert.deepEqual(shuffle(input, () => 0), [1, 2, 0]);
  assert.deepEqual(input, [0, 1, 2]);
  for (const count of [0, 1, -1, 2.5, NaN]) assert.throws(() => deal(count), /caseCount/);
  for (const value of [-1, 1, NaN, Infinity]) assert.throws(() => shuffle(input, () => value), /random/);
  for (const deck of [{ deck: [0, 0], last: 1 }, { deck: [0], last: 0 }, { deck: [10], last: 1 }, { deck: [0], last: -1 }]) {
    assert.throws(() => deal(10, deck), /deck/);
  }
});

test('score compares shuffled facts with their part, including incomplete and wrong answers', () => {
  assert.deepEqual(score([2, 0, 1], [2, 0, 1]), { right: 3, total: 3, unanswered: [] });
  assert.deepEqual(score([2, 0, 1], [0, 1, 2]), { right: 0, total: 3, unanswered: [] });
  assert.deepEqual(score([2, 0, 1], [null, 0, null]), { right: 1, total: 3, unanswered: [0, 2] });
  for (const order of [[], [0, 0], [0, 2], [0, -1], [0, 1.5]]) assert.throws(() => score(order, order), /order/);
  for (const picks of [[], [0, 1], [0, 1, 3], [0, 1, -1], [0, 1, undefined]]) assert.throws(() => score([0, 1, 2], picks), /picks/);
});

test('content has named definitions, a complete worked example and at least eight complete cases', () => {
  for (const example of [content, french]) {
    assert.doesNotThrow(() => validateContent(example));
    assert.equal(matches(example, schema), true);
  }
  const minimum = { ...content, cases: content.cases.slice(0, 8) };
  assert.doesNotThrow(() => validateContent(minimum));
  const bad = (edit, field) => {
    const copy = structuredClone(content);
    edit(copy);
    assert.throws(() => validateContent(copy), error => error instanceof Error && error.message.includes(field), field);
    assert.equal(matches(copy, schema), false, field);
  };
  for (const value of [null, [], 3]) assert.throws(() => validateContent(value), /content/);
  bad(c => { c.extra = true; }, 'extra');
  for (const field of ['title', 'context', 'question']) {
    for (const value of ['', '   ', null, 3, undefined]) bad(c => { c[field] = value; }, field);
  }
  for (const value of [[], [content.parts[0]], null, {}]) bad(c => { c.parts = value; }, 'parts');
  bad(c => { c.parts[0] = null; }, 'parts[0]');
  bad(c => { c.parts[0].extra = ''; }, 'parts[0].extra');
  for (const field of ['label', 'definition']) {
    for (const value of ['', ' ', null, 3, undefined]) bad(c => { c.parts[0][field] = value; }, `parts[0].${field}`);
  }
  bad(c => { c.parts[1].label = c.parts[0].label; }, 'parts[1].label');
  for (const field of ['workedExample', 'cases']) {
    for (const value of [null, {}, []]) bad(c => { c[field] = value; }, field);
  }
  bad(c => { c.cases.length = 7; }, 'cases');
  bad(c => { c.workedExample.pop(); }, 'workedExample');
  bad(c => { c.workedExample.push('Extra'); }, 'workedExample');
  bad(c => { c.cases[0] = null; }, 'cases[0]');
  bad(c => { c.cases[0].pop(); }, 'cases[0]');
  bad(c => { c.cases[0].push('Extra'); }, 'cases[0]');
  for (const value of ['', ' ', 3, null]) {
    bad(c => { c.workedExample[0] = value; }, 'workedExample[0]');
    bad(c => { c.cases[0][0] = value; }, 'cases[0][0]');
  }
  bad(c => { delete c.parts[0]; }, 'parts[0]');
  bad(c => { delete c.workedExample[0]; }, 'workedExample[0]');
  bad(c => { delete c.cases[0]; }, 'cases[0]');
  bad(c => { delete c.cases[0][0]; }, 'cases[0][0]');
});

test('schema declares matching text limits and completeness rules', () => {
  assert.equal(schema.properties.cases.minItems, 8);
  assert.equal(schema.properties.cases.items['x-lengthFrom'], 'parts');
  assert.equal(schema.properties.workedExample['x-lengthFrom'], 'parts');
  assert.equal(schema.properties.parts['x-uniqueBy'], 'label');
  const fields = [
    [schema.properties.title, c => c, 'title'],
    [schema.properties.context, c => c, 'context'],
    [schema.properties.question, c => c, 'question'],
    [schema.properties.parts.items.properties.label, c => c.parts[0], 'label'],
    [schema.properties.parts.items.properties.definition, c => c.parts[0], 'definition'],
    [schema.properties.workedExample.items, c => c.workedExample, 0],
    [schema.properties.cases.items.items, c => c.cases[0], 0]
  ];
  for (const [rule, parent, key] of fields) {
    const copy = structuredClone(content);
    parent(copy)[key] = '🦉'.repeat(rule.maxLength);
    assert.doesNotThrow(() => validateContent(copy));
    parent(copy)[key] += 'x';
    assert.throws(() => validateContent(copy), /maximum/);
  }
});

const saved = () => ({ deck: [1, 2, 3, 4, 5, 6, 7, 8, 9], last: 0, order: [2, 0, 1], picks: [null, 0, null], checked: false, completed: 0, placed: 0 });

test('valid partial and checked host states are copied, invalid state is ignored', () => {
  const partial = saved();
  assert.deepEqual(validateState(content, partial), partial);
  const copy = validateState(content, partial);
  copy.deck.pop(); copy.picks[0] = 2; copy.order.reverse();
  assert.deepEqual(partial, saved());
  const checked = { ...saved(), picks: [2, 0, 0], checked: true, completed: 1, placed: 2 };
  assert.deepEqual(validateState(content, checked), checked);
  const invalid = [null, [], {}, { ...saved(), checked: 1 }, { ...saved(), last: -1 },
    { ...saved(), deck: [0] }, { ...saved(), deck: [1, 1] }, { ...saved(), deck: [10] },
    { ...saved(), order: [1, 1, 0] }, { ...saved(), picks: [null] }, { ...saved(), picks: [3, 0, 0] },
    { ...saved(), completed: -1 }, { ...saved(), completed: 0.5 }, { ...saved(), placed: 1 },
    { ...saved(), placed: NaN }, { ...saved(), completed: Number.MAX_SAFE_INTEGER }, { ...saved(), deck: [] },
    { ...saved(), picks: Array(3) }, { ...saved(), order: [0, 1, ,] }, { ...saved(), deck: [1, ,] },
    { ...checked, picks: [null, 0, 0] }, { ...checked, completed: 0 },
    { ...checked, placed: 1 }, { ...checked, placed: 3 }];
  for (const value of invalid) assert.equal(validateState(content, value), null, JSON.stringify(value));
});

test('render escapes content, UI, ids and language and keeps instances independent', () => {
  const hostile = '<script>"&\'</script>';
  const copy = structuredClone(content);
  copy.title = hostile; copy.context = hostile; copy.question = hostile;
  copy.parts[0] = { label: hostile, definition: hostile };
  copy.workedExample[0] = hostile; copy.cases[0][0] = hostile;
  const ui = Object.fromEntries(Object.keys(strings.en).map(key => [key, hostile]));
  const markup = render(copy, ui, { id: 'a"', lang: 'fr"' });
  assert.ok(!markup.includes('<script>'));
  assert.match(markup, /&lt;script&gt;&quot;&amp;&#39;&lt;\/script&gt;/);
  assert.match(markup, /lang="fr&quot;"/);
  const both = ['a', 'b'].map(id => render(content, strings.en, { id, lang: 'en' })).join('');
  const ids = [...both.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.every(id => /^[ab]-/.test(id)));
});

test('worked example comes first, no-JS answers contain every fact, label and source', () => {
  for (const [example, ui, lang] of [[content, strings.en, 'en'], [french, strings.fr, 'fr']]) {
    const markup = render(example, ui, { id: 'practice', lang });
    assert.ok(markup.indexOf('data-lp-worked') < markup.indexOf('data-lp-practice'));
    assert.match(markup, /data-lp-practice hidden/);
    assert.match(markup, /data-lp-try-again hidden/);
    assert.equal((markup.match(/role="status"/g) ?? []).length, 1);
    assert.match(markup, /role="status" aria-atomic="true"><\/p>/);
    const fallback = markup.match(/<details[^>]+data-lp-fallback>[\s\S]*?<\/details>/)[0];
    for (const fact of example.cases.flat()) assert.ok(fallback.includes(escapeHtml(fact, lang)));
    for (const part of example.parts) assert.ok(fallback.includes(escapeHtml(part.label, lang)));
    assert.ok(fallback.includes(escapeHtml(example.context, lang)));
    if (lang === 'fr') assert.match(markup, /Contexte\u202f:/);
  }
  assert.deepEqual(Object.keys(strings.en), Object.keys(strings.fr));
});
