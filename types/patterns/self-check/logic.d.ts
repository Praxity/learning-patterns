/** @param {unknown} content
 * @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @param {string} model @param {Part[]} parts @param {string[]} includedIds
 * @returns {Segment[]} */
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
/** @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
export type Part = {
    id: string;
    label: string;
    missed: string;
    evidence: string | null;
};
export type Content = {
    scenario?: string;
    task: string;
    context?: {
        to: string;
        initials: string;
        subject: string;
        placeholder?: string;
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
