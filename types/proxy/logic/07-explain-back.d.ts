/** @param {Record<string, { noul: number }>} answers */
export function explainFeedback(answers: Record<string, {
    noul: number;
}>): {
    items: {
        key: string;
        state: "unsure" | "met" | "missed";
    }[];
    met: number;
    allMet: boolean;
};
export const ANSWER_LIMIT: 1500;
export const IDEA_KEYS: string[];
