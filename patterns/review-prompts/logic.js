/** @typedef {'remembered' | 'forgot'} Result */
/** @typedef {{ remembered: number, forgot: number }} ReviewDays */
/** @typedef {{ id: string, heading: string, paragraphs: string[], question: string, answer: string }} Part */
/** @typedef {{ parts: Part[], reviewDays: ReviewDays }} Content */
/** @typedef {{ result: Result, reviewOn: string }} Review */
/** @typedef {{ results: Record<string, Review> }} LearnerState */

export const REVIEW_DAYS = Object.freeze({ remembered: 3, forgot: 1 });

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** @param {Record<string, unknown>} value @param {string[]} allowed @param {string} path */
function fields(value, allowed, path) {
  for (const field of Object.keys(value)) if (!allowed.includes(field)) throw new Error(`Invalid ${path}.${field}`);
}
/** @param {unknown} value @returns {asserts value is ReviewDays} */
function validateReviewDays(value) {
  if (!object(value)) throw new Error('Invalid reviewDays');
  fields(value, ['remembered', 'forgot'], 'reviewDays');
  for (const field of ['remembered', 'forgot']) {
    const days = value[field];
    if (typeof days !== 'number' || !Number.isSafeInteger(days) || days < 1) throw new Error(`Invalid reviewDays.${field}`);
  }
}
/** @param {unknown} value @returns {value is Result} */
function result(value) { return value === 'remembered' || value === 'forgot'; }

/** Validate authored plain text. Empty strings are rejected; whitespace is allowed.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content) {
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['parts', 'reviewDays'], 'content');
  validateReviewDays(content.reviewDays);
  if (!Array.isArray(content.parts) || content.parts.length === 0) throw new Error('Invalid parts');
  const known = new Set();
  content.parts.forEach((part, index) => {
    const path = `parts[${index}]`;
    if (!object(part)) throw new Error(`Invalid ${path}`);
    fields(part, ['id', 'heading', 'paragraphs', 'question', 'answer'], path);
    for (const field of ['id', 'heading', 'question', 'answer']) {
      if (typeof part[field] !== 'string' || part[field].length === 0) throw new Error(`Invalid ${path}.${field}`);
    }
    if (typeof part.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(part.id) || known.has(part.id)) throw new Error(`Invalid ${path}.id`);
    known.add(part.id);
    if (!Array.isArray(part.paragraphs) || part.paragraphs.length === 0) throw new Error(`Invalid ${path}.paragraphs`);
    part.paragraphs.forEach((paragraph, i) => {
      if (typeof paragraph !== 'string' || paragraph.length === 0) throw new Error(`Invalid ${path}.paragraphs[${i}]`);
    });
  });
}

/** Local calendar date for the datetime attribute and host state.
 * @param {Date} date @returns {string}
 */
export function isoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('isoDate needs a valid Date');
  const year = date.getFullYear();
  if (year < 0 || year > 9999) throw new RangeError('Unsupported date range');
  return `${String(year).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Returns a new date at local midnight after the configured calendar days.
 * @param {Date} date @param {Result} choice @param {ReviewDays} [reviewDays]
 * @returns {Date}
 */
export function scheduleReview(date, choice, reviewDays = REVIEW_DAYS) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('scheduleReview needs a valid Date');
  if (!result(choice)) throw new RangeError(`Unsupported result: ${String(choice)}`);
  validateReviewDays(reviewDays);
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + reviewDays[choice]);
  // Set midnight on the target day: the source day may have a DST gap at midnight.
  next.setHours(0, 0, 0, 0);
  if (Number.isNaN(next.getTime()) || next.getFullYear() < 0 || next.getFullYear() > 9999) throw new RangeError('Unsupported date range');
  return next;
}

/** Ignore invalid host state and copy valid records. Dates are civil dates, not timestamps.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content, value) {
  if (!object(value) || Object.keys(value).some(key => key !== 'results') || !object(value.results)) return null;
  const known = new Set(content.parts.map(part => part.id));
  /** @type {[string, Review][]} */
  const entries = [];
  for (const [id, row] of Object.entries(value.results)) {
    if (!known.has(id) || !object(row) || Object.keys(row).some(key => !['result', 'reviewOn'].includes(key))) return null;
    if (!result(row.result) || typeof row.reviewOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.reviewOn)) return null;
    const date = new Date(`${row.reviewOn}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== row.reviewOn) return null;
    entries.push([id, { result: row.result, reviewOn: row.reviewOn }]);
  }
  return { results: Object.fromEntries(entries) };
}
