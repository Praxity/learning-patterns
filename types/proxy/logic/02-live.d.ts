/** The original confidence gates apply to every criterion independently.
 * @param {unknown} answers
 * @returns {{ items: { key: string, state: 'met' | 'missed' | 'unsure' }[], met: number, allMet: boolean }}
 */
export function liveFeedback(answers: unknown): {
    items: {
        key: string;
        state: "met" | "missed" | "unsure";
    }[];
    met: number;
    allMet: boolean;
};
export const ANSWER_LIMIT: 1200;
export const CRITERION_KEYS: string[];
