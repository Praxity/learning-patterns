/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @param {number[]} stops @param {number} [ratio] @returns {[number, number][]} */
export function bandsFor(stops: number[], ratio?: number): [number, number][];
/** @param {Content} content */
export function scaleFor(content: Content): {
    stops: number[];
    bands: [number, number][];
    start: number;
    ratio: number;
};
/** @param {number} value @param {number[]} stops @returns {number} Percentage along the scale. */
export function positionOf(value: number, stops: number[]): number;
/** @param {Content} content @param {number[]} ranges */
export function score(content: Content, ranges: number[]): {
    count: number;
    total: number;
    items: {
        low: number;
        high: number;
        answer: number;
        relation: string;
    }[];
};
/** @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
export type Question = {
    question: string;
    unit: string;
    answer: number;
    source: string;
};
export type Content = {
    title: string;
    context: string;
    ratio?: number;
    questions: Question[];
};
export type LearnerState = {
    ranges: number[];
    touched: boolean[];
    shown: boolean;
};
