/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string, today?: Date }} options @returns {string}
 */
export function render(content: import("./logic.js").Content, strings: import("./strings.js").Strings, { id, lang, today }: {
    id: string;
    lang: string;
    today?: Date;
}): string;
