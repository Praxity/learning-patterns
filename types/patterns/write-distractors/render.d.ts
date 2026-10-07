/** Render keyed rows for both the native fallback and the enhanced comparison.
 * @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {(import('./logic.js').AuthorOption | import('./logic.js').LearnerOption)[]} options
 * @param {{ author?: boolean, matches?: boolean[], heading?: boolean }} [settings]
 * @returns {string}
 */
export function renderQuestionPreview(content: import("./logic.js").Content, strings: import("./strings.js").Strings, options: (import("./logic.js").AuthorOption | import("./logic.js").LearnerOption)[], { author, matches, heading }?: {
    author?: boolean;
    matches?: boolean[];
    heading?: boolean;
}): string;
/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options @returns {string}
 */
export function render(content: import("./logic.js").Content, strings: import("./strings.js").Strings, { id, lang }: {
    id: string;
    lang: string;
}): string;
