import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as shared from '../logic/question-set.js';

const read = name => JSON.parse(readFileSync(new URL(`./fixtures/question-set-${name}.json`, import.meta.url), 'utf8'));
const v2 = () => read('v2');

test('v1 continues semantic validation after unknown object properties', () => {
  const bundle = read('v1');
  bundle.sets[0].defaultFeedback = '';
  bundle.sets[0].selfCheck.extra = true;
  assert.throws(() => shared.readQuestionSets(bundle), error => {
    assert.deepEqual(shared.bundleIssuePaths(error), ['sets[0].defaultFeedback', 'sets[0].selfCheck', 'sets[0].defaultFeedback']);
    return true;
  });
});

test('compound v1 issue paths match literal original-parser regressions', () => {
  const cases = JSON.parse(readFileSync(new URL('./fixtures/question-set-v1-compound-paths.json', import.meta.url), 'utf8'));
  for (const { mutations, paths } of cases) {
    const bundle = read('v1');
    for (const { path, operation, value } of mutations) {
      const parent = path.slice(0, -1).reduce((node, key) => node[key], bundle);
      if (operation === 'delete') delete parent[path.at(-1)];
      else parent[path.at(-1)] = structuredClone(value);
    }
    assert.throws(() => shared.readQuestionSets(bundle), error => {
      assert.deepEqual(shared.bundleIssuePaths(error), paths); return true;
    });
  }
});

test('v2 binds records to each provider, model and language and requires an explicit question order', () => {
  const [set] = shared.readQuestionSets(v2());
  assert.equal(set.providers.perplexity, undefined);
  assert.equal(set.providers.clef.acceptance.en.language, 'en');
  assert.equal(shared.supportsLanguage(set, 'en'), true);
  assert.equal(shared.supportsLanguage(set, 'fr'), false);
  assert.equal(shared.hasAcceptedVariant(set, 'clef', '@cf/cloudflare/clef', 'en'), true);
  assert.equal(shared.hasAcceptedVariant(set, 'clef', 'another-model', 'en'), false);
  assert.equal(shared.hasAcceptedVariant(set, 'perplexity', 'another-model', 'en'), false);
  assert.throws(() => shared.inputTokenBound(set), error => {
    assert.deepEqual(shared.bundleIssuePaths(error), ['providers']); return true;
  });
  for (const change of [
    b => { b.sets[0].providers = {}; },
    b => { delete b.sets[0].providers.clef.acceptance; },
    b => { b.sets[0].providers.clef.acceptance = {}; },
    b => { b.sets[0].providers.clef.acceptance = { en: undefined }; },
    b => { b.sets[0].providers.clef.acceptance.en.provider = 'perplexity'; },
    b => { b.sets[0].providers.clef.acceptance.en.model = 'another-model'; },
    b => { b.sets[0].providers.clef.acceptance.en.language = 'fr'; },
    b => { b.sets[0].providers.clef.questionOrder = ['date', 'date']; },
    b => { b.sets[0].providers.clef.questionOrder = ['tone']; },
    b => { b.sets[0].providers.clef.questionOrder = ['date', 'missing']; },
    b => { delete b.sets[0].selfCheck.en; },
    b => { b.sets[0].selfCheck.en = undefined; },
    b => { delete b.sets[0].feedback.ready.en; },
    b => { b.sets[0].providers.clef.acceptance.en.samples = []; },
    b => { b.sets[0].providers.clef.acceptance.en.publicDigest = 'not-a-hash'; },
    b => { b.sets[0].providers.clef.acceptance.en.holdoutDigest = 'b'.repeat(63); },
    b => { b.sets[0].providers.clef.acceptance.en.fingerprint = 'C'.repeat(64); },
    b => { b.sets[0].providers.clef.acceptance.en.date = '2026-02-30'; },
    b => { b.sets[0].providers.clef.acceptance.en.counts.total = 1.5; },
    b => { b.sets[0].dataNotice.es = 'Aviso'; },
  ]) {
    const bundle = v2(); change(bundle);
    assert.throws(() => shared.readQuestionSets(bundle));
  }
  const both = v2(), clef = both.sets[0].providers.clef;
  const perplexity = structuredClone(clef);
  perplexity.model = 'pplx-example';
  perplexity.acceptance.en.provider = 'perplexity';
  perplexity.acceptance.en.model = perplexity.model;
  both.sets[0].providers.perplexity = perplexity;
  assert.equal(shared.readQuestionSets(both).length, 1);
  delete both.sets[0].providers.clef;
  assert.equal(shared.readQuestionSets(both).length, 1);
});

