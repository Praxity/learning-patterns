import { validateTextLengths } from '../../lib/text-limits.js';
/** @typedef {{ id: string, text: string }} Option */
/** @typedef {{ from: string, to: string, correct: string, explanation: string }} Change */
/** @typedef {{ title: string, context?: string, case: string, question: string, options: Option[], correct: string, explanation: string, changes: Change[], rule: string }} Content */
/** @typedef {{ kind: 'same' | 'before' | 'now', text: string }} Part */
/** @typedef {{ parts: Part[], correct: string, explanation: string, moves: boolean | null }} Round */
/** @typedef {{ picks: string[] }} LearnerState */

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
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Invalid ${path}`);
}

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  validateTextLengths(content, {
    title: 120, context: 400, case: 600, question: 400, correct: 120, explanation: 600, rule: 400,
    options: [{ id: 120, text: 300 }],
    changes: [{ from: 120, to: 120, correct: 120, explanation: 600 }]
  });
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['title', 'context', 'case', 'question', 'options', 'correct', 'explanation', 'changes', 'rule'], 'content');
  for (const field of ['title', 'case', 'question', 'correct', 'explanation', 'rule']) text(content[field], field);
  if (Object.hasOwn(content, 'context')) text(content.context, 'context');
  if (!Array.isArray(content.options) || content.options.length < 2 || content.options.length > 4) throw new Error('Invalid options: write two to four');
  const ids = new Set();
  content.options.forEach((option, index) => {
    const path = `options[${index}]`;
    if (!object(option)) throw new Error(`Invalid ${path}`);
    fields(option, ['id', 'text'], path);
    text(option.id, `${path}.id`); text(option.text, `${path}.text`);
    if (!/^[a-zA-Z0-9_-]+$/.test(option.id) || ids.has(option.id)) throw new Error(`Invalid ${path}.id`);
    ids.add(option.id);
  });
  if (!ids.has(content.correct)) throw new Error('Invalid correct');
  if (!Array.isArray(content.changes) || content.changes.length < 1 || content.changes.length > 3) throw new Error('Invalid changes: write one to three');
  const original = /** @type {string} */ (content.case);
  content.changes.forEach((change, index) => {
    const path = `changes[${index}]`;
    if (!object(change)) throw new Error(`Invalid ${path}`);
    fields(change, ['from', 'to', 'correct', 'explanation'], path);
    for (const field of ['from', 'to', 'correct', 'explanation']) text(change[field], `${path}.${field}`);
    // One occurrence, so the page can show the change in place without guessing which one is meant.
    if (original.split(/** @type {string} */ (change.from)).length !== 2) throw new Error(`Invalid ${path}.from: it must appear exactly once in case`);
    if (change.to === change.from) throw new Error(`Invalid ${path}.to: it must differ from from`);
    if (!ids.has(change.correct)) throw new Error(`Invalid ${path}.correct`);
  });
  // Without a change that moves the answer, the case never shows which detail the rule turns on.
  if (content.changes.every(change => change.correct === content.correct)) throw new Error('Invalid changes: at least one must have a different correct answer from the first case');
}

/** The first case, then one round per change. Every change starts from the first case, so a round
 * differs from it in one detail only.
 * @param {Content} content @returns {Round[]}
 */
export function rounds(content) {
  validateContent(content);
  return [
    { parts: [{ kind: 'same', text: content.case }], correct: content.correct, explanation: content.explanation, moves: null },
    ...content.changes.map(change => {
      const [head, tail] = content.case.split(change.from);
      /** @type {Part[]} */
      const parts = [{ kind: 'same', text: head }, { kind: 'before', text: change.from }, { kind: 'now', text: change.to }, { kind: 'same', text: tail }];
      return { parts: parts.filter(part => part.text), correct: change.correct, explanation: change.explanation, moves: change.correct !== content.correct };
    })
  ];
}

/** Validate checked decisions at the host boundary: option ids in round order.
 * @param {Content} content @param {unknown} picks @returns {asserts picks is string[]}
 */
function validatePicks(content, picks) {
  if (!Array.isArray(picks) || picks.length > content.changes.length + 1) throw new Error('Invalid picks');
  picks.forEach((pick, index) => {
    if (!content.options.some(option => option.id === pick)) throw new Error(`Invalid picks[${index}]`);
  });
}

/** @param {Content} content @param {string[]} picks Checked decisions, in round order. */
export function score(content, picks) {
  const all = rounds(content);
  validatePicks(content, picks);
  const results = picks.map((pick, index) => pick === all[index].correct);
  return { results, right: results.filter(Boolean).length, total: all.length, done: picks.length === all.length };
}

/** Ignore invalid saved values and copy valid state.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content, value) {
  if (!object(value) || Object.keys(value).some(key => key !== 'picks')) return null;
  try { validatePicks(content, value.picks); } catch { return null; }
  return { picks: [...value.picks] };
}

/** Replace authored placeholders in a single pass so inserted content stays literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token);
}
