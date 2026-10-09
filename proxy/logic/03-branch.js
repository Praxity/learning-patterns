
// A two-round branching dialogue with Michel. The learner types a reply, Jev picks one of the
// author's branches, and Michel answers with the authored line for that branch. Every node also
// offers the same branches as clickable replies, so the scenario works without typing or network.

import { BRANCH_SURE, CLEF_BRANCH_SURE, CLEF_27B_BRANCH_SURE, BRANCHES, OFF_SCRIPT, ROUNDS, confidenceGate } from './03-contract.js';
export { BRANCH_SURE, CLEF_BRANCH_SURE, CLEF_27B_BRANCH_SURE, BRANCHES, OFF_SCRIPT, ROUNDS };

const SETUP = "Last week you and Michel agreed the order of work on a client proposal. Yesterday the client asked for pricing first, so you changed the order without asking him. Michel had already done the part he'd planned first. At this morning's meeting, he turns to you.";
export const UNSURE = "It's not clear how Michel would take that. Say it another way, or choose a reply.";
export const OFF_SCRIPT_REPLY = "None of these fits. I'll write my own.";
export const OFF_SCRIPT_HINT = "Type your reply in the box, then press Say it.";

// Michel's line at each node. Copied from MICHEL_REPLIES in src/demos/03-branch.js, which the
// server sends to Jev as context; a test keeps the two in step. The server's off_script node is
// never reached here: an off-script reply doesn't take a round.
export const OPENING = "That's not what we agreed. You always change the plan at the last minute.";
export const FIRST = {
	acknowledge: "I need to know what changed and how we will avoid another last-minute change.",
	defend: "I hear your reasons, but I still had to redo my work. What will you do differently?",
	attack: "I'm trying to talk about the plan. Can we discuss that without attacking each other?",
	withdraw: "We still need to resolve the plan. Are you willing to come back to this conversation?",
	pause: "All right. Let's take ten minutes and come back to agree on the plan.",
};

// SECOND[node][branch]: Michel's answer to the second reply, given where the first one led.
export const SECOND = {
	acknowledge: {
		acknowledge: "OK. If you check with me first, I can live with changes. Let's write that down.",
		defend: "Then nothing will change, and I'll keep redoing my work.",
		attack: "I asked a fair question. I'll take this to the team lead.",
		withdraw: "So we're leaving it. Then it'll happen again next month.",
		pause: "Fine. This afternoon, then.",
	},
	defend: {
		acknowledge: "Thank you. That's what I needed. Let's look at the new order together.",
		defend: "Then this will keep happening, and I'll keep paying for it.",
		attack: "A few hours of my work. I'm done with this conversation.",
		withdraw: "Fine. Next item.",
		pause: "OK. Ten minutes.",
	},
	attack: {
		acknowledge: "Thank you. Then let's agree how changes work from now on.",
		defend: "It didn't sound like facts to me. Let's leave it for now.",
		attack: "I'm not doing this. Talk to me when you can be civil.",
		withdraw: "Then I'll raise it with the team lead.",
		pause: "Yes. Three o'clock.",
	},
	withdraw: {
		acknowledge: "Thank you. Let's start with what's left of my part.",
		defend: "I redid hours of work. I'm not letting this go.",
		attack: "I asked a simple question. I'll take this to the team lead.",
		withdraw: "Right.",
		pause: "OK. After lunch, then.",
	},
	pause: {
		acknowledge: "Thanks. That's what I needed to hear. Let's fix the new order together.",
		defend: "So the break changed nothing.",
		attack: "Then the break was pointless.",
		withdraw: "You said we'd come back to this. Leaving it is exactly the problem.",
		pause: "Tomorrow at nine, then. I'll hold you to it.",
	},
};

// What happens after Michel speaks, where the line alone doesn't show it.
const AFTER = {
	"attack:attack": "Michel leaves the meeting.",
	"defend:attack": "Michel leaves the meeting.",
	"withdraw:withdraw": "Michel turns to his screen. He says nothing more in the meeting.",
	"defend:withdraw": "Michel says nothing for the rest of the meeting.",
};

