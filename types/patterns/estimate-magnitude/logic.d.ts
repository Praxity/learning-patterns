/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** Each band starts at a stop and reaches the furthest stop within the ratio.
 * @param {number[]} stops @param {number} [ratio] @returns {[number, number][]}
 */
export function bandsFor(stops: number[], ratio?: number): [number, number][];
/** Integer stops at 1 and 5 in each power of ten. Every generated band spans the ratio.
 * @param {Content} content
 */
export function scaleFor(content: Content): {
    stops: number[];
    bands: [number, number][];
    start: number;
    ratio: number;
};
/** Log positions keep every band the same width, including between 1 and 5.
 * @param {number} value @param {number[]} stops @returns {number} Percentage along the scale.
 */
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
/** Ignore invalid host state and return independent arrays for valid state.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
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
