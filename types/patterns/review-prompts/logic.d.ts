/** Validate authored plain text. Empty strings are rejected; whitespace is allowed.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content: unknown): asserts content is Content;
/** Estimate reading time from all authored text, excluding interface labels.
 * @param {Content} content @returns {number} Whole minutes, at least one.
 */
export function readingMinutes(content: Content): number;
/** Local calendar date for the datetime attribute and host state.
 * @param {Date} date @returns {string}
 */
export function isoDate(date: Date): string;
/** Returns a new date at local midnight after the configured calendar days.
 * @param {Date} date @param {Result} choice @param {ReviewDays} [reviewDays]
 * @returns {Date}
 */
export function scheduleReview(date: Date, choice: Result, reviewDays?: ReviewDays): Date;
/** Ignore invalid host state and copy valid records. Dates are civil dates, not timestamps.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** @typedef {'remembered' | 'forgot'} Result */
/** @typedef {{ remembered: number, forgot: number }} ReviewDays */
/** @typedef {{ id: string, heading: string, paragraphs: string[], question: string, answer: string }} Part */
/** @typedef {{ title: string, parts: Part[], reviewDays: ReviewDays }} Content */
/** @typedef {{ result: Result, reviewOn: string }} Review */
/** @typedef {{ results: Record<string, Review> }} LearnerState */
export const REVIEW_DAYS: Readonly<{
    remembered: 3;
    forgot: 1;
}>;
export type Result = "remembered" | "forgot";
export type ReviewDays = {
    remembered: number;
    forgot: number;
};
export type Part = {
    id: string;
    heading: string;
    paragraphs: string[];
    question: string;
    answer: string;
};
export type Content = {
    title: string;
    parts: Part[];
    reviewDays: ReviewDays;
};
export type Review = {
    result: Result;
    reviewOn: string;
};
export type LearnerState = {
    results: Record<string, Review>;
};
