import { ENTRY_IDS as FAQ_IDS, QUESTION_LIMIT, faqLookup } from '../../proxy/logic/20-faq.js';
import { ENTRY_IDS as SECTION_IDS, sectionLookup } from '../../proxy/logic/21-sections.js';
export { QUESTION_LIMIT };
export const AUTO_CHECK_LIMIT = 30;
export const BANK_LIMIT = 100;

/** @typedef {{ id: string, title: string, answer?: string, summary?: string }} Entry */
/** @typedef {{ id: string, question: string, author: 'instructor' | 'learner', answer: string }} Seed */
/** @typedef {{ kind: 'faq' | 'sections', prompt: string, course?: string, entries: Entry[], seeds: Seed[] }} Content */
/** @typedef {{ questions: string[] }} LearnerState */
/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {Record<string, unknown>} value @param {string[]} keys @param {string} path */
function fields(value, keys, path) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`Invalid ${path}.${key}`);
}
/** @param {unknown} value @returns {value is string} */
function text(value) { return typeof value === 'string' && value.trim().length > 0; }

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['kind', 'prompt', 'course', 'entries', 'seeds'], 'content');
  if (content.kind !== 'faq' && content.kind !== 'sections') throw new Error('Invalid kind');
  if (!text(content.prompt)) throw new Error('Invalid prompt');
  // {course} in the prompt renders the course name in italics, so a prompt that uses it needs the name.
  if (content.course !== undefined && !text(content.course)) throw new Error('Invalid course');
  if (content.prompt.includes('{course}') && content.course === undefined) throw new Error('Invalid prompt');
  const ids = content.kind === 'faq' ? FAQ_IDS : SECTION_IDS;
  const body = content.kind === 'faq' ? 'answer' : 'summary';
  if (!Array.isArray(content.entries) || content.entries.length !== ids.length) throw new Error('Invalid entries');
  content.entries.forEach((entry, index) => {
    const path = `entries[${index}]`;
    if (!object(entry)) throw new Error(`Invalid ${path}`);
    fields(entry, ['id', 'title', body], path);
    if (entry.id !== ids[index]) throw new Error(`Invalid ${path}.id`);
    for (const key of ['title', body]) if (!text(entry[key])) throw new Error(`Invalid ${path}.${key}`);
  });
  if (!Array.isArray(content.seeds) || content.seeds.length !== 3) throw new Error('Invalid seeds');
  const seen = new Set();
  content.seeds.forEach((seed, index) => {
    const path = `seeds[${index}]`;
    if (!object(seed)) throw new Error(`Invalid ${path}`);
    fields(seed, ['id', 'question', 'author', 'answer'], path);
    for (const key of ['id', 'question', 'answer']) if (!text(seed[key])) throw new Error(`Invalid ${path}.${key}`);
    if (seen.has(seed.id)) throw new Error(`Invalid ${path}.id`);
    seen.add(seed.id);
    if (seed.author !== 'instructor' && seed.author !== 'learner') throw new Error(`Invalid ${path}.author`);
  });
  if (content.seeds.filter(seed => seed.author === 'instructor').length !== 2) throw new Error('Invalid seeds.author');
}

/** @param {Content} content @param {unknown} answers @returns {Entry[]} */
export function lookup(content, answers) {
  validateContent(content);
  const result = content.kind === 'faq' ? faqLookup(answers) : sectionLookup(answers);
  return result.ids.map(id => /** @type {Entry} */ (content.entries.find(entry => entry.id === id)));
}

/** Only learner questions are stored; authored examples stay in content.
 * @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(value) {
  if (!object(value) || Object.keys(value).some(key => key !== 'questions') || !Array.isArray(value.questions) || value.questions.length > BANK_LIMIT || value.questions.some(q => !text(q) || q.length > QUESTION_LIMIT || q !== q.trim()) || new Set(value.questions).size !== value.questions.length) return null;
  return { questions: [...value.questions] };
}
