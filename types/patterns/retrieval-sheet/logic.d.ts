/** Validate authored plain text. Whitespace is allowed; empty strings are rejected.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content: unknown): asserts content is Content;
/** Valid civil date in the native date input's supported range, years 0001 to 9999.
 * @param {unknown} value @returns {value is string}
 */
export function isDate(value: unknown): value is string;
/** Whether a date field value is a year still being typed. Chrome reports each partial year as a
 * valid date while the learner types it digit by digit (0002, 0020, 0202), so those aren't dates yet.
 * @param {unknown} value @returns {boolean}
 */
export function isPartialYear(value: unknown): boolean;
/** Seven local calendar days ahead, without changing the source date.
 * @param {Date} today @returns {string} YYYY-MM-DD.
 */
export function defaultDate(today: Date): string;
/** Count civil days from today's local date using UTC arithmetic, without changing today.
 * @param {Date} today @param {number} days @returns {string} YYYY-MM-DD.
 */
export function dateAfterDays(today: Date, days: number): string;
/** Format a civil date without shifting its day when the learner changes time zones.
 * @param {string} date @param {string} lang @returns {string}
 */
export function formatDate(date: string, lang: string): string;
/** Short weekday and date, preserving the civil day across time zones.
 * @param {string} date @param {string} lang @returns {string}
 */
export function formatShortDate(date: string, lang: string): string;
/** Ignore invalid host state as a whole; copy valid values, including past dates.
 * @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(value: unknown): LearnerState | null;
/** Spacing choices in civil days. */
export const presetDays: number[];
export type Question = {
    id: string;
    question: string;
    answer: string;
};
export type Content = {
    title: string;
    questions: Question[];
};
export type Side = "front" | "back";
export type LearnerState = {
    date: string;
    side: Side;
};
