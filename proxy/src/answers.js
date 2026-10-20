// Keep only typed answers to server-owned questions. Providers may echo state in
// extra fields; persisting their raw response would break the no-text promise.
export function readAnswers(answers, questions) {
	if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw new Error("Invalid model answers");
	const probability = value => {
		if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error("Invalid model probability");
		return value;
	};
	return Object.fromEntries(Object.entries(questions).map(([id, question]) => {
		const answer = answers[id];
		if (!answer || typeof answer !== "object" || Array.isArray(answer)) throw new Error("Missing model answer");
		if (answer.type !== undefined && answer.type !== question.type) throw new Error("Invalid model answer type");
		const result = answer.type === undefined ? {} : { type: question.type };
		if (question.type === "noul") result.noul = probability(answer.noul);
		else {
			if (question.type !== "choice") throw new Error("Invalid question type");
			const choices = Object.keys(question.criteria);
			if (typeof answer.choice !== "string" || !choices.includes(answer.choice)) throw new Error("Invalid model choice");
			result.choice = answer.choice;
			result.confidence = probability(answer.confidence);
			if (answer.probabilities !== undefined) {
				if (!answer.probabilities || typeof answer.probabilities !== "object" || Array.isArray(answer.probabilities)) throw new Error("Invalid model probabilities");
				result.probabilities = Object.fromEntries(Object.entries(answer.probabilities).map(([choice, value]) => {
					if (!choices.includes(choice)) throw new Error("Invalid model probability choice");
					return [choice, probability(value)];
				}));
			}
		}
		return [id, result];
	}));
}
