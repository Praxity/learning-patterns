import { band } from '../../proxy/logic/shared.js';
import { ANSWER_LIMIT, IDEA_KEYS } from '../../proxy/logic/07-explain-back.js';
export { ANSWER_LIMIT };

/** @typedef {{ id: string, heading: string, body: string, label: string, met: string, missed: string, unsure: string }} Idea */
/** @typedef {{ task: string, model: string, ideas: Idea[] }} Content */
/** @typedef {{ answer: string, ticked: string[] }} LearnerState */
/** @typedef {'met' | 'missed' | 'unsure'} Mark */
/** @typedef {{ id: string, mark: Mark, text: string, heading: string }} FeedbackItem */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {Record<string, unknown>} value @param {string[]} keys @param {string} path */
function fields(value, keys, path) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`Invalid ${path}.${key}`);
}

/** Content must describe the proxy's fixed three ideas, in lesson order.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content) {
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['task', 'model', 'ideas'], 'content');
  for (const key of ['task', 'model']) if (typeof content[key] !== 'string' || !content[key].length) throw new Error(`Invalid ${key}`);
  if (!Array.isArray(content.ideas) || content.ideas.length !== IDEA_KEYS.length) throw new Error('Invalid ideas');
  content.ideas.forEach((idea, index) => {
    const path = `ideas[${index}]`;
    if (!object(idea)) throw new Error(`Invalid ${path}`);
    const keys = ['id', 'heading', 'body', 'label', 'met', 'missed', 'unsure'];
    fields(idea, keys, path);
    for (const key of keys) if (typeof idea[key] !== 'string' || !idea[key].length) throw new Error(`Invalid ${path}.${key}`);
    if (idea.id !== IDEA_KEYS[index]) throw new Error(`Invalid ${path}.id`);
  });
}

/** Choose authored lines. The proxy owns the confidence gate.
 * @param {Content} content @param {unknown} answers
 * @returns {{ count: number, total: number, allFound: boolean, items: FeedbackItem[] }}
 */
export function feedback(content, answers) {
  validateContent(content);
  if (!object(answers)) throw new Error('Invalid answers');
  const items = content.ideas.map(idea => {
    const answer = answers[idea.id];
    if (!object(answer) || typeof answer.noul !== 'number' || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) throw new Error(`Invalid answers.${idea.id}`);
    const mark = /** @type {Mark} */ (band(answer.noul));
    return { id: idea.id, mark, text: idea[mark], heading: idea.heading };
  });
  const count = items.filter(item => item.mark === 'met').length;
  return { count, total: items.length, allFound: count === items.length, items };
}

/** Restore drafts only, never persist automated judgments.
 * @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(value) {
  if (!object(value) || typeof value.answer !== 'string' || value.answer.length > ANSWER_LIMIT || !Array.isArray(value.ticked) || value.ticked.some(id => typeof id !== 'string' || !IDEA_KEYS.includes(id)) || new Set(value.ticked).size !== value.ticked.length) return null;
  return { answer: value.answer, ticked: [...value.ticked] };
}
