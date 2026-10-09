// Clef uses the System One question and answer schemas. Workers AI also needs a
// short model selector inside the body; its binding takes the full model id.
export async function clef(ai, modelId, state, questions) {
	let timer;
	const deadline = new Promise((_, reject) => {
		timer = setTimeout(() => reject(new Error("Model deadline exceeded")), 15_000);
	});
	try {
		const data = await Promise.race([ai.run(modelId, { model: modelId.split('/').at(-1), state, questions }), deadline]);
		return { answers: data.answers, tokens: data.usage?.input_tokens ?? null };
	} finally { clearTimeout(timer); }
}
