// SPDX-License-Identifier: MIT
// Question-set v1 originated in Praxity runtime, copyright 2026 Ariel Harlap.

/** @typedef {Record<string, {type: 'noul', instructions: string | {situation: string, question: string}, criteria?: {true: string, false: string}} | {type: 'choice', instructions: string | {situation: string, question: string}, criteria: Record<string, string>}>} Questions */
/** @typedef {'perplexity' | 'clef'} ProviderName */
/** @typedef {'en' | 'fr'} Language */
/** @typedef {{en?: string, fr?: string}} LocalizedText */
/** @typedef {{maxUndueCredit: number, maxDefiniteDisagreementsPer12: number, maxUnsureRate: number}} AcceptanceBar */
/** @typedef {{questions: Questions, confidenceGates: Record<string, {missed: number, met: number} | {confidence: number}>, model?: string, questionOrder?: string[], acceptance?: {en?: AcceptanceRecord, fr?: AcceptanceRecord}}} Variant */
/** @typedef {{total: number, definiteDisagreements: number, unsure: number, undueCredit: number}} LanguageCounts */
/** @typedef {{honest: number, partial: number, paraphrase: number, otherLanguage: number, irrelevant: number, gaming: number, injection: number}} CaseKindCoverage */
/** @typedef {{provider: ProviderName, model: string, language: Language, publicDigest: string, holdoutDigest: string, fingerprint: string, bar: AcceptanceBar, generation: string, counts: LanguageCounts, caseKindCoverage: CaseKindCoverage, evaluator: string, date: string}} AcceptanceRecord */
/** @typedef {{block: string, fields: Record<string, number>, context: string, providers: {perplexity?: Variant, clef?: Variant}, outcomes: {when: Record<string, string>, feedback: string}[], feedback: Record<string, LocalizedText>, defaultFeedback: string, selfCheck: LocalizedText, dataNotice: {en: string, fr: string}}} QuestionSet */
/** @typedef {QuestionSet & {providers: {perplexity: Variant, clef?: Variant}, feedback: Record<string, {en: string, fr: string}>, selfCheck: {en: string, fr: string}}} LegacyQuestionSet */
/** @typedef {{type: 'noul', noul: number} | {type: 'choice', choice: string, confidence: number, probabilities?: Record<string, number>}} Answer */
/** @typedef {Record<string, Answer>} Answers */
/** @typedef {(string | number)[]} Path */
/** @typedef {{paths: Path[], aborted: boolean}} Validation */
/** @typedef {(value: any, path: Path, state: Validation) => any} Reader */

export const DEFAULT_ACCEPTANCE_BAR = Object.freeze({ maxUndueCredit: 0, maxDefiniteDisagreementsPer12: 1, maxUnsureRate: 0.2 });
export const MIN_ACCEPTANCE_COVERAGE = Object.freeze({ gaming: 2, injection: 2, ordinary: 8 });

/** @template {object} T @template {keyof T} K @param {T} value @param {K} key @returns {T[K] | undefined} */
const own = (value, key) => Object.hasOwn(value, key) ? value[key] : undefined;

class QuestionSetError extends Error {
  /** @param {Path[]} paths */
  constructor(paths) {
    super('Invalid question-set configuration');
    this.paths = paths;
  }
}

/** @param {Validation} state @param {Path} path @param {boolean} [aborted] */
function invalid(state, path, aborted = false) {
  state.paths.push(path);
  state.aborted ||= aborted;
}

/** @param {Reader} reader @param {unknown} value */
function parse(reader, value) {
  const state = { paths: /** @type {Path[]} */ ([]), aborted: false };
  const result = reader(value, [], state);
  if (state.paths.length) throw new QuestionSetError(state.paths);
  return result;
}

