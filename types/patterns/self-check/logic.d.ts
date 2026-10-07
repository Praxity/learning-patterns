/** Validate authored plain text. Whitespace is allowed; empty strings are not.
 * @param {unknown} content
 * @returns {asserts content is Content}
 */
export function validateContent(content: unknown): asserts content is Content;
/** Segment validated model text in reading order. Whole-message parts stay in the legend.
 * When evidence overlaps, the first span in model order owns that text.
 * @param {string} model @param {Part[]} parts @param {string[]} includedIds
 * @returns {Segment[]}
 */
export function annotate(model: string, parts: Part[], includedIds: string[]): Segment[];
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
    evidence: string | null;
};
export type Content = {
    task: string;
    context: {
        to: string;
        initials: string;
        subject: string;
    };
    parts: Part[];
    model: string;
};
export type Segment = {
    text: string;
    partIndex: number | null;
    included: boolean;
};
export type LearnerState = {
    answer: string;
    ticked: string[];
    shown: boolean;
};
