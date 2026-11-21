/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @param {string} template @param {Record<string, string | number>} values */
export function format(template: string, values: Record<string, string | number>): string;
/** @param {Content} content @param {StepName} step @param {string} id
 * @returns {{ ok: true, text: string } | { ok: false, reason: string }} */
export function choose(content: Content, step: StepName, id: string): {
    ok: true;
    text: string;
} | {
    ok: false;
    reason: string;
};
/** @returns {LearnerState} */
export function emptyState(): LearnerState;
/** @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** @param {Content} content @param {{ whenStem: string, soFar: string, plan: string }} strings
 * @param {Pick<LearnerState, 'when' | 'will'>} state */
export function sentence(content: Content, strings: {
    whenStem: string;
    soFar: string;
    plan: string;
}, state: Pick<LearnerState, "when" | "will">): string;
/** @param {number} start Milliseconds since the epoch; NaN for an empty or unreadable field.
 * @param {number} now
 * @returns {'invalid' | 'past' | null} */
export function startError(start: number, now: number): "invalid" | "past" | null;
/** @param {{ plan: string, note: string, start: number, now: number, uid: string }} event
 * @returns {string} */
export function calendarFile({ plan, note, start, now, uid }: {
    plan: string;
    note: string;
    start: number;
    now: number;
    uid: string;
}): string;
/** @typedef {{ id: string, text: string, vague?: string }} Option */
/** @typedef {{ options: Option[] }} Step */
/** @typedef {{ title: string, context: string, when: Step, will: Step, dateLabel: string }} Content */
/** @typedef {{ when: string | null, will: string | null, start: string }} LearnerState */
/** @typedef {'when' | 'will'} StepName */
export const REMINDER_MINUTES: 10;
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
export type LearnerState = {
    when: string | null;
    will: string | null;
    start: string;
};
export type StepName = "when" | "will";
