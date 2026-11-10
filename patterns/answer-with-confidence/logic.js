import { validateTextLengths } from '../../lib/text-limits.js';
/** @typedef {{ id: string, text: string, feedback: string, rightWhen?: string }} Option */
/** @typedef {{ id: string, text: string, options: Option[], correct: string }} Question */
/** @typedef {{ title?: string, context?: string, dontKnow?: boolean, questions: Question[] }} Content */
/** @typedef {'sure' | 'unsure'} Certainty */
/** @typedef {{ answers: Record<string, string> }} LearnerState */

export const DONT_KNOW = 'dont-know';
export const SURE = 'sure';
export const UNSURE = 'unsure';

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

/** @param {unknown} value @param {string} path @returns {asserts value is string} */
function identity(value, path) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error(`Invalid ${path}`);
}

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  validateTextLengths(content, {
    title: 120, context: 400,
    questions: [{ id: 120, text: 400, correct: 120, options: [{ id: 120, text: 300, feedback: 300, rightWhen: 200 }] }]
  });
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['title', 'context', 'dontKnow', 'questions'], 'content');
  if (Object.hasOwn(content, 'title')) text(content.title, 'title');
  if (Object.hasOwn(content, 'context')) text(content.context, 'context');
  if (Object.hasOwn(content, 'dontKnow') && typeof content.dontKnow !== 'boolean') throw new Error('Invalid dontKnow');
  if (!Array.isArray(content.questions) || content.questions.length === 0) throw new Error('Invalid questions');
  // One question is its own heading. Several need a title above them.
  if (content.questions.length > 1 && !Object.hasOwn(content, 'title')) throw new Error('Invalid title: required with several questions');
  const ids = new Set();
  content.questions.forEach((q, index) => {
    const path = `questions[${index}]`;
    if (!object(q)) throw new Error(`Invalid ${path}`);
    fields(q, ['id', 'text', 'options', 'correct'], path);
    identity(q.id, `${path}.id`);
    if (ids.has(q.id)) throw new Error(`Invalid ${path}.id`);
    ids.add(q.id);
    text(q.text, `${path}.text`);
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) throw new Error(`Invalid ${path}.options: use two to six`);
    const optionIds = new Set();
    q.options.forEach((option, n) => {
      const optionPath = `${path}.options[${n}]`;
      if (!object(option)) throw new Error(`Invalid ${optionPath}`);
      fields(option, ['id', 'text', 'feedback', 'rightWhen'], optionPath);
      identity(option.id, `${optionPath}.id`);
      if (option.id === DONT_KNOW || optionIds.has(option.id)) throw new Error(`Invalid ${optionPath}.id`);
      optionIds.add(option.id);
      text(option.text, `${optionPath}.text`);
      text(option.feedback, `${optionPath}.feedback`);
      if (Object.hasOwn(option, 'rightWhen')) {
        text(option.rightWhen, `${optionPath}.rightWhen`);
        // The line says why a wrong option can seem right, so the correct option has nowhere to show one.
        if (option.id === q.correct) throw new Error(`Invalid ${optionPath}.rightWhen: the correct option takes none`);
      }
    });
    if (typeof q.correct !== 'string' || !optionIds.has(q.correct)) throw new Error(`Invalid ${path}.correct`);
  });
}

/** An answer is one of the question's options, or "Don't know" when the content turns it on.
 * @param {Content} content @param {Question} question @param {unknown} answer @returns {answer is string}
 */
function answerable(content, question, answer) {
  return typeof answer === 'string' && (answer === DONT_KNOW ? content.dontKnow === true : question.options.some(o => o.id === answer));
}

/** Validate answers at the host boundary. Missing own keys mean unanswered.
 * @param {Content} content @param {unknown} answers @returns {asserts answers is Record<string, string>}
 */
function validateAnswers(content, answers) {
  if (!object(answers)) throw new Error('Invalid answers');
  const questions = new Map(content.questions.map(q => [q.id, q]));
  for (const [id, answer] of Object.entries(answers)) {
    const q = questions.get(id);
    if (!q) throw new Error(`Unknown question in answers: ${id}`);
    if (!answerable(content, q, answer)) throw new Error(`Invalid answers.${id}`);
  }
}

/** What to show after one submitted answer: the result and the chosen option's feedback.
 * After "Don't know" the feedback is the correct option's. `rightWhen` is the chosen option's
 * line only after a wrong answer the learner said they were sure of; otherwise it is null.
 * @param {Content} content @param {string} questionId @param {string} answer @param {Certainty} [certainty]
 * @returns {{ result: 'right' | 'wrong' | 'unknown', correct: Option, feedback: string, rightWhen: string | null }}
 */
export function feedback(content, questionId, answer, certainty) {
  validateContent(content);
  const question = content.questions.find(q => q.id === questionId);
  if (!question) throw new Error(`Unknown question: ${questionId}`);
  if (!answerable(content, question, answer)) throw new Error('Invalid answer');
  if (certainty !== undefined && certainty !== SURE && certainty !== UNSURE) throw new Error('Invalid certainty');
  const correct = /** @type {Option} */ (question.options.find(o => o.id === question.correct));
  if (answer === DONT_KNOW) return { result: 'unknown', correct, feedback: correct.feedback, rightWhen: null };
  const chosen = /** @type {Option} */ (question.options.find(o => o.id === answer));
  const wrong = chosen !== correct;
  return { result: wrong ? 'wrong' : 'right', correct, feedback: chosen.feedback, rightWhen: wrong && certainty === SURE ? chosen.rightWhen ?? null : null };
}

/** Group question identities in content order. Certainty only fills `sureWrong` and `unsureRight`;
 * it never moves a question between right and wrong.
 * @param {Content} content @param {Record<string, string>} answers @param {Record<string, Certainty>} [certainties]
 */
export function summarize(content, answers, certainties = {}) {
  validateContent(content);
  validateAnswers(content, answers);
  if (!object(certainties)) throw new Error('Invalid certainties');
  for (const [id, certainty] of Object.entries(certainties)) {
    if ((certainty !== SURE && certainty !== UNSURE) || !Object.hasOwn(answers, id) || answers[id] === DONT_KNOW) throw new Error(`Invalid certainties.${id}`);
  }
  /** @type {{ total: number, right: string[], wrong: string[], unknown: string[], unanswered: string[], sureWrong: string[], unsureRight: string[] }} */
  const result = { total: content.questions.length, right: [], wrong: [], unknown: [], unanswered: [], sureWrong: [], unsureRight: [] };
  for (const q of content.questions) {
    if (!Object.hasOwn(answers, q.id)) { result.unanswered.push(q.id); continue; }
    const group = answers[q.id] === DONT_KNOW ? 'unknown' : answers[q.id] === q.correct ? 'right' : 'wrong';
    result[group].push(q.id);
    if (group === 'wrong' && certainties[q.id] === SURE) result.sureWrong.push(q.id);
    if (group === 'right' && certainties[q.id] === UNSURE) result.unsureRight.push(q.id);
  }
  return result;
}

/** Ignore invalid saved values and copy valid state. Saved state holds answers only, so a value
 * that carries anything else, certainty included, is rejected.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content, value) {
  if (!object(value) || Object.keys(value).some(key => key !== 'answers')) return null;
  try { validateAnswers(content, value.answers); } catch { return null; }
  return { answers: { ...value.answers } };
}

/** Replace authored placeholders in a single pass so inserted content stays literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token);
}
