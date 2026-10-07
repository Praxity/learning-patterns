/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 * @returns {string}
 */
export function render(content: import("./logic.js").Content, strings: import("./strings.js").Strings, { id, lang }: {
    id: string;
    lang: string;
}): string;
/** Decorative progress ring. The adjacent authored text carries the count.
 * @param {number} count @param {number} total @param {number} [size]
 * @returns {string}
 */
export function ring(count: number, total: number, size?: number): string;
