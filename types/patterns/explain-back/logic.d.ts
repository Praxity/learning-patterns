/** Content must describe the proxy's fixed three ideas, in lesson order.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content: unknown): asserts content is Content;
/** Choose authored lines. The proxy owns the confidence gate.
 * @param {Content} content @param {unknown} answers
 * @returns {{ count: number, total: number, allFound: boolean, items: FeedbackItem[] }}
 */
export function feedback(content: Content, answers: unknown): {
    count: number;
    total: number;
    allFound: boolean;
    items: FeedbackItem[];
};
/** Restore drafts only, never persist automated judgments.
 * @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(value: unknown): LearnerState | null;
export { ANSWER_LIMIT };
export type Idea = {
    id: string;
    heading: string;
    body: string;
    label: string;
    met: string;
    missed: string;
    unsure: string;
};
export type Content = {
    task: string;
    model: string;
    ideas: Idea[];
};
export type LearnerState = {
    answer: string;
    ticked: string[];
};
export type Mark = "met" | "missed" | "unsure";
export type FeedbackItem = {
    id: string;
    mark: Mark;
    text: string;
    heading: string;
};
import { ANSWER_LIMIT } from '../../proxy/logic/07-explain-back.js';
