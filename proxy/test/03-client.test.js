import assert from "node:assert/strict";
import test from "node:test";
import * as server from "../src/demos/03-branch.js";
import { advance, BRANCHES, choicesFor, choose, DEBRIEF, EXAMPLES, examplesFor, FIRST, OFF_SCRIPT, OFF_SCRIPT_REPLY, OPENING, isDone, michelReply, readBranch, ROUNDS, SECOND, start, UNSURE } from "../logic/03-branch.js";

test("an unsure or off-script answer selects no branch", () => {
	assert.equal(readBranch({ choice: "defend", confidence: 0.98 }), "defend");
	assert.equal(readBranch({ choice: "withdraw", confidence: 0.9 }), "withdraw");
	assert.equal(readBranch({ choice: "withdraw", confidence: 0.89 }), null);
	assert.equal(readBranch({ choice: "attack", confidence: 0.55 }), null);
	assert.equal(readBranch({ choice: "off_script", confidence: 1 }), null);
	assert.equal(readBranch(undefined), null);
});

test("choosing replies completes both rounds without Jev", () => {
	let state = start();
	assert.equal(state.node, "opening");
	state = advance(state, "withdraw");
	assert.equal(michelReply(state), FIRST.withdraw);
	assert.equal(isDone(state), false);
	assert.equal(state.node, "withdraw");
	state = advance(state, "acknowledge");
	assert.equal(michelReply(state), SECOND.withdraw.acknowledge);
	assert.equal(isDone(state), true);
	assert.throws(() => advance(state, "pause"), /already over/);
});

test("the second reply depends on where the first one led", () => {
	const after = (first) => michelReply(advance(advance(start(), first), "defend"));
	assert.notEqual(after("acknowledge"), after("attack"));
});

test("every node has an example and a reply for every branch", () => {
	assert.equal(ROUNDS, 2);
	for (const node of ["opening", ...BRANCHES]) {
		assert.deepEqual(examplesFor({ node, path: [] }).map((e) => e.branch), BRANCHES);
		for (const b of BRANCHES) assert.ok(EXAMPLES[node][b]?.length > 5, `example ${node}.${b}`);
	}
	for (const b of BRANCHES) {
		assert.ok(FIRST[b] && DEBRIEF[b], b);
		for (const c of BRANCHES) assert.ok(SECOND[b][c], `${b}.${c}`);
	}
});

test("examples differ between nodes, so round 2 isn't the opening list again", () => {
	for (const node of BRANCHES) for (const b of BRANCHES) assert.notEqual(EXAMPLES[node][b], EXAMPLES.opening[b], `${node}.${b}`);
});

test("Michel's opening and first replies match the lines the server sends to Jev", () => {
	assert.ok(server.MICHEL_REPLIES, "src/demos/03-branch.js exports MICHEL_REPLIES");
	assert.equal(OPENING, server.MICHEL_REPLIES.opening);
	for (const b of BRANCHES) assert.equal(FIRST[b], server.MICHEL_REPLIES[b], b);
});

test("every node offers six replies: the five branches, then off-script last", () => {
	let state = start();
	for (const branch of ["defend", null]) {
		const choices = choicesFor(state);
		assert.equal(choices.length, 6);
		assert.deepEqual(choices.slice(0, 5).map((c) => c.branch).sort(), [...BRANCHES].sort());
		assert.deepEqual(choices[5], { branch: OFF_SCRIPT, text: OFF_SCRIPT_REPLY });
		if (branch) state = advance(state, branch);
	}
});

test("choosing off-script nudges and keeps the round; a branch moves on", () => {
	const first = choose(start(), OFF_SCRIPT);
	assert.deepEqual(first.state, start());
	assert.equal(first.nudge[0], UNSURE);
	assert.equal(first.nudge.length, 2);
	const round2 = choose(start(), "pause").state;
	const again = choose(round2, OFF_SCRIPT);
	assert.deepEqual(again.state, { node: "pause", path: ["pause"] });
	const done = choose(again.state, "acknowledge");
	assert.equal(done.nudge, null);
	assert.equal(isDone(done.state), true);
	assert.equal(michelReply(done.state), SECOND.pause.acknowledge);
});
