/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void }, ask?: import('../../lib/ask.js').Ask }} options
 */
export function enhance(root: HTMLElement, { content, strings, state, ask }: {
    content: import("./logic.js").Content;
    strings: import("./strings.js").Strings;
    state?: {
        read(): unknown;
        write(value: import("./logic.js").LearnerState): void;
    };
    ask?: import("../../lib/ask.js").Ask;
}): {
    destroy(): void;
};
