/** The shared decision contains no learner-facing copy.
 * @param {Record<string, { noul: number }>} answers
 * @returns {{ kind: 'support' | 'complete' } | { kind: 'nudge', key: typeof NUDGE_KEYS[number] }}
 */
export function journalDecision(answers: Record<string, {
    noul: number;
}>): {
    kind: "support" | "complete";
} | {
    kind: "nudge";
    key: (typeof NUDGE_KEYS)[number];
};
export const JOURNAL_KEY: "jev-demos:13-journal";
export const ANSWER_LIMIT: 1500;
export const NUDGE_KEYS: readonly ["situation", "action", "next_step", "when"];
export const DISTRESS: 0.5;
