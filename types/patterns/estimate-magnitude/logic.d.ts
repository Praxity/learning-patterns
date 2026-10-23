/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** Each band starts at a stop and reaches the furthest stop within ten times it.
 * Tolerate floating-point rounding at exact tens, such as 0.003 / 0.0003 > 10.
 * @param {number[]} stops @returns {[number, number][]}
 */
export function bandsFor(stops: number[]): [number, number][];
/** Integer stops at 1 and 5 in each power of ten. Every generated band spans exactly 10x.
 * @param {Content} content
 */
export function scaleFor(content: Content): {
    stops: number[];
    bands: [number, number][];
    start: number;
};
/** Log positions keep every tenfold band the same width, including between 1 and 5.
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
    questions: Question[];
};
export type LearnerState = {
    ranges: number[];
    touched: boolean[];
    shown: boolean;
};
