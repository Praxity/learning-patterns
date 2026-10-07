/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** Error keys let the host pick an authored translation.
 * @param {unknown} text
 * @returns {{ ok: true, text: string } | { ok: false, error: 'empty' | 'tooLong' }}
 */
export function validateAnswer(text: unknown): {
    ok: true;
    text: string;
} | {
    ok: false;
    error: "empty" | "tooLong";
};
/** Return a copy, or null for damaged host state. Null is distinct from emptyState.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** @param {Content} content @returns {LearnerState} */
export function emptyState(content: Content): LearnerState;
/** Save once. An end-only attempt cannot later become a first attempt.
 * @param {Content} content @param {LearnerState | null} value @param {string} text @param {string} savedAt
 * @returns {LearnerState}
 */
export function withFirstAnswer(content: Content, value: LearnerState | null, text: string, savedAt: string): LearnerState;
/** Repeating comparison replaces only now; first and checks keep their values.
 * @param {Content} content @param {LearnerState | null} value @param {string} text @param {string} savedAt
 * @returns {LearnerState}
 */
export function withAnswerNow(content: Content, value: LearnerState | null, text: string, savedAt: string): LearnerState;
/** @param {Content} content @param {LearnerState | null} value @param {Record<string, unknown>} checks
 * @returns {LearnerState}
 */
export function withChecks(content: Content, value: LearnerState | null, checks: Record<string, unknown>): LearnerState;
/** @typedef {{ id: string, label: string }} Check */
/** @typedef {{ prompt: string, checks: Check[] }} Content */
/** @typedef {{ text: string, savedAt: string }} Entry */
/** @typedef {{ first: Entry | null, now: Entry | null, checks: Record<string, boolean> }} LearnerState */
export const MAX_LENGTH: 2000;
export type Check = {
    id: string;
    label: string;
};
export type Content = {
    prompt: string;
    checks: Check[];
};
export type Entry = {
    text: string;
    savedAt: string;
};
export type LearnerState = {
    first: Entry | null;
    now: Entry | null;
    checks: Record<string, boolean>;
};
