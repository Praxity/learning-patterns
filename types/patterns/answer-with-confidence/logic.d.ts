/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @param {Content} content @param {string} questionId @param {string} answer @param {Certainty} [certainty]
 * @returns {{ result: 'right' | 'wrong' | 'unknown', correct: Option, feedback: string, rightWhen: string | null }} */
export function feedback(content: Content, questionId: string, answer: string, certainty?: Certainty): {
    result: "right" | "wrong" | "unknown";
    correct: Option;
    feedback: string;
    rightWhen: string | null;
};
/** @param {Content} content @param {Record<string, string>} answers @param {Record<string, Certainty>} [certainties] */
export function summarize(content: Content, answers: Record<string, string>, certainties?: Record<string, Certainty>): {
    total: number;
    right: string[];
    wrong: string[];
    unknown: string[];
    unanswered: string[];
    sureWrong: string[];
    unsureRight: string[];
};
/** @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** @param {string} template @param {Record<string, string | number>} values */
export function format(template: string, values: Record<string, string | number>): string;
/** @typedef {{ id: string, text: string, feedback: string, rightWhen?: string }} Option */
/** @typedef {{ id: string, text: string, options: Option[], correct: string }} Question */
/** @typedef {{ title?: string, context?: string, dontKnow?: boolean, questions: Question[] }} Content */
/** @typedef {'sure' | 'unsure'} Certainty */
/** @typedef {{ answers: Record<string, string> }} LearnerState */
export const DONT_KNOW: "dont-know";
export const SURE: "sure";
export const UNSURE: "unsure";
export type Option = {
    id: string;
    text: string;
    feedback: string;
    rightWhen?: string;
};
export type Question = {
    id: string;
    text: string;
    options: Option[];
    correct: string;
};
export type Content = {
    title?: string;
    context?: string;
    dontKnow?: boolean;
    questions: Question[];
};
export type Certainty = "sure" | "unsure";
export type LearnerState = {
    answers: Record<string, string>;
};
