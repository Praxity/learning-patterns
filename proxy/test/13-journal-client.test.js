import assert from "node:assert/strict";
import test from "node:test";
import { journalFeedback } from "../logic/13-journal.js";

const answers = (situation, action, next_step, when, distress = 0) => ({
	situation: { noul: situation }, action: { noul: action }, next_step: { noul: next_step }, when: { noul: when }, distress: { noul: distress },
});

test("at most one nudge, in the fixed order", () => {
	assert.equal(journalFeedback(answers(0.1, 0.1, 0.1, 0.1)).key, "situation");
	assert.equal(journalFeedback(answers(0.9, 0.2, 0.1, 0.1)).key, "action");
	assert.equal(journalFeedback(answers(0.9, 0.9, 0.5, 0.1)).key, "next_step");
	const f = journalFeedback(answers(0.9, 0.9, 0.9, 0.1));
	assert.equal(f.key, "when");
	assert.equal(f.text, "Want to add when you'll try it?");
	for (const input of [answers(0, 0, 0, 0), answers(1, 0, 0, 0), answers(1, 1, 0, 0), answers(1, 1, 1, 0)]) {
		assert.equal((journalFeedback(input).text.match(/\?/g) ?? []).length, 1);
	}
});

test("all present gets the quiet specific line", () => {
	const f = journalFeedback(answers(0.9, 0.9, 0.9, 0.9));
	assert.equal(f.kind, "complete");
	assert.equal(f.text, "Great. You've named a moment, what you did, and a next step with a when.");
});

test("distress at 0.5 or more replaces any nudge with the support line", () => {
	const f = journalFeedback(answers(0.1, 0.1, 0.1, 0.1, 0.5));
	assert.equal(f.kind, "support");
	assert.match(f.text, /someone you trust/);
	assert.match(f.text, /workplace support/);
	assert.match(f.text, /local support service/);
	assert.equal(journalFeedback(answers(0.1, 0.1, 0.1, 0.1, 0.49)).kind, "nudge");
});

test("no feedback line is a score", () => {
	for (const a of [answers(0, 0, 0, 0), answers(1, 1, 1, 1), answers(1, 1, 1, 1, 1)]) assert.doesNotMatch(journalFeedback(a).text, /\d/);
});
