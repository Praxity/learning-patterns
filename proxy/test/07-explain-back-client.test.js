import assert from "node:assert/strict";
import test from "node:test";
import { explainFeedback, LESSON } from "../logic/07-explain-back.js";

const answers = (stonewalling, pause, ret) => ({ stonewalling: { noul: stonewalling }, pause: { noul: pause }, return: { noul: ret } });

test("all three ideas met means no links and the all-met state", () => {
	const f = explainFeedback(answers(0.9, 0.8, 0.7));
	assert.equal(f.allMet, true);
	assert.equal(f.met, 3);
	assert.ok(f.items.every((i) => i.link === null));
});

test("missed and unsure ideas link to their own lesson heading", () => {
	const f = explainFeedback(answers(0.9, 0.1, 0.5));
	assert.equal(f.allMet, false);
	const [stonewalling, pause, ret] = f.items;
	assert.equal(stonewalling.link, null);
	assert.equal(pause.state, "missed");
	assert.equal(pause.link.href, `#${LESSON.pause.id}`);
	assert.match(pause.text, /tell the other person you need a pause/);
	assert.equal(ret.state, "unsure");
	assert.equal(ret.link.href, `#${LESSON.return.id}`);
	assert.match(ret.text, /^I couldn't tell/);
});

test("lesson heading ids are unique on the page", () => {
	const ids = Object.values(LESSON).map((l) => l.id);
	assert.equal(new Set(ids).size, 3);
	assert.ok(ids.every((id) => id.startsWith("d07-")));
});
