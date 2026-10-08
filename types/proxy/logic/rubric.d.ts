/** @param {string} id @param {number} noul @param {string} [model] @returns {'met' | 'missed' | 'unsure'} */
export function rubricBand(id: string, noul: number, model?: string): "met" | "missed" | "unsure";
/** Return six raw predicate bands. Other answers, including sincere, are ignored. */
/** @param {unknown} answers @param {string} [model] @returns {Record<string, 'met' | 'missed' | 'unsure'>} */
export function labelAnswers(answers: unknown, model?: string): Record<string, "met" | "missed" | "unsure">;
export const ANSWER_LIMIT: 800;
export const CRITERIA: {
    id: string;
    label: string;
}[];
