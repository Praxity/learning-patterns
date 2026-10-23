/** Render a badge with an authored word, for server-rendered answer rows too.
 * @param {ChoiceMark} kind @param {string} word @param {string} [lang]
 * @returns {string}
 */
export function renderChoiceMark(kind: ChoiceMark, word: string, lang?: string): string;
/** Clear an answer row without changing its answer controls.
 * @param {HTMLElement} row
 */
export function clearChoice(row: HTMLElement): void;
/** Mark an answer row. Update a server-rendered badge if present.
 * @param {HTMLElement} row @param {ChoiceMark} kind
 * @param {MarkStrings} strings @param {string} [lang] The pattern root's language.
 */
export function markChoice(row: HTMLElement, kind: ChoiceMark, strings: MarkStrings, lang?: string): void;
export type ChoiceMark = "correct" | "wrong" | "missed";
export type MarkStrings = {
    markCorrect: string;
    markWrong: string;
    markAnswer: string;
};
