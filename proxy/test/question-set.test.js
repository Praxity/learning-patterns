import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bundleIssuePaths, checkInput, chooseFeedback, readAnswers, readQuestionSets } from '../logic/question-set.js';
import * as shared from '../logic/question-set.js';

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

const acceptance = {
  publicDigest: 'a'.repeat(64), holdoutDigest: 'b'.repeat(64), fingerprint: 'c'.repeat(64),
  bar: { maxUndueCredit: 0, maxDefiniteDisagreementsPer12: 1, maxUnsureRate: 0.2 },
  generation: 'generation-1',
  counts: { en: { total: 12, definiteDisagreements: 1, unsure: 2, undueCredit: 0 } },
  caseKindCoverage: { en: { honest: 2, partial: 2, paraphrase: 2, otherLanguage: 1, irrelevant: 1, gaming: 2, injection: 2 } },
  evaluator: 'independent-evaluator', date: '2026-10-20',
};
const v2 = () => ({ version: 2, sets: [{ ...structuredClone(fixture.sets[0]), acceptance: structuredClone(acceptance) }] });

test('v2 adds a strict acceptance record while v1 still validates unchanged', () => {
  const bundle = v2();
  assert.deepEqual(readQuestionSets(bundle)[0].acceptance, acceptance);
  assert.deepEqual(readQuestionSets(fixture)[0], set);
  assert.deepEqual(readQuestionSets({ version: 2, sets: [] }), []);
  assert.throws(() => readQuestionSets({ ...bundle, version: 1 }));
  for (const change of [
    value => { delete value.sets[0].acceptance; },
    value => { value.sets[0].acceptance.publicDigest = 'not-a-hash'; },
    value => { value.sets[0].acceptance.holdoutDigest = 'b'.repeat(63); },
    value => { value.sets[0].acceptance.fingerprint = 'C'.repeat(64); },
    value => { value.sets[0].acceptance.generation = ''; },
    value => { value.sets[0].acceptance.evaluator = ''; },
    value => { value.sets[0].acceptance.date = '2026-02-30'; },
    value => { value.sets[0].acceptance.bar.maxUnsureRate = 1.01; },
    value => { value.sets[0].acceptance.counts.en.total = 1.5; },
    value => { value.sets[0].acceptance.counts.en.unsure = -1; },
    value => { value.sets[0].acceptance.counts.en.unsure = 12; },
    value => { value.sets[0].acceptance.counts.en.undueCredit = 5; },
    value => { value.sets[0].acceptance.caseKindCoverage.en.injection = -1; },
    value => { value.sets[0].acceptance.caseKindCoverage.en.injection = 3; },
    value => { value.sets[0].acceptance.counts = {}; },
    value => { value.sets[0].acceptance.caseKindCoverage = {}; },
    value => { value.sets[0].acceptance.counts.fr = value.sets[0].acceptance.counts.en; },
    value => { value.sets[0].acceptance.samples = [{ answer: 'Do not publish sample text' }]; },
    value => { value.sets[0].acceptance.counts.en.sampleText = 'Do not publish sample text'; },
    value => { value.sets[0].dataNotice.es = 'Aviso'; },
    value => { delete value.sets[0].dataNotice.fr; },
    value => { value.sets[0].canarySamples = []; },
  ]) {
    const invalid = v2();
    change(invalid);
    assert.throws(() => readQuestionSets(invalid));
  }
});

test('v2 records one or both pilot languages without embedding holdout cases', () => {
  for (const languages of [['en'], ['fr'], ['en', 'fr']]) {
    const bundle = v2(), record = bundle.sets[0].acceptance;
    record.counts = Object.fromEntries(languages.map(language => [language, acceptance.counts.en]));
    record.caseKindCoverage = Object.fromEntries(languages.map(language => [language, acceptance.caseKindCoverage.en]));
    assert.deepEqual(readQuestionSets(bundle)[0].acceptance, record);
  }
});

test('shared bands expose per-question decisions for tuning and runtime feedback', () => {
  assert.equal(typeof shared.questionBands, 'function');
  const answers = readAnswers({ date: { noul: 0.65 }, tone: { choice: 'respectful', confidence: 0.6 } }, set.providers.perplexity.questions);
  assert.deepEqual(shared.questionBands(set, answers), { date: 'met', tone: 'respectful' });
  assert.deepEqual(shared.questionBands(set, { ...answers, date: { type: 'noul', noul: 0.35 } }), { date: 'missed', tone: 'respectful' });
  assert.deepEqual(shared.questionBands(set, { ...answers, date: { type: 'noul', noul: 0.5 } }), { date: 'unsure', tone: 'respectful' });
  assert.deepEqual(shared.questionBands(set, { ...answers, tone: { type: 'choice', choice: 'respectful', confidence: 0.59 } }), { date: 'met', tone: 'unsure' });
});
