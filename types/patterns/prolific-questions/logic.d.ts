/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** Shuffle a copy; the injected random source makes deal rules reproducible.
 * @template T @param {T[]} values @param {() => number} [random] @returns {T[]} */
export function shuffle<T>(values: T[], random?: () => number): T[];
/** Every case once before any repeats; a new round never starts with the case just shown.
 * @param {number} caseCount @param {Deck} [previous] @param {() => number} [random] @returns {Deck} */
export function deal(caseCount: number, previous?: Deck, random?: () => number): Deck;
/** Compare each displayed fact's part with the learner's choice. Null means unanswered.
 * @param {number[]} order @param {(number | null)[]} picks */
export function score(order: number[], picks: (number | null)[]): {
    right: number;
    total: number;
    unanswered: number[];
};
/** Ignore invalid saved values and copy valid arrays. Counts include the current set only when checked.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null} */
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
