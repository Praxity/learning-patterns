/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @param {Content} content @param {unknown} answers @returns {Entry[]} */
export function lookup(content: Content, answers: unknown): Entry[];
/** Only learner questions are stored; authored examples stay in content.
 * @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(value: unknown): LearnerState | null;
export { QUESTION_LIMIT };
export const AUTO_CHECK_LIMIT: 30;
export const BANK_LIMIT: 100;
export type Entry = {
    id: string;
    title: string;
    answer?: string;
    summary?: string;
};
export type Seed = {
    id: string;
    question: string;
    author: "instructor" | "learner";
    answer: string;
};
export type Content = {
    kind: "faq" | "sections";
    prompt: string;
    entries: Entry[];
    seeds: Seed[];
};
export type LearnerState = {
    questions: string[];
};
import { QUESTION_LIMIT } from '../../proxy/logic/20-faq.js';