// Example replies for each branch, written for the node the learner is at.
export const EXAMPLES = {
	opening: {
		acknowledge: "You're right, I changed it late and didn't check with you first. I can see why that's frustrating.",
		defend: "That's not fair. The client changed their mind, not me. I had no choice.",
		attack: "Here we go again. Maybe if you read your emails you'd have known.",
		withdraw: "OK. Never mind. Let's move on to the next item.",
		pause: "I want to answer this properly. Can we take ten minutes and come back to it?",
	},
	acknowledge: {
		acknowledge: "The client asked for pricing first. Next time I'll check with you before I change the order, even when it's urgent.",
		defend: "Honestly, the client changes things all the time. I can't promise anything.",
		attack: "Maybe you should plan for changes instead of complaining about them.",
		withdraw: "I don't know. Let's just get on with the agenda.",
		pause: "Let me look at how we hand over changes. I'll come back to you this afternoon with a proposal.",
	},
	defend: {
		acknowledge: "You're right, you redid work because of me. Next time I'll tell you the same day the client asks, before anything moves.",
		defend: "Nothing. It wasn't my decision, so I don't see what I could do differently.",
		attack: "You're making a big deal out of a few hours of work.",
		withdraw: "Can we not do this now? Next item.",
		pause: "I'm getting defensive. Give me ten minutes, then let's work out what I'll do differently.",
	},
	attack: {
		acknowledge: "Yes. Sorry, that was unfair. I changed the plan without asking you, and you had to redo your part.",
		defend: "I wasn't attacking you. I was only stating facts.",
		attack: "Oh please. Even an intern would cope with a change of order.",
		withdraw: "Forget it. I'm not discussing this.",
		pause: "You're right. I need a few minutes to calm down. Can we pick this up at three?",
	},
	withdraw: {
		acknowledge: "Yes. I changed the plan late and you had to redo work. Let's sort it out now.",
		defend: "There's nothing to resolve. The client decided, not me.",
		attack: "Why do you always make such a drama of everything?",
		withdraw: "No. I've said all I'm going to say.",
		pause: "Yes. Give me until after lunch and I'll come to your desk.",
	},
	pause: {
		acknowledge: "Thanks for waiting. You're right, I changed the plan late. From now on I'll check with you first.",
		defend: "I've thought about it, and the client really forced my hand. There's nothing to fix.",
		attack: "I've thought about it, and I think you overreact to every change.",
		withdraw: "Actually, let's leave it. It's not worth it.",
		pause: "I need a bit longer. Can we finish this tomorrow at nine?",
	},
};

// The text box label for each node.
const PROMPTS = {
	opening: "Round 1 of 2. Reply to Michel.",
	acknowledge: "Round 2 of 2. Reply to Michel.",
	defend: "Round 2 of 2. Reply to Michel.",
	attack: "Round 2 of 2. Reply to Michel.",
	withdraw: "Round 2 of 2. Reply to Michel.",
	pause: "Round 2 of 2. Ten minutes later, you're back with Michel. Reply to him.",
};

// One line on what the reply did, in the course's terms.
export const DEBRIEF = {
	acknowledge: "You took up Michel's concern. If you haven't yet, name your part in the change and what you'll do next time.",
	defend: "That was defensiveness. Your excuse puts the problem on someone else. Accept your part first.",
	attack: "That was criticism or contempt. It moves the talk from the plan to Michel. Name the change you made and ask how to fix it together.",
	withdraw: "That was stonewalling. You closed the subject without saying why. If you need time, say so and come back.",
	pause: "That was a time-out, not stonewalling. You said you needed time and when you'd come back.",
};

const RULE = `A typed reply takes a round only when its model picks one of the five branches at its checked confidence gate: ${BRANCH_SURE.toFixed(2)} for Jev, ${CLEF_27B_BRANCH_SURE.toFixed(2)} for Clef 27B or ${CLEF_BRANCH_SURE.toFixed(2)} for Clef-flash. Otherwise the learner sees a nudge and tries again or chooses. The sixth clickable reply, "${OFF_SCRIPT_REPLY}", shows the same nudge without asking Jev.`;

const DID = { acknowledge: "took up his concern", defend: "defended yourself", attack: "hit back", withdraw: "stonewalled", pause: "asked for a time-out" };

// The branch the model selects, or null when it is off-script or below its gate.
export function readBranch(answer, sure = BRANCH_SURE, model) {
	const threshold = model === "@cf/cloudflare/clef" || model === "@cf/cloudflare/clef-flash" ? confidenceGate(model) : sure;
	if (!answer || !BRANCHES.includes(answer.choice) || !(answer.confidence >= threshold)) return null;
	return answer.choice;
}

export function start() {
	return { node: "opening", path: [] };
}

export const isDone = (state) => state.path.length >= ROUNDS;

// Moves to the chosen branch. The node sent to the server is the learner's previous branch.
export function advance(state, branch) {
	if (isDone(state)) throw new Error("The scenario is already over");
	if (!BRANCHES.includes(branch)) throw new Error(`Unknown branch: ${branch}`);
	return { node: branch, path: [...state.path, branch] };
}

// Michel's reply to the latest step.
export function michelReply(state) {
	const [first, second] = state.path;
	return second ? SECOND[first][second] : FIRST[first];
}

export const examplesFor = (state) => BRANCHES.map((branch) => ({ branch, text: EXAMPLES[state.node][branch] }));

// The clickable replies at a node: the five branches in random order, then the off-script reply.
export const choicesFor = (state) => [...shuffle(examplesFor(state)), { branch: OFF_SCRIPT, text: OFF_SCRIPT_REPLY }];

// What a clicked reply does. A branch moves on; off-script keeps the state and returns the nudge.
export function choose(state, branch) {
	if (branch === OFF_SCRIPT) return { state, nudge: [UNSURE, OFF_SCRIPT_HINT] };
	return { state: advance(state, branch), nudge: null };
}

export function ending(state) {
	const [first, second] = state.path;
	return `You ${DID[first]}, then ${DID[second]}.`;
}

function shuffle(items) {
	const a = [...items];
	for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
	return a;
}