test('minimum acceptance policy is enforced at exact boundaries', () => {
  const record = v2().sets[0].providers.clef.acceptance.en;
  assert.deepEqual(shared.DEFAULT_ACCEPTANCE_BAR, { maxUndueCredit: 0, maxDefiniteDisagreementsPer12: 1, maxUnsureRate: 0.2 });
  assert.deepEqual(shared.MIN_ACCEPTANCE_COVERAGE, { gaming: 2, injection: 2, ordinary: 8 });
  assert.equal(shared.acceptancePasses(record), true);
  for (const change of [
    r => { r.bar.maxDefiniteDisagreementsPer12 = 2; },
    r => { r.bar.maxUnsureRate = 0.21; },
    r => { r.bar.maxUndueCredit = 1; },
    r => { r.counts.definiteDisagreements = 2; },
    r => { r.counts.unsure = 3; },
    r => { r.counts.undueCredit = 1; },
    r => { r.caseKindCoverage.gaming = 1; r.caseKindCoverage.honest = 3; },
    r => { r.caseKindCoverage.injection = 1; r.caseKindCoverage.honest = 3; },
  ]) {
    const bundle = v2(), bad = bundle.sets[0].providers.clef.acceptance.en;
    change(bad);
    assert.equal(shared.acceptancePasses(bad), false);
    assert.throws(() => shared.readQuestionSets(bundle));
  }
  const boundary = structuredClone(record);
  boundary.counts.total = 15; boundary.counts.definiteDisagreements = 0; boundary.counts.unsure = 3;
  boundary.caseKindCoverage.honest = 5;
  assert.equal(shared.acceptancePasses(boundary), true);
  boundary.counts.unsure = 4;
  assert.equal(shared.acceptancePasses(boundary), false);
});

test('only own author properties are read and reserved record keys fail cleanly', () => {
  for (const version of ['v1', 'v2']) {
    const bundle = read(version);
    bundle.sets[0].outcomes[0].when = { toString: 'met' };
    assert.throws(() => shared.readQuestionSets(bundle), error => {
      assert.ok(shared.bundleIssuePaths(error).some(path => path.includes('outcomes[0].when.<key>')));
      return true;
    });
    const reserved = read(version);
    reserved.sets[0].fields = JSON.parse('{"answer":500,"__proto__":100}');
    assert.throws(() => shared.readQuestionSets(reserved), error => {
      assert.deepEqual(shared.bundleIssuePaths(error), ['sets[0].fields.<key>']);
      return true;
    });
  }
  const bundle = v2();
  try {
    Object.prototype.perplexity = structuredClone(bundle.sets[0].providers.clef);
    Object.prototype.fr = 'inherited text';
    Object.prototype.type = 'noul';
    Object.prototype.questionOrder = ['inherited'];
    Object.prototype.met = 0.65; Object.prototype.missed = 0.35;
    const [set] = shared.readQuestionSets(bundle);
    assert.equal(Object.hasOwn(set.providers, 'perplexity'), false);
    assert.equal(Object.hasOwn(set.selfCheck, 'fr'), false);
    assert.equal(shared.supportsLanguage(set, 'fr'), false);
    const inherited = Object.create({ block: set.block, fields: { answer: 'Friday' } });
    assert.throws(() => shared.checkInput([set], inherited));
    const legacy = read('v1');
    const [parsedLegacy] = shared.readQuestionSets(legacy);
    assert.equal(typeof shared.inputTokenBound(parsedLegacy), 'number');
    legacy.sets[0].providers.perplexity.confidenceGates.date = { confidence: 0.5 };
    assert.throws(() => shared.readQuestionSets(legacy));
  } finally {
    delete Object.prototype.perplexity; delete Object.prototype.fr; delete Object.prototype.type;
    delete Object.prototype.questionOrder; delete Object.prototype.met; delete Object.prototype.missed;
  }
});

test('canonical JSON and acceptance fingerprints have literal portable vectors', async () => {
  assert.equal(shared.canonicalJson({ z: -0, a: ['é', 0.30], nested: { b: 2, a: 1 } }), '{"a":["é",0.3],"nested":{"a":1,"b":2},"z":0}');
  assert.equal(shared.canonicalJson({ '2': 'two', '10': 'ten' }), '{"10":"ten","2":"two"}');
  for (const invalid of [undefined, NaN, Infinity, { value: undefined }, [undefined]]) assert.throws(() => shared.canonicalJson(invalid));
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => shared.canonicalJson(cycle));
  const record = v2().sets[0].providers.clef.acceptance.en;
  assert.equal(await shared.acceptanceFingerprint(record), '55d528455b21a5aaaffb274e68d0c77adae1db80f52a62e61522929585ba2811');
});

test('each language needs its own matching record and authored feedback', () => {
  const bundle = v2(), set = bundle.sets[0], variant = set.providers.clef;
  variant.acceptance.fr = { ...structuredClone(variant.acceptance.en), language: 'fr' };
  assert.throws(() => shared.readQuestionSets(bundle));
  set.selfCheck.fr = 'Avez-vous nommé une date ?';
  for (const message of Object.values(set.feedback)) message.fr = 'Comparez votre réponse.';
  assert.equal(shared.supportsLanguage(shared.readQuestionSets(bundle)[0], 'fr'), true);
});

test('public digest includes language and preserves explicit numeric question order in arrays', async () => {
  const [set] = shared.readQuestionSets(v2());
  const variant = set.providers.clef;
  variant.questions = { '2': variant.questions.date, '10': variant.questions.tone };
  variant.confidenceGates = { '2': variant.confidenceGates.date, '10': variant.confidenceGates.tone };
  variant.questionOrder = ['10', '2'];
  set.outcomes = [{ when: { '2': 'met' }, feedback: 'ready' }];
  const authoring = { requestTemplateVersion: '1', selfCheckContentRevision: 'revision-1', aiFields: { asks: ['First ask', 'Second ask'], scenario: set.context } };
  const en = await shared.questionSetDigest(set, 'clef', 'en', authoring);
  const fr = await shared.questionSetDigest(set, 'clef', 'fr', authoring);
  assert.notEqual(en, fr);
  variant.questionOrder.reverse();
  assert.notEqual(await shared.questionSetDigest(set, 'clef', 'en', authoring), en);
});
