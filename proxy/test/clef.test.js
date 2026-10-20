import test from 'node:test';
import assert from 'node:assert/strict';
import { clef } from '../src/clef.js';

for (const model of ['clef-flash', 'clef']) {
	test(`Clef ${model} preserves all Jev answer fields and sends the short selector`, async () => {
		const state = { answer: 'A real attempt' };
		const questions = { yes: { type: 'noul', instructions: 'Yes?' }, pick: { type: 'choice', instructions: 'Pick', criteria: { a: 'A', b: 'B' } }, level: { type: 'score', instructions: 'Rate', criteria: ['Low', 'High'] } };
		const answers = { yes: { type: 'noul', noul: 0.7 }, pick: { type: 'choice', choice: 'a', confidence: 0.8, probabilities: { a: 0.9, b: 0.1 } }, level: { type: 'score', score: 0.8, confidence: 0.6, probabilities: { 0: 0.2, 1: 0.8 }, legend: { 0: 'Low', 1: 'High' } } };
		const binding = { async run(id, request) {
			assert.equal(id, `@cf/cloudflare/${model}`);
			assert.deepEqual(request, { model, state, questions });
			return { model, answers, usage: { input_tokens: 123, output_tokens: 50 } };
		} };
		assert.deepEqual(await clef(binding, `@cf/cloudflare/${model}`, state, questions), { answers, tokens: 123 });
	});
}

test('missing usage stays unknown, rather than zero', async () => {
	assert.deepEqual(await clef({ run: async () => ({ answers: {} }) }, '@cf/cloudflare/clef-flash', '', {}), { answers: {}, tokens: null });
});

test('binding errors propagate unchanged', async () => {
	const error = new Error('HTTP 429 quota exceeded');
	await assert.rejects(clef({ run: async () => { throw error; } }, '@cf/cloudflare/clef-flash', '', {}), e => e === error);
});
