/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** The first case, then one round per change. Every change starts from the first case, so a round
 * differs from it in one detail only.
 * @param {Content} content @returns {Round[]}
 */
export function rounds(content: Content): Round[];
/** @param {Content} content @param {string[]} picks Checked decisions, in round order. */
export function score(content: Content, picks: string[]): {
    results: boolean[];
    right: number;
    total: number;
    done: boolean;
};
/** Ignore invalid saved values and copy valid state.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** Replace authored placeholders in a single pass so inserted content stays literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template: string, values: Record<string, string | number>): string;
export type Option = {
    id: string;
    text: string;
};
export type Change = {
    from: string;
    to: string;
    correct: string;
    explanation: string;
};
export type Content = {
    title: string;
    context?: string;
    case: string;
    question: string;
    options: Option[];
    correct: string;
    explanation: string;
    changes: Change[];
    rule: string;
};
export type Part = {
    kind: "same" | "before" | "now";
    text: string;
};
export type Round = {
    parts: Part[];
    correct: string;
    explanation: string;
    moves: boolean | null;
};
export type LearnerState = {
    picks: string[];
};
