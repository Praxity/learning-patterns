import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { feedback, validateContent, validateState, ANSWER_LIMIT, AUTO_CHECK_LIMIT } from './logic.js';
import { liveFeedback, CRITERION_KEYS } from '../../proxy/logic/02-live.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const answers = value => Object.fromEntries(CRITERION_KEYS.map(key => [key, { noul: value }]));

test('the original gates choose only authored feedback, shared with the proxy', () => {
  for (const [value, mark] of [[.65, 'done'], [.6499, 'todo'], [.3501, 'todo'], [.35, 'todo']]) {
    const result = feedback(content, answers(value));
    assert.deepEqual(result.items.map(item => item.mark), Array(4).fill(mark));
    assert.deepEqual(result.items.map(item => item.text), content.criteria.map(item => item[mark === 'done' ? 'done' : 'todo']));
    assert.deepEqual(liveFeedback(answers(value)).items.map(item => item.state === 'met' ? 'done' : 'todo'), result.items.map(item => item.mark));
    assert.equal(result.count, mark === 'done' ? 4 : 0);
  }
});

test('criteria contain only done and todo wording; automatic checks stop at 40', () => {
  for (const item of content.criteria) assert.deepEqual(Object.keys(item), ['id', 'done', 'todo']);
  assert.equal(AUTO_CHECK_LIMIT, 40);
});

test('unfinished sentences keep met items until punctuation or a newline permits revision', () => {
  const previous = feedback(content, answers(1)).items;
  for (const draft of ['I will say', 'I will say   ']) {
    for (const value of [0, .5]) assert.equal(feedback(content, answers(value), draft, previous).count, 4);
  }
  for (const end of ['.', '!', '?', '\n', '\n  ', '\r\n']) assert.equal(feedback(content, answers(0), `I will say${end}`, previous).count, 0);
  const partial = feedback(content, { ...answers(0), observable: { noul: 1 } }, 'I will');
  assert.deepEqual(partial.items.map(item => item.id), ['observable', 'three_actions', 'when', 'commitments']);
  assert.deepEqual(partial.items.map(item => item.mark), ['done', 'todo', 'todo', 'todo']);
});

test('invalid decision answers fail loudly', () => {
  for (const value of [null, {}, answers(NaN), answers(-1), answers(2), answers('1'), { ...answers(1), extra: { noul: 1 } }]) {
    assert.throws(() => feedback(content, value), /Invalid answers/);
  }
});

test('content and state guards reject planted violations', () => {
  validateContent(content);
  for (const mutate of [c => { c.extra = true; }, c => { c.prompt = ''; }, c => { c.criteria.pop(); }, c => { c.criteria[0].id = 'when'; }, c => { c.criteria[0].done = ''; }, c => { delete c.criteria[0].todo; }, c => { c.criteria[0].label = 'Old label'; }]) {
    const bad = structuredClone(content); mutate(bad); assert.throws(() => validateContent(bad), /Invalid/);
  }
  const saved = { answer: 'Draft', ticked: ['when'] };
  assert.deepEqual(validateState(saved), saved);
  for (const value of [null, {}, { answer: 'x', ticked: ['unknown'] }, { answer: 'x', ticked: ['when', 'when'] }, { answer: 'x'.repeat(ANSWER_LIMIT + 1), ticked: [] }]) assert.equal(validateState(value), null);
});

test('bilingual native markup escapes content and prefixes every id', async () => {
  assert.deepEqual(Object.keys(strings.en), Object.keys(strings.fr));
  for (const lang of ['en', 'fr']) {
    const example = JSON.parse(await readFile(new URL(`./examples/${lang}.json`, import.meta.url)));
    const markup = render({ ...example, prompt: '<script>bad</script>' }, strings[lang], { id: 'one', lang });
    assert.match(markup, /&lt;script&gt;bad&lt;\/script&gt;/);
    assert.match(markup, new RegExp(`lang="${lang}"`));
    assert.equal([...markup.matchAll(/role="status"/g)].length, 1);
    assert.equal([...markup.matchAll(/type="checkbox"/g)].length, 4);
    assert.doesNotMatch(markup, /data-lp-check(?:\s|>)|lp-choice-key/);
    for (const item of example.criteria) assert.ok(markup.includes(item.done));
    for (const [, id] of markup.matchAll(/\sid="([^"]+)"/g)) assert.ok(id.startsWith('one-'));
  }
});

test('neither language exposes a timing hint in its strings or rendered page', async () => {
  for (const lang of ['en', 'fr']) {
    const example = JSON.parse(await readFile(new URL(`./examples/${lang}.json`, import.meta.url)));
    assert.equal(Object.hasOwn(strings[lang], 'hint'), false);
    assert.doesNotMatch(render(example, strings[lang], { id: 'one', lang }), /data-lp-hint/);
  }
});
