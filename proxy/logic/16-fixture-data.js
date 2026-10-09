import { CRITERIA, rubricBand, labelAnswers } from "./rubric.js";
export { CRITERIA, rubricBand, labelAnswers } from "./rubric.js";

// Browser-safe task copy. The server owns all question wording.
export const TASK_EN = "Your client report is due Friday. The sales data arrived three days late, so you need until Tuesday. Write the message to your manager.";
export const TASK_FR = "Votre rapport client est attendu vendredi. Les données de vente sont arrivées avec trois jours de retard. Il vous faut jusqu’à mardi. Écrivez le message à votre gestionnaire.";

// Expected labels authored before live calls. Met for blame means a mistake.
export const FIXTURES = [
	{
		id: "perfect",
		name: "Complete message",
		answer: "Hi Sam, the client report is due Friday. The sales data arrived three days late, so I need until Tuesday to finish it. I can send the finished sections by Friday. Would Tuesday work for you?",
		english: "Hi Sam, the client report is due Friday. The sales data arrived three days late, so I need until Tuesday to finish it. I can send the finished sections by Friday. Would Tuesday work for you?",
		french: "Bonjour Sam, le rapport client est attendu vendredi. Les données de vente sont arrivées avec trois jours de retard. Il me faudrait jusqu’à mardi pour le terminer. Je peux envoyer les sections terminées vendredi. Est-ce que mardi te convient?",
		expected: {"work_deadline": "met", "reason": "met", "new_date": "met", "impact": "met", "agreement": "met", "blame": "missed"},
	},
	{
		id: "no_work_deadline",
		name: "Work and original deadline missing",
		answer: "The sales data arrived three days late. Could I have until Tuesday to finish? I can send a draft by Friday. Does that work for you?",
		english: "The sales data arrived three days late. Could I have until Tuesday to finish? I can send a draft by Friday. Does that work for you?",
		french: "Les données de vente sont arrivées avec trois jours de retard. Est-ce que je peux avoir jusqu’à mardi pour finir? Je peux envoyer une version préliminaire vendredi. Est-ce que ça te convient?",
		expected: {"work_deadline": "missed", "reason": "met", "new_date": "met", "impact": "met", "agreement": "met", "blame": "missed"},
	},
	{
		id: "no_reason",
		name: "Reason missing",
		answer: "The client report is due Friday. Could I finish it by Tuesday instead? I can send the finished sections by Friday. Would that work for you?",
		english: "The client report is due Friday. Could I finish it by Tuesday instead? I can send the finished sections by Friday. Would that work for you?",
		french: "Le rapport client est attendu vendredi. Est-ce que je peux le terminer mardi plutôt? Je peux envoyer les sections terminées vendredi. Est-ce que ça te convient?",
		expected: {"work_deadline": "met", "reason": "missed", "new_date": "met", "impact": "met", "agreement": "met", "blame": "missed"},
	},
	{
		id: "no_new_date",
		name: "New date missing",
		answer: "The client report is due Friday. The sales data arrived three days late. I need more time and can send a draft by Friday. What do you suggest?",
		english: "The client report is due Friday. The sales data arrived three days late. I need more time and can send a draft by Friday. What do you suggest?",
		french: "Le rapport client est attendu vendredi. Les données de vente sont arrivées avec trois jours de retard. J’ai besoin de plus de temps et je peux envoyer une version préliminaire vendredi. Qu’est-ce que tu proposes?",
		expected: {"work_deadline": "met", "reason": "met", "new_date": "missed", "impact": "met", "agreement": "met", "blame": "missed"},
	},
	{
		id: "no_impact",
		name: "Offer missing",
		answer: "The client report is due Friday. The sales data arrived three days late. Could I have until Tuesday to finish it?",
		english: "The client report is due Friday. The sales data arrived three days late. Could I have until Tuesday to finish it?",
		french: "Le rapport client est attendu vendredi. Les données de vente sont arrivées avec trois jours de retard. Est-ce que je peux avoir jusqu’à mardi pour le terminer?",
		expected: {"work_deadline": "met", "reason": "met", "new_date": "met", "impact": "missed", "agreement": "met", "blame": "missed"},
	},
	{
		id: "no_agreement",
		name: "Agreement missing",
		answer: "The client report is due Friday. The sales data arrived three days late. I will finish it Tuesday and send the finished sections by Friday.",
		english: "The client report is due Friday. The sales data arrived three days late. I will finish it Tuesday and send the finished sections by Friday.",
		french: "Le rapport client est attendu vendredi. Les données de vente sont arrivées avec trois jours de retard. Je vais le terminer mardi et envoyer les sections terminées vendredi.",
		expected: {"work_deadline": "met", "reason": "met", "new_date": "met", "impact": "met", "agreement": "missed", "blame": "missed"},
	},
	{
		id: "several_missing",
		name: "Several parts missing",
		answer: "The data arrived late. I need more time.",
		english: "The data arrived late. I need more time.",
		french: "Les données sont arrivées en retard. J’ai besoin de plus de temps.",
		expected: {"work_deadline": "missed", "reason": "met", "new_date": "missed", "impact": "missed", "agreement": "missed", "blame": "missed"},
	},
	{
		id: "vague_date",
		name: "Vague new date",
		answer: "The client report is due Friday. The sales data arrived three days late. Could I finish it sometime next week? I can send a draft by Friday.",
		english: "The client report is due Friday. The sales data arrived three days late. Could I finish it sometime next week? I can send a draft by Friday.",
		french: "Le rapport client est attendu vendredi. Les données de vente sont arrivées avec trois jours de retard. Est-ce que je peux le terminer au courant de la semaine prochaine? Je peux envoyer une version préliminaire vendredi.",
		expected: {"work_deadline": "met", "reason": "met", "new_date": "missed", "impact": "met", "agreement": "met", "blame": "missed"},
		holdout: true,
	},
	{
		id: "blame_mistake",
		name: "Blames sales",
		answer: "The client report is due Friday. The sales data arrived three days late because sales never sends anything on time. Could I finish it Tuesday? I can send a draft by Friday.",
		english: "The client report is due Friday. The sales data arrived three days late because sales never sends anything on time. Could I finish it Tuesday? I can send a draft by Friday.",
		french: "Le rapport client est attendu vendredi. Les données de vente sont arrivées avec trois jours de retard parce que l’équipe des ventes n’envoie jamais rien à temps. Est-ce que je peux le terminer mardi? Je peux envoyer une version préliminaire vendredi.",
		expected: {"work_deadline": "met", "reason": "met", "new_date": "met", "impact": "met", "agreement": "met", "blame": "met"},
	},
	{
		id: "french",
		name: "Complete French message",
		answer: "Bonjour Sam, est-ce qu’on peut reporter la date de remise du rapport client de vendredi à mardi? Les données de vente sont arrivées avec trois jours de retard. Je peux envoyer une version préliminaire vendredi. Dis-moi si une autre solution te conviendrait mieux.",
		english: "Hi Sam, could we move the client report deadline from Friday to Tuesday? The sales data arrived three days late. I can send a draft Friday. Let me know if another plan would work better.",
		french: "Bonjour Sam, est-ce qu’on peut reporter la date de remise du rapport client de vendredi à mardi? Les données de vente sont arrivées avec trois jours de retard. Je peux envoyer une version préliminaire vendredi. Dis-moi si une autre solution te conviendrait mieux.",
		expected: {"work_deadline": "met", "reason": "met", "new_date": "met", "impact": "met", "agreement": "met", "blame": "missed"},
		holdout: true,
	},
	{
		id: "short",
		name: "Very short request",
		answer: "Could I have until Tuesday?",
		english: "Could I have until Tuesday?",
		french: "Est-ce que je peux avoir jusqu’à mardi?",
		expected: {"work_deadline": "missed", "reason": "missed", "new_date": "met", "impact": "missed", "agreement": "met", "blame": "missed"},
		holdout: true,
	},
	{
		id: "off_topic",
		name: "Off-topic answer",
		answer: "I made vegetable soup for lunch and saved the leftovers for tomorrow.",
		english: "I made vegetable soup for lunch and saved the leftovers for tomorrow.",
		french: "J’ai fait une soupe aux légumes pour dîner et gardé les restes pour demain.",
		expected: {"work_deadline": "missed", "reason": "missed", "new_date": "missed", "impact": "missed", "agreement": "missed", "blame": "missed"},
	},
];

