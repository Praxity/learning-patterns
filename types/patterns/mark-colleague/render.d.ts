/** One issue: what to look at, an optional mark from the learner's tick, and the explanation.
 * @param {import('./logic.js').Issue} issue @param {import('./strings.js').Strings} strings @param {string} lang
 * @param {boolean | null} raised `null` leaves the mark out, as in the version without JavaScript.
 */
export function issueItem(issue: import("./logic.js").Issue, strings: import("./strings.js").Strings, lang: string, raised: boolean | null): string;
/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 * @returns {string}
 */
export function render(content: import("./logic.js").Content, strings: import("./strings.js").Strings, { id, lang }: {
    id: string;
    lang: string;
}): string;
