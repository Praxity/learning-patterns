/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').AuthorState): void } }} options
 */
export function enhance(root: HTMLElement, { content, strings, state }: {
    content: import("./logic.js").Content;
    strings: import("./strings.js").Strings;
    state?: {
        read(): unknown;
        write(value: import("./logic.js").AuthorState): void;
    };
}): {
    destroy(): void;
};