function validateFixture(fixture) {
	if (typeof fixture?.id !== "string" || typeof fixture?.name !== "string") throw new Error("Invalid fixture identity");
	const expected = fixture.expected;
	if (!expected || Object.keys(expected).length !== CRITERIA.length || CRITERIA.some(({ id }) => expected[id] !== "met" && expected[id] !== "missed")) {
		throw new Error(`Invalid expected labels for ${fixture.id}`);
	}
}

/**
 * rows: [{fixture,result}], where result is the ask response with answers.
 * total counts predicate cells. matches + mismatches + uncertain = total.
 * perCriterion uses the same counts; disagreements includes mismatches and unsure.
 */
export function summarizeFixtures(rows) {
	if (!Array.isArray(rows)) throw new Error("Fixture rows must be an array");
	const summary = {
		fixtures: rows.length, total: rows.length * CRITERIA.length,
		matches: 0, mismatches: 0, uncertain: 0,
		perCriterion: Object.fromEntries(CRITERIA.map(({ id }) => [id, { total: rows.length, matches: 0, mismatches: 0, uncertain: 0 }])),
		disagreements: [],
	};
	for (const { fixture, result } of rows) {
		validateFixture(fixture);
		const actual = labelAnswers(result?.answers, result?.model);
		for (const { id } of CRITERIA) {
			const expected = fixture.expected[id];
			const outcome = actual[id] === "unsure" ? "uncertain" : actual[id] === expected ? "matches" : "mismatches";
			summary[outcome]++;
			summary.perCriterion[id][outcome]++;
			if (outcome !== "matches") summary.disagreements.push({
				fixtureId: fixture.id, fixtureName: fixture.name, criterion: id,
				expected, actual: actual[id], noul: result.answers[id].noul,
			});
		}
	}
	return summary;
}

