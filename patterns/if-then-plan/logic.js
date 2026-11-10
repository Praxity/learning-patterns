import { validateTextLengths } from '../../lib/text-limits.js';

/** An option with `vague` is too vague to plan with; `vague` is the reason shown when it is chosen.
 * @typedef {{ id: string, text: string, vague?: string }} Option */
/** @typedef {{ options: Option[] }} Step */
/** @typedef {{ title: string, context: string, when: Step, will: Step, dateLabel: string }} Content */
/** `when` and `will` hold the ids of accepted options; `start` is the date field's value.
 * @typedef {{ when: string | null, will: string | null, start: string }} LearnerState */
/** @typedef {'when' | 'will'} StepName */

/** The calendar entry starts this long before the time the learner sets, and ends at it. */
export const REMINDER_MINUTES = 10;
const STEPS = /** @type {const} */ (['when', 'will']);
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/;

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
/** @param {unknown} value */
const text = value => typeof value === 'string' && value.trim().length > 0;

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  if (!object(content)) throw new Error('Invalid content');
  for (const key of Object.keys(content)) if (!['title', 'context', 'when', 'will', 'dateLabel'].includes(key)) throw new Error(`Invalid ${key}`);
  const option = { id: 120, text: 300, vague: 400 };
  validateTextLengths(content, { title: 120, context: 400, dateLabel: 120, when: { options: [option] }, will: { options: [option] } });
  for (const key of ['title', 'context', 'dateLabel']) if (!text(content[key])) throw new Error(`Invalid ${key}`);
  for (const name of STEPS) {
    const step = content[name];
    if (!object(step) || Object.keys(step).some(key => key !== 'options')) throw new Error(`Invalid ${name}`);
    const options = step.options;
    if (!Array.isArray(options) || options.length < 3 || options.length > 5) throw new Error(`Invalid ${name}.options: three to five options`);
    const ids = new Set();
    options.forEach((item, index) => {
      const path = `${name}.options[${index}]`;
      if (!object(item)) throw new Error(`Invalid ${path}`);
      for (const key of Object.keys(item)) if (!['id', 'text', 'vague'].includes(key)) throw new Error(`Invalid ${path}.${key}`);
      if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.id) || ids.has(item.id)) throw new Error(`Invalid ${path}.id`);
      if (!text(item.text)) throw new Error(`Invalid ${path}.text`);
      if ('vague' in item && !text(item.vague)) throw new Error(`Invalid ${path}.vague`);
      ids.add(item.id);
    });
    // With one concrete option the step would have a single right answer, and the plan would not be the learner's.
    if (options.filter(item => !('vague' in item)).length < 2) throw new Error(`Invalid ${name}.options: at least two options without vague`);
  }
}

/** Placeholder substitution that keeps inserted text literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
}

/** What choosing an option does: a concrete one joins the plan, a vague one returns its reason.
 * @param {Content} content @param {StepName} step @param {string} id
 * @returns {{ ok: true, text: string } | { ok: false, reason: string }}
 */
export function choose(content, step, id) {
  const option = content[step].options.find(item => item.id === id);
  if (!option) throw new Error(`Unknown ${step} option`);
  return option.vague === undefined ? { ok: true, text: option.text } : { ok: false, reason: option.vague };
}

/** @returns {LearnerState} */
export function emptyState() {
  return { when: null, will: null, start: '' };
}

/** Return a copy, or null for damaged host state.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content, value) {
  if (!object(value) || Object.keys(value).some(key => !['when', 'will', 'start'].includes(key))) return null;
  const { when, will, start } = value;
  for (const [name, id] of /** @type {const} */ ([['when', when], ['will', will]])) {
    if (id === null) continue;
    if (typeof id !== 'string' || !content[name].options.some(item => item.id === id && item.vague === undefined)) return null;
  }
  if (will !== null && when === null) return null;
  if (typeof start !== 'string' || (start !== '' && (will === null || !LOCAL_TIME.test(start) || Number.isNaN(Date.parse(start))))) return null;
  return { when: /** @type {string | null} */ (when), will: /** @type {string | null} */ (will), start };
}

/** The sentence as far as the learner has built it: the opening stem, the moment with the
 * second stem, or the whole plan.
 * @param {Content} content @param {{ whenStem: string, soFar: string, plan: string }} strings
 * @param {Pick<LearnerState, 'when' | 'will'>} state
 */
export function sentence(content, strings, state) {
  if (state.when === null) return strings.whenStem;
  const when = choose(content, 'when', state.when);
  if (!when.ok) throw new Error('Invalid when');
  if (state.will === null) return format(strings.soFar, { when: when.text });
  const will = choose(content, 'will', state.will);
  if (!will.ok) throw new Error('Invalid will');
  return format(strings.plan, { when: when.text, will: will.text });
}

/** Why a start time cannot go in a calendar, or null when it can.
 * @param {number} start Milliseconds since the epoch; NaN for an empty or unreadable field.
 * @param {number} now
 * @returns {'invalid' | 'past' | null}
 */
export function startError(start, now) {
  if (!Number.isFinite(start)) return 'invalid';
  return start <= now ? 'past' : null;
}

/** RFC 5545 TEXT (section 3.3.11): escape backslash, semicolon and comma, write every line break as
 * an escaped n, and turn the other control characters, which TEXT does not allow, into spaces.
 * @param {string} value */
const escapeText = value => value.replace(/[\\;,]/g, '\\$&').replace(/\r\n|\r|\n/g, '\\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ' ');
/** UTC date-time, so the entry lands on the same instant whatever zone the calendar is in.
 * @param {number} time */
const utc = time => new Date(time).toISOString().replace(/[-:]|\.\d{3}/g, '');
/** Fold at 75 octets without splitting a character, as RFC 5545 section 3.1 requires.
 * A fold may fall inside an escape; readers unfold before they unescape.
 * @param {string} line */
function fold(line) {
  let out = '', octets = 0;
  for (const character of line) {
    const point = /** @type {number} */ (character.codePointAt(0));
    const size = point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    if (octets + size > 75) { out += '\r\n '; octets = 1; }
    out += character; octets += size;
  }
  return out;
}

/** An iCalendar file with one entry that shows the plan just before the moment it is for.
 * The entry starts REMINDER_MINUTES before `start`, ends at `start` and raises a notice when it begins.
 * @param {{ plan: string, note: string, start: number, now: number, uid: string }} event
 * `plan` is the entry's title, `note` follows it in the description, and `uid` must be unique per file.
 * @returns {string}
 */
export function calendarFile({ plan, note, start, now, uid }) {
  const problem = startError(start, now);
  if (problem) throw new Error(`Invalid start: ${problem}`);
  if (!text(plan) || !text(uid) || typeof note !== 'string') throw new Error('Invalid event');
  const summary = escapeText(plan);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Praxity//Learning patterns: if-then plan//EN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${escapeText(uid)}`, `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(start - REMINDER_MINUTES * 60000)}`, `DTEND:${utc(start)}`,
    `SUMMARY:${summary}`, `DESCRIPTION:${escapeText(note ? `${plan}\n\n${note}` : plan)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${summary}`, 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ].map(fold).join('\r\n') + '\r\n';
}
