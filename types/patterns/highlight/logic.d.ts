/** Validate authored content, including identities across every paragraph.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content: unknown): asserts content is Content;
/** Compare marks with the author's targets. Duplicate marks count once.
 * @param {Content} content @param {string[]} markedIds
 * @returns {{ found: number, total: number, marked: number, wrong: number, items: Outcome[] }}
 */
export function check(content: Content, markedIds: string[]): {
    found: number;
    total: number;
    marked: number;
    wrong: number;
    items: Outcome[];
};
/** Ignore invalid host state and copy valid marks.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
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
