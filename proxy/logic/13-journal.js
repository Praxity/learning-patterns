import { MET } from "./shared.js";

export const JOURNAL_KEY = "jev-demos:13-journal";
export const ANSWER_LIMIT = 1500;
export const NUDGE_KEYS = /** @type {const} */ (["situation", "action", "next_step", "when"]);
// Lower than the met threshold on purpose: missing a support line costs more than showing one needlessly.
export const DISTRESS = 0.5;

// Optional questions, asked one at a time in this order.
const NUDGES = {
	situation: "Want to add a specific moment, like where you were and what was said?",
	action: "Want to add what you said or did in that moment?",
	next_step: "Want to add one thing you'll try next time?",
	when: "Want to add when you'll try it?",
};
const COMPLETE = "You've got a situation, what you did and a next step with a when.";
const SUPPORT = "That sounds hard. If it's weighing on you, talk to someone you trust. You can also contact your workplace support, such as an employee assistance programme, or a local support service.";

/** The shared decision contains no learner-facing copy.
 * @param {Record<string, { noul: number }>} answers
 * @returns {{ kind: 'support' | 'complete' } | { kind: 'nudge', key: typeof NUDGE_KEYS[number] }}
 */
export function journalDecision(answers) {
	if (answers.distress.noul >= DISTRESS) return { kind: "support" };
	const key = NUDGE_KEYS.find(key => answers[key].noul < MET);
	return key ? { kind: "nudge", key } : { kind: "complete" };
}

/** Picks at most one authored line. Never a score or a checklist.
 * @param {Record<string, { noul: number }>} answers
 */
export function journalFeedback(answers) {
	const decision = journalDecision(answers);
	if (decision.kind === "support") return { kind: "support", text: SUPPORT };
	if (decision.kind === "nudge") return { kind: "nudge", key: decision.key, text: NUDGES[decision.key] };
	return { kind: "complete", text: COMPLETE };
}
