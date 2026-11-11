/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** What a learner reads after checking a case. The deciding fact always shows; the surface
 * detail shows only to a learner who picked the principle it points to, since it names that one.
 * @param {Content} content @param {number} index @param {string} pick @returns {Feedback}
 */
export function feedback(content: Content, index: number, pick: string): Feedback;
/** @param {Content} content @param {string[]} picks Checked cases, in case order. */
export function score(content: Content, picks: string[]): {
    results: boolean[];
    right: number;
    total: number;
    done: boolean;
};
/** The pairs of principles the learner mixed up: each miss pairs the pick with the correct
 * principle, in either direction. Most frequent first, then in principle order.
 * @param {Content} content @param {string[]} picks @returns {Pair[]}
 */
export function mixedPairs(content: Content, picks: string[]): Pair[];
/** Split feedback text so each principle name it quotes can be set in italics.
 * @param {Content} content @param {string} value @returns {Part[]}
 */
export function quoteParts(content: Content, value: string): Part[];
/** The principle's display name. @param {Content} content @param {string} id */
export function principleName(content: Content, id: string): string;
/** Ignore invalid saved values and copy valid state.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** Replace authored placeholders in a single pass so inserted content stays literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template: string, values: Record<string, string | number>): string;
export type Principle = {
    id: string;
    name: string;
    rule: string;
};
export type Case = {
    text: string;
    correct: string;
    lure: string;
    looksLike: string;
    decides: string;
};
export type Content = {
    title: string;
    context?: string;
    question: string;
    principles: Principle[];
    cases: Case[];
};
export type Feedback = {
    right: boolean;
    correct: string;
    looksLike: string | null;
    decides: string;
};
export type Pair = {
    first: string;
    second: string;
    count: number;
};
export type Part = {
    text: string;
    principle: boolean;
};
export type LearnerState = {
    picks: string[];
};
