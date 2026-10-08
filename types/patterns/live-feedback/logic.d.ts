/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** Choose authored lines, retaining done items while the final sentence is unfinished.
 * @param {Content} content @param {unknown} answers @param {string} [draft]
 * @param {FeedbackItem[]} [previous]
 * @returns {{ count: number, total: number, items: FeedbackItem[] }}
 */
export function feedback(content: Content, answers: unknown, draft?: string, previous?: FeedbackItem[]): {
    count: number;
    total: number;
    items: FeedbackItem[];
};
/** Drafts and self-check ticks only; automatic judgments are never persisted.
 * @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(value: unknown): LearnerState | null;
export { ANSWER_LIMIT };
export const MIN_CHARS: 20;
export const PAUSE_MS: 700;
export const AUTO_CHECK_LIMIT: 40;
export type Criterion = {
    id: string;
    done: string;
    todo: string;
};
export type Content = {
    prompt: string;
    criteria: Criterion[];
};
export type LearnerState = {
    answer: string;
    ticked: string[];
};
export type FeedbackItem = {
    id: string;
    mark: "done" | "todo";
    text: string;
};
import { ANSWER_LIMIT } from '../../proxy/logic/02-live.js';
