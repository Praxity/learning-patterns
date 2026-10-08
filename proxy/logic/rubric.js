import { band } from "./shared.js";

export const ANSWER_LIMIT = 800;

export const CRITERIA = [
	{"id": "work_deadline", "label": "Client report and Friday deadline"},
	{"id": "reason", "label": "Reason for the delay"},
	{"id": "new_date", "label": "New deadline of Tuesday"},
	{"id": "impact", "label": "Offer to limit the impact"},
	{"id": "agreement", "label": "Manager's agreement or input"},
	{"id": "blame", "label": "Blames someone"},
];

// Shared rubric calibration, including demos 01 and 15. The shorter deadline
// wording separates real due dates from draft offers in all three data groups.
// 0.625 accepts the two remaining clear 0.639+ deadlines; 0.60 agreement resolves
// both positive and negative hedges without adding credit to any gaming row.
/** @param {string} id @param {number} noul @param {string} [model] @returns {'met' | 'missed' | 'unsure'} */
export function rubricBand(id, noul, model) {
	if (model !== "@cf/cloudflare/clef") return band(noul);
	const sure = id === "work_deadline" ? 0.625 : id === "agreement" ? 0.60 : 0.65;
	return noul >= sure ? "met" : noul <= 1 - sure ? "missed" : "unsure";
}

/** Return six raw predicate bands. Other answers, including sincere, are ignored. */
/** @param {unknown} answers @param {string} [model] @returns {Record<string, 'met' | 'missed' | 'unsure'>} */
export function labelAnswers(answers, model) {
	return Object.fromEntries(CRITERIA.map(({ id }) => {
		const value = /** @type {Record<string, { noul?: unknown }> | null | undefined} */ (answers);
		const noul = value?.[id]?.noul;
		if (typeof noul !== 'number' || !Number.isFinite(noul) || noul < 0 || noul > 1) throw new Error(`Invalid Noul for ${id}`);
		return [id, rubricBand(id, noul, model)];
	}));
}

