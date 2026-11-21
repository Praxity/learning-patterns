import { MET } from "./shared.js";

export const JOURNAL_KEY = "jev-demos:13-journal";
export const ANSWER_LIMIT = 1500;
export const NUDGE_KEYS = /** @type {const} */ (["situation", "action", "next_step", "when"]);
export const DISTRESS = 0.5;

/** @param {Record<string, { noul: number }>} answers
 * @returns {{ kind: 'support' | 'complete' } | { kind: 'nudge', key: typeof NUDGE_KEYS[number] }} */
export function journalDecision(answers) {
	if (answers.distress.noul >= DISTRESS) return { kind: "support" };
	const key = NUDGE_KEYS.find(key => answers[key].noul < MET);
	return key ? { kind: "nudge", key } : { kind: "complete" };
}
