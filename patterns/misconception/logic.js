import { confidenceGate, MISCONCEPTION_KEYS, ANSWER_LIMIT } from '../../proxy/logic/06-misconceptions.js';
export { ANSWER_LIMIT };

/** @typedef {{ id: string, label: string, idea: string, why: string }} Misconception */
/** @typedef {{ question: string, keyIdea: string, model: string, unsureKeyIdea: string, unsureMisconception: string, noMatch: string, misconceptions: Misconception[] }} Content */
/** @typedef {{ answer: string, ticked: string[] }} LearnerState */
/** @typedef {'correct' | 'misconception' | 'unsure-key' | 'unsure-misconception' | 'none'} Kind */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {Record<string, unknown>} value @param {string[]} keys @param {string} path */
function fields(value, keys, path) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`Invalid ${path}.${key}`);
  for (const key of keys) if (typeof value[key] !== 'string' || !value[key].length) throw new Error(`Invalid ${path}.${key}`);
}

/** The catalogue identities match the proxy's evaluated study beliefs.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content) {
  if (!object(content)) throw new Error('Invalid content');
  const { misconceptions, ...text } = content;
  fields(text, ['question', 'keyIdea', 'model', 'unsureKeyIdea', 'unsureMisconception', 'noMatch'], 'content');
  if (!String(text.unsureMisconception).includes('{idea}') || !String(text.unsureMisconception).includes('{why}')) throw new Error('Invalid content.unsureMisconception');
  if (!Array.isArray(misconceptions) || misconceptions.length !== MISCONCEPTION_KEYS.length) throw new Error('Invalid misconceptions');
  misconceptions.forEach((item, index) => {
    if (!object(item)) throw new Error(`Invalid misconceptions[${index}]`);
    fields(item, ['id', 'label', 'idea', 'why'], `misconceptions[${index}]`);
    if (item.id !== MISCONCEPTION_KEYS[index]) throw new Error(`Invalid misconceptions[${index}].id`);
  });
}

/** Select authored feedback, never model-written text.
 * @param {Content} content @param {unknown} answers @param {string} [model]
 * @returns {{ kind: Kind, heading: string, text: string }}
 */
export function feedback(content, answers, model = '@cf/cloudflare/clef') {
  validateContent(content);
  if (!object(answers) || !object(answers.misconception)) throw new Error('Invalid answers.misconception');
  const { choice, confidence } = answers.misconception;
  if (typeof choice !== 'string' || !['correct', ...MISCONCEPTION_KEYS, 'none'].includes(choice)) throw new Error('Invalid answers.misconception.choice');
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('Invalid answers.misconception.confidence');
  const sure = confidence >= confidenceGate(model);
  if (choice === 'correct') return { kind: sure ? 'correct' : 'unsure-key', heading: '', text: sure ? content.keyIdea : content.unsureKeyIdea };
  if (choice === 'none') return { kind: 'none', heading: '', text: content.noMatch };
  const item = /** @type {Misconception} */ (content.misconceptions.find(item => item.id === choice));
  return { kind: sure ? 'misconception' : 'unsure-misconception', heading: sure ? item.label : '', text: sure ? item.why : content.unsureMisconception.replaceAll('{idea}', item.idea).replaceAll('{why}', item.why) };
}

/** @param {unknown} value @returns {LearnerState | null} */
export function validateState(value) {
  if (!object(value) || typeof value.answer !== 'string' || value.answer.length > ANSWER_LIMIT || !Array.isArray(value.ticked) || value.ticked.some(id => typeof id !== 'string' || !MISCONCEPTION_KEYS.includes(id)) || new Set(value.ticked).size !== value.ticked.length) return null;
  return { answer: value.answer, ticked: [...value.ticked] };
}
