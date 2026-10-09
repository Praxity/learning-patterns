import assert from "node:assert/strict";
import test from "node:test";
import { misconceptionFeedback } from "../logic/06-misconceptions.js";

test("uncertain unclassified answers hedge in visible feedback and the status summary", () => {
	const feedback = misconceptionFeedback({ choice: "none", confidence: 0.4 });
	assert.equal(feedback.log, true);
	assert.equal(feedback.sure, false);
	assert.match(feedback.text, /couldn't match/i);
	assert.match(feedback.status, /Not sure/);
	assert.doesNotMatch(feedback.status, /No match/);
});
