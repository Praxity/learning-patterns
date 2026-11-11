/** Every case in full, usable without JavaScript: each case is a radio group with its answer in a
 * disclosure. `enhance` shows one case at a time, checks each one and adds the result.
 * @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 */
export function render(content: import("./logic.js").Content, strings: import("./strings.js").Strings, { id, lang }: {
    id: string;
    lang: string;
}): string;
