/** Validate authored plain text. Whitespace is allowed; empty strings are not.
 * @param {unknown} content
 * @returns {asserts content is Content}
 */
export function validateContent(content: unknown): asserts content is Content;
/** @param {Content} content @param {string[]} ticked */
export function feedback(content: Content, ticked: string[]): {
    count: number;
    total: number;
    items: {
        id: string;
        included: boolean;
        label: string;
        hint: string | null;
    }[];
};
/** Ignore invalid host state; return an independent copy of a valid value.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content: Content, value: unknown): LearnerState | null;
export type Part = {
    id: string;
    label: string;
    missed: string;
};
export type Content = {
    task: string;
    parts: Part[];
    model: string;
};
export type LearnerState = {
    answer: string;
    ticked: string[];
    shown: boolean;
};
