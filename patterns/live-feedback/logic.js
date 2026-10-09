import { ANSWER_LIMIT, CRITERION_KEYS, liveFeedback } from '../../proxy/logic/02-live.js';
export { ANSWER_LIMIT };
export const MIN_CHARS = 20;
export const AUTO_CHECK_LIMIT = 40;

/** @typedef {{ id: string, done: string, todo: string }} Criterion */
/** @typedef {{ prompt: string, criteria: Criterion[] }} Content */
/** @typedef {{ answer: string, ticked: string[] }} LearnerState */
/** @typedef {{ id: string, mark: 'done' | 'todo', text: string }} FeedbackItem */
/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {Record<string, unknown>} value @param {string[]} keys @param {string} path */
function fields(value, keys, path) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`Invalid ${path}.${key}`);
}

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['prompt', 'criteria'], 'content');
  if (typeof content.prompt !== 'string' || !content.prompt.length) throw new Error('Invalid prompt');
  if (!Array.isArray(content.criteria) || content.criteria.length !== CRITERION_KEYS.length) throw new Error('Invalid criteria');
  content.criteria.forEach((item, index) => {
    const path = `criteria[${index}]`;
    if (!object(item)) throw new Error(`Invalid ${path}`);
    const keys = ['id', 'done', 'todo'];
    fields(item, keys, path);
    for (const key of keys) if (typeof item[key] !== 'string' || !item[key].length) throw new Error(`Invalid ${path}.${key}`);
    if (item.id !== CRITERION_KEYS[index]) throw new Error(`Invalid ${path}.id`);
  });
}

/** Choose authored lines, retaining done items while the final sentence is unfinished.
 * @param {Content} content @param {unknown} answers @param {string} [draft]
 * @param {FeedbackItem[]} [previous]
 * @returns {{ count: number, total: number, items: FeedbackItem[] }}
 */
export function feedback(content, answers, draft = '', previous = []) {
  validateContent(content);
  const complete = /[.!?]\s*$|\n[^\S\r\n]*$/.test(draft);
  const items = liveFeedback(answers).items.map(({ key, state }, index) => {
    const item = content.criteria[index];
    const done = state === 'met' || (!complete && previous.some(old => old.id === key && old.mark === 'done'));
    const mark = /** @type {'done' | 'todo'} */ (done ? 'done' : 'todo');
    return { id: key, mark, text: item[mark] };
  });
  const ordered = [...items.filter(item => item.mark === 'done'), ...items.filter(item => item.mark === 'todo')];
  return { count: ordered.filter(item => item.mark === 'done').length, total: ordered.length, items: ordered };
}

/** Drafts and self-check ticks only; automatic judgments are never persisted.
 * @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(value) {
  if (!object(value) || typeof value.answer !== 'string' || value.answer.length > ANSWER_LIMIT || !Array.isArray(value.ticked) || value.ticked.some(id => typeof id !== 'string' || !CRITERION_KEYS.includes(id)) || new Set(value.ticked).size !== value.ticked.length) return null;
  return { answer: value.answer, ticked: [...value.ticked] };
}
