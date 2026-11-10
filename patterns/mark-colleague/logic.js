import { validateTextLengths } from '../../lib/text-limits.js';
/** @typedef {{ heading: string, subject?: string, body: string }} Message */
/** @typedef {{ id: string, label: string, explanation: string }} Issue */
/** @typedef {{ title: string, context: string, colleague: string, messages: Message[], issues: Issue[] }} Content */
/** @typedef {'write' | 'compare' | 'done'} Stage */
/** @typedef {{ feedback: string, ticked: string[], stage: Stage }} LearnerState */

export const MAX_LENGTH = 2000;
const STAGES = ['write', 'compare', 'done'];

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/** @param {Record<string, unknown>} value @param {string[]} keys @param {string} path */
function only(value, keys, path) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`Invalid ${path}.${key}`);
}
/** @param {Record<string, unknown>} value @param {string} key @param {string} path */
function text(value, key, path) {
  if (typeof value[key] !== 'string' || !value[key].length) throw new Error(`Invalid ${path}${key}`);
}

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  validateTextLengths(content, {
    title: 120, context: 400, colleague: 120,
    messages: [{ heading: 120, subject: 120, body: 1500 }],
    issues: [{ id: 120, label: 120, explanation: 1500 }]
  });
  if (!object(content)) throw new Error('Invalid content');
  only(content, ['title', 'context', 'colleague', 'messages', 'issues'], 'content');
  for (const key of ['title', 'context', 'colleague']) text(content, key, '');
  if (!Array.isArray(content.messages) || content.messages.length < 1 || content.messages.length > 3) throw new Error('Invalid messages: one to three');
  content.messages.forEach((message, index) => {
    const path = `messages[${index}]`;
    if (!object(message)) throw new Error(`Invalid ${path}`);
    only(message, ['heading', 'subject', 'body'], path);
    text(message, 'heading', `${path}.`);
    text(message, 'body', `${path}.`);
    if (Object.hasOwn(message, 'subject')) text(message, 'subject', `${path}.`);
  });
  if (!Array.isArray(content.issues) || content.issues.length < 2 || content.issues.length > 5) throw new Error('Invalid issues: two to five');
  const known = new Set();
  content.issues.forEach((issue, index) => {
    const path = `issues[${index}]`;
    if (!object(issue)) throw new Error(`Invalid ${path}`);
    only(issue, ['id', 'label', 'explanation'], path);
    if (typeof issue.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(issue.id) || known.has(issue.id)) throw new Error(`Invalid ${path}.id`);
    known.add(issue.id);
    text(issue, 'label', `${path}.`);
    text(issue, 'explanation', `${path}.`);
  });
}

/** Error keys let the host pick an authored message.
 * @param {unknown} feedback
 * @returns {{ ok: true, text: string } | { ok: false, error: 'empty' | 'tooLong' }}
 */
export function validateFeedback(feedback) {
  const trimmed = typeof feedback === 'string' ? feedback.trim() : '';
  if (!trimmed) return { ok: false, error: 'empty' };
  if (trimmed.length > MAX_LENGTH) return { ok: false, error: 'tooLong' };
  return { ok: true, text: trimmed };
}

/** Every issue, in author order, marked by the learner's own ticks.
 * @param {Content} content @param {string[]} ticked
 * @returns {{ count: number, total: number, key: 'all' | 'some' | 'none', items: (Issue & { raised: boolean })[] }}
 */
export function result(content, ticked) {
  const known = new Set(content.issues.map(issue => issue.id));
  const raised = new Set();
  for (const id of ticked) {
    if (!known.has(id)) throw new Error(`Unknown issue: ${id}`);
    if (raised.has(id)) throw new Error(`Duplicate issue: ${id}`);
    raised.add(id);
  }
  const count = raised.size, total = content.issues.length;
  return {
    count, total,
    key: count === total ? 'all' : count ? 'some' : 'none',
    items: content.issues.map(issue => ({ ...issue, raised: raised.has(issue.id) }))
  };
}

/** Ignore invalid host state; return an independent copy of a valid value.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content, value) {
  if (!object(value) || Object.keys(value).some(key => !['feedback', 'ticked', 'stage'].includes(key))) return null;
  const { feedback, ticked, stage } = value;
  if (typeof feedback !== 'string' || typeof stage !== 'string' || !STAGES.includes(stage) || !Array.isArray(ticked)) return null;
  const known = new Set(content.issues.map(issue => issue.id));
  if (ticked.some(id => typeof id !== 'string' || !known.has(id)) || new Set(ticked).size !== ticked.length) return null;
  // Ticks exist only once the checklist has been shown.
  if (stage === 'write' && ticked.length) return null;
  // A finished state locks the field, so it needs feedback a live check would accept. Drafts may be oversized.
  if (stage === 'done' && !validateFeedback(feedback).ok) return null;
  return { feedback, ticked: [...ticked], stage: /** @type {Stage} */ (stage) };
}

/** Replace placeholders in a single pass so inserted text stays literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
}
