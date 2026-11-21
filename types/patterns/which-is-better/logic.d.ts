/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @param {Content} content @param {number} index @returns {Pick} */
export function answer(content: Content, index: number): Pick;
/** @param {Content} content @param {unknown} pick @returns {{ version: Version, sentence: number } | null} */
export function sentenceOf(content: Content, pick: unknown): {
    version: Version;
    sentence: number;
} | null;
/** @param {Content} content @param {unknown} pick @returns {pick is Pick} */
export function isPick(content: Content, pick: unknown): pick is Pick;
/** @param {Content} content @param {import('./strings.js').Strings} strings @param {string} pick */
export function pickName(content: Content, strings: import("./strings.js").Strings, pick: string): string;
/** @param {Content} content @param {import('./strings.js').Strings} strings @param {number} index */
export function answerText(content: Content, strings: import("./strings.js").Strings, index: number): string;
/** @param {Content} content @param {Pick[]} picks */
export function score(content: Content, picks: Pick[]): {
    results: boolean[];
    right: number;
    total: number;
    done: boolean;
};
/** @param {Content} content */
export function summary(content: Content): {
    version: Version;
    paragraphs: {
        text: string;
        note: string | null;
    }[][];
    missing: string[];
};
/** @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** @param {string} template @param {Record<string, string | number>} values */
export function format(template: string, values: Record<string, string | number>): string;
/** @typedef {'a' | 'b'} Version */
/** @typedef {{ question: string, sentence: number | null, reason: string, note: string }} Quality */
/** @typedef {{ subject: string, greeting: string, body: string[][], signoff: string }} Email */
/** @typedef {{ title: string, context: string, versions: { a: Email, b: Email }, better: Version, qualities: Quality[] }} Content */
/** @typedef {string} Pick */
/** @typedef {{ at: number, picks: Pick[] }} LearnerState */
export const NEITHER: "neither";
export type Version = "a" | "b";
export type Quality = {
    question: string;
    sentence: number | null;
    reason: string;
    note: string;
};
export type Email = {
    subject: string;
    greeting: string;
    body: string[][];
    signoff: string;
};
export type Content = {
    title: string;
    context: string;
    versions: {
        a: Email;
        b: Email;
    };
    better: Version;
    qualities: Quality[];
};
export type Pick = string;
export type LearnerState = {
    at: number;
    picks: Pick[];
};
