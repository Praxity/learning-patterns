/** @param {Record<string, { noul: number }>} answers */
export function explainFeedback(answers: Record<string, {
    noul: number;
}>): {
    items: {
        key: string;
        state: "unsure" | "met" | "missed";
        text: string;
        link: {
            href: string;
            text: string;
        } | null;
    }[];
    met: number;
    allMet: boolean;
};
export const ANSWER_LIMIT: 1500;
/** @type {Record<string, { id: string, heading: string, body: string }>} */
export const LESSON: Record<string, {
    id: string;
    heading: string;
    body: string;
}>;
export const IDEA_KEYS: string[];
