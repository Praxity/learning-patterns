import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bundleIssuePaths, checkInput, chooseFeedback, readAnswers, readQuestionSets } from '../logic/question-set.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/question-set-v1.json', import.meta.url), 'utf8'));
const cases = JSON.parse(readFileSync(new URL('./fixtures/question-set-v1-paths.json', import.meta.url), 'utf8'));
const [set] = readQuestionSets(fixture);

test('v1 issue paths match the original runtime validator byte for byte', () => {
  for (const { path, operation, value, paths } of cases) {
    const bundle = structuredClone(fixture);
    const parent = path.slice(0, -1).reduce((node, key) => node[key], bundle);
    if (operation === 'delete') delete parent[path.at(-1)];
    else parent[path.at(-1)] = value;
    assert.throws(() => readQuestionSets(bundle), error => {
      assert.equal(JSON.stringify(bundleIssuePaths(error)), JSON.stringify(paths), JSON.stringify({ path, operation, value }));
      return true;
    });
  }
});

test('v1 defaults context, clones data and keeps EN/FR notices', () => {
  const bundle = structuredClone(fixture);
  delete bundle.sets[0].context;
  const [parsed] = readQuestionSets(bundle);
  assert.equal(parsed.context, '');
  assert.deepEqual(parsed.dataNotice, fixture.sets[0].dataNotice);
  assert.notEqual(parsed.providers, bundle.sets[0].providers);
  assert.deepEqual(readQuestionSets({ version: 1, sets: [] }), []);
  const error = new Error('unrelated');
  assert.throws(() => bundleIssuePaths(error), value => value === error);
});

test('only server-owned questions and declared input fields are accepted', () => {
  const input = { block: set.block, fields: { answer: 'Friday' } };
  assert.deepEqual(checkInput([set], input).fields, input.fields);
  for (const bad of [
    { ...input, questions: set.providers.perplexity.questions },
    { ...input, unknown: true },
    { ...input, fields: { ...input.fields, unknown: 'x' } },
    { ...input, fields: { answer: ' ' } },
    { ...input, fields: { answer: 'x'.repeat(501) } },
  ]) assert.throws(() => checkInput([set], bad));
});

test('bands include exact noul and choice gates and outcomes keep their order', () => {
  const answers = { date: { noul: 0.65 }, tone: { choice: 'respectful', confidence: 0.6 } };
  const feedback = value => chooseFeedback(set, readAnswers(value, set.providers.perplexity.questions));
  assert.equal(feedback(answers), 'ready');
  assert.equal(feedback({ ...answers, date: { noul: 0.35 } }), 'revise');
  assert.equal(feedback({ ...answers, date: { noul: 0.350001 } }), 'uncertain');
  assert.equal(feedback({ ...answers, date: { noul: 0.649999 } }), 'uncertain');
  assert.equal(feedback({ ...answers, tone: { choice: 'respectful', confidence: 0.599999 } }), 'uncertain');
  assert.equal(chooseFeedback({ ...set, outcomes: [{ when: { date: 'met' }, feedback: 'revise' }, ...set.outcomes] }, readAnswers(answers, set.providers.perplexity.questions)), 'revise');
});
