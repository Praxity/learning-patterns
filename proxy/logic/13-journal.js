import { MET } from "./shared.js";

export const JOURNAL_KEY = "jev-demos:13-journal";
// Lower than the met threshold on purpose: missing a support line costs more than showing one needlessly.
export const DISTRESS = 0.5;

// Optional questions, asked one at a time in this order.
const NUDGES = [
	["situation", "Want to add a specific moment, like where you were and what was said?"],
	["action", "Want to add what you said or did in that moment?"],
	["next_step", "Want to add one thing you'll try next time?"],
	["when", "Want to add when you'll try it?"],
];
const COMPLETE = "Great. You've named a moment, what you did, and a next step with a when.";
const SUPPORT = "That sounds hard. If it's weighing on you, talk to someone you trust. You can also contact your workplace support, such as an employee assistance programme, or a local support service.";
const DISCLOSURE = "Save keeps your entry in this browser. Get a suggestion sends it to Jev.";

// Picks at most one authored line. Never a score or a checklist. Pure, so tests can call it.
export function journalFeedback(answers) {
	if (answers.distress.noul >= DISTRESS) return { kind: "support", text: SUPPORT };
	const next = NUDGES.find(([key]) => answers[key].noul < MET);
	return next ? { kind: "nudge", key: next[0], text: next[1] } : { kind: "complete", text: COMPLETE };
}
