/** Render a badge with an authored word, for server-rendered answer rows too.
 * @param {ChoiceMark} kind @param {string} word @param {string} [lang]
 * @returns {string}
 */
export function renderChoiceMark(kind: ChoiceMark, word: string, lang?: string): string;
/** Mark an answer row, or remove its mark with null. Update a server-rendered badge if present.
 * @param {HTMLElement} row @param {ChoiceMark | null} kind
 * @param {MarkStrings} strings @param {string} [lang] The pattern root's language.
 */
export function markChoice(row: HTMLElement, kind: ChoiceMark | null, strings: MarkStrings, lang?: string): void;
export type ChoiceMark = "correct" | "wrong" | "missed";
export type MarkStrings = {
    markCorrect: string;
    markWrong: string;
    markAnswer: string;
};
