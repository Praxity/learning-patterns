/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** Snap pointer input to the authored scale, including its boundaries.
 * @param {Content} content @param {number} value */
export function snap(content: Content, value: number): number;
/** Compare a complete guess with the last known point. No numeric grade is assigned.
 * @param {Content} content @param {number[]} guesses
 * @returns {{ trend: Trend, summary: string, differences: number[] }} */
export function compare(content: Content, guesses: number[]): {
    trend: Trend;
    summary: string;
    differences: number[];
};
/** Ignore invalid saved values and copy valid ones.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** Replace placeholders without interpreting inserted author text.
 * @param {string} template @param {Record<string, string | number>} values */
export function format(template: string, values: Record<string, string | number>): string;
/** @typedef {{ label: string, name: string, value: number }} Point */
/** @typedef {'changedDirection' | 'fell' | 'rose' | 'flat' | 'fellThenFlat' | 'roseThenFlat'} Trend */
/** @typedef {{ title: string, context: string, question: string, unit: string, known: Point[], future: Point[], top: number, step: number, changeLabel: string, realLabel: string, resultTitle: string, explanationLabel: string, explanation: string, source: string, feedback: Record<Trend, string> }} Content */
/** @typedef {{ guesses: (number | null)[], shown: boolean }} LearnerState */
export const trends: readonly ["changedDirection", "fell", "rose", "flat", "fellThenFlat", "roseThenFlat"];
export type Point = {
    label: string;
    name: string;
    value: number;
};
export type Trend = "changedDirection" | "fell" | "rose" | "flat" | "fellThenFlat" | "roseThenFlat";
export type Content = {
    title: string;
    context: string;
    question: string;
    unit: string;
    known: Point[];
    future: Point[];
    top: number;
    step: number;
    changeLabel: string;
    realLabel: string;
    resultTitle: string;
    explanationLabel: string;
    explanation: string;
    source: string;
    feedback: Record<Trend, string>;
};
export type LearnerState = {
    guesses: (number | null)[];
    shown: boolean;
};
