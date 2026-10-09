import assert from "node:assert/strict";
import test from "node:test";
import rubric, { TASK } from "../src/demos/01-rubric.js";
import fixtures from "../src/demos/16-fixtures.js";
import { CRITERIA, FIXTURES, TASK_EN, labelAnswers, summarizeFixtures } from "../logic/16-fixture-data.js";

const expected = { work_deadline: "met", reason: "met", new_date: "met", impact: "met", agreement: "met", blame: "missed" };
const fixture = { id: "literal", name: "Literal complete message", expected };
const result = (values) => ({ answers: Object.fromEntries(Object.entries(values).map(([id, noul]) => [id, { noul }])) });

test("fixture server reuses demo 1 and browser task matches the server task", () => {
	assert.equal(fixtures.id, "16-fixtures");
	assert.deepEqual(fixtures.fields, { answer: 800 });
	assert.deepEqual(fixtures.build({ answer: "A message" }), rubric.build({ answer: "A message" }));
	assert.equal(TASK_EN, TASK);
});

test("twelve authored fixtures cover omissions, French and held-out cases", () => {
	assert.equal(FIXTURES.length, 12);
	assert.equal(new Set(FIXTURES.map(({ id }) => id)).size, 12);
	assert.deepEqual(FIXTURES.filter(({ holdout }) => holdout).map(({ id }) => id), ["vague_date", "french", "short"]);
	assert.deepEqual(CRITERIA.map(({ id }) => id), ["work_deadline", "reason", "new_date", "impact", "agreement", "blame"]);
	for (const entry of FIXTURES) {
		assert.deepEqual(Object.keys(entry.expected), ["work_deadline", "reason", "new_date", "impact", "agreement", "blame"]);
		assert.ok(Object.values(entry.expected).every((label) => label === "met" || label === "missed"));
		for (const field of ["answer", "english", "french"]) assert.ok(entry[field].length > 0 && entry[field].length <= 800);
		assert.equal(entry.answer, entry.id === "french" ? entry.french : entry.english);
		assert.equal(entry.expected.blame, entry.id === "blame_mistake" ? "met" : "missed");
	}
	assert.deepEqual(FIXTURES.find(({ id }) => id === "perfect").expected, expected);
	assert.deepEqual(FIXTURES.find(({ id }) => id === "short").expected, { work_deadline: "missed", reason: "missed", new_date: "met", impact: "missed", agreement: "met", blame: "missed" });
	for (const id of ["work_deadline", "reason", "new_date", "impact", "agreement"]) {
		const entry = FIXTURES.find((row) => row.id === `no_${id}`);
		assert.deepEqual(entry.expected, { ...expected, [id]: "missed" });
	}
});

test("labels use inclusive thresholds and preserve the uncertain interval", () => {
	const answers = result({ work_deadline: 0, reason: 0.35, new_date: 0.350001, impact: 0.649999, agreement: 0.65, blame: 1 }).answers;
	answers.sincere = { noul: 0.5 };
	assert.deepEqual(labelAnswers(answers), { work_deadline: "missed", reason: "missed", new_date: "unsure", impact: "unsure", agreement: "met", blame: "met" });
});

test("invalid or missing Nouls fail rather than becoming uncertain labels", () => {
	const answers = result({ work_deadline: 0.9, reason: 0.9, new_date: 0.9, impact: 0.9, agreement: 0.9, blame: 0.1 }).answers;
	for (const noul of [NaN, Infinity, -Infinity, -0.01, 1.01, "0.8", null, undefined]) {
		assert.throws(() => labelAnswers({ ...answers, new_date: { noul } }), /Invalid Noul for new_date/);
	}
	const { work_deadline, ...missing } = answers;
	assert.throws(() => labelAnswers(missing), /Invalid Noul for work_deadline/);
	assert.throws(() => labelAnswers(null), /Invalid Noul for work_deadline/);
});

test("fixture summary separates certain mistakes and uncertainty", () => {
	const response = result({ work_deadline: 0.9, reason: 0.1, new_date: 0.5, impact: 0.9, agreement: 0.9, blame: 0.1 });
	const summary = summarizeFixtures([{ fixture, result: response }]);
	assert.deepEqual({ fixtures: summary.fixtures, total: summary.total, matches: summary.matches, mismatches: summary.mismatches, uncertain: summary.uncertain }, { fixtures: 1, total: 6, matches: 4, mismatches: 1, uncertain: 1 });
	assert.deepEqual(summary.perCriterion.reason, { total: 1, matches: 0, mismatches: 1, uncertain: 0 });
	assert.deepEqual(summary.perCriterion.new_date, { total: 1, matches: 0, mismatches: 0, uncertain: 1 });
	assert.deepEqual(summary.disagreements, [
		{ fixtureId: "literal", fixtureName: "Literal complete message", criterion: "reason", expected: "met", actual: "missed", noul: 0.1 },
		{ fixtureId: "literal", fixtureName: "Literal complete message", criterion: "new_date", expected: "met", actual: "unsure", noul: 0.5 },
	]);
	const repeated = summarizeFixtures([{ fixture, result: response }, { fixture, result: response }]);
	assert.equal(repeated.total, 12);
	assert.equal(repeated.matches, 8);
	assert.equal(repeated.mismatches, 2);
	assert.equal(repeated.uncertain, 2);
});

test("empty fixture summary reports zero, and invalid expectations fail", () => {
	assert.deepEqual(summarizeFixtures([]).perCriterion.work_deadline, { total: 0, matches: 0, mismatches: 0, uncertain: 0 });
	assert.equal(summarizeFixtures([]).total, 0);
	assert.throws(() => summarizeFixtures(null), /Fixture rows must be an array/);
	assert.throws(() => summarizeFixtures([{ fixture: { ...fixture, expected: { ...expected, work_deadline: "unsure" } }, result: {} }]), /Invalid expected labels/);
	assert.throws(() => summarizeFixtures([{ fixture: { ...fixture, expected: { ...expected, extra: "met" } }, result: {} }]), /Invalid expected labels/);
	assert.throws(() => summarizeFixtures([{ fixture, result: {} }]), /Invalid Noul for work_deadline/);
});