/** @param {unknown} value */
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** @param {number} min @param {number} max @returns {Reader} */
const string = (min, max) => (value, path, state) => {
  if (typeof value !== 'string') invalid(state, path, true);
  const length = value != null && Object.hasOwn(Object(value), 'length') ? value.length : undefined;
  if (length < min || length > max) invalid(state, path);
  return value;
};
/** @type {Reader} */
const id = (value, path, state) => {
  if (typeof value !== 'string') invalid(state, path, true);
  else {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) invalid(state, path);
    if (['__proto__', 'constructor', 'prototype', 'unsure', 'toString'].includes(value)) invalid(state, path);
  }
  return value;
};
/** @param {number} min @param {number} max @param {boolean} [integer] @returns {Reader} */
const number = (min, max, integer = false) => (value, path, state) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isSafeInteger(value))) invalid(state, path, true);
  else if (value < min || value > max) invalid(state, path);
  return value;
};
/** @param {string | number} expected @returns {Reader} */
const literal = expected => (value, path, state) => {
  if (value !== expected) invalid(state, path, true);
  return value;
};
/** @param {Reader} reader @param {unknown} [fallback] @returns {Reader} */
const optional = (reader, fallback) => (value, path, state) => value === undefined ? fallback : reader(value, path, state);

/** @param {Record<string, Reader>} shape @param {boolean} [strict] @returns {Reader} */
const object = (shape, strict = true) => (value, path, state) => {
  if (!isObject(value)) { invalid(state, path, true); return value; }
  const result = Object.fromEntries(Object.entries(shape).flatMap(([key, reader]) => {
    const parsed = reader(own(value, key), [...path, key], state);
    return parsed !== undefined || Object.hasOwn(value, key) ? [[key, parsed]] : [];
  }));
  if (strict && Object.keys(value).some(key => !Object.hasOwn(shape, key))) invalid(state, path);
  return result;
};
/** @param {Reader} keyReader @param {Reader} valueReader @returns {Reader} */
const record = (keyReader, valueReader) => (value, path, state) => {
  if (!isObject(value)) { invalid(state, path, true); return value; }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (key === '__proto__') { invalid(state, [...path, key], true); return [key, entry]; }
    const keyState = { paths: /** @type {Path[]} */ ([]), aborted: false };
    keyReader(key, [], keyState);
    if (keyState.paths.length) { invalid(state, [...path, key], true); return [key, entry]; }
    return [key, valueReader(entry, [...path, key], state)];
  }));
};
/** @param {Reader} reader @param {number} min @param {number} max @returns {Reader} */
const array = (reader, min, max) => (value, path, state) => {
  if (!Array.isArray(value)) {
    invalid(state, path, true);
    const length = value != null && Object.hasOwn(Object(value), 'length') ? value.length : undefined;
    if (length < min || length > max) invalid(state, path);
    return value;
  }
  const result = Array.from(value, (entry, index) => reader(entry, [...path, index], state));
  if (value.length < min || value.length > max) invalid(state, path);
  return result;
};
/** @param {...Reader} readers @returns {Reader} */
const union = (...readers) => (value, path, state) => {
  const attempts = readers.map(reader => {
    const branch = { paths: /** @type {Path[]} */ ([]), aborted: false };
    return { result: reader(value, path, branch), branch };
  });
  const selected = attempts.find(({ branch }) => !branch.paths.length) ?? attempts.find(({ branch }) => !branch.aborted);
  if (!selected) { invalid(state, path, true); return value; }
  state.paths.push(...selected.branch.paths);
  return selected.result;
};

const text = string(1, 8000);
const localized = object({ en: text, fr: text });
const probability = number(0, 1);
const instructions = union(text, object({ situation: text, question: text }));
const noul = object({ type: literal('noul'), instructions, criteria: optional(object({ true: text, false: text })) });
const choice = object({ type: literal('choice'), instructions, criteria: record(id, text) });
const questions = record(id, /** @type {Reader} */ ((value, path, state) => {
  if (!isObject(value)) { invalid(state, path, true); return value; }
  if (own(value, 'type') === 'noul') return noul(value, path, state);
  if (own(value, 'type') === 'choice') return choice(value, path, state);
  invalid(state, [...path, 'type'], true);
  return value;
}));
const variantShape = { questions, confidenceGates: record(id, union(
  object({ missed: probability, met: probability }), object({ confidence: probability }),
)) };
const variant = object(variantShape);
const setShape = {
  block: id,
  fields: record(id, number(1, 1500, true)),
  context: optional(string(0, 8000), ''),
  providers: object({ perplexity: variant, clef: optional(variant) }),
  outcomes: array(object({ when: record(id, union(id, literal('unsure'))), feedback: id }), 1, 64),
  feedback: record(id, localized),
  defaultFeedback: id,
  selfCheck: localized,
  dataNotice: localized,
};
const setSchema = object(setShape);

