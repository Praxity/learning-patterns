// SPDX-License-Identifier: MIT
// Question-set v1 originated in Praxity runtime, copyright 2026 Ariel Harlap.

/** @typedef {Record<string, {type: 'noul', instructions: string | {situation: string, question: string}, criteria?: {true: string, false: string}} | {type: 'choice', instructions: string | {situation: string, question: string}, criteria: Record<string, string>}>} Questions */
/** @typedef {{questions: Questions, confidenceGates: Record<string, {missed: number, met: number} | {confidence: number}>}} Variant */
/** @typedef {{total: number, definiteDisagreements: number, unsure: number, undueCredit: number}} LanguageCounts */
/** @typedef {{honest: number, partial: number, paraphrase: number, otherLanguage: number, irrelevant: number, gaming: number, injection: number}} CaseKindCoverage */
/** @typedef {{publicDigest: string, holdoutDigest: string, fingerprint: string, bar: {maxUndueCredit: 0, maxDefiniteDisagreementsPer12: number, maxUnsureRate: number}, generation: string, counts: {en?: LanguageCounts, fr?: LanguageCounts}, caseKindCoverage: {en?: CaseKindCoverage, fr?: CaseKindCoverage}, evaluator: string, date: string}} AcceptanceRecord */
/** @typedef {{block: string, fields: Record<string, number>, context: string, providers: {perplexity: Variant, clef?: Variant}, outcomes: {when: Record<string, string>, feedback: string}[], feedback: Record<string, {en: string, fr: string}>, defaultFeedback: string, selfCheck: {en: string, fr: string}, dataNotice: {en: string, fr: string}, acceptance?: AcceptanceRecord}} QuestionSet */
/** @typedef {{type: 'noul', noul: number} | {type: 'choice', choice: string, confidence: number, probabilities?: Record<string, number>}} Answer */
/** @typedef {Record<string, Answer>} Answers */
/** @typedef {(string | number)[]} Path */
/** @typedef {{paths: Path[], aborted: boolean}} Validation */
/** @typedef {(value: any, path: Path, state: Validation) => any} Reader */

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
  if (value != null && (value.length < min || value.length > max)) invalid(state, path);
  return value;
};
/** @type {Reader} */
const id = (value, path, state) => {
  if (typeof value !== 'string') invalid(state, path, true);
  else {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(value)) invalid(state, path);
    if (['__proto__', 'constructor', 'prototype', 'unsure'].includes(value)) invalid(state, path);
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
    const parsed = reader(value[key], [...path, key], state);
    return parsed !== undefined || Object.hasOwn(value, key) ? [[key, parsed]] : [];
  }));
  if (strict && Object.keys(value).some(key => !Object.hasOwn(shape, key))) invalid(state, path, true);
  return result;
};
/** @param {Reader} keyReader @param {Reader} valueReader @returns {Reader} */
const record = (keyReader, valueReader) => (value, path, state) => {
  if (!isObject(value)) { invalid(state, path, true); return value; }
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== '__proto__').map(([key, entry]) => {
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
    if (value != null && (value.length < min || value.length > max)) invalid(state, path);
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
  if (value.type === 'noul') return noul(value, path, state);
  if (value.type === 'choice') return choice(value, path, state);
  invalid(state, [...path, 'type'], true);
  return value;
}));
const variant = object({ questions, confidenceGates: record(id, union(
  object({ missed: probability, met: probability }), object({ confidence: probability }),
)) });
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
const acceptanceSchema = object({
  publicDigest: digest, holdoutDigest: digest, fingerprint: digest,
  bar: object({ maxUndueCredit: literal(0), maxDefiniteDisagreementsPer12: number(0, 12, true), maxUnsureRate: probability }),
  generation: id,
  counts: object({ en: optional(counts), fr: optional(counts) }),
  caseKindCoverage: object({ en: optional(coverage), fr: optional(coverage) }),
  evaluator: text,
  date: (/** @type {Reader} */ ((value, path, state) => {
    formatted(/^\d{4}-\d{2}-\d{2}$/)(value, path, state);
    if (typeof value === 'string' && (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) invalid(state, path);
    return value;
  })),
});
const setSchemaV2 = object({ ...setShape, acceptance: acceptanceSchema });

/** @param {unknown} value @returns {QuestionSet[]} */
export function readQuestionSets(value) {
  const state = { paths: /** @type {Path[]} */ ([]), aborted: false };
  const version = isObject(value) && /** @type {{version?: unknown}} */ (value).version === 2 ? 2 : 1;
  const bundle = object({ version: literal(version), sets: array(version === 2 ? setSchemaV2 : setSchema, 0, 256) })(value, [], state);
  if (!state.aborted) {
    validateSets(bundle.sets, state);
    if (version === 2) bundle.sets.forEach((/** @type {QuestionSet} */ set, /** @type {number} */ index) => validateAcceptance(/** @type {AcceptanceRecord} */ (set.acceptance), ['sets', index, 'acceptance'], state));
  }
  if (state.paths.length) throw new QuestionSetError(state.paths);
  return bundle.sets;
}

/** @param {AcceptanceRecord} record @param {Path} path @param {Validation} state */
function validateAcceptance(record, path, state) {
  if (!Object.keys(record.counts).length) invalid(state, [...path, 'counts']);
  for (const language of /** @type {const} */ (['en', 'fr'])) {
    const counts = record.counts[language], coverage = record.caseKindCoverage[language];
    if (!counts !== !coverage) invalid(state, [...path, 'caseKindCoverage', language]);
    if (!counts || !coverage) continue;
    if (counts.definiteDisagreements + counts.unsure > counts.total || counts.undueCredit > coverage.gaming + coverage.injection) invalid(state, [...path, 'counts', language]);
    if (Object.values(coverage).reduce((sum, count) => sum + count, 0) !== counts.total) invalid(state, [...path, 'caseKindCoverage', language]);
  }
}

/** @param {QuestionSet[]} sets @param {Validation} state */
function validateSets(sets, state) {
  const blocks = new Set();
  sets.forEach((set, index) => {
    /** @param {Path} path */
    const issue = path => invalid(state, ['sets', index, ...path]);
    if (blocks.has(set.block)) issue(['block']);
    blocks.add(set.block);
    if (!Object.keys(set.fields).length || ['block', 'acknowledge', 'notice'].some(key => Object.hasOwn(set.fields, key)) || Object.keys(set.fields).length > 10) issue(['fields']);
    if (!Object.hasOwn(set.feedback, set.defaultFeedback)) issue(['defaultFeedback']);
    const base = set.providers.perplexity.questions;
    for (const name of /** @type {const} */ (['perplexity', 'clef'])) {
      const variant = set.providers[name];
      if (!variant) continue;
      const count = Object.keys(variant.questions).length;
      if (!count || count > 128 || inputTokenBound(set, name) >= 65536) issue(['providers', name, 'questions']);
      if (Object.keys(variant.confidenceGates).length !== count) issue(['providers', name, 'confidenceGates']);
      // Provider wording and thresholds can differ; outcome meanings must agree.
      if (Object.keys(base).length !== count) issue(['providers', name, 'questions']);
      for (const [key, question] of Object.entries(variant.questions)) {
        const gate = variant.confidenceGates[key], original = base[key];
        if (!original || original.type !== question.type || (question.type === 'choice' && original.type === 'choice' && (Object.keys(original.criteria).length !== Object.keys(question.criteria).length || Object.keys(original.criteria).some(key => !Object.hasOwn(question.criteria, key))))) issue(['providers', name, 'questions', key]);
        if (question.type === 'noul') {
          if (!gate || !('met' in gate) || gate.missed >= gate.met) issue(['providers', name, 'confidenceGates', key]);
        } else if (!gate || !('confidence' in gate) || !Object.keys(question.criteria).length || Object.keys(question.criteria).length > 255) issue(['providers', name, 'confidenceGates', key]);
      }
      set.outcomes.forEach((outcome, outcomeIndex) => {
        if (!Object.hasOwn(set.feedback, outcome.feedback) || !Object.keys(outcome.when).length) issue(['outcomes', outcomeIndex]);
        for (const [key, band] of Object.entries(outcome.when)) {
          const question = variant.questions[key];
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

// JSON can escape each UTF-16 code unit to six bytes. Count shared state per question.
/** @param {QuestionSet} set @param {keyof QuestionSet['providers']} [provider] */
export function inputTokenBound(set, provider = 'perplexity') {
  const emptyFields = Object.fromEntries(Object.keys(set.fields).map(key => [key, '']));
  const stateBytes = new TextEncoder().encode(JSON.stringify({ context: set.context, fields: emptyFields })).length
    + Object.values(set.fields).reduce((sum, cap) => sum + cap * 6, 0);
  return Object.values(/** @type {Variant} */ (set.providers[provider]).questions).reduce((sum, question) => sum + stateBytes + new TextEncoder().encode(JSON.stringify(question)).length + 1024, 0);
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
export function questionBands(set, answers, provider = 'perplexity') {
  const variant = /** @type {Variant} */ (set.providers[provider]);
  return Object.fromEntries(Object.entries(variant.questions).map(([key]) => {
    const answer = answers[key], gate = variant.confidenceGates[key];
    if (answer.type === 'noul' && 'met' in gate) return [key, answer.noul >= gate.met ? 'met' : answer.noul <= gate.missed ? 'missed' : 'unsure'];
    if (answer.type === 'choice' && 'confidence' in gate) return [key, answer.confidence >= gate.confidence ? answer.choice : 'unsure'];
    throw new Error('Mismatched confidence gate');
  }));
}

/** @param {QuestionSet} set @param {Answers} answers @param {keyof QuestionSet['providers']} [provider] */
export function chooseFeedback(set, answers, provider = 'perplexity') {
  const bands = questionBands(set, answers, provider);
  return set.outcomes.find(outcome => Object.entries(outcome.when).every(([key, value]) => bands[key] === value))?.feedback ?? set.defaultFeedback;
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
