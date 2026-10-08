import { band } from "./shared.js";

export const ANSWER_LIMIT = 1500;

// The short lesson the learner explains back. Each idea has its own heading, so feedback can link to it.
/** @type {Record<string, { id: string, heading: string, body: string }>} */
export const LESSON = {
	stonewalling: {
		id: "d07-stonewalling",
		heading: "Stonewalling",
		body: "Stonewalling is going silent, withdrawing or changing the subject without saying why. The other person feels ignored or rejected. The problem stays unsolved.",
	},
	pause: {
		id: "d07-pause",
		heading: "Taking a time-out",
		body: "A time-out starts when you tell the other person you need a pause. For example, \"I need ten minutes to think about this.\" Stepping away to calm down is fine. Doing it without a word is stonewalling.",
	},
	return: {
		id: "d07-return",
		heading: "Coming back",
		body: "A time-out ends when you come back. Agree when you'll return to the conversation, then do it. That way the other person isn't left waiting.",
	},
};
export const IDEA_KEYS = Object.keys(LESSON);

// Authored feedback. Jev only decides which line applies.
const FEEDBACK = {
	stonewalling: {
		met: "You described stonewalling as withdrawing without saying why.",
		missed: "Say what stonewalling looks like: going silent, withdrawing or changing the subject without saying why.",
		unsure: "I couldn't tell whether you described stonewalling. Say what it looks like.",
		link: "Reread \"Stonewalling\"",
	},
	pause: {
		met: "You said a time-out starts by telling the other person you need a pause.",
		missed: "Add how a time-out starts. You tell the other person you need a pause.",
		unsure: "I couldn't tell whether you said to announce the pause.",
		link: "Reread \"Taking a time-out\"",
	},
	return: {
		met: "You said to agree when to come back, and then come back.",
		missed: "Add how a time-out ends. You agree when you'll come back, then come back.",
		unsure: "I couldn't tell whether you said to come back.",
		link: "Reread \"Coming back\"",
	},
};
const ALL_MET = "All three ideas are there: what stonewalling is, announcing the pause, and coming back.";
const MODEL = "Stonewalling means going quiet or pulling away without saying why, so the other person feels ignored. In a time-out you tell them you need a pause, agree when you'll come back, and then come back.";

// Turns Jev's Nouls into authored feedback items. Pure, so tests can call it.
/** @param {Record<string, { noul: number }>} answers */
export function explainFeedback(answers) {
	const items = Object.entries(FEEDBACK).map(([key, text]) => {
		const state = band(answers[key].noul);
		return { key, state, text: text[state], link: state === "met" ? null : { href: `#${LESSON[key].id}`, text: text.link } };
	});
	const met = items.filter((i) => i.state === "met").length;
	return { items, met, allMet: met === items.length };
}
