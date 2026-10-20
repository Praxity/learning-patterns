import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as shared from '../logic/question-set.js';

const v2 = () => JSON.parse(readFileSync(new URL('./fixtures/question-set-v2.json', import.meta.url), 'utf8'));

test('numeric question order is an exact permutation and survives request serialization', () => {
  const bundle = v2(), variant = bundle.sets[0].providers.clef;
  variant.questions = { '10': variant.questions.tone, '2': variant.questions.date };
  variant.confidenceGates = { '10': variant.confidenceGates.tone, '2': variant.confidenceGates.date };
  variant.questionOrder = ['10', '2'];
  bundle.sets[0].outcomes = [{ when: { '2': 'met' }, feedback: 'ready' }];
  const [set] = shared.readQuestionSets(bundle);
  const questions = shared.requestQuestions(set, 'clef');
  assert.deepEqual(Object.keys(questions), ['10', '2']);
  assert.ok(JSON.stringify(questions).startsWith('{"10":'));
  for (const order of [['10'], ['10', '10'], ['10', '2', 'other'], ['10', 'other']]) {
    const bad = structuredClone(bundle);
    bad.sets[0].providers.clef.questionOrder = order;
    assert.throws(() => shared.readQuestionSets(bad), error => {
      assert.deepEqual(shared.bundleIssuePaths(error), ['sets[0].providers.clef.questionOrder']); return true;
    });
  }
});

test('an invalid supplied bar throws even when a record would otherwise fail', () => {
  const record = v2().sets[0].providers.clef.acceptance.en;
  for (const bar of [{}, { ...record.bar, maxUnsureRate: 0.3 }, { ...record.bar, maxDefiniteDisagreementsPer12: 2 }]) {
    assert.throws(() => shared.acceptancePasses(record, bar));
    assert.throws(() => shared.acceptancePasses({ ...record, counts: {} }, bar));
  }
  assert.equal(shared.acceptancePasses({ ...record, counts: {} }), false);
});

test('a holdout needs eight ordinary rows in addition to gaming and injection', () => {
  assert.equal(shared.MIN_ACCEPTANCE_COVERAGE.ordinary, 8);
  for (const [ordinary, gaming, injection] of [[0, 2, 2], [7, 2, 2], [8, 2, 2], [7, 4, 4], [8, 4, 4]]) {
    const bundle = v2(), record = bundle.sets[0].providers.clef.acceptance.en;
    record.counts = { total: ordinary + gaming + injection, definiteDisagreements: 0, unsure: 0, undueCredit: 0 };
    record.caseKindCoverage = { honest: ordinary, partial: 0, paraphrase: 0, otherLanguage: 0, irrelevant: 0, gaming, injection };
    assert.equal(shared.acceptancePasses(record), ordinary >= 8);
    if (ordinary < 8) assert.throws(() => shared.readQuestionSets(bundle));
    else assert.equal(shared.readQuestionSets(bundle).length, 1);
  }
});

test('the public digest binds Choice option order with a literal vector', async () => {
  const [set] = shared.readQuestionSets(v2());
  set.fields = { answer: 10 }; set.context = '';
  const variant = set.providers.clef;
  variant.questions = { '10': { type: 'choice', instructions: 'Choose.', criteria: { z: 'Last', a: 'First' } } };
  variant.questionOrder = ['10']; variant.confidenceGates = { '10': { confidence: 0.6 } };
  set.outcomes = [{ when: { '10': 'z' }, feedback: 'ready' }];
  set.defaultFeedback = 'ready'; set.feedback = { ready: { en: 'Ready' } }; set.selfCheck = { en: 'Check' };
  const authoring = { requestTemplateVersion: '1', selfCheckContentRevision: 'revision-1', aiFields: {} };
  const digest = await shared.questionSetDigest(set, 'clef', 'en', authoring);
  variant.questions['10'].criteria = { a: 'First', z: 'Last' };
  assert.notEqual(await shared.questionSetDigest(set, 'clef', 'en', authoring), digest);
  assert.equal(digest, '5edf18ea7059d65a392cf7856b7a449d2152e452ac46a47b5c2d69d0a6c3850b');
  const record = v2().sets[0].providers.clef.acceptance.en;
  assert.equal(await shared.acceptanceFingerprint({ ...record, publicDigest: digest }), 'ccea8b389548ea31c3efad57640a343460d92d2aaf919b3e62af6016efcdfc46');
});
