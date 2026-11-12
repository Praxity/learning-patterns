import { validateTextLengths } from '../../lib/text-limits.js';
/** @typedef {'a' | 'b'} Version */
/** @typedef {{ question: string, sentence: number | null, reason: string, note: string }} Quality */
/** An email: its body is paragraphs of sentences, and only body sentences can be picked.
 * @typedef {{ subject: string, greeting: string, body: string[][], signoff: string }} Email */
/** @typedef {{ title: string, context: string, versions: { a: Email, b: Email }, better: Version, qualities: Quality[] }} Content */
/** A pick is a sentence written as its version and number, such as "b2", or "neither". @typedef {string} Pick */
/** @typedef {{ at: number, picks: Pick[] }} LearnerState */

export const NEITHER = 'neither';

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {Record<string, unknown>} value @param {string[]} allowed @param {string} path */
function fields(value, allowed, path) {
  for (const field of Object.keys(value)) if (!allowed.includes(field)) throw new Error(`Invalid ${path}.${field}`);
}

/** @param {unknown} value @param {string} path @returns {asserts value is string} */
function text(value, path) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Invalid ${path}`);
}

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  const email = { subject: 120, greeting: 120, body: [[300]], signoff: 200 };
  validateTextLengths(content, {
    title: 120, context: 400, versions: { a: email, b: email },
    qualities: [{ question: 400, reason: 600, note: 120 }]
  });
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['title', 'context', 'versions', 'better', 'qualities'], 'content');
  text(content.title, 'title'); text(content.context, 'context');
  const versions = content.versions;
  if (!object(versions)) throw new Error('Invalid versions');
  fields(versions, ['a', 'b'], 'versions');
  for (const version of ['a', 'b']) {
    const path = `versions.${version}`, value = versions[version];
    if (!object(value)) throw new Error(`Invalid ${path}`);
    fields(value, ['subject', 'greeting', 'body', 'signoff'], path);
    for (const field of ['subject', 'greeting', 'signoff']) text(value[field], `${path}.${field}`);
    const body = value.body;
    if (!Array.isArray(body) || body.length < 1 || body.length > 3) throw new Error(`Invalid ${path}.body: write one to three paragraphs`);
    body.forEach((paragraph, p) => {
      if (!Array.isArray(paragraph) || paragraph.length === 0) throw new Error(`Invalid ${path}.body[${p}]: write at least one sentence`);
      paragraph.forEach((sentence, i) => text(sentence, `${path}.body[${p}][${i}]`));
    });
    const count = body.flat().length;
    if (count < 2 || count > 6) throw new Error(`Invalid ${path}.body: write two to six sentences in all`);
  }
  if (content.better !== 'a' && content.better !== 'b') throw new Error('Invalid better: use "a" or "b"');
  const length = sentences(/** @type {Email} */ (versions[content.better])).length;
  if (!Array.isArray(content.qualities) || content.qualities.length < 2 || content.qualities.length > 4) throw new Error('Invalid qualities: write two to four');
  const used = new Set();
  content.qualities.forEach((quality, i) => {
    const path = `qualities[${i}]`;
    if (!object(quality)) throw new Error(`Invalid ${path}`);
    fields(quality, ['question', 'sentence', 'reason', 'note'], path);
    for (const field of ['question', 'reason', 'note']) text(quality[field], `${path}.${field}`);
    if (!Object.hasOwn(quality, 'sentence')) throw new Error(`Invalid ${path}.sentence: give a number, or null for neither version`);
    const sentence = quality.sentence;
    if (sentence === null) return;
    // The number counts sentences in the better version, so an answer can never sit in the weaker one.
    if (!Number.isInteger(sentence) || /** @type {number} */ (sentence) < 1 || /** @type {number} */ (sentence) > length) throw new Error(`Invalid ${path}.sentence: number a sentence in version ${content.better}`);
    // The summary gives each highlighted sentence one note.
    if (used.has(sentence)) throw new Error(`Invalid ${path}.sentence: another quality already uses it`);
    used.add(sentence);
  });
  // Without one, the summary would have nothing to highlight in the better version.
  if (used.size === 0) throw new Error('Invalid qualities: at least one must name a sentence');
}

/** An email's body sentences in reading order; a sentence's number counts from 1 in this list.
 * @param {Email} email */
function sentences(email) {
  return email.body.flat();
}

/** The right pick for a quality. @param {Content} content @param {number} index @returns {Pick} */
export function answer(content, index) {
  const sentence = content.qualities[index].sentence;
  return sentence === null ? NEITHER : `${content.better}${sentence}`;
}

/** Split a sentence pick into its version and 1-based number, or null for "neither" or anything unknown.
 * @param {Content} content @param {unknown} pick @returns {{ version: Version, sentence: number } | null}
 */
export function sentenceOf(content, pick) {
  const match = typeof pick === 'string' ? /^([ab])([1-9]\d*)$/.exec(pick) : null;
  if (!match) return null;
  const version = /** @type {Version} */ (match[1]), sentence = Number(match[2]);
  return sentence <= sentences(content.versions[version]).length ? { version, sentence } : null;
}

/** @param {Content} content @param {unknown} pick @returns {pick is Pick} */
export function isPick(content, pick) {
  return pick === NEITHER || sentenceOf(content, pick) !== null;
}

/** A pick's name: the version a sentence is in, such as "Version B", or the Neither label.
 * @param {Content} content @param {import('./strings.js').Strings} strings @param {string} pick
 */
export function pickName(content, strings, pick) {
  const sentence = sentenceOf(content, pick);
  if (!sentence) return strings.neither;
  return sentence.version === 'a' ? strings.versionA : strings.versionB;
}

/** The right answer as one line ending in punctuation, such as "Correct answer, in Version B: For an
 * urgent order, call …", or "Correct answer: Neither version does this."
 * @param {Content} content @param {import('./strings.js').Strings} strings @param {number} index
 */
export function answerText(content, strings, index) {
  const pick = answer(content, index), sentence = sentenceOf(content, pick);
  return sentence
    ? format(strings.correctIn, { version: pickName(content, strings, pick), letter: sentence.version.toUpperCase(), answer: sentences(content.versions[sentence.version])[sentence.sentence - 1] })
    : format(strings.correct, { answer: `${strings.neither}.` });
}

/** Score checked picks, in question order.
 * @param {Content} content @param {Pick[]} picks
 */
export function score(content, picks) {
  validateContent(content);
  if (!Array.isArray(picks) || picks.length > content.qualities.length) throw new Error('Invalid picks');
  const results = picks.map((pick, i) => {
    if (!isPick(content, pick)) throw new Error(`Invalid picks[${i}]`);
    return pick === answer(content, i);
  });
  return { results, right: results.filter(Boolean).length, total: content.qualities.length, done: picks.length === content.qualities.length };
}

/** The better version's body, paragraph by paragraph, each sentence with the note of the quality it
 * shows, then the notes of the qualities neither version has.
 * @param {Content} content
 */
export function summary(content) {
  validateContent(content);
  let n = 0;
  return {
    version: content.better,
    paragraphs: content.versions[content.better].body.map(paragraph => paragraph.map(text => {
      n += 1;
      return { text, note: content.qualities.find(q => q.sentence === n)?.note ?? null };
    })),
    missing: content.qualities.filter(q => q.sentence === null).map(q => q.note)
  };
}

/** Ignore invalid saved values and copy valid state. `at` is the open question, or the number of
 * questions once the summary shows. Every question before `at` is checked; `at` itself may be.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content, value) {
  if (!object(value) || Object.keys(value).some(key => key !== 'at' && key !== 'picks')) return null;
  const { at, picks } = value, total = content.qualities.length;
  if (!Number.isInteger(at) || !Array.isArray(picks) || !picks.every(pick => isPick(content, pick))) return null;
  const open = /** @type {number} */ (at);
  if (open < 0 || open > total) return null;
  if (open === total ? picks.length !== total : picks.length !== open && picks.length !== open + 1) return null;
  return { at: open, picks: [...picks] };
}

/** Replace authored placeholders in a single pass so inserted content stays literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token);
}
