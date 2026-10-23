import { validateTextLengths } from '../../lib/text-limits.js';

// Authors set the known points, real values, scale and step.
/** @typedef {{ label: string, name: string, value: number }} Point */
/** @typedef {'changedDirection' | 'fell' | 'rose' | 'flat' | 'fellThenFlat' | 'roseThenFlat'} Trend */
/** @typedef {{ title: string, context: string, question: string, unit: string, known: Point[], future: Point[], top: number, step: number, changeLabel: string, realLabel: string, resultTitle: string, explanationLabel: string, explanation: string, source: string, feedback: Record<Trend, string> }} Content */
/** @typedef {{ guesses: (number | null)[], shown: boolean }} LearnerState */

export const trends = /** @type {const} */ (['changedDirection', 'fell', 'rose', 'flat', 'fellThenFlat', 'roseThenFlat']);

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }

/** @param {Record<string, unknown>} value @param {string[]} keys @param {string} path */
function fields(value, keys, path) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`Invalid ${path}.${key}`);
  for (const key of keys) if (!Object.hasOwn(value, key)) throw new Error(`Invalid ${path}.${key}`);
}

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  if (!object(content)) throw new Error('Invalid content');
  const labels = ['title', 'unit', 'changeLabel', 'realLabel', 'resultTitle', 'explanationLabel'];
  const text = [...labels, 'context', 'question', 'explanation', 'source'];
  fields(content, [...text, 'known', 'future', 'top', 'step', 'feedback'], 'content');
  validateTextLengths(content, {
    ...Object.fromEntries(labels.map(key => [key, 120])), context: 1500, question: 400,
    explanation: 1500, source: 1500, known: [{ label: 120, name: 120 }],
    future: [{ label: 120, name: 120 }], feedback: { '*': 1500 }
  });
  for (const key of text) if (typeof content[key] !== 'string' || !content[key].trim()) throw new Error(`Invalid ${key}`);
  for (const key of ['top', 'step']) if (!Number.isSafeInteger(content[key]) || Number(content[key]) <= 0) throw new Error(`Invalid ${key}`);
  const top = Number(content.top), step = Number(content.step);
  if (step > top || top % step !== 0) throw new Error('Invalid step: must divide top');
  for (const key of ['known', 'future']) {
    const points = content[key];
    if (!Array.isArray(points) || points.length < 3 || points.length > 6) throw new Error(`Invalid ${key}: use three to six points`);
    for (const [i, point] of points.entries()) {
      const path = `${key}[${i}]`;
      if (!object(point)) throw new Error(`Invalid ${path}`);
      fields(point, ['label', 'name', 'value'], path);
      for (const field of ['label', 'name']) if (typeof point[field] !== 'string' || !point[field].trim()) throw new Error(`Invalid ${path}.${field}`);
      if (typeof point.value !== 'number' || !Number.isFinite(point.value) || point.value < 0 || point.value > top) throw new Error(`Invalid ${path}.value`);
    }
  }
  if (!object(content.feedback)) throw new Error('Invalid feedback');
  fields(content.feedback, [...trends], 'feedback');
  for (const key of trends) if (typeof content.feedback[key] !== 'string' || !content.feedback[key].trim()) throw new Error(`Invalid feedback.${key}`);
}

/** Snap pointer input to the authored scale, including its boundaries.
 * @param {Content} content @param {number} value */
export function snap(content, value) {
  if (!Number.isFinite(value)) throw new Error('Invalid value');
  return Math.min(content.top, Math.max(0, Math.round(value / content.step) * content.step));
}

/** Compare a complete guess with the last known point. No numeric grade is assigned.
 * @param {Content} content @param {number[]} guesses
 * @returns {{ trend: Trend, summary: string, differences: number[] }} */
export function compare(content, guesses) {
  validateContent(content);
  if (!validateState(content, { guesses, shown: true })) throw new Error('Invalid guesses');
  const changes = guesses.map((value, i) => value - (i ? guesses[i - 1] : content.known[content.known.length - 1].value));
  const fell = changes.some(value => value < 0), rose = changes.some(value => value > 0);
  let trend = /** @type {Trend} */ (fell && rose ? 'changedDirection' : fell ? 'fell' : rose ? 'rose' : 'flat');
  if (fell !== rose && changes.at(-1) === 0) trend = fell ? 'fellThenFlat' : 'roseThenFlat';
  return { trend, summary: content.feedback[trend], differences: guesses.map((value, i) => value - content.future[i].value) };
}

/** Ignore invalid saved values and copy valid ones.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content, value) {
  if (!object(value) || typeof value.shown !== 'boolean' || !Array.isArray(value.guesses) || value.guesses.length !== content.future.length) return null;
  const guesses = value.guesses;
  for (let i = 0; i < guesses.length; i++) {
    const guess = guesses[i];
    if (guess === null && !value.shown) continue;
    if (typeof guess !== 'number' || !Number.isFinite(guess) || guess < 0 || guess > content.top || guess % content.step !== 0) return null;
  }
  return { guesses: [...guesses], shown: value.shown };
}

/** Replace placeholders without interpreting inserted author text.
 * @param {string} template @param {Record<string, string | number>} values */
export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
}
