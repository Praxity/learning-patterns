import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { CATALOGUE } from "../logic/06-misconceptions.js";
import explainBack from "../src/demos/07-explain-back.js";
import journal, { TASK as JOURNAL_TASK } from "../src/demos/13-journal.js";

// The proxy keeps server-side copies of card terms; these fail when a card changes without them.
const card = async (pattern, file) => JSON.parse(await readFile(new URL(`../../patterns/${pattern}/examples/${file}`, import.meta.url), "utf8"));

test("misconception labels and ideas match the card", async () => {
	const { misconceptions } = await card("misconception", "en.json");
	assert.deepEqual(Object.keys(CATALOGUE), misconceptions.map((m) => m.id));
	for (const { id, label, idea } of misconceptions) assert.deepEqual({ label: CATALOGUE[id].label, idea: CATALOGUE[id].idea }, { label, idea });
});

test("journal task asks the card's prompt", async () => {
	const { prompt } = await card("journal", "en.json");
	assert.ok(JOURNAL_TASK.startsWith(prompt), JOURNAL_TASK);
	assert.equal(journal.build({ answer: "x" }).state.task, JOURNAL_TASK);
});

test("explain-back criteria name stonewalling with the card's French term", async () => {
	const { ideas } = await card("explain-back", "fr.json");
	const term = ideas.find((idea) => idea.id === "stonewalling").heading.toLowerCase();
	for (const question of [explainBack.build({ answer: "x" }).questions.stonewalling, explainBack.clefQuestions.stonewalling]) {
		assert.ok(question.criteria.true.includes(term), question.criteria.true);
	}
});
