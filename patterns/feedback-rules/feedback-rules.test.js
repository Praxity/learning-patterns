import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarize, runSamples, validateContent } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const model = '@cf/cloudflare/clef';
const answers = values => Object.fromEntries(content.criteria.map((c, i) => [c.id, { noul: values[i] }]));
const first = content.fixtures[0];

test('summary counts each cell, preserves blame polarity and keeps failures separate', () => {
  const result = summarize(content, { [first.id]: answers([1, 0, .5, 1, 1, 1]), [content.fixtures[1].id]: null }, model);
  assert.deepEqual({ agree: result.agree, disagree: result.disagree, unsure: result.unsure, notRun: result.notRun, total: result.total, failed: result.failed },
    { agree: 3, disagree: 2, unsure: 1, notRun: 66, total: 72, failed: 1 });
  assert.deepEqual(result.rows[0].cells.map(c => [c.author, c.model, c.outcome]), [
    ['met', 'met', 'agree'], ['met', 'missed', 'disagree'], ['met', 'unsure', 'unsure'],
    ['met', 'met', 'agree'], ['met', 'met', 'agree'], ['missed', 'met', 'disagree']
  ]);
  assert.equal(result.rows[0].review, true);
  assert.equal(result.rows[1].failed, true);
  assert.equal(result.rows[2].failed, false);
});

test('all authored labels agree, including met on blame, without grading answer quality', () => {
  const results = Object.fromEntries(content.fixtures.map(f => [f.id, answers(content.criteria.map(c => f.expected[c.id] === 'met' ? 1 : 0))]));
  const summary = summarize(content, results, model);
  assert.equal(summary.agree, 72); assert.equal(summary.disagree + summary.unsure + summary.notRun, 0);
  assert.equal(summary.rows.find(r => r.id === 'blame_mistake').cells.at(-1).outcome, 'agree');
});

test('fixture ids cannot read inherited results or change the results dictionary', async () => {
  const c = structuredClone(content);
  c.fixtures = ['__proto__', 'constructor'].map(id => ({ ...c.fixtures[0], id }));
  c.savedRun.answers = { en: {}, fr: {} }; validateContent(c);
  assert.equal(summarize(c, {}, model).notRun, 12);
  const result = await runSamples(c.fixtures, async () => answers([1, 1, 1, 1, 1, 0]), () => {});
  assert.equal(Object.keys(result).length, 2); assert.equal(summarize(c, result, model).agree, 12);
});

test('the proxy owns calibrated gates, model-specific uncertainty and invalid Noul guards', () => {
  const result = { [first.id]: answers([.625, 1, 1, 1, .6, 0]) };
  assert.equal(summarize(content, result, model).agree, 6);
  assert.equal(summarize(content, result, 'jev-1.13.0').unsure, 2);
  for (const value of [-1, 2, NaN, Infinity, '1', null]) assert.throws(() => summarize(content, { [first.id]: answers([value, 1, 1, 1, 1, 0]) }, model), /work_deadline/);
  assert.throws(() => summarize(content, { [first.id]: {} }, model), /work_deadline/);
  assert.throws(() => summarize(content, { unknown: null }, model), /unknown/);
});

test('four requests at once, one per fixture, progressive results, failures do not stop later rows', async () => {
  let active = 0, maximum = 0;
  const calls = [], updates = [], release = [];
  const run = runSamples(content.fixtures, async fixture => {
    calls.push(fixture.id); maximum = Math.max(maximum, ++active);
    await new Promise(resolve => release.push(resolve)); active--;
    if (fixture.id === content.fixtures[1].id) throw new Error('Offline');
    return answers([1, 1, 1, 1, 1, 0]);
  }, (id, result) => updates.push([id, result]));
  assert.equal(calls.length, 4); assert.equal(updates.length, 0);
  release.shift()(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(updates.length, 1); assert.equal(calls.length, 5);
  while (updates.length < content.fixtures.length) {
    release.splice(0).forEach(resolve => resolve()); await new Promise(resolve => setImmediate(resolve));
  }
  const results = await run;
  assert.equal(maximum, 4); assert.equal(calls.length, new Set(calls).size);
  assert.equal(results[content.fixtures[1].id], null);
});

test('abort stops new work and propagates cancellation', async () => {
  const controller = new AbortController(); let calls = 0;
  await assert.rejects(runSamples(content.fixtures, async () => { calls++; controller.abort(); return answers([1, 1, 1, 1, 1, 0]); }, () => {}, controller.signal), /abort/i);
  assert.equal(calls, 1);
});

test('bilingual examples, saved runs, strict validation and escaped no-JS table', async () => {
  for (const lang of ['en', 'fr']) {
    const example = JSON.parse(await readFile(new URL(`./examples/${lang}.json`, import.meta.url)));
    validateContent(example);
    assert.equal(summarize(example, example.savedRun.answers[lang], model).agree, 72);
    assert.deepEqual(Object.keys(strings.en), Object.keys(strings.fr));
    const markup = render({ ...example, task: '<script>bad</script>' }, strings[lang], { id: 'one', lang });
    assert.ok(markup.includes('&lt;script&gt;bad&lt;/script&gt;'));
    assert.equal((markup.match(/role="status"/g) ?? []).length, 1);
    assert.ok(markup.includes('tabindex="0"')); assert.ok(markup.includes('<table>'));
    assert.ok(markup.includes('2026-10-07')); assert.ok(markup.includes('Clef 27B'));
    assert.ok(!markup.includes('<script>bad</script>'));
  }
  const cases = [
    [c => { c.extra = 1; }, /extra/], [c => { c.task = ' '; }, /task/],
    [c => { c.criteria.reverse(); }, /criteria/], [c => { c.criteria[5].polarity = 'positive'; }, /polarity/],
    [c => { c.fixtures[0].expected.blame = 'unsure'; }, /expected.blame/],
    [c => { c.fixtures[0].expected.other = 'met'; }, /other/],
    [c => { c.fixtures[0].answer.fr = ''; }, /answer.fr/], [c => { c.fixtures[0].answer.en = 'x'.repeat(801); }, /answer.en/],
    [c => { c.fixtures[1].id = c.fixtures[0].id; }, /id/],
    [c => { c.fixtures[0].id = 123; }, /id/],
    [c => { c.savedRun.date = '2026-02-30'; }, /date/],
    [c => { c.savedRun.answers.en.unknown = {}; }, /unknown/]
  ];
  for (const [mutate, error] of cases) { const c = structuredClone(content); mutate(c); assert.throws(() => validateContent(c), error); }
});
