/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @param {Content} content @returns {number} */
export function markLimit(content: Content): number;
/** @param {Content} content @param {string[]} markedIds
 * @returns {{ found: number, total: number, marked: number, wrong: number, items: Outcome[] }} */
export function check(content: Content, markedIds: string[]): {
    found: number;
    total: number;
    marked: number;
    wrong: number;
    items: Outcome[];
};
/** @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
export type Chunk = {
    id: string;
    text: string;
    key?: boolean;
    note?: string;
};
export type Content = {
    mode: "key" | "evidence";
    title: string;
    question?: string;
    maxMarks?: number;
    paragraphs: Chunk[][];
};
export type LearnerState = {
    marked: string[];
    shown: boolean;
};
export type Outcome = {
    id: string;
    text: string;
    marked: boolean;
    outcome: "correct" | "missed" | "wrong" | "unmarked";
    note: string | null;
};
