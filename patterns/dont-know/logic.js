/** @typedef {{ id: string, text: string }} Option */
/** @typedef {{ id: string, text: string, options: Option[], correct: string, explanation: string }} Question */
/** @typedef {{ questions: Question[], points: { right: number, wrong: number, unknown: number } }} Content */
/** @typedef {{ picks: Record<string, string>, shown: boolean }} LearnerState */

export const DONT_KNOW = 'dont-know';

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
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid ${path}`);
}

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['questions', 'points'], 'content');
  if (!Array.isArray(content.questions) || content.questions.length === 0) throw new Error('Invalid questions');
  const ids = new Set();
  content.questions.forEach((q, index) => {
    const path = `questions[${index}]`;
    if (!object(q)) throw new Error(`Invalid ${path}`);
    fields(q, ['id', 'text', 'options', 'correct', 'explanation'], path);
    for (const field of ['id', 'text', 'correct', 'explanation']) text(q[field], `${path}.${field}`);
    text(q.id, `${path}.id`);
    if (!/^[a-zA-Z0-9_-]+$/.test(q.id) || ids.has(q.id)) throw new Error(`Invalid ${path}.id`);
    ids.add(q.id);
    if (!Array.isArray(q.options) || q.options.length === 0) throw new Error(`Invalid ${path}.options`);
    const optionIds = new Set();
    q.options.forEach((option, n) => {
      const optionPath = `${path}.options[${n}]`;
      if (!object(option)) throw new Error(`Invalid ${optionPath}`);
      fields(option, ['id', 'text'], optionPath);
      text(option.id, `${optionPath}.id`); text(option.text, `${optionPath}.text`);
      if (!/^[a-zA-Z0-9_-]+$/.test(option.id) || option.id === DONT_KNOW || optionIds.has(option.id)) throw new Error(`Invalid ${optionPath}.id`);
      optionIds.add(option.id);
    });
    if (!optionIds.has(q.correct)) throw new Error(`Invalid ${path}.correct`);
  });
  if (!object(content.points)) throw new Error('Invalid points');
  fields(content.points, ['right', 'wrong', 'unknown'], 'points');
  for (const field of ['right', 'wrong', 'unknown']) if (typeof content.points[field] !== 'number' || !Number.isFinite(content.points[field])) throw new Error(`Invalid points.${field}`);
}

/** Validate picks at the host boundary. Missing own keys mean unanswered.
 * @param {Content} content @param {unknown} picks @returns {asserts picks is Record<string, string>}
 */
function validatePicks(content, picks) {
  if (!object(picks)) throw new Error('Invalid picks');
  const questions = new Map(content.questions.map(q => [q.id, q]));
  for (const [id, pick] of Object.entries(picks)) {
    const q = questions.get(id);
    if (!q) throw new Error(`Unknown question in picks: ${id}`);
    if (typeof pick !== 'string' || (pick !== DONT_KNOW && !q.options.some(o => o.id === pick))) throw new Error(`Invalid picks.${id}`);
  }
}

/** @param {Content} content @param {Record<string, string>} picks */
export function score(content, picks) {
  validateContent(content);
  validatePicks(content, picks);
  /** @type {{ points: number, total: number, right: string[], wrong: string[], unknown: string[], unanswered: string[] }} */
  const result = { points: 0, total: content.questions.length * content.points.right, right: [], wrong: [], unknown: [], unanswered: [] };
  for (const q of content.questions) {
    if (!Object.hasOwn(picks, q.id)) { result.unanswered.push(q.id); continue; }
    const group = picks[q.id] === DONT_KNOW ? 'unknown' : picks[q.id] === q.correct ? 'right' : 'wrong';
    result[group].push(q.id);
    result.points += content.points[group];
  }
  return result;
}

/** Ignore invalid saved values and copy valid state.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content, value) {
  if (!object(value) || typeof value.shown !== 'boolean' || Object.keys(value).some(key => !['picks', 'shown'].includes(key))) return null;
  try { validatePicks(content, value.picks); } catch { return null; }
  const picks = value.picks;
  if (value.shown && content.questions.some(q => !Object.hasOwn(picks, q.id))) return null;
  return { picks: { ...picks }, shown: value.shown };
}

/** Use the mathematical minus sign; scoring rules also show positive signs.
 * @param {number} value @param {boolean} [positive]
 */
export function displayPoints(value, positive = false) {
  return value < 0 ? `−${-value}` : `${positive && value > 0 ? '+' : ''}${value}`;
}

/** Replace authored placeholders in a single pass so inserted content stays literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token);
}
