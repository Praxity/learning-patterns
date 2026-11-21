/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @param {unknown} feedback
 * @returns {{ ok: true, text: string } | { ok: false, error: 'empty' | 'tooLong' }} */
export function validateFeedback(feedback: unknown): {
    ok: true;
    text: string;
} | {
    ok: false;
    error: "empty" | "tooLong";
};
/** @param {Content} content @param {string[]} ticked
 * @returns {{ count: number, total: number, key: 'all' | 'some' | 'none', items: (Issue & { raised: boolean })[] }} */
export function result(content: Content, ticked: string[]): {
    count: number;
    total: number;
    key: "all" | "some" | "none";
    items: (Issue & {
        raised: boolean;
    })[];
};
/** @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** @param {string} template @param {Record<string, string | number>} values */
export function format(template: string, values: Record<string, string | number>): string;
/** @typedef {{ heading: string, subject?: string, body: string }} Message */
/** @typedef {{ id: string, label: string, explanation: string }} Issue */
/** @typedef {{ title: string, context: string, colleague: string, messages: Message[], issues: Issue[] }} Content */
/** @typedef {'write' | 'compare' | 'done'} Stage */
/** @typedef {{ feedback: string, ticked: string[], stage: Stage }} LearnerState */
export const MAX_LENGTH: 2000;
export type Message = {
    heading: string;
    subject?: string;
    body: string;
};
export type Issue = {
    id: string;
    label: string;
    explanation: string;
};
export type Content = {
    title: string;
    context: string;
    colleague: string;
    messages: Message[];
    issues: Issue[];
};
export type Stage = "write" | "compare" | "done";
export type LearnerState = {
    feedback: string;
    ticked: string[];
    stage: Stage;
};
