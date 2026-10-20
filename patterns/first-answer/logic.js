import { validateTextLengths } from '../../lib/text-limits.js';
/** @typedef {{ id: string, label: string }} Check */
/** @typedef {{ prompt: string, checks: Check[] }} Content */
/** @typedef {{ text: string, savedAt: string }} Entry */
/** @typedef {{ first: Entry | null, now: Entry | null, checks: Record<string, boolean> }} LearnerState */

export const MAX_LENGTH = 2000;

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** @param {Record<string, unknown>} value @param {string[]} keys */
function only(value, keys) {
  return Object.keys(value).every(key => keys.includes(key));
}

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  validateTextLengths(content, {
    prompt: 400,
    checks: [{"id": 120, "label": 120}],
  });
  if (!object(content)) throw new Error('Invalid content');
  for (const key of Object.keys(content)) if (!['prompt', 'checks'].includes(key)) throw new Error(`Invalid content.${key}`);
  if (typeof content.prompt !== 'string' || !content.prompt.length) throw new Error('Invalid prompt');
  if (!Array.isArray(content.checks) || !content.checks.length) throw new Error('Invalid checks');
  const known = new Set();
  content.checks.forEach((check, index) => {
    const path = `checks[${index}]`;
    if (!object(check)) throw new Error(`Invalid ${path}`);
    for (const key of Object.keys(check)) if (!['id', 'label'].includes(key)) throw new Error(`Invalid ${path}.${key}`);
    if (typeof check.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(check.id) || known.has(check.id)) throw new Error(`Invalid ${path}.id`);
    if (typeof check.label !== 'string' || !check.label.length) throw new Error(`Invalid ${path}.label`);
    known.add(check.id);
  });
}

/** Error keys let the host pick an authored translation.
 * @param {unknown} text
 * @returns {{ ok: true, text: string } | { ok: false, error: 'empty' | 'tooLong' }}
 */
export function validateAnswer(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) return { ok: false, error: 'empty' };
  if (trimmed.length > MAX_LENGTH) return { ok: false, error: 'tooLong' };
  return { ok: true, text: trimmed };
}

/** Full ISO timestamps, including offsets. Date.parse alone normalizes invalid days.
 * @param {unknown} value @returns {value is string}
 */
function isDate(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendar = new Date(0);
  calendar.setUTCFullYear(Number(match[1]), month, 0);
  return month >= 1 && month <= 12 && day >= 1 && day <= calendar.getUTCDate();
}

/** @param {unknown} value @returns {value is Entry} */
function entry(value) {
  if (!object(value) || !only(value, ['text', 'savedAt'])) return false;
  const answer = validateAnswer(value.text);
  return answer.ok && answer.text === value.text && isDate(value.savedAt);
}

/** Return a copy, or null for damaged host state. Null is distinct from emptyState.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content, value) {
  validateContent(content);
  if (!object(value) || !only(value, ['first', 'now', 'checks'])) return null;
  if (value.first !== null && !entry(value.first)) return null;
  if (value.now !== null && !entry(value.now)) return null;
  const checks = value.checks;
  if (!object(checks) || Object.keys(checks).length !== content.checks.length) return null;
  if (content.checks.some(check => !Object.hasOwn(checks, check.id) || typeof checks[check.id] !== 'boolean')) return null;
  if (value.now === null && Object.values(checks).some(Boolean)) return null;
  return {
    first: value.first === null ? null : { text: value.first.text, savedAt: value.first.savedAt },
    now: value.now === null ? null : { text: value.now.text, savedAt: value.now.savedAt },
    checks: Object.fromEntries(content.checks.map(check => [check.id, checks[check.id] === true]))
  };
}

/** @param {Content} content @returns {LearnerState} */
export function emptyState(content) {
  validateContent(content);
  return { first: null, now: null, checks: Object.fromEntries(content.checks.map(check => [check.id, false])) };
}

/** @param {Content} content @param {LearnerState | null} value */
function record(content, value) {
  if (value === null) return emptyState(content);
  const copy = validateState(content, value);
  if (!copy) throw new Error('Invalid state');
  return copy;
}
/** @param {unknown} text @param {unknown} savedAt @returns {Entry} */
function answerEntry(text, savedAt) {
  const answer = validateAnswer(text);
  if (!answer.ok) throw new Error(answer.error);
  if (!isDate(savedAt)) throw new Error('Invalid savedAt');
  return { text: answer.text, savedAt };
}

/** Save once. An end-only attempt cannot later become a first attempt.
 * @param {Content} content @param {LearnerState | null} value @param {string} text @param {string} savedAt
 * @returns {LearnerState}
 */
export function withFirstAnswer(content, value, text, savedAt) {
  const copy = record(content, value);
  if (copy.first) throw new Error('First answer already saved');
  if (copy.now) throw new Error('End of course already started');
  return { ...copy, first: answerEntry(text, savedAt) };
}

/** Repeating comparison replaces only now; first and checks keep their values.
 * @param {Content} content @param {LearnerState | null} value @param {string} text @param {string} savedAt
 * @returns {LearnerState}
 */
export function withAnswerNow(content, value, text, savedAt) {
  return { ...record(content, value), now: answerEntry(text, savedAt) };
}

/** @param {Content} content @param {LearnerState | null} value @param {Record<string, unknown>} checks
 * @returns {LearnerState}
 */
export function withChecks(content, value, checks) {
  const copy = record(content, value);
  if (!copy.now) throw new Error('Compare your answers first');
  return { ...copy, checks: Object.fromEntries(content.checks.map(check => [check.id, Object.hasOwn(checks, check.id) && checks[check.id] === true])) };
}
