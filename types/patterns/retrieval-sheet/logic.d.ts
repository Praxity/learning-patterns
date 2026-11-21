/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @param {unknown} value @returns {value is string} */
export function isDate(value: unknown): value is string;
/** @param {unknown} value @returns {boolean} */
export function isPartialYear(value: unknown): boolean;
/** @param {Date} today @returns {string} YYYY-MM-DD. */
export function defaultDate(today: Date): string;
/** @param {Date} today @param {number} days @returns {string} YYYY-MM-DD. */
export function dateAfterDays(today: Date, days: number): string;
/** @param {string} date @param {string} lang @returns {string} */
export function formatDate(date: string, lang: string): string;
/** @param {string} date @param {string} lang @returns {string} */
export function formatShortDate(date: string, lang: string): string;
/** @param {unknown} value @returns {LearnerState | null} */
export function validateState(value: unknown): LearnerState | null;
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
