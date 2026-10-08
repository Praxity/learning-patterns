/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: unknown): void }, ask?: import('../../lib/ask.js').Ask }} options
 */
export function enhance(root: HTMLElement, { content, strings, ask }: {
    content: import("./logic.js").Content;
    strings: import("./strings.js").Strings;
    state?: {
        read(): unknown;
        write(value: unknown): void;
    };
    ask?: import("../../lib/ask.js").Ask;
}): {
    destroy(): void;
};
