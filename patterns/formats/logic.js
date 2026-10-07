/** @typedef {'text' | 'slides' | 'audio' | 'outline' | 'quiz'} Format */
/** @typedef {{ id: string, title: string, sentences: string[], outline: string[], example?: string[], exampleOutline?: string }} Point */
/** @typedef {{ text: string, feedback: string, correct?: boolean }} Option */
/** @typedef {{ section: string, prompt: string, options: Option[] }} Question */
/** @typedef {{ title: string, points: Point[], quiz: Question[], summary: string }} Content */
/** @typedef {{ format: Format, section: number }} LearnerState */

/** @type {readonly Format[]} */
export const FORMATS = Object.freeze(['text', 'slides', 'audio', 'outline', 'quiz']);
/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {Record<string, unknown>} value @param {string[]} allowed @param {string} path */
function fields(value, allowed, path) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Invalid ${path}.${key}`);
}
/** @param {unknown} value @param {string} path */
function text(value, path) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid ${path}`);
}
/** @param {unknown} value @param {string} path @returns {asserts value is unknown[]} */
function array(value, path) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`Invalid ${path}`);
}
/** @param {unknown} value @returns {value is Format} */
function format(value) { return FORMATS.some(name => name === value); }

/** Validate authored text, stable section ids and exactly one correct option per question.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content) {
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['title', 'points', 'quiz', 'summary'], 'content');
  text(content.title, 'title'); text(content.summary, 'summary');
  array(content.points, 'points');
  const known = new Set();
  content.points.forEach((point, i) => {
    const path = `points[${i}]`;
    if (!object(point)) throw new Error(`Invalid ${path}`);
    fields(point, ['id', 'title', 'sentences', 'outline', 'example', 'exampleOutline'], path);
    text(point.title, `${path}.title`);
    if (typeof point.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(point.id) || known.has(point.id)) throw new Error(`Invalid ${path}.id`);
    known.add(point.id);
    for (const key of ['sentences', 'outline', ...('example' in point ? ['example'] : [])]) {
      const lines = point[key]; array(lines, `${path}.${key}`);
      lines.forEach((line, j) => text(line, `${path}.${key}[${j}]`));
    }
    if ('exampleOutline' in point) text(point.exampleOutline, `${path}.exampleOutline`);
  });
  array(content.quiz, 'quiz');
  content.quiz.forEach((question, i) => {
    const path = `quiz[${i}]`;
    if (!object(question)) throw new Error(`Invalid ${path}`);
    fields(question, ['section', 'prompt', 'options'], path);
    if (typeof question.section !== 'string' || !known.has(question.section)) throw new Error(`Invalid ${path}.section`);
    text(question.prompt, `${path}.prompt`); array(question.options, `${path}.options`);
    question.options.forEach((option, j) => {
      const row = `${path}.options[${j}]`;
      if (!object(option)) throw new Error(`Invalid ${row}`);
      fields(option, ['text', 'feedback', 'correct'], row);
      text(option.text, `${row}.text`); text(option.feedback, `${row}.feedback`);
      if ('correct' in option && typeof option.correct !== 'boolean') throw new Error(`Invalid ${row}.correct`);
    });
    if (question.options.filter(option => object(option) && option.correct === true).length !== 1) throw new Error(`Invalid ${path}.options.correct`);
  });
}
/** Demo place keeping: truncate fractions, clamp to the nearest section, start at zero for nonfinite indices.
 * @param {number} index @param {number} count @returns {number}
 */
export function clampPoint(index, count) {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid section count');
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), count - 1);
}
/** @param {number} place @param {'next' | 'previous' | { set: number }} action @param {number} count @returns {number} */
export function movePlace(place, action, count) {
  if (action === 'next') return clampPoint(place + 1, count);
  if (action === 'previous') return clampPoint(place - 1, count);
  if (object(action) && typeof action.set === 'number') return clampPoint(action.set, count);
  throw new Error('Unknown place action');
}
/** @param {LearnerState} state @param {Format} next @returns {LearnerState} */
export function switchFormat(state, next) {
  if (!format(next)) throw new Error('Invalid format');
  return { format: next, section: state.section };
}
/** The narration uses the same title, body and example as text, in order.
 * @param {Point} point @returns {string[]}
 */
export function spokenLines(point) { return [point.title, ...point.sentences, ...(point.example ?? [])]; }
/** @param {number} questionIndex @param {number} optionIndex @param {Question[]} quiz @returns {{ correct: boolean, feedback: string }} */
export function checkQuizAnswer(questionIndex, optionIndex, quiz) {
  const option = Number.isInteger(questionIndex) && Number.isInteger(optionIndex) ? quiz[questionIndex]?.options[optionIndex] : undefined;
  if (!option) throw new Error(`No option ${optionIndex} in question ${questionIndex}`);
  return { correct: option.correct === true, feedback: option.feedback };
}
/** Ignore invalid host state as a whole. Saved sections are zero-based indices, never clamped.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content, value) {
  if (!object(value) || Object.keys(value).some(key => !['format', 'section'].includes(key))) return null;
  if (!format(value.format) || typeof value.section !== 'number' || !Number.isInteger(value.section) || value.section < 0 || value.section >= content.points.length) return null;
  return { format: value.format, section: value.section };
}
