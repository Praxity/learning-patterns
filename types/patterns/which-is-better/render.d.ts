/** @typedef {import('./logic.js').Content} Content
 * @typedef {import('./strings.js').Strings} Strings
 */
/** @param {Content} content @param {Strings} strings @param {{ id: string, lang: string }} options */
export function render(content: Content, strings: Strings, { id, lang }: {
    id: string;
    lang: string;
}): string;
export type Content = import("./logic.js").Content;
export type Strings = import("./strings.js").Strings;
