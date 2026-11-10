import { validateTextLengths } from '../../lib/text-limits.js';
/** @typedef {{ id: string, text: string, feedback?: string }} Option */
/** @typedef {{ question: string, options: { id: string, text: string }[], correct: string, explanation: string }} FollowUp */
/** @typedef {{ title: string, context?: string, question: string, options: Option[], correct: string, hints: string[], worked: string, followUp: FollowUp }} Content */
/** `tries` holds the options checked on the first question, in order. `opened` counts help steps
 * opened: the hints, then the worked answer. `followUp` is the option checked on the last question.
 * @typedef {{ tries: string[], opened: number, followUp: string | null }} LearnerState */
/** @typedef {{ first: 'open' | 'solved' | 'shown', tries: number, hints: number, next: 'hint' | 'worked' | null, gated: boolean, followUp: 'right' | 'wrong' | null, done: boolean }} Progress */
/** @typedef {{ tryOne: string, tryMany: string, hintNone: string, hintOne: string, hintMany: string, firstSolved: string, firstShown: string, followUpRight: string, followUpWrong: string, summary: string }} SummaryStrings */

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

/** Options with unique ids and a correct one among them. Returns the ids.
 * @param {unknown} options @param {unknown} correct @param {string} path @param {number} least @param {string[]} allowed */
function choices(options, correct, path, least, allowed) {
  if (!Array.isArray(options) || options.length < least || options.length > 4) throw new Error(`Invalid ${path}options: write ${least} to 4`);
  const ids = new Set();
  options.forEach((option, index) => {
    const at = `${path}options[${index}]`;
    if (!object(option)) throw new Error(`Invalid ${at}`);
    fields(option, allowed, at);
    text(option.id, `${at}.id`); text(option.text, `${at}.text`);
    if (!/^[a-zA-Z0-9_-]+$/.test(option.id) || ids.has(option.id)) throw new Error(`Invalid ${at}.id`);
    ids.add(option.id);
  });
  if (typeof correct !== 'string' || !ids.has(correct)) throw new Error(`Invalid ${path}correct`);
}

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  validateTextLengths(content, {
    title: 120, context: 600, question: 400, correct: 120, worked: 600, hints: [400],
    options: [{ id: 120, text: 300, feedback: 600 }],
    followUp: { question: 400, correct: 120, explanation: 600, options: [{ id: 120, text: 300 }] }
  });
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['title', 'context', 'question', 'options', 'correct', 'hints', 'worked', 'followUp'], 'content');
  for (const field of ['title', 'question', 'worked']) text(content[field], field);
  if (Object.hasOwn(content, 'context')) text(content.context, 'context');
  // Three options leave a second try after a wrong answer; two would end the question on the first.
  choices(content.options, content.correct, '', 3, ['id', 'text', 'feedback']);
  /** @type {Record<string, unknown>[]} */ (content.options).forEach((option, index) => {
    const path = `options[${index}].feedback`;
    // The worked answer explains the correct option, so a reason there would never be shown.
    if (option.id === content.correct) { if (Object.hasOwn(option, 'feedback')) throw new Error(`Invalid ${path}: the correct option takes none`); }
    else text(option.feedback, path);
  });
  if (!Array.isArray(content.hints) || content.hints.length < 1 || content.hints.length > 3) throw new Error('Invalid hints: write one to three');
  content.hints.forEach((hint, index) => text(hint, `hints[${index}]`));
  const followUp = content.followUp;
  if (!object(followUp)) throw new Error('Invalid followUp');
  fields(followUp, ['question', 'options', 'correct', 'explanation'], 'followUp');
  for (const field of ['question', 'explanation']) text(followUp[field], `followUp.${field}`);
  choices(followUp.options, followUp.correct, 'followUp.', 2, ['id', 'text']);
}

/** @returns {LearnerState} */
export function start() {
  return { tries: [], opened: 0, followUp: null };
}

