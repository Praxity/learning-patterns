/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string, stage?: 'first' | 'end' | 'both' }} options
 * @returns {string}
 */
export function render(content: import("./logic.js").Content, strings: import("./strings.js").Strings, { id, lang, stage }: {
    id: string;
    lang: string;
    stage?: "first" | "end" | "both";
}): string;
