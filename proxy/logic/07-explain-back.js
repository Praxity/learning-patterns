import { band } from "./shared.js";

export const ANSWER_LIMIT = 1500;

// The three ideas, in lesson order. The pattern's examples own the lesson and feedback text.
export const IDEA_KEYS = ["stonewalling", "pause", "return"];

// Turns Jev's Nouls into a band per idea. Pure, so tests can call it.
/** @param {Record<string, { noul: number }>} answers */
export function explainFeedback(answers) {
	const items = IDEA_KEYS.map((key) => ({ key, state: band(answers[key].noul) }));
	const met = items.filter((i) => i.state === "met").length;
	return { items, met, allMet: met === items.length };
}
