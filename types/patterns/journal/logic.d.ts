/** Questions follow the proxy's fixed criteria, in its order.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content: unknown): asserts content is Content;
/** Select one authored line. The proxy owns every threshold and the decision order.
 * @param {Content} content @param {unknown} answers
 * @returns {{ kind: 'support' | 'complete', text: string } | { kind: 'nudge', key: typeof NUDGE_KEYS[number], text: string }}
 */
export function feedback(content: Content, answers: unknown): {
    kind: "support" | "complete";
    text: string;
} | {
    kind: "nudge";
    key: (typeof NUDGE_KEYS)[number];
    text: string;
};
/** Preserve the writer's whitespace when saving.
 * @param {unknown} text @returns {{ ok: true, text: string } | { ok: false, error: 'empty' | 'tooLong' }}
 */
export function validateAnswer(text: unknown): {
    ok: true;
    text: string;
} | {
    ok: false;
    error: "empty" | "tooLong";
};
/** Only submitted entries are saved, with canonical UTC timestamps. No model judgments.
 * @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(value: unknown): LearnerState | null;
/** @param {string} text @param {string} savedAt @returns {LearnerState} */
export function savedEntry(text: string, savedAt: string): LearnerState;
export { ANSWER_LIMIT };
export type Question = {
    id: (typeof NUDGE_KEYS)[number];
    text: string;
};
export type Content = {
    prompt: string;
    questions: Question[];
    complete: string;
    support: string;
    supportNote: string;
    saved: string;
    changed: string;
};
export type LearnerState = {
    text: string;
    savedAt: string;
};
import { NUDGE_KEYS } from '../../proxy/logic/13-journal.js';
import { ANSWER_LIMIT } from '../../proxy/logic/13-journal.js';
