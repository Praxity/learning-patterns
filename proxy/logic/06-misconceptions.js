import { CLEF_CHOICE_CONFIDENT } from "./shared.js";

// Below this Choice confidence the demo hedges instead of naming a misconception, and logs the answer for the designer.
export const CONFIDENT = 0.65;
// The revised wording classifies all 27B train beliefs correctly, with confidence
// at least 0.527. Retain the earlier 0.50 gate for flash; 27B now uses the shared
// three-group Choice calibration. Jev keeps its original gate.
export const CLEF_CONFIDENT = 0.5;
export const INBOX_KEY = "jev-demos:06-inbox";
export const ANSWER_LIMIT = 1500;

// Authored refutations. Each names the wrong idea, says why it's wrong and gives the right idea.
export const CATALOGUE = {
	rereading: {
		label: "Rereading builds memory",
		idea: "rereading builds memory",
		why: "Familiarity can feel like knowing, so test your recall over several days instead.",
	},
	highlighting: {
		label: "Highlighting is studying",
		idea: "highlighting counts as studying",
		why: "Marking words doesn't show what you recall, so close your notes and test yourself.",
	},
	cramming: {
		label: "Cramming the night before works as well",
		idea: "cramming works as well as spaced practice",
		why: "Cramming fades faster, so spread your self-tests over several days.",
	},
	watching: {
		label: "Some people only learn by watching",
		idea: "some people can learn only by watching",
		why: "A preference isn't a fixed learning style, so practise recalling what you watched.",
	},
};

const KEY_IDEA = "Rereading alone can feel familiar without showing what you recall. Test yourself over several days.";
const MAYBE_KEY_IDEA = "You may have the key idea, but I can't tell. Check it against the model answer below.";
const NO_MATCH = "Your answer doesn't match the expected answer or a known misconception. Check it against the model answer below.";
const MAYBE_NO_MATCH = "I couldn't match your answer to the expected answer or a known misconception. Check it against the model answer below.";
const LOGGED = "Your answer went to the designer's inbox below.";
const MODEL = "Not on its own. Rereading feels familiar but doesn't show what you can recall. Close your notes and test yourself, spaced out over several days.";

export const MISCONCEPTION_KEYS = Object.keys(CATALOGUE);
const OPTIONS = ["correct", ...MISCONCEPTION_KEYS, "none"];

/** The configured model determines which evaluated Choice gate applies.
 * @param {string} model @returns {number}
 */
export function confidenceGate(model) {
	return model === "@cf/cloudflare/clef" ? CLEF_CHOICE_CONFIDENT : model === "@cf/cloudflare/clef-flash" ? CLEF_CONFIDENT : CONFIDENT;
}

// Turns Jev's Choice answer into authored feedback. Pure, so tests can call it.
/** @param {{ choice: string, confidence: number }} answer @param {string} model */
export function misconceptionFeedback({ choice, confidence }, model) {
	if (!OPTIONS.includes(choice)) throw new Error(`Unexpected label "${choice}"`);
	const threshold = confidenceGate(model);
	const sure = confidence >= threshold;
	const log = choice === "none" || !sure;
	const logged = log ? " Sent to the designer." : "";
	if (choice === "correct") return { kind: "correct", sure, log, text: sure ? KEY_IDEA : MAYBE_KEY_IDEA, status: (sure ? "Key idea found." : "Not sure.") + logged };
	if (choice === "none") return { kind: "none", sure, log, text: sure ? NO_MATCH : MAYBE_NO_MATCH, status: (sure ? "No match." : "Not sure.") + logged };
	const { idea, why } = CATALOGUE[/** @type {keyof typeof CATALOGUE} */ (choice)];
	const text = sure
		? `Your answer assumes ${idea}. ${why}`
		: `I'm not sure, but you may mean ${idea}. ${why}`;
	return { kind: "misconception", sure, log, text, status: (sure ? "Known misconception found." : "Not sure.") + logged };
}