/** Where the learner is. The first question ends when they answer it (`solved`) or when its worked
 * answer shows (`shown`): they opened it, or only the correct option was left to try.
 * @param {Content} content @param {LearnerState} state @returns {Progress} */
export function progress(content, state) {
  const solved = state.tries.at(-1) === content.correct;
  const first = solved ? 'solved' : state.opened > content.hints.length || state.tries.length === content.options.length - 1 ? 'shown' : 'open';
  const open = first === 'open';
  return {
    first,
    tries: state.tries.length,
    hints: Math.min(state.opened, content.hints.length),
    next: !open ? null : state.opened < content.hints.length ? 'hint' : 'worked',
    // The worked answer waits for one checked answer, so nobody reads it before trying.
    gated: open && state.opened === content.hints.length && state.tries.length === 0,
    followUp: state.followUp === null ? null : state.followUp === content.followUp.correct ? 'right' : 'wrong',
    done: state.followUp !== null
  };
}

/** Check an option on the first question. A checked option cannot be checked again.
 * @param {Content} content @param {LearnerState} state @param {string} option @returns {LearnerState} */
export function tryFirst(content, state, option) {
  if (progress(content, state).first !== 'open') throw new Error('The first question is closed');
  if (!content.options.some(o => o.id === option) || state.tries.includes(option)) throw new Error('Invalid try');
  return { ...state, tries: [...state.tries, option] };
}

/** Open the next help step: a hint, or the worked answer once every hint is open.
 * @param {Content} content @param {LearnerState} state @returns {LearnerState} */
export function openHelp(content, state) {
  const { next, gated } = progress(content, state);
  if (!next) throw new Error('The first question is closed');
  if (gated) throw new Error('The worked answer opens after one checked answer');
  return { ...state, tries: [...state.tries], opened: state.opened + 1 };
}

/** Check the question without hints. It takes one answer.
 * @param {Content} content @param {LearnerState} state @param {string} option @returns {LearnerState} */
export function tryFollowUp(content, state, option) {
  const { first, done } = progress(content, state);
  if (first === 'open' || done) throw new Error('The follow-up question is not open');
  if (!content.followUp.options.some(o => o.id === option)) throw new Error('Invalid follow-up answer');
  return { ...state, tries: [...state.tries], followUp: option };
}

/** Ignore invalid saved values and copy valid state. A value is valid when the learner's own steps
 * could have produced it.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content, value) {
  if (!object(value) || Object.keys(value).length !== 3 || !Array.isArray(value.tries)
    || !Number.isInteger(value.opened) || !(value.followUp === null || typeof value.followUp === 'string')) return null;
  const opened = /** @type {number} */ (value.opened), hints = content.hints.length;
  if (opened < 0 || opened > hints + 1) return null;
  try {
    // The order of tries and hints is not saved. Hints open at any time and the worked answer
    // needs a try, so this order replays every state the page can reach.
    let state = start();
    for (let n = 0; n < Math.min(opened, hints); n++) state = openHelp(content, state);
    for (const option of value.tries) state = tryFirst(content, state, option);
    if (opened > hints) state = openHelp(content, state);
    return value.followUp === null ? state : tryFollowUp(content, state, value.followUp);
  } catch { return null; }
}

/** The closing sentence: how the first question went, then the one without hints.
 * @param {Content} content @param {LearnerState} state @param {SummaryStrings} strings */
export function summarize(content, state, strings) {
  const { first, tries, hints, followUp, done } = progress(content, state);
  if (!done) throw new Error('No summary before the follow-up question is checked');
  return format(strings.summary, {
    first: format(first === 'solved' ? strings.firstSolved : strings.firstShown, {
      tries: tries === 1 ? strings.tryOne : format(strings.tryMany, { count: tries }),
      hints: hints === 0 ? strings.hintNone : hints === 1 ? strings.hintOne : format(strings.hintMany, { count: hints })
    }),
    followUp: followUp === 'right' ? strings.followUpRight : strings.followUpWrong
  });
}

/** Replace authored placeholders in a single pass so inserted content stays literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token);
}
