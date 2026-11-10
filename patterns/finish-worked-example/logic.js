import { validateTextLengths } from '../../lib/text-limits.js';

/** @typedef {{ question: string, options: string[] }} Step */
/** @typedef {{ answer: number, reason: string, worked: boolean }} CaseStep */
/** @typedef {{ facts: { label: string, text: string }[], steps: CaseStep[] }} Case */
/** @typedef {{ title: string, context: string, steps: Step[], cases: Case[] }} Content */
/** @typedef {{ at: number, picks: (number | null)[][] }} LearnerState */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {Record<string, unknown>} value @param {string[]} allowed @param {string} path */
function fields(value, allowed, path) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Invalid ${path}.${key}`);
}

/** @param {unknown} value @param {string} path */
function text(value, path) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid ${path}`);
}

/** @param {unknown} value @param {number} min @param {number} max @param {string} path @returns {unknown[]} */
function list(value, min, max, path) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`Invalid ${path}: ${min} to ${max} items`);
  return value;
}

/** @param {unknown} value @param {number} count @returns {value is number} */
function index(value, count) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < count;
}

/** The limits keep a case short enough to finish: two to four steps, three or four cases, one-line facts.
 * @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  validateTextLengths(content, {
    title: 120, context: 300,
    steps: [{ question: 120, options: [80] }],
    cases: [{ facts: [{ label: 40, text: 120 }], steps: [{ reason: 200 }] }]
  });
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['title', 'context', 'steps', 'cases'], 'content');
  text(content.title, 'title');
  text(content.context, 'context');
  const steps = list(content.steps, 2, 4, 'steps');
  /** @type {number[]} */
  const optionCounts = [];
  steps.forEach((step, s) => {
    const path = `steps[${s}]`;
    if (!object(step)) throw new Error(`Invalid ${path}`);
    fields(step, ['question', 'options'], path);
    text(step.question, `${path}.question`);
    const options = list(step.options, 2, 4, `${path}.options`);
    options.forEach((option, n) => text(option, `${path}.options[${n}]`));
    if (new Set(options).size !== options.length) throw new Error(`Invalid ${path}.options: duplicate`);
    optionCounts.push(options.length);
  });
  // Two cases would be an example and a problem, with nothing faded in between.
  const cases = list(content.cases, 3, 4, 'cases');
  /** @type {boolean[]} */
  let before = steps.map(() => true);
  cases.forEach((item, c) => {
    const path = `cases[${c}]`;
    if (!object(item)) throw new Error(`Invalid ${path}`);
    fields(item, ['facts', 'steps'], path);
    list(item.facts, 1, 4, `${path}.facts`).forEach((fact, n) => {
      if (!object(fact)) throw new Error(`Invalid ${path}.facts[${n}]`);
      fields(fact, ['label', 'text'], `${path}.facts[${n}]`);
      text(fact.label, `${path}.facts[${n}].label`);
      text(fact.text, `${path}.facts[${n}].text`);
    });
    if (!Array.isArray(item.steps) || item.steps.length !== steps.length) throw new Error(`Invalid ${path}.steps: one entry per step`);
    const worked = Array.from(item.steps).map((step, s) => {
      const stepPath = `${path}.steps[${s}]`;
      if (!object(step)) throw new Error(`Invalid ${stepPath}`);
      fields(step, ['answer', 'reason', 'worked'], stepPath);
      if (!index(step.answer, optionCounts[s])) throw new Error(`Invalid ${stepPath}.answer`);
      text(step.reason, `${stepPath}.reason`);
      if (typeof step.worked !== 'boolean') throw new Error(`Invalid ${stepPath}.worked`);
      return step.worked;
    });
    if (c === 0 && worked.includes(false)) throw new Error(`Invalid ${path}.steps: the first case is fully worked`);
    if (c === cases.length - 1 && worked.includes(true)) throw new Error(`Invalid ${path}.steps: the learner does every step of the last case`);
    if (c > 0 && (worked.some((value, s) => value && !before[s]) || worked.every((value, s) => value === before[s]))) {
      throw new Error(`Invalid ${path}.steps: each case keeps the learner's earlier steps and adds at least one`);
    }
    before = worked;
  });
}

