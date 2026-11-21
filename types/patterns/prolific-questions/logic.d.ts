/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @template T @param {T[]} values @param {() => number} [random] @returns {T[]} */
export function shuffle<T>(values: T[], random?: () => number): T[];
/** @param {number} caseCount @param {Deck} [previous] @param {() => number} [random] @returns {Deck} */
export function deal(caseCount: number, previous?: Deck, random?: () => number): Deck;
/** @param {number[]} order @param {(number | null)[]} picks */
export function score(order: number[], picks: (number | null)[]): {
    right: number;
    total: number;
    unanswered: number[];
};
/** @param {import('./strings.js').Strings} strings
 * @param {{ right: number, total: number, completed: number, placed: number }} counts */
export function feedback(strings: import("./strings.js").Strings, { right, total, completed, placed }: {
    right: number;
    total: number;
    completed: number;
    placed: number;
}): {
    summary: string;
    announcement: string;
};
/** @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
export type Part = {
    label: string;
    definition: string;
};
export type Content = {
    title: string;
    context: string;
    question: string;
    parts: Part[];
    workedExample: string[];
    cases: string[][];
};
export type Deck = {
    deck: number[];
    last: number;
};
export type LearnerState = Deck & {
    order: number[];
    picks: (number | null)[];
    checked: boolean;
    completed: number;
    placed: number;
};