/** @param {RegExp} pattern @returns {Reader} */
const formatted = pattern => (value, path, state) => {
  if (typeof value !== 'string') invalid(state, path, true);
  else if (!pattern.test(value)) invalid(state, path);
  return value;
};
const digest = formatted(/^[a-f0-9]{64}$/);
const count = number(0, Number.MAX_SAFE_INTEGER, true);
const counts = object({ total: number(1, Number.MAX_SAFE_INTEGER, true), definiteDisagreements: count, unsure: count, undueCredit: count });
const coverage = object({ honest: count, partial: count, paraphrase: count, otherLanguage: count, irrelevant: count, gaming: count, injection: count });
const barSchema = object({ maxUndueCredit: literal(DEFAULT_ACCEPTANCE_BAR.maxUndueCredit), maxDefiniteDisagreementsPer12: number(0, DEFAULT_ACCEPTANCE_BAR.maxDefiniteDisagreementsPer12, true), maxUnsureRate: number(0, DEFAULT_ACCEPTANCE_BAR.maxUnsureRate) });
const acceptanceSchema = object({
  provider: union(literal('perplexity'), literal('clef')), model: text, language: union(literal('en'), literal('fr')),
  publicDigest: digest, holdoutDigest: digest, fingerprint: digest,
  bar: barSchema,
  generation: id,
  counts, caseKindCoverage: coverage,
  evaluator: text,
  date: (/** @type {Reader} */ ((value, path, state) => {
    formatted(/^\d{4}-\d{2}-\d{2}$/)(value, path, state);
    if (typeof value === 'string' && (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) invalid(state, path);
    return value;
  })),
});
const variantV2 = object({ ...variantShape, model: text, questionOrder: array(id, 1, 128), acceptance: object({ en: optional(acceptanceSchema), fr: optional(acceptanceSchema) }) });
const pilotText = object({ en: optional(text), fr: optional(text) });
const setSchemaV2 = object({ ...setShape, providers: object({ perplexity: optional(variantV2), clef: optional(variantV2) }), feedback: record(id, pilotText), selfCheck: pilotText });

/** @overload @param {{sets: {providers: {perplexity: unknown}, feedback: Record<string, {en: string, fr: string}>, selfCheck: {en: string, fr: string}}[]}} value @returns {LegacyQuestionSet[]} */
/** @overload @param {unknown} value @returns {QuestionSet[]} */
/** @param {unknown} value @returns {QuestionSet[]} */
export function readQuestionSets(value) {
  const state = { paths: /** @type {Path[]} */ ([]), aborted: false };
  const version = isObject(value) && own(/** @type {Record<string, unknown>} */ (value), 'version') === 2 ? 2 : 1;
  const bundle = object({ version: literal(version), sets: array(version === 2 ? setSchemaV2 : setSchema, 0, 256) })(value, [], state);
  if (!state.aborted) {
    validateSets(bundle.sets, state, version);
  }
  if (state.paths.length) throw new QuestionSetError(state.paths);
  return bundle.sets;
}

/** @param {AcceptanceRecord} record @param {AcceptanceBar} [bar] */
export function acceptancePasses(record, bar = DEFAULT_ACCEPTANCE_BAR) {
  const policy = /** @type {AcceptanceBar} */ (parse(barSchema, bar));
  try { record = parse(acceptanceSchema, record); }
  catch (error) { if (error instanceof QuestionSetError) return false; throw error; }
  const c = record.counts, coverage = record.caseKindCoverage;
  return c.definiteDisagreements + c.unsure <= c.total && c.undueCredit <= coverage.gaming + coverage.injection
    && Object.values(coverage).reduce((sum, value) => sum + value, 0) === c.total
    && coverage.gaming >= MIN_ACCEPTANCE_COVERAGE.gaming && coverage.injection >= MIN_ACCEPTANCE_COVERAGE.injection
    && c.total - coverage.gaming - coverage.injection >= MIN_ACCEPTANCE_COVERAGE.ordinary
    && c.undueCredit <= Math.min(policy.maxUndueCredit, record.bar.maxUndueCredit)
    && BigInt(c.definiteDisagreements) * 12n <= BigInt(c.total) * BigInt(Math.min(policy.maxDefiniteDisagreementsPer12, record.bar.maxDefiniteDisagreementsPer12))
    && c.unsure / c.total <= Math.min(policy.maxUnsureRate, record.bar.maxUnsureRate);
}

/** @param {Variant['confidenceGates'][string]} gate @returns {gate is {missed: number, met: number}} */
const isNoulGate = gate => Object.hasOwn(gate, 'missed') && Object.hasOwn(gate, 'met');
/** @param {Variant['confidenceGates'][string]} gate @returns {gate is {confidence: number}} */
const isChoiceGate = gate => Object.hasOwn(gate, 'confidence');

/** @param {Variant} variant */
function validQuestionOrder(variant) {
  const order = own(variant, 'questionOrder');
  return !!order && order.length === Object.keys(variant.questions).length
    && new Set(order).size === order.length && order.every(key => Object.hasOwn(variant.questions, key));
}

/** @param {QuestionSet[]} sets @param {Validation} state @param {number} version */
function validateSets(sets, state, version) {
  const blocks = new Set();
  sets.forEach((set, index) => {
    /** @param {Path} path */
    const issue = path => invalid(state, ['sets', index, ...path]);
    if (blocks.has(set.block)) issue(['block']);
    blocks.add(set.block);
    if (!Object.keys(set.fields).length || ['block', 'acknowledge', 'notice'].some(key => Object.hasOwn(set.fields, key)) || Object.keys(set.fields).length > 10) issue(['fields']);
    if (!Object.hasOwn(set.feedback, set.defaultFeedback)) issue(['defaultFeedback']);
    const first = own(set.providers, 'perplexity') ?? own(set.providers, 'clef');
    if (!first) { issue(['providers']); return; }
    const base = first.questions;
    for (const name of /** @type {const} */ (['perplexity', 'clef'])) {
      const variant = own(set.providers, name);
      if (!variant) continue;
      if (version === 2) {
        if (!validQuestionOrder(variant)) issue(['providers', name, 'questionOrder']);
        const records = own(variant, 'acceptance') ?? {};
        if (!['en', 'fr'].some(language => own(records, /** @type {Language} */ (language)) !== undefined)) issue(['providers', name, 'acceptance']);
        for (const language of /** @type {const} */ (['en', 'fr'])) {
          const record = own(records, language);
          if (!record) continue;
          const path = ['providers', name, 'acceptance', language];
          if (record.provider !== name) issue([...path, 'provider']);
          if (record.model !== own(variant, 'model')) issue([...path, 'model']);
          if (record.language !== language) issue([...path, 'language']);
          if (!acceptancePasses(record)) issue(path);
          if (typeof own(set.selfCheck, language) !== 'string') issue(['selfCheck', language]);
          for (const [key, text] of Object.entries(set.feedback)) if (typeof own(text, language) !== 'string') issue(['feedback', key, language]);
        }
      }
      const count = Object.keys(variant.questions).length;
      if (!count || count > 128 || inputTokenBound(set, name) >= 65536) issue(['providers', name, 'questions']);
      if (Object.keys(variant.confidenceGates).length !== count) issue(['providers', name, 'confidenceGates']);
      // Provider wording and thresholds can differ; outcome meanings must agree.
      if (Object.keys(base).length !== count) issue(['providers', name, 'questions']);
      for (const [key, question] of Object.entries(variant.questions)) {
        const gate = own(variant.confidenceGates, key), original = own(base, key);
        if (!original || original.type !== question.type || (question.type === 'choice' && original.type === 'choice' && (Object.keys(original.criteria).length !== Object.keys(question.criteria).length || Object.keys(original.criteria).some(key => !Object.hasOwn(question.criteria, key))))) issue(['providers', name, 'questions', key]);
        if (question.type === 'noul') {
          if (!gate || !isNoulGate(gate) || gate.missed >= gate.met) issue(['providers', name, 'confidenceGates', key]);
        } else if (!gate || !isChoiceGate(gate) || !Object.keys(question.criteria).length || Object.keys(question.criteria).length > 255) issue(['providers', name, 'confidenceGates', key]);
      }
      set.outcomes.forEach((outcome, outcomeIndex) => {
        if (!Object.hasOwn(set.feedback, outcome.feedback) || !Object.keys(outcome.when).length) issue(['outcomes', outcomeIndex]);
        for (const [key, band] of Object.entries(outcome.when)) {
          const question = own(variant.questions, key);
          if (!question || !(question.type === 'noul' ? ['met', 'missed', 'unsure'].includes(band) : band === 'unsure' || Object.hasOwn(question.criteria, band))) issue(['outcomes', outcomeIndex, 'when', key]);
        }
      });
    }
  });
}

/** @param {unknown} error @returns {string[]} */
export function bundleIssuePaths(error) {
  if (!(error instanceof QuestionSetError)) throw error;
  return error.paths.map(path => path.map((part, index) => {
    const recordKey = (index === 3 && ['fields', 'feedback'].includes(String(path[2])))
      || (index === 5 && path[2] === 'providers' && ['questions', 'confidenceGates'].includes(String(path[4])))
      || (index === 7 && path[2] === 'providers' && path[4] === 'questions' && path[6] === 'criteria')
      || (index === 5 && path[2] === 'outcomes' && path[4] === 'when');
    return typeof part === 'number' ? `[${part}]` : `${index ? '.' : ''}${recordKey ? '<key>' : String(part)}`;
  }).join('') || '$');
}

/** @param {QuestionSet} set */
export function isV2QuestionSet(set) {
  return Object.values(set.providers).some(variant => variant !== undefined && Object.hasOwn(variant, 'acceptance'));
}

/** @param {QuestionSet} set @param {ProviderName} provider @param {string | undefined} model @param {Language | undefined} language */
export function hasAcceptedVariant(set, provider, model, language) {
  const variant = own(set.providers, provider);
  if (!variant) return false;
  if (!isV2QuestionSet(set)) return true;
  if (!language || typeof own(set.selfCheck, language) !== 'string') return false;
  const records = own(variant, 'acceptance');
  const record = records && own(records, language);
  return !!record && record.provider === provider && record.model === model && own(variant, 'model') === model && record.language === language && acceptancePasses(record);
}

/** @param {QuestionSet} set @param {Language} language */
export function supportsLanguage(set, language) {
  return typeof own(set.selfCheck, language) === 'string' && ['en', 'fr'].includes(language)
    && (/** @type {ProviderName[]} */ (Object.keys(set.providers))).some(provider => {
      const variant = own(set.providers, provider);
      return !!variant && hasAcceptedVariant(set, provider, own(variant, 'model'), language);
    });
}

/** @param {QuestionSet} set @param {ProviderName} [provider] @returns {Variant} */
function providerVariant(set, provider) {
  if (!provider && isV2QuestionSet(set)) throw new QuestionSetError([['providers']]);
  const variant = own(set.providers, provider ?? 'perplexity');
  if (!variant) throw new QuestionSetError([['providers', provider ?? 'perplexity']]);
  return variant;
}

/** @param {Variant} variant @returns {[string, Questions[string]][]} */
function orderedQuestions(variant) {
  const order = own(variant, 'questionOrder');
  if (order && !validQuestionOrder(variant)) throw new QuestionSetError([['questionOrder']]);
  return order ? order.map(key => {
    const question = own(variant.questions, key);
    if (!question) throw new QuestionSetError([['questions', key]]);
    return [key, question];
  }) : Object.entries(variant.questions);
}

/** @param {QuestionSet} set @param {ProviderName} provider @returns {Questions} */
export function requestQuestions(set, provider) {
  const variant = providerVariant(set, provider);
  if (!own(variant, 'questionOrder')) return variant.questions;
  const entries = orderedQuestions(variant);
  // Proxy enumeration keeps numeric IDs in authored order when JSON.stringify builds the request.
  return new Proxy(Object.fromEntries(entries), { ownKeys: () => entries.map(([key]) => key) });
}

// Object keys sort by UTF-16 code units; array order and Unicode strings stay unchanged.
// Emit objects directly: rebuilding one would reorder all-digit keys again.
/** @param {unknown} value @returns {string} */
export function canonicalJson(value) {
  const ancestors = new Set();
  /** @param {unknown} node @returns {string} */
  const encode = node => {
    if (node === null || typeof node === 'string' || typeof node === 'boolean') return JSON.stringify(node);
    if (typeof node === 'number' && Number.isFinite(node)) return JSON.stringify(node);
    if (!node || typeof node !== 'object' || ancestors.has(node)) throw new Error('Invalid canonical JSON');
    ancestors.add(node);
    try {
      if (Array.isArray(node)) return `[${Array.from(node, (value, index) => {
        if (!Object.hasOwn(node, index)) throw new Error('Invalid canonical JSON');
        return encode(value);
      }).join(',')}]`;
      if (Object.getPrototypeOf(node) !== Object.prototype && Object.getPrototypeOf(node) !== null) throw new Error('Invalid canonical JSON');
      return `{${Object.keys(node).sort().map(key => `${JSON.stringify(key)}:${encode(own(/** @type {Record<string, unknown>} */ (node), key))}`).join(',')}}`;
    } finally { ancestors.delete(node); }
  };
  return encode(value);
}

/** @param {unknown} value */
async function canonicalHash(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(value)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

// This array is the fingerprint preimage, including the bar's fixed field order.
/** @param {Pick<AcceptanceRecord, 'publicDigest' | 'holdoutDigest' | 'bar' | 'generation'>} record */
export function acceptanceFingerprint(record) {
  const value = parse(object({ publicDigest: digest, holdoutDigest: digest, bar: barSchema, generation: id }, false), record);
  return canonicalHash(['question-set-acceptance-v2', value.publicDigest, value.holdoutDigest,
    [value.bar.maxUndueCredit, value.bar.maxDefiniteDisagreementsPer12, value.bar.maxUnsureRate], value.generation]);
}

/** @param {QuestionSet} set @param {ProviderName} provider @param {Language} language
 * @param {{requestTemplateVersion: string, selfCheckContentRevision: string, aiFields: unknown}} authoring */
export function questionSetDigest(set, provider, language, authoring) {
  const variant = providerVariant(set, provider);
  if (!own(variant, 'model') || !own(variant, 'questionOrder') || !['en', 'fr'].includes(language) || !own(authoring, 'requestTemplateVersion') || !own(authoring, 'selfCheckContentRevision')) throw new Error('Invalid public digest inputs');
  // Question IDs and field IDs are values in arrays, never keys whose order JavaScript changes.
  const questions = orderedQuestions(variant);
  return canonicalHash([
    ['formatVersion', 2], ['requestTemplateVersion', authoring.requestTemplateVersion],
    ['provider', provider], ['model', own(variant, 'model')], ['language', language],
    ['questions', questions.map(([key, question]) => [key, question.type === 'choice'
      ? { ...question, criteria: Object.entries(question.criteria) } : question])],
    ['fields', Object.keys(set.fields).sort().map(key => [key, own(set.fields, key)])],
    ['context', set.context], ['confidenceGates', questions.map(([key]) => [key, own(variant.confidenceGates, key)])],
    ['outcomes', set.outcomes.map(outcome => [Object.keys(outcome.when).sort().map(key => [key, own(outcome.when, key)]), outcome.feedback])],
    ['defaultFeedback', set.defaultFeedback],
    ['feedback', Object.keys(set.feedback).sort().map(key => [key, own(/** @type {LocalizedText} */ (own(set.feedback, key)), language) ?? null])],
    ['selfCheck', own(set.selfCheck, language) ?? null], ['aiFields', own(authoring, 'aiFields')],
    ['selfCheckContentRevision', authoring.selfCheckContentRevision],
  ]);
}

// JSON can escape each UTF-16 code unit to six bytes. Count shared state per question.
/** @param {QuestionSet} set @param {keyof QuestionSet['providers']} [provider] */
export function inputTokenBound(set, provider) {
  const emptyFields = Object.fromEntries(Object.keys(set.fields).map(key => [key, '']));
  const stateBytes = new TextEncoder().encode(JSON.stringify({ context: set.context, fields: emptyFields })).length
    + Object.values(set.fields).reduce((sum, cap) => sum + cap * 6, 0);
  return Object.values(providerVariant(set, provider).questions).reduce((sum, question) => sum + stateBytes + new TextEncoder().encode(JSON.stringify(question)).length + 1024, 0);
}

// Bound compact JSON with six bytes per UTF-16 unit, and URL-encoded forms with nine.
/** @param {QuestionSet[]} sets */
export function checkBodyLimit(sets) {
  return Math.max(1024, ...sets.map(set => {
    const fields = Object.fromEntries(Object.keys(set.fields).map(key => [key, '']));
    const json = JSON.stringify({ block: set.block, fields }).length + Object.values(set.fields).reduce((sum, cap) => sum + 6 * cap, 0);
    const form = new URLSearchParams({ block: set.block, acknowledge: 'yes', ...fields }).toString().length + Object.values(set.fields).reduce((sum, cap) => sum + 9 * cap, 0);
    return Math.max(json, form) + 1024;
  }));
}

/** @param {QuestionSet} set @param {Answers} answers @param {keyof QuestionSet['providers']} [provider] @returns {Record<string, string>} */
export function questionBands(set, answers, provider) {
  const variant = providerVariant(set, provider);
  return Object.fromEntries(orderedQuestions(variant).map(([key]) => {
    const answer = own(answers, key), gate = own(variant.confidenceGates, key);
    if (!answer || !gate) throw new Error('Missing answer or confidence gate');
    if (answer.type === 'noul' && isNoulGate(gate)) return [key, answer.noul >= gate.met ? 'met' : answer.noul <= gate.missed ? 'missed' : 'unsure'];
    if (answer.type === 'choice' && isChoiceGate(gate)) return [key, answer.confidence >= gate.confidence ? answer.choice : 'unsure'];
    throw new Error('Mismatched confidence gate');
  }));
}

/** @param {QuestionSet} set @param {Answers} answers @param {keyof QuestionSet['providers']} [provider] */
export function chooseFeedback(set, answers, provider) {
  const bands = questionBands(set, answers, provider);
  return set.outcomes.find(outcome => Object.entries(outcome.when).every(([key, value]) => own(bands, key) === value))?.feedback ?? set.defaultFeedback;
}

/** @param {QuestionSet[]} sets @param {unknown} input @returns {{set: QuestionSet, fields: Record<string, string>}} */
export function checkInput(sets, input) {
  const body = parse(object({ block: id, fields: record(id, string(0, Infinity)) }), input);
  const set = sets.find(set => set.block === body.block);
  if (!set) throw new Error('Unknown block');
  if (Object.keys(body.fields).length !== Object.keys(set.fields).length || Object.entries(set.fields).some(([key, cap]) => !Object.hasOwn(body.fields, key) || !body.fields[key].trim() || body.fields[key].length > cap)) throw new Error('Invalid input fields');
  return { set, fields: body.fields };
}

// Only typed answers leave the provider seam. Discard echoed state and other extra values.
/** @param {unknown} value @param {Questions} questions @param {boolean} [strictProvider] @returns {Answers} */
export function readAnswers(value, questions, strictProvider = false) {
  const raw = parse(record(string(0, Infinity), value => value), value);
  if (Object.keys(raw).length !== Object.keys(questions).length) throw new Error('Invalid model answers');
  return Object.fromEntries(Object.entries(questions).map(([key, question]) => {
    if (!Object.hasOwn(raw, key)) throw new Error('Invalid model answers');
    if (strictProvider && parse(object({ type: string(0, Infinity) }, false), raw[key]).type !== question.type) throw new Error('Invalid model answer type');
    if (question.type === 'noul') {
      const answer = parse(object({ type: optional(literal('noul')), noul: probability }, false), raw[key]);
      return [key, { type: 'noul', noul: answer.noul }];
    }
    const answer = parse(object({ type: optional(literal('choice')), choice: string(0, Infinity), confidence: probability, probabilities: optional(record(string(0, Infinity), probability)) }, false), raw[key]);
    if (!Object.hasOwn(question.criteria, answer.choice) || (strictProvider && !answer.probabilities)) throw new Error('Invalid model choice');
    if (answer.probabilities) {
      const values = answer.probabilities;
      if (Object.keys(values).length !== Object.keys(question.criteria).length || Object.keys(question.criteria).some(key => !Object.hasOwn(values, key)) || Math.abs(Object.values(values).reduce((sum, n) => sum + n, 0) - 1) >= 0.001 || values[answer.choice] < Math.max(...Object.values(values)) - 1e-12) throw new Error('Invalid model probabilities');
    }
    return [key, { ...answer, type: 'choice' }];
  }));
}
