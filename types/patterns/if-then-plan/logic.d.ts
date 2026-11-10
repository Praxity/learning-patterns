/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** Placeholder substitution that keeps inserted text literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template: string, values: Record<string, string | number>): string;
/** What choosing an option does: a concrete one joins the plan, a vague one returns its reason.
 * @param {Content} content @param {StepName} step @param {string} id
 * @returns {{ ok: true, text: string } | { ok: false, reason: string }}
 */
export function choose(content: Content, step: StepName, id: string): {
    ok: true;
    text: string;
} | {
    ok: false;
    reason: string;
};
/** @returns {LearnerState} */
export function emptyState(): LearnerState;
/** Return a copy, or null for damaged host state.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** The sentence as far as the learner has built it: the opening stem, the moment with the
 * second stem, or the whole plan.
 * @param {Content} content @param {{ whenStem: string, soFar: string, plan: string }} strings
 * @param {Pick<LearnerState, 'when' | 'will'>} state
 */
export function sentence(content: Content, strings: {
    whenStem: string;
    soFar: string;
    plan: string;
}, state: Pick<LearnerState, "when" | "will">): string;
/** Why a start time cannot go in a calendar, or null when it can.
 * @param {number} start Milliseconds since the epoch; NaN for an empty or unreadable field.
 * @param {number} now
 * @returns {'invalid' | 'past' | null}
 */
export function startError(start: number, now: number): "invalid" | "past" | null;
/** An iCalendar file with one entry that shows the plan just before the moment it is for.
 * The entry starts REMINDER_MINUTES before `start`, ends at `start` and raises a notice when it begins.
 * @param {{ plan: string, note: string, start: number, now: number, uid: string }} event
 * `plan` is the entry's title, `note` follows it in the description, and `uid` must be unique per file.
 * @returns {string}
 */
export function calendarFile({ plan, note, start, now, uid }: {
    plan: string;
    note: string;
    start: number;
    now: number;
    uid: string;
}): string;
/** An option with `vague` is too vague to plan with; `vague` is the reason shown when it is chosen.
 * @typedef {{ id: string, text: string, vague?: string }} Option */
/** @typedef {{ options: Option[] }} Step */
/** @typedef {{ title: string, context: string, when: Step, will: Step, dateLabel: string }} Content */
/** `when` and `will` hold the ids of accepted options; `start` is the date field's value.
 * @typedef {{ when: string | null, will: string | null, start: string }} LearnerState */
/** @typedef {'when' | 'will'} StepName */
/** The calendar entry starts this long before the time the learner sets, and ends at it. */
export const REMINDER_MINUTES: 10;
/**
 * An option with `vague` is too vague to plan with; `vague` is the reason shown when it is chosen.
 */
export type Option = {
    id: string;
    text: string;
    vague?: string;
};
export type Step = {
    options: Option[];
};
export type Content = {
    title: string;
    context: string;
    when: Step;
    will: Step;
    dateLabel: string;
};
/**
 * `when` and `will` hold the ids of accepted options; `start` is the date field's value.
 */
export type LearnerState = {
    when: string | null;
    will: string | null;
    start: string;
};
export type StepName = "when" | "will";
