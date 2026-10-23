import { validateTextLengths } from '../../lib/text-limits.js';

/** @typedef {{ question: string, unit: string, answer: number, source: string }} Question */
/** @typedef {{ title: string, context: string, questions: Question[] }} Content */
/** @typedef {{ ranges: number[], touched: boolean[], shown: boolean }} LearnerState */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {Record<string, unknown>} value @param {string[]} allowed @param {string} path */
function fields(value, allowed, path) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Invalid ${path}.${key}`);
}

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  validateTextLengths(content, { title: 120, context: 1500, questions: [{ question: 400, unit: 120, source: 1500 }] });
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['title', 'context', 'questions'], 'content');
  for (const field of ['title', 'context']) {
    if (typeof content[field] !== 'string' || !content[field].trim()) throw new Error(`Invalid ${field}`);
  }
  if (!Array.isArray(content.questions) || content.questions.length < 3 || content.questions.length > 5) throw new Error('Invalid questions: expected three to five');
  Array.from(content.questions).forEach((question, index) => {
    const path = `questions[${index}]`;
    if (!object(question)) throw new Error(`Invalid ${path}`);
    fields(question, ['question', 'unit', 'answer', 'source'], path);
    for (const field of ['question', 'unit', 'source']) {
      if (typeof question[field] !== 'string' || !question[field].trim()) throw new Error(`Invalid ${path}.${field}`);
    }
    // Leave room for the next 1-or-5 stop above ten times the answer without overflowing.
    if (typeof question.answer !== 'number' || !Number.isFinite(question.answer) || question.answer < 1 || question.answer > 1e307) throw new Error(`Invalid ${path}.answer`);
  });
}

/** Each band starts at a stop and reaches the furthest stop within ten times it.
 * Tolerate floating-point rounding at exact tens, such as 0.003 / 0.0003 > 10.
 * @param {number[]} stops @returns {[number, number][]}
 */
export function bandsFor(stops) {
  // The range spans ten times its low end, so nobody wins with 1 to 100,000.
  /** @type {[number, number][]} */
  const bands = [];
  for (let low = 0; low < stops.length; low++) {
    let high = low;
    while (high + 1 < stops.length && stops[high + 1] / stops[low] <= 10 * (1 + 1e-9)) high++;
    bands.push([stops[low], stops[high]]);
    if (high === stops.length - 1) break;
  }
  return bands;
}

/** Integer stops at 1 and 5 in each power of ten. Every generated band spans exactly 10x.
 * @param {Content} content
 */
export function scaleFor(content) {
  validateContent(content);
  const ceiling = Math.max(...content.questions.map(question => question.answer)) * 10;
  const stops = [1];
  for (let exponent = 0; stops[stops.length - 1] < ceiling; exponent++) {
    for (const stop of [5 * 10 ** exponent, 10 ** (exponent + 1)]) {
      stops.push(stop);
      if (stop >= ceiling) break;
    }
  }
  const bands = bandsFor(stops);
  // Start in the middle; require a deliberate setting so the start is not taken as a hint.
  return { stops, bands, start: Math.floor((bands.length - 1) / 2) };
}

/** Log positions keep every tenfold band the same width, including between 1 and 5.
 * @param {number} value @param {number[]} stops @returns {number} Percentage along the scale.
 */
export function positionOf(value, stops) {
  return Math.log(value / stops[0]) / Math.log(stops[stops.length - 1] / stops[0]) * 100;
}

/** @param {Content} content @param {number[]} ranges */
export function score(content, ranges) {
  const { bands } = scaleFor(content);
  if (!Array.isArray(ranges) || ranges.length !== content.questions.length || Array.from(ranges).some(range => !Number.isInteger(range) || range < 0 || range >= bands.length)) throw new Error('Invalid ranges');
  const items = content.questions.map((question, index) => {
    const [low, high] = bands[ranges[index]];
    const relation = question.answer < low ? 'below' : question.answer > high ? 'above' : 'inside';
    return { low, high, answer: question.answer, relation };
  });
  return { count: items.filter(item => item.relation === 'inside').length, total: items.length, items };
}

/** Ignore invalid host state and return independent arrays for valid state.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content, value) {
  const { bands } = scaleFor(content);
  if (!object(value) || typeof value.shown !== 'boolean' || !Array.isArray(value.ranges) || !Array.isArray(value.touched)) return null;
  if (value.ranges.length !== content.questions.length || value.touched.length !== content.questions.length) return null;
  if (Array.from(value.ranges).some(range => !Number.isInteger(range) || range < 0 || range >= bands.length) || Array.from(value.touched).some(touched => typeof touched !== 'boolean')) return null;
  if (value.shown && !value.touched.every(Boolean)) return null;
  return { ranges: [...value.ranges], touched: [...value.touched], shown: value.shown };
}
