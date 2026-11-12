import { validateTextLengths } from '../../lib/text-limits.js';
/** @typedef {{ label: string, value: string }} Check */
/** @typedef {{ id: string, text: string, correct: boolean, stops?: true, feedback: string }} Step */
/** @typedef {{ title: string, summary: string, checks: Check[], held: string, approved: string, stopped: string, notStopped: string, steps: Step[] }} Request */
/** @typedef {{ name: string, title: string, summary: string, checks: Check[], approved: string, stopped: string, notStopped: string, steps: Step[] }} Colleague */
/** @typedef {{ title: string, context: string, request: Request, colleague: Colleague }} Content */
/** @typedef {'approve' | 'hold'} Decision */
/** `decision` holds the choice on the request. `steps` holds the step ids checked on the request and
 * on the colleague's payment, or null where no recovery was checked.
 * @typedef {{ decision: Decision | null, steps: (string[] | null)[] }} LearnerState */
/** What each payment's status line says, or null while it is not on screen.
 * @typedef {'pending' | 'held' | 'approved' | 'stopped' | 'notStopped' | null} Status */
/** @typedef {{ stage: 'decide' | 'recover' | 'done', item: 0 | 1 | null, statuses: Status[] }} Progress */
/** @typedef {{ approvedStopped: string, approvedGoes: string, heldStopped: string, heldGoes: string }} SummaryStrings */

const ITEM = ['title', 'summary', 'checks', 'approved', 'stopped', 'notStopped', 'steps'];

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

/** A request or the colleague's payment: its record, its status lines and its recovery steps.
 * @param {unknown} item @param {string} path @param {string[]} allowed */
function payment(item, path, allowed) {
  if (!object(item)) throw new Error(`Invalid ${path}`);
  fields(item, allowed, path);
  for (const field of allowed) if (field !== 'checks' && field !== 'steps') text(item[field], `${path}.${field}`);
  const { checks, steps } = item;
  if (!Array.isArray(checks) || checks.length < 2 || checks.length > 4) throw new Error(`Invalid ${path}.checks: write 2 to 4`);
  checks.forEach((check, n) => {
    const at = `${path}.checks[${n}]`;
    if (!object(check)) throw new Error(`Invalid ${at}`);
    fields(check, ['label', 'value'], at);
    text(check.label, `${at}.label`); text(check.value, `${at}.value`);
  });
  if (!Array.isArray(steps) || steps.length < 3 || steps.length > 5) throw new Error(`Invalid ${path}.steps: write 3 to 5`);
  const ids = new Set();
  steps.forEach((step, n) => {
    const at = `${path}.steps[${n}]`;
    if (!object(step)) throw new Error(`Invalid ${at}`);
    fields(step, ['id', 'text', 'correct', 'stops', 'feedback'], at);
    text(step.id, `${at}.id`); text(step.text, `${at}.text`); text(step.feedback, `${at}.feedback`);
    if (!/^[a-zA-Z0-9_-]+$/.test(step.id) || ids.has(step.id)) throw new Error(`Invalid ${at}.id`);
    ids.add(step.id);
    if (typeof step.correct !== 'boolean') throw new Error(`Invalid ${at}.correct`);
    if (Object.hasOwn(step, 'stops') && step.stops !== true) throw new Error(`Invalid ${at}.stops`);
  });
  // The status line changes when the learner chooses the one step that stops the harm, so there is
  // exactly one and it is correct. A list with every step correct, or none, is not a choice.
  const stopping = steps.filter(step => step.stops);
  if (stopping.length !== 1 || !stopping[0].correct) throw new Error(`Invalid ${path}.steps: mark one correct step with stops`);
  if (!steps.some(step => step.correct) || steps.every(step => step.correct)) throw new Error(`Invalid ${path}.steps: write a correct and an incorrect step`);
}

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  const item = { title: 120, summary: 300, held: 300, approved: 300, stopped: 300, notStopped: 300, checks: [{ label: 60, value: 200 }], steps: [{ id: 120, text: 200, feedback: 300 }] };
  validateTextLengths(content, { title: 120, context: 400, request: item, colleague: { ...item, name: 60 } });
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['title', 'context', 'request', 'colleague'], 'content');
  text(content.title, 'title'); text(content.context, 'context');
  payment(content.request, 'request', [...ITEM, 'held']);
  payment(content.colleague, 'colleague', [...ITEM, 'name']);
}

