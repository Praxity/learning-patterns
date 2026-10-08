// Clef uses the System One question and answer schemas. Workers AI also needs a
// short model selector inside the body; its binding takes the full model id.
export async function clef(ai, modelId, state, questions) {
	const data = await ai.run(modelId, { model: modelId.split('/').at(-1), state, questions });
	return { answers: data.answers, tokens: data.usage?.input_tokens ?? null };
}
