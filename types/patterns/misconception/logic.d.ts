/** The catalogue identities match the proxy's evaluated study beliefs.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content: unknown): asserts content is Content;
/** Select authored feedback, never model-written text.
 * @param {Content} content @param {unknown} answers @param {string} [model]
 * @returns {{ kind: Kind, heading: string, text: string }}
 */
export function feedback(content: Content, answers: unknown, model?: string): {
    kind: Kind;
    heading: string;
    text: string;
};
/** @param {unknown} value @returns {LearnerState | null} */
export function validateState(value: unknown): LearnerState | null;
export { ANSWER_LIMIT };
export type Misconception = {
    id: string;
    label: string;
    idea: string;
    why: string;
};
export type Content = {
    question: string;
    keyIdea: string;
    model: string;
    unsureKeyIdea: string;
    unsureMisconception: string;
    noMatch: string;
    misconceptions: Misconception[];
};
export type LearnerState = {
    answer: string;
    ticked: string[];
};
export type Kind = "correct" | "misconception" | "unsure-key" | "unsure-misconception" | "none";
import { ANSWER_LIMIT } from '../../proxy/logic/06-misconceptions.js';