/** @returns {LearnerState} */
export function start() {
  return { decision: null, steps: [null, null] };
}

/** Where the learner is, and what each payment's status line says. Approving opens the request's
 * recovery; holding it opens the colleague's payment, so every learner recovers once.
 * @param {Content} content @param {LearnerState} state @returns {Progress} */
export function progress(content, state) {
  if (state.decision === null) return { stage: 'decide', item: 0, statuses: ['pending', null] };
  const item = state.decision === 'approve' ? 0 : 1;
  /** @type {Status[]} */
  const statuses = [item ? 'held' : null, null];
  const checked = state.steps[item];
  if (checked === null) { statuses[item] = 'approved'; return { stage: 'recover', item, statuses }; }
  const stop = (item ? content.colleague : content.request).steps.find(step => step.stops)?.id;
  statuses[item] = checked.includes(stop ?? '') ? 'stopped' : 'notStopped';
  return { stage: 'done', item: null, statuses };
}

/** Approve or hold the request.
 * @param {Content} content @param {LearnerState} state @param {Decision} decision @returns {LearnerState} */
export function decide(content, state, decision) {
  if (progress(content, state).stage !== 'decide') throw new Error('This request is not open');
  if (decision !== 'approve' && decision !== 'hold') throw new Error('Invalid decision');
  return { decision, steps: [...state.steps] };
}

/** Check the recovery steps chosen for the payment that is open. Recovery is checked once.
 * @param {Content} content @param {LearnerState} state @param {0 | 1} item @param {string[]} ids @returns {LearnerState} */
export function recover(content, state, item, ids) {
  const now = progress(content, state);
  if (now.stage !== 'recover' || now.item !== item) throw new Error('This recovery is not open');
  const known = (item ? content.colleague : content.request).steps.map(step => step.id);
  if (!Array.isArray(ids) || ids.length === 0 || new Set(ids).size !== ids.length || ids.some(id => !known.includes(id))) throw new Error('Invalid steps');
  const steps = [...state.steps];
  steps[item] = [...ids];
  return { decision: state.decision, steps };
}

/** Ignore invalid saved values and copy valid state. A value is valid when the learner's own steps
 * could have produced it.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content, value) {
  if (!object(value) || Object.keys(value).length !== 2 || !Array.isArray(value.steps) || value.steps.length !== 2) return null;
  const { decision, steps } = value;
  try {
    let state = start();
    for (;;) {
      const { stage, item } = progress(content, state);
      if (stage === 'decide' && decision !== null) state = decide(content, state, /** @type {Decision} */ (decision));
      else if (stage === 'recover' && item !== null && steps[item] !== null) state = recover(content, state, item, steps[item]);
      else break;
    }
    // Every saved value must have been replayed; anything left over could not have been reached.
    return JSON.stringify(state) === JSON.stringify({ decision, steps }) ? state : null;
  } catch { return null; }
}

/** The closing sentence: the decision, then whether the payment it put at risk was stopped.
 * @param {Content} content @param {LearnerState} state @param {SummaryStrings} strings */
export function summarize(content, state, strings) {
  const { stage, statuses } = progress(content, state);
  if (stage !== 'done') throw new Error('No summary before the last payment is settled');
  const sentence = state.decision === 'approve'
    ? statuses[0] === 'stopped' ? strings.approvedStopped : strings.approvedGoes
    : statuses[1] === 'stopped' ? strings.heldStopped : strings.heldGoes;
  return format(sentence, { name: content.colleague.name });
}

/** Replace authored placeholders in a single pass so inserted content stays literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token);
}
