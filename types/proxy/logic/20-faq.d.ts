/** Validate a complete Choice distribution, then choose at most two authored entries.
 * `none` winning always suppresses suggestions. Inclusive gates permit a split decision.
 * @param {unknown} answers @param {string[]} ids @param {number} gate
 * @returns {{ ids: string[] }}
 */
export function selectLookup(answers: unknown, ids: string[], gate: number): {
    ids: string[];
};
/** @param {unknown} answers */
export function faqLookup(answers: unknown): {
    ids: string[];
};
export const QUESTION_LIMIT: 500;
export const ENTRY_IDS: string[];
export const MATCH_GATE: 0.35;
export const CLOSE_GAP: 0.2;
