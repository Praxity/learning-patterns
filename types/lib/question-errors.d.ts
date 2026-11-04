/** Scroll the question into view without letting input focus hide its legend.
 * @param {HTMLElement} fieldset
 */
export function focusQuestion(fieldset: HTMLElement): void;
/** Keep unanswered links beside Check. Callers reveal a hidden panel before focus.
 * @param {HTMLElement} summary
 * @param {{ fieldset: HTMLElement, text: string, focus(): void }[]} questions
 */
export function questionLinks(summary: HTMLElement, questions: {
    fieldset: HTMLElement;
    text: string;
    focus(): void;
}[]): void;
/** Remove only the answered question's entry; keep the other errors available.
 * @param {HTMLElement} summary
 * @param {HTMLElement} fieldset
 */
export function clearQuestionLink(summary: HTMLElement, fieldset: HTMLElement): void;
