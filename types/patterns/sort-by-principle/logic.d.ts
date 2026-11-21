/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @param {Content} content @param {number} index @param {string} pick @returns {Feedback} */
export function feedback(content: Content, index: number, pick: string): Feedback;
/** @param {Content} content @param {string[]} picks Checked cases, in case order. */
export function score(content: Content, picks: string[]): {
    results: boolean[];
    right: number;
    total: number;
    done: boolean;
};
/** @param {Content} content @param {string[]} picks @returns {Pair[]} */
export function mixedPairs(content: Content, picks: string[]): Pair[];
/** @param {Content} content @param {string} value @returns {Part[]} */
export function quoteParts(content: Content, value: string): Part[];
/** @param {Content} content @param {string} id */
export function principleName(content: Content, id: string): string;
/** @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** @param {string} template @param {Record<string, string | number>} values */
export function format(template: string, values: Record<string, string | number>): string;
export type Principle = {
    id: string;
    name: string;
    rule: string;
};
export type Case = {
    text: string;
    correct: string;
    lure: string;
    looksLike: string;
    decides: string;
};
export type Content = {
    title: string;
    context?: string;
    question: string;
    principles: Principle[];
    cases: Case[];
};
export type Feedback = {
    right: boolean;
    correct: string;
    looksLike: string | null;
    decides: string;
};
export type Pair = {
    first: string;
    second: string;
    count: number;
};
export type Part = {
    text: string;
    principle: boolean;
};
export type LearnerState = {
    picks: string[];
};
