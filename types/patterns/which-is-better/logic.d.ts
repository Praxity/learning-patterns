/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** The right pick for a quality. @param {Content} content @param {number} index @returns {Pick} */
export function answer(content: Content, index: number): Pick;
/** Split a sentence pick into its version and 1-based number, or null for "neither" or anything unknown.
 * @param {Content} content @param {unknown} pick @returns {{ version: Version, sentence: number } | null}
 */
export function sentenceOf(content: Content, pick: unknown): {
    version: Version;
    sentence: number;
} | null;
/** @param {Content} content @param {unknown} pick @returns {pick is Pick} */
export function isPick(content: Content, pick: unknown): pick is Pick;
/** A pick's name: the version a sentence is in, such as "Version B", or the Neither label.
 * @param {Content} content @param {import('./strings.js').Strings} strings @param {string} pick
 */
export function pickName(content: Content, strings: import("./strings.js").Strings, pick: string): string;
/** The right answer as one line ending in punctuation, such as "Correct answer, in Version B: For an
 * urgent order, call …", or "Correct answer: Neither version does this."
 * @param {Content} content @param {import('./strings.js').Strings} strings @param {number} index
 */
export function answerText(content: Content, strings: import("./strings.js").Strings, index: number): string;
/** Score checked picks, in question order.
 * @param {Content} content @param {Pick[]} picks
 */
export function score(content: Content, picks: Pick[]): {
    results: boolean[];
    right: number;
    total: number;
    done: boolean;
};
/** The better version's body, paragraph by paragraph, each sentence with the note of the quality it
 * shows, then the notes of the qualities neither version has.
 * @param {Content} content
 */
export function summary(content: Content): {
    version: Version;
    paragraphs: {
        text: string;
        note: string | null;
    }[][];
    missing: string[];
};
/** Ignore invalid saved values and copy valid state. `at` is the open question, or the number of
 * questions once the summary shows. Every question before `at` is checked; `at` itself may be.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** Replace authored placeholders in a single pass so inserted content stays literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template: string, values: Record<string, string | number>): string;
/** @typedef {'a' | 'b'} Version */
/** @typedef {{ question: string, sentence: number | null, reason: string, note: string }} Quality */
/** An email: its body is paragraphs of sentences, and only body sentences can be picked.
 * @typedef {{ subject: string, greeting: string, body: string[][], signoff: string }} Email */
/** @typedef {{ title: string, context: string, versions: { a: Email, b: Email }, better: Version, qualities: Quality[] }} Content */
/** A pick is a sentence written as its version and number, such as "b2", or "neither". @typedef {string} Pick */
/** @typedef {{ at: number, picks: Pick[] }} LearnerState */
export const NEITHER: "neither";
export type Version = "a" | "b";
export type Quality = {
    question: string;
    sentence: number | null;
    reason: string;
    note: string;
};
/**
 * An email: its body is paragraphs of sentences, and only body sentences can be picked.
 */
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
/**
 * A pick is a sentence written as its version and number, such as "b2", or "neither".
 */
export type Pick = string;
export type LearnerState = {
    at: number;
    picks: Pick[];
};
