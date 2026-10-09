import { DEFAULT_MODEL } from './prices.js';
import { PERPLEXITY_MAX_INPUT_TOKENS } from './limits.js';

// Preserve the authored Jev wording. Decisions requires string instructions.
export function perplexityRequest(state, questions) {
	return { model: DEFAULT_MODEL, state, questions: Object.fromEntries(Object.entries(questions).map(([key, question]) => [key, {
		...question,
		...(question.instructions === undefined ? {} : { instructions: typeof question.instructions === 'string' ? question.instructions : JSON.stringify(question.instructions) }),
	}])) };
}

function convertAnswers(data, questions) {
	const valid = condition => { if (!condition) throw new Error('Invalid model response'); };
	const probability = value => valid(Number.isFinite(value) && value >= 0 && value <= 1);
	valid(data.model === DEFAULT_MODEL && data.answers && typeof data.answers === 'object' && !Array.isArray(data.answers));
	valid(Object.keys(data.answers).length === Object.keys(questions).length);
	return Object.fromEntries(Object.entries(questions).map(([key, question]) => {
		const answer = data.answers[key];
		valid(answer?.type === question.type);
		if (question.type === 'noul') { probability(answer.noul); return [key, { noul: answer.noul }]; }
		valid(question.type === 'choice');
		probability(answer.confidence);
		const keys = Object.keys(question.criteria);
		valid(answer.probabilities && typeof answer.probabilities === 'object' && !Array.isArray(answer.probabilities));
		valid(Object.keys(answer.probabilities).length === keys.length && keys.every(option => Object.hasOwn(answer.probabilities, option)));
		for (const value of Object.values(answer.probabilities)) probability(value);
		valid(Math.abs(Object.values(answer.probabilities).reduce((sum, value) => sum + value, 0) - 1) < 0.001);
		const probabilities = Object.fromEntries(keys.map(option => [option, answer.probabilities[option]]));
		valid(keys.includes(answer.choice) && probabilities[answer.choice] >= Math.max(...Object.values(probabilities)) - 1e-12);
		return [key, { choice: answer.choice, confidence: answer.confidence, probabilities }];
	}));
}

export async function perplexity(apiKey, state, questions) {
	if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('The model provider is not configured.');
	let timer;
	const controller = new AbortController();
	const deadline = new Promise((_, reject) => {
		timer = setTimeout(() => { reject(new Error('Model deadline exceeded')); controller.abort(); }, 15_000);
	});
	try {
		return await Promise.race([(async () => {
			const response = await fetch('https://api.perplexity.ai/v1/decisions', {
				method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
				body: JSON.stringify(perplexityRequest(state, questions)), signal: controller.signal,
			});
			if (response.status === 429) throw Object.assign(new Error('Model rate limit exceeded'), { status: 429 });
			if (response.status === 504) throw new Error('Model deadline exceeded');
			if (!response.ok) throw new Error('Invalid model response');
			const data = await response.json();
			const tokens = data.usage?.input_tokens;
			if (!Number.isSafeInteger(tokens) || tokens < 0 || tokens > PERPLEXITY_MAX_INPUT_TOKENS) throw new Error('Invalid billed input tokens');
			return { answers: convertAnswers(data, questions), tokens };
		})(), deadline]);
	} finally { clearTimeout(timer); }
}
