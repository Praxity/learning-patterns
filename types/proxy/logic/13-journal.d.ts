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
/** Picks at most one authored line. Never a score or a checklist.
 * @param {Record<string, { noul: number }>} answers
 */
export function journalFeedback(answers: Record<string, {
    noul: number;
}>): {
    kind: string;
    text: string;
    key?: undefined;
} | {
    kind: string;
    key: "action" | "situation" | "next_step" | "when";
    text: string;
};
export const JOURNAL_KEY: "jev-demos:13-journal";
export const ANSWER_LIMIT: 1500;
export const NUDGE_KEYS: readonly ["situation", "action", "next_step", "when"];
export const DISTRESS: 0.5;
