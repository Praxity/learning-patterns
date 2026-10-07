/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @param {Content} content @param {Record<string, string>} picks */
export function score(content: Content, picks: Record<string, string>): {
    points: number;
    total: number;
    right: string[];
    wrong: string[];
    unknown: string[];
    unanswered: string[];
};
/** Ignore invalid saved values and copy valid state.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** Use the mathematical minus sign; scoring rules also show positive signs.
 * @param {number} value @param {boolean} [positive]
 */
export function displayPoints(value: number, positive?: boolean): string;
/** Replace authored placeholders in a single pass so inserted content stays literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template: string, values: Record<string, string | number>): string;
/** @typedef {{ id: string, text: string }} Option */
/** @typedef {{ id: string, text: string, options: Option[], correct: string, explanation: string }} Question */
/** @typedef {{ title: string, questions: Question[], points: { right: number, wrong: number, unknown: number } }} Content */
/** @typedef {{ picks: Record<string, string>, shown: boolean }} LearnerState */
export const DONT_KNOW: "dont-know";
export type Option = {
    id: string;
    text: string;
};
export type Question = {
    id: string;
    text: string;
    options: Option[];
    correct: string;
    explanation: string;
};
export type Content = {
    title: string;
    questions: Question[];
    points: {
        right: number;
        wrong: number;
        unknown: number;
    };
};
export type LearnerState = {
    picks: Record<string, string>;
    shown: boolean;
};
