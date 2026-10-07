/** @typedef {{ element: HTMLElement, fieldset: HTMLFieldSetElement, check: HTMLButtonElement, error: HTMLElement, rows: { input: HTMLInputElement, row: HTMLLabelElement, word: HTMLElement, feedback: HTMLElement }[] }} QuestionBlock */
/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options
 */
export function enhance(root: HTMLElement, { content, strings, state }: {
    content: import("./logic.js").Content;
    strings: import("./strings.js").Strings;
    state?: {
        read(): unknown;
        write(value: import("./logic.js").LearnerState): void;
    };
}): {
    destroy(): void;
};
export type QuestionBlock = {
    element: HTMLElement;
    fieldset: HTMLFieldSetElement;
    check: HTMLButtonElement;
    error: HTMLElement;
    rows: {
        input: HTMLInputElement;
        row: HTMLLabelElement;
        word: HTMLElement;
        feedback: HTMLElement;
    }[];
};
