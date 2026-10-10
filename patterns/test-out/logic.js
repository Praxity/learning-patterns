import { validateTextLengths } from '../../lib/text-limits.js';
/** @typedef {{ id: number, title: string, requires: number[] }} Section */
/** @typedef {{ id: string, text: string }} Option */
/** @typedef {{ id: string, section: number, text: string, options: Option[], correct: string, explanation: string }} Question */
/** @typedef {{ title: string, allowTestOut: boolean, sections: Section[], questions: Question[] }} Content */
/** @typedef {{ picks: Record<string, string>, shown: boolean, step: number }} LearnerState */
/** @typedef {{ id: number, title: string, action: 'take' | 'passed' | 'credited', by?: number }} PlanRow */

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
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid ${path}`);
}
/** @param {unknown} value @returns {value is number} */
function sectionId(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
/** @param {unknown} value @param {Set<string>} ids @param {string} path @returns {asserts value is string} */
function identity(value, ids, path) {
  text(value, path);
  if (!/^[a-zA-Z0-9_-]+$/.test(value) || ids.has(value)) throw new Error(`Invalid ${path}`);
  ids.add(value);
}

/** @param {unknown} sections @returns {asserts sections is Section[]} */
function validateSections(sections) {
  if (!Array.isArray(sections) || !sections.length) throw new Error('Invalid sections');
  const ids = new Set();
  for (const [i, s] of sections.entries()) {
    const path = `sections[${i}]`;
    if (!object(s)) throw new Error(`Invalid ${path}`);
    fields(s, ['id', 'title', 'requires'], path);
    if (!sectionId(s.id) || ids.has(s.id)) throw new Error(`Invalid ${path}.id`);
    ids.add(s.id); text(s.title, `${path}.title`);
    if (!Array.isArray(s.requires) || s.requires.some(r => !sectionId(r)) || new Set(s.requires).size !== s.requires.length) throw new Error(`Invalid ${path}.requires`);
  }
  const byId = new Map(sections.map(s => [s.id, s]));
  const done = new Set();
  const active = new Set();
  /** @param {Section} section */
  function visit(section) {
    if (active.has(section.id)) throw new Error(`Invalid sections.${section.id}.requires: cycle`);
    if (done.has(section.id)) return;
    active.add(section.id);
    for (const id of section.requires) {
      const prerequisite = byId.get(id);
      if (!prerequisite) throw new Error(`Invalid sections.${section.id}.requires: unknown section ${id}`);
      visit(prerequisite);
    }
    active.delete(section.id); done.add(section.id);
  }
  for (const section of sections) visit(section);
}

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  validateTextLengths(content, {
    title: 120,
    sections: [{"title": 120}],
    questions: [{"id": 120, "text": 400, "correct": 120, "explanation": 1500, "options": [{"id": 120, "text": 300}]}],
  });
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['title', 'allowTestOut', 'sections', 'questions'], 'content');
  text(content.title, 'title');
  if (typeof content.allowTestOut !== 'boolean') throw new Error('Invalid allowTestOut');
  validateSections(content.sections);
  if (!Array.isArray(content.questions) || !content.questions.length) throw new Error('Invalid questions');
  const sections = new Set(content.sections.map(s => s.id));
  const ids = new Set();
  for (const [i, q] of content.questions.entries()) {
    const path = `questions[${i}]`;
    if (!object(q)) throw new Error(`Invalid ${path}`);
    fields(q, ['id', 'section', 'text', 'options', 'correct', 'explanation'], path);
    identity(q.id, ids, `${path}.id`);
    for (const field of ['text', 'correct', 'explanation']) text(q[field], `${path}.${field}`);
    if (!sectionId(q.section) || !sections.has(q.section)) throw new Error(`Invalid ${path}.section`);
    if (!Array.isArray(q.options) || q.options.length < 2) throw new Error(`Invalid ${path}.options`);
    const optionIds = new Set();
    for (const [n, o] of q.options.entries()) {
      const optionPath = `${path}.options[${n}]`;
      if (!object(o)) throw new Error(`Invalid ${optionPath}`);
      fields(o, ['id', 'text'], optionPath);
      identity(o.id, optionIds, `${optionPath}.id`); text(o.text, `${optionPath}.text`);
    }
    if (!optionIds.has(q.correct)) throw new Error(`Invalid ${path}.correct`);
  }
  for (const section of content.sections) {
    const count = content.questions.filter(q => q.section === section.id).length;
    if (count < 1 || count > 2) throw new Error(`Invalid questions: section ${section.id} needs one or two questions`);
  }
}

/** A passed section credits prerequisites unless they were directly failed. The lowest numeric passed id wins ties.
 * @param {Section[]} sections @param {number[]} passed @param {boolean} [allowTestOut] @param {number[]} [failed]
 * @returns {{ rows: PlanRow[], skip: number }}
 */
export function plan(sections, passed, allowTestOut = true, failed = []) {
  validateSections(sections);
  const byId = new Map(sections.map(s => [s.id, s]));
  if (!Array.isArray(passed) || Array.from(passed).some(id => !byId.has(id))) throw new Error('Invalid passed');
  if (typeof allowTestOut !== 'boolean') throw new Error('Invalid allowTestOut');
  if (!Array.isArray(failed) || Array.from(failed).some(id => !byId.has(id) || passed.includes(id))) throw new Error('Invalid failed');
  const fail = new Set(failed);
  const pass = new Set(passed);
  const creditedBy = new Map();
  for (const id of [...pass].sort((a, b) => a - b)) {
    const stack = [...(byId.get(id)?.requires ?? [])];
    const seen = new Set();
    for (const prerequisite of stack) {
      if (seen.has(prerequisite)) continue;
      seen.add(prerequisite);
      if (!creditedBy.has(prerequisite)) creditedBy.set(prerequisite, id);
      stack.push(...(byId.get(prerequisite)?.requires ?? []));
    }
  }
  const rows = sections.map(s => {
    /** @type {PlanRow} */
    const row = { id: s.id, title: s.title, action: 'take' };
    if (allowTestOut) {
      if (pass.has(s.id)) row.action = 'passed';
      else if (!fail.has(s.id) && creditedBy.has(s.id)) { row.action = 'credited'; row.by = creditedBy.get(s.id); }
    }
    return row;
  });
  return { rows, skip: rows.filter(r => r.action !== 'take').length };
}

/** @param {Content} content @param {unknown} picks @returns {asserts picks is Record<string, string>} */
function validatePicks(content, picks) {
  if (!object(picks)) throw new Error('Invalid picks');
  for (const [id, value] of Object.entries(picks)) {
    const question = content.questions.find(q => q.id === id);
    if (!question || typeof value !== 'string' || !question.options.some(o => o.id === value)) throw new Error(`Invalid picks.${id}`);
  }
}

/** All questions in a section must be right for a direct pass. Missing picks stay unanswered.
 * @param {Content} content @param {Record<string, string>} picks
 */
export function score(content, picks) {
  validateContent(content); validatePicks(content, picks);
  /** @type {{ right: string[], wrong: string[], unanswered: string[] }} */
  const result = { right: [], wrong: [], unanswered: [] };
  for (const q of content.questions) result[!Object.hasOwn(picks, q.id) ? 'unanswered' : picks[q.id] === q.correct ? 'right' : 'wrong'].push(q.id);
  const passed = content.sections.filter(s => content.questions.filter(q => q.section === s.id).every(q => result.right.includes(q.id))).map(s => s.id);
  const failed = content.sections.filter(s => content.questions.some(q => q.section === s.id && result.wrong.includes(q.id))).map(s => s.id);
  return { ...result, passed, failed, ...plan(content.sections, passed, content.allowTestOut, failed) };
}

/** @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content, value) {
  if (!object(value) || typeof value.shown !== 'boolean' || Object.keys(value).some(key => !['picks', 'shown', 'step'].includes(key))) return null;
  const step = value.step;
  if (typeof step !== 'number' || !Number.isInteger(step) || step < 0 || step > content.questions.length + 1) return null;
  if (value.shown !== (step === content.questions.length + 1) || (!content.allowTestOut && step !== 0)) return null;
  try { validatePicks(content, value.picks); } catch { return null; }
  const picks = value.picks;
  if (value.shown && content.questions.some(q => !Object.hasOwn(picks, q.id))) return null;
  return { picks: { ...picks }, shown: value.shown, step };
}

/** Replace placeholders once so inserted values stay literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token);
}
