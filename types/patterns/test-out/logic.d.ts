/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** A passed section credits every prerequisite. The lowest numeric passed id wins ties.
 * @param {Section[]} sections @param {number[]} passed @param {boolean} [allowTestOut]
 * @returns {{ rows: PlanRow[], skip: number }}
 */
export function plan(sections: Section[], passed: number[], allowTestOut?: boolean): {
    rows: PlanRow[];
    skip: number;
};
/** All questions in a section must be right for a direct pass. Missing picks stay unanswered.
 * @param {Content} content @param {Record<string, string>} picks
 */
export function score(content: Content, picks: Record<string, string>): {
    rows: PlanRow[];
    skip: number;
    passed: number[];
    right: string[];
    wrong: string[];
    unanswered: string[];
};
/** @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** Replace placeholders once so inserted values stay literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template: string, values: Record<string, string | number>): string;
export type Section = {
    id: number;
    title: string;
    requires: number[];
};
export type Option = {
    id: string;
    text: string;
};
export type Question = {
    id: string;
    section: number;
    text: string;
    options: Option[];
    correct: string;
    explanation: string;
};
export type Content = {
    title: string;
    allowTestOut: boolean;
    sections: Section[];
    questions: Question[];
};
export type LearnerState = {
    picks: Record<string, string>;
    shown: boolean;
};
export type PlanRow = {
    id: number;
    title: string;
    action: "take" | "passed" | "credited";
    by?: number;
};
