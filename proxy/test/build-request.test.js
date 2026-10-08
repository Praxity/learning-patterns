import assert from "node:assert/strict";
import test from "node:test";
import { buildRequest } from "../src/worker.js";
import { blocks as demos } from "../src/registry.js";

test("rejects unknown demos, extra fields, missing fields and long text", () => {
	assert.match(jevRequest({ block: "nope", fields: {} }).error, /Unknown block/);
	assert.match(jevRequest({ block: "16-fixtures", fields: { answer: "x", extra: "y" } }).error, /Unexpected field/);
	assert.match(jevRequest({ block: "16-fixtures", fields: {} }).error, /Missing field/);
	assert.match(jevRequest({ block: "16-fixtures", fields: { answer: "x".repeat(801) } }).error, /too long/);
	assert.match(jevRequest({ block: "16-fixtures", fields: { answer: 3 } }).error, /must be text/);
});

test("builds server-side questions for a valid request", () => {
	const r = jevRequest({ block: "16-fixtures", fields: { answer: "A message" } });
	assert.equal(r.error, undefined);
	assert.equal(r.state.answer, "A message");
	assert.equal(r.questions.impact.type, "noul");
});

test("every built demo has a matching id and valid question types", () => {
	for (const [id, demo] of Object.entries(demos)) {
		assert.equal(demo.id, id);
		if (!Object.keys(demo.fields).length) continue; // stub
		const input = Object.fromEntries(Object.keys(demo.fields).map((k) => [k, demo.sample?.[k] ?? "sample text"]));
		const { questions } = demo.build(input);
		for (const [qid, q] of Object.entries(questions)) {
			assert.ok(["noul", "choice", "score"].includes(q.type), `${id}.${qid} type`);
			if (q.type === "choice") assert.ok(Object.keys(q.criteria).length >= 2 && Object.keys(q.criteria).length <= 255, `${id}.${qid} options`);
			if (q.type === "score") assert.ok(q.criteria.length >= 2 && q.criteria.length <= 10, `${id}.${qid} levels`);
		}
	}
});

function jevRequest(body) { return buildRequest(body, "jev"); }