/** Steps of one case the learner does, in order.
 * @param {Content} content @param {number} caseIndex @returns {number[]} */
export function learnerSteps(content, caseIndex) {
  return content.cases[caseIndex].steps.flatMap((step, s) => step.worked ? [] : [s]);
}

/** @param {Content} content @returns {LearnerState} */
export function emptyState(content) {
  return { at: 0, picks: content.cases.map(item => item.steps.map(() => null)) };
}

/** The step the learner answers next in a case, or -1 once the case is finished.
 * @param {Content} content @param {LearnerState} state @param {number} caseIndex @returns {number} */
export function nextStep(content, state, caseIndex) {
  return learnerSteps(content, caseIndex).find(s => state.picks[caseIndex][s] === null) ?? -1;
}

/** The furthest case the learner may open: the first unfinished one, or the last.
 * @param {Content} content @param {LearnerState} state @returns {number} */
export function reach(content, state) {
  const open = content.cases.findIndex((_, c) => nextStep(content, state, c) !== -1);
  return open === -1 ? content.cases.length - 1 : open;
}

/** @param {LearnerState} state @returns {LearnerState} */
function copy(state) {
  return { at: state.at, picks: state.picks.map(row => [...row]) };
}

/** Record the learner's answer to the next step. Steps are answered in order and never changed.
 * @param {Content} content @param {LearnerState} state @param {number} caseIndex @param {number} step @param {number} pick
 * @returns {LearnerState} */
export function answer(content, state, caseIndex, step, pick) {
  if (caseIndex !== reach(content, state) || step !== nextStep(content, state, caseIndex)) throw new RangeError('Not the next step');
  if (!index(pick, content.steps[step].options.length)) throw new RangeError('Invalid pick');
  const next = copy(state);
  next.picks[caseIndex][step] = pick;
  return next;
}

/** Open a case the learner has reached.
 * @param {Content} content @param {LearnerState} state @param {number} caseIndex @returns {LearnerState} */
export function move(content, state, caseIndex) {
  if (!index(caseIndex, reach(content, state) + 1)) throw new RangeError('Case not reached');
  return { ...copy(state), at: caseIndex };
}

/** Count the learner's own steps across every case.
 * @param {Content} content @param {LearnerState} state @returns {{ right: number, total: number, done: boolean }} */
export function result(content, state) {
  let right = 0, total = 0, answered = 0;
  content.cases.forEach((item, c) => {
    for (const s of learnerSteps(content, c)) {
      total++;
      if (state.picks[c][s] !== null) answered++;
      if (state.picks[c][s] === item.steps[s].answer) right++;
    }
  });
  return { right, total, done: answered === total };
}

/** Copy valid saved state, or return null. Answers must follow the order the pattern allows.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content, value) {
  if (!object(value) || !Array.isArray(value.picks) || value.picks.length !== content.cases.length) return null;
  let blocked = false;
  /** @type {(number | null)[][]} */
  const picks = [];
  for (const [c, item] of content.cases.entries()) {
    const row = value.picks[c];
    if (!Array.isArray(row) || row.length !== item.steps.length) return null;
    for (const [s, step] of item.steps.entries()) {
      const pick = row[s];
      if (pick === null) { if (!step.worked) blocked = true; continue; }
      if (step.worked || blocked || !index(pick, content.steps[s].options.length)) return null;
    }
    picks.push([...row]);
  }
  const state = { at: 0, picks };
  return index(value.at, reach(content, state) + 1) ? { at: value.at, picks } : null;
}

/** Replace `{name}` placeholders; inserted text is kept literally.
 * @param {string} template @param {Record<string, string | number>} values @returns {string} */
export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
}
