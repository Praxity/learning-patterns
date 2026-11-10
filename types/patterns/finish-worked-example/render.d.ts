/** Every case in full, usable without JavaScript: the learner's steps are radio groups and each
 * case's answers sit in a disclosure. `enhance` shows one case at a time and checks each step.
 * @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options */
export function render(content: import("./logic.js").Content, strings: import("./strings.js").Strings, { id, lang }: {
    id: string;
    lang: string;
}): string;
