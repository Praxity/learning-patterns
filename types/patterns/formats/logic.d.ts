/** Validate authored text, stable section ids and exactly one correct option per question.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content: unknown): asserts content is Content;
/** Demo place keeping: truncate fractions, clamp to the nearest section, start at zero for nonfinite indices.
 * @param {number} index @param {number} count @returns {number}
 */
export function clampPoint(index: number, count: number): number;
/** @param {number} place @param {'next' | 'previous' | { set: number }} action @param {number} count @returns {number} */
export function movePlace(place: number, action: "next" | "previous" | {
    set: number;
}, count: number): number;
/** @param {LearnerState} state @param {Format} next @returns {LearnerState} */
export function switchFormat(state: LearnerState, next: Format): LearnerState;
/** The narration uses the same title, body and example as text, in order.
 * @param {Point} point @returns {string[]}
 */
export function spokenLines(point: Point): string[];
/** @param {number} questionIndex @param {number} optionIndex @param {Question[]} quiz @returns {{ correct: boolean, feedback: string }} */
export function checkQuizAnswer(questionIndex: number, optionIndex: number, quiz: Question[]): {
    correct: boolean;
    feedback: string;
};
/** Ignore invalid host state as a whole. Saved sections are zero-based indices, never clamped.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** @typedef {'text' | 'slides' | 'audio' | 'quiz'} Format */
/** @typedef {{ id: string, title: string, sentences: string[], outline: string[], example?: string[], exampleOutline?: string }} Point */
/** @typedef {{ text: string, feedback: string, correct?: boolean }} Option */
/** @typedef {{ section: string, prompt: string, options: Option[] }} Question */
/** @typedef {{ title: string, points: Point[], quiz: Question[], summary: string }} Content */
/** @typedef {{ format: Format, section: number }} LearnerState */
/** @type {readonly Format[]} */
export const FORMATS: readonly Format[];
export type Format = "text" | "slides" | "audio" | "quiz";
export type Point = {
    id: string;
    title: string;
    sentences: string[];
    outline: string[];
    example?: string[];
    exampleOutline?: string;
};
export type Option = {
    text: string;
    feedback: string;
    correct?: boolean;
};
export type Question = {
    section: string;
    prompt: string;
    options: Option[];
};
export type Content = {
    title: string;
    points: Point[];
    quiz: Question[];
    summary: string;
};
export type LearnerState = {
    format: Format;
    section: number;
};
