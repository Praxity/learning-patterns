import assert from "node:assert/strict";
import test from "node:test";
import { explainFeedback } from "../logic/07-explain-back.js";

const answers = (stonewalling, pause, ret) => ({ stonewalling: { noul: stonewalling }, pause: { noul: pause }, return: { noul: ret } });

test("all three ideas met means the all-met state", () => {
	const f = explainFeedback(answers(0.9, 0.8, 0.7));
	assert.equal(f.allMet, true);
	assert.equal(f.met, 3);
});

test("each idea gets its own band, in lesson order", () => {
	const f = explainFeedback(answers(0.9, 0.1, 0.5));
	assert.equal(f.allMet, false);
	assert.deepEqual(f.items, [{ key: "stonewalling", state: "met" }, { key: "pause", state: "missed" }, { key: "return", state: "unsure" }]);
});
