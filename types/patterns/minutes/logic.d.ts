/** Narration runs during reading. Round up only after adding question time.
 * @param {number} words @param {number} questions @param {number} narrationSeconds
 * @param {Rates} [rates] @returns {number} Whole minutes, including zero for empty content.
 */
export function estimateMinutes(words: number, questions: number, narrationSeconds: number, rates?: Rates): number;
/** @param {number} minutes @returns {boolean} */
export function overLimit(minutes: number): boolean;
/** @param {string} text @returns {number | null} */
export function parseCount(text: string): number | null;
/** Validate plain authored content and name the first bad field.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content: unknown): asserts content is Content;
/** @param {Content} content
 * @returns {{ sections: { id: string, minutes: number, overLimit: boolean }[], total: number }}
 */
export function courseEstimate(content: Content): {
    sections: {
        id: string;
        minutes: number;
        overLimit: boolean;
    }[];
    total: number;
};
/** Ignore invalid snapshots as a whole; copy valid counts so the host cannot mutate them.
 * @param {Content} content @param {unknown} value @returns {AuthorState | null}
 */
export function validateState(content: Content, value: unknown): AuthorState | null;
/** @typedef {{ words: number, questions: number, narrationSeconds: number }} Counts */
/** @typedef {{ readingWordsPerMinute: number, minutesPerQuestion: number }} Rates */
/** @typedef {Counts & { id: string, title: string }} Section */
/** @typedef {{ title: string, rates: Rates, sections: Section[] }} Content */
/** @typedef {{ authorView: boolean, sections: Record<string, Counts> }} AuthorState */
export const RATES: Readonly<{
    readingWordsPerMinute: 200;
    minutesPerQuestion: 0.75;
}>;
export const LIMIT_MINUTES: 15;
/** @type {ReadonlyArray<keyof Counts>} */
export const COUNT_FIELDS: ReadonlyArray<keyof Counts>;
export type Counts = {
    words: number;
    questions: number;
    narrationSeconds: number;
};
export type Rates = {
    readingWordsPerMinute: number;
    minutesPerQuestion: number;
};
export type Section = Counts & {
    id: string;
    title: string;
};
export type Content = {
    title: string;
    rates: Rates;
    sections: Section[];
};
export type AuthorState = {
    authorView: boolean;
    sections: Record<string, Counts>;
};