/**
 * rows: [{fixture,english,french}], each language an ask response.
 * Each language contains the fixture summary and raw meanNoul/meanByCriterion.
 * total counts paired predicates. agreements require equal definite labels.
 * disagreementsCount counts unequal labels. uncertainPairs counts either unsure,
 * so it can overlap disagreementsCount. Detail rows include unequal or unsure pairs.
 * perCriterion contains pair counts, language matches and raw language means.
 * Empty means are null. Means describe yes probability, never answer quality.
 */
export function summarizeParity(rows) {
	if (!Array.isArray(rows)) throw new Error("Parity rows must be an array");
	const languageSummary = (language) => {
		const summary = summarizeFixtures(rows.map(({ fixture, [language]: result }) => ({ fixture, result })));
		const meanByCriterion = Object.fromEntries(CRITERIA.map(({ id }) => [id,
			rows.length ? rows.reduce((sum, row) => sum + row[language].answers[id].noul, 0) / rows.length : null,
		]));
		return { ...summary, meanByCriterion, meanNoul: rows.length ? Object.values(meanByCriterion).reduce((sum, value) => sum + value, 0) / CRITERIA.length : null };
	};
	const english = languageSummary("english");
	const french = languageSummary("french");
	const summary = {
		pairs: rows.length, total: rows.length * CRITERIA.length,
		agreements: 0, disagreementsCount: 0, uncertainPairs: 0,
		english, french,
		perCriterion: Object.fromEntries(CRITERIA.map(({ id }) => [id, {
			total: rows.length, agreements: 0, disagreements: 0, uncertainPairs: 0,
			englishMatches: english.perCriterion[id].matches, frenchMatches: french.perCriterion[id].matches,
			englishMean: english.meanByCriterion[id], frenchMean: french.meanByCriterion[id],
		}])),
		disagreements: [],
	};
	for (const row of rows) {
		const en = labelAnswers(row.english.answers, row.english.model);
		const fr = labelAnswers(row.french.answers, row.french.model);
		for (const { id } of CRITERIA) {
			const different = en[id] !== fr[id];
			const uncertain = en[id] === "unsure" || fr[id] === "unsure";
			if (!different && !uncertain) { summary.agreements++; summary.perCriterion[id].agreements++; }
			if (different) { summary.disagreementsCount++; summary.perCriterion[id].disagreements++; }
			if (uncertain) { summary.uncertainPairs++; summary.perCriterion[id].uncertainPairs++; }
			if (different || uncertain) summary.disagreements.push({
				fixtureId: row.fixture.id, fixtureName: row.fixture.name, criterion: id,
				expected: row.fixture.expected[id], english: en[id], french: fr[id],
				englishNoul: row.english.answers[id].noul, frenchNoul: row.french.answers[id].noul,
			});
		}
	}
	return summary;
}
