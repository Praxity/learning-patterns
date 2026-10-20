import { validateTextLengths } from '../../lib/text-limits.js';
import { ANSWER_LIMIT, NUDGE_KEYS, journalDecision } from '../../proxy/logic/13-journal.js';
export { ANSWER_LIMIT };

/** @typedef {{ id: typeof NUDGE_KEYS[number], text: string }} Question */
/** @typedef {{ prompt: string, questions: Question[], complete: string, support: string, supportNote: string, saved: string, changed: string }} Content */
/** @typedef {{ text: string, savedAt: string }} LearnerState */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {Record<string, unknown>} value @param {string[]} keys @param {string} path */
function textFields(value, keys, path) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`Invalid ${path}.${key}`);
  for (const key of keys) if (typeof value[key] !== 'string' || !value[key].trim()) throw new Error(`Invalid ${path}.${key}`);
}

/** Questions follow the proxy's fixed criteria, in its order.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content) {
  validateTextLengths(content, {
    prompt: 400,
    complete: 1500,
    support: 1500,
    supportNote: 1500,
    saved: 1500,
    changed: 1500,
    questions: [{"text": 400}],
  });
  if (!object(content)) throw new Error('Invalid content');
  const { questions, ...text } = content;
  textFields(text, ['prompt', 'complete', 'support', 'supportNote', 'saved', 'changed'], 'content');
  if (!Array.isArray(questions) || questions.length !== NUDGE_KEYS.length) throw new Error('Invalid questions');
  questions.forEach((question, index) => {
    if (!object(question)) throw new Error(`Invalid questions[${index}]`);
    textFields(question, ['id', 'text'], `questions[${index}]`);
    if (question.id !== NUDGE_KEYS[index]) throw new Error(`Invalid questions[${index}].id`);
  });
}

/** Select one authored line. The proxy owns every threshold and the decision order.
 * @param {Content} content @param {unknown} answers
 * @returns {{ kind: 'support' | 'complete', text: string } | { kind: 'nudge', key: typeof NUDGE_KEYS[number], text: string }}
 */
export function feedback(content, answers) {
  validateContent(content);
  if (!object(answers)) throw new Error('Invalid answers');
  /** @type {Record<string, { noul: number }>} */
  const checked = {};
  for (const key of [...NUDGE_KEYS, 'distress']) {
    const answer = answers[key];
    if (!object(answer) || typeof answer.noul !== 'number' || !Number.isFinite(answer.noul) || answer.noul < 0 || answer.noul > 1) throw new Error(`Invalid answers.${key}`);
    checked[key] = { noul: answer.noul };
  }
  const outcome = journalDecision(checked);
  if (outcome.kind === 'nudge') return { ...outcome, text: /** @type {Question} */ (content.questions.find(question => question.id === outcome.key)).text };
  return { ...outcome, text: outcome.kind === 'support' ? content.support : content.complete };
}

/** Preserve the writer's whitespace when saving.
 * @param {unknown} text @returns {{ ok: true, text: string } | { ok: false, error: 'empty' | 'tooLong' }}
 */
export function validateAnswer(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'empty' };
  if (text.length > ANSWER_LIMIT) return { ok: false, error: 'tooLong' };
  return { ok: true, text };
}

/** Only submitted entries are saved, with canonical UTC timestamps. No model judgments.
 * @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(value) {
  if (!object(value) || Object.keys(value).some(key => !['text', 'savedAt'].includes(key))) return null;
  const answer = validateAnswer(value.text);
  if (!answer.ok || typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt)) || new Date(value.savedAt).toISOString() !== value.savedAt) return null;
  return { text: answer.text, savedAt: value.savedAt };
}

/** @param {string} text @param {string} savedAt @returns {LearnerState} */
export function savedEntry(text, savedAt) {
  const answer = validateAnswer(text);
  if (!answer.ok) throw new Error(answer.error);
  const entry = validateState({ text, savedAt });
  if (!entry) throw new Error('Invalid savedAt');
  return entry;
}
