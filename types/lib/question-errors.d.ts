/** @param {HTMLElement} fieldset */
export function focusQuestion(fieldset: HTMLElement): void;
/** @param {HTMLElement} summary
 * @param {{ fieldset: HTMLElement, text: string, focus(): void }[]} questions */
export function questionLinks(summary: HTMLElement, questions: {
    fieldset: HTMLElement;
    text: string;
    focus(): void;
}[]): void;
/** @param {HTMLElement} summary
 * @param {HTMLElement} fieldset */
export function clearQuestionLink(summary: HTMLElement, fieldset: HTMLElement): void;
