/** @typedef {{ id: string, question: string, answer: string }} Question */
/** @typedef {{ title: string, questions: Question[] }} Content */
/** @typedef {'front' | 'back'} Side */
/** @typedef {{ date: string, side: Side }} LearnerState */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {Record<string, unknown>} value @param {string[]} allowed @param {string} path */
function fields(value, allowed, path) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Invalid ${path}.${key}`);
}

/** Validate authored plain text. Whitespace is allowed; empty strings are rejected.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content) {
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['title', 'questions'], 'content');
  if (typeof content.title !== 'string' || content.title.length === 0) throw new Error('Invalid title');
  if (!Array.isArray(content.questions) || content.questions.length === 0) throw new Error('Invalid questions');
  const known = new Set();
  content.questions.forEach((row, index) => {
    const path = `questions[${index}]`;
    if (!object(row)) throw new Error(`Invalid ${path}`);
    fields(row, ['id', 'question', 'answer'], path);
    for (const key of ['id', 'question', 'answer']) {
      if (typeof row[key] !== 'string' || row[key].length === 0) throw new Error(`Invalid ${path}.${key}`);
    }
    if (typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(row.id) || known.has(row.id)) throw new Error(`Invalid ${path}.id`);
    known.add(row.id);
  });
}

/** Valid civil date in the native date input's supported range, years 0001 to 9999.
 * @param {unknown} value @returns {value is string}
 */
export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Seven local calendar days ahead, without changing the source date.
 * @param {Date} today @returns {string} YYYY-MM-DD.
 */
export function defaultDate(today) { return dateAfterDays(today, 7); }

/** Spacing choices in civil days. */
export const presetDays = [2, 7, 14, 30];

/** Count civil days from today's local date using UTC arithmetic, without changing today.
 * @param {Date} today @param {number} days @returns {string} YYYY-MM-DD.
 */
export function dateAfterDays(today, days) {
  if (!(today instanceof Date) || Number.isNaN(today.getTime())) throw new TypeError('dateAfterDays needs a valid Date');
  if (!Number.isSafeInteger(days)) throw new TypeError('days must be a safe integer');
  if (today.getFullYear() < 1 || today.getFullYear() > 9999) throw new RangeError('Unsupported date range');
  const next = new Date(0);
  next.setUTCFullYear(today.getFullYear(), today.getMonth(), today.getDate() + days);
  if (Number.isNaN(next.getTime())) throw new RangeError('Unsupported date range');
  const value = next.toISOString().slice(0, 10);
  if (!isDate(value)) throw new RangeError('Unsupported date range');
  return value;
}

/** Format a civil date without shifting its day when the learner changes time zones.
 * @param {string} date @param {string} lang @returns {string}
 */
export function formatDate(date, lang) {
  if (!isDate(date)) throw new Error('Invalid date');
  return new Intl.DateTimeFormat(lang.toLowerCase().startsWith('fr') ? 'fr-CA' : 'en-CA', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Short weekday and date, preserving the civil day across time zones.
 * @param {string} date @param {string} lang @returns {string}
 */
export function formatShortDate(date, lang) {
  if (!isDate(date)) throw new Error('Invalid date');
  return new Intl.DateTimeFormat(lang.toLowerCase().startsWith('fr') ? 'fr-CA' : 'en-CA', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Ignore invalid host state as a whole; copy valid values, including past dates.
 * @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(value) {
  if (!object(value) || Object.keys(value).some(key => !['date', 'side'].includes(key)) || !isDate(value.date)) return null;
  if (value.side !== 'front' && value.side !== 'back') return null;
  return { date: value.date, side: value.side };
}
