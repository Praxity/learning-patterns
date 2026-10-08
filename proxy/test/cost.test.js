import assert from "node:assert/strict";
import test from "node:test";
import { costOf, costText } from "../logic/cost.js";
import worker from "../src/worker.js";

test("cost uses $0.042 per million input tokens", () => {
	assert.equal(costOf(1_000_000, "jev-1.13.0"), 0.042);
	assert.equal(costOf(0), 0);
});

test("the browser price module exposes the same calculations", async () => {
	const response = await worker.fetch(new Request("https://demo.example/api/patterns/prices.js"), {});
	assert.match(response.headers.get("content-type"), /javascript/);
	const browser = await import(`data:text/javascript;base64,${Buffer.from(await response.text()).toString("base64")}`);
	assert.equal(browser.costOf(1000, "jev-1.13.0"), 0.000042);
	assert.equal(browser.costOf(1000, "@cf/cloudflare/clef-flash"), 0.00009);
	assert.equal(browser.costOf(1000, "@cf/cloudflare/clef"), 0.00024);
});

test("the cost label uses each model's list price and rejects unknown models", () => {
	assert.equal(costOf(1_000_000, "@cf/cloudflare/clef-flash"), 0.09);
	assert.equal(costOf(1_000_000, "@cf/cloudflare/clef"), 0.24);
	assert.throws(() => costOf(1000, "unknown"), /model/i);
});

test("cost text for one check and for a run of checks", () => {
	assert.equal(costText({ model: "jev-1.13.0", calls: 1, tokens: 1000 }), "$0.000042 for 1,000 tokens. About $0.04 per 1,000 runs.");
	assert.equal(costText({ model: "jev-1.13.0", calls: 12, tokens: 250000 }), "$0.01 for 12 checks, 250,000 tokens. About $10.50 per 1,000 runs.");
});
