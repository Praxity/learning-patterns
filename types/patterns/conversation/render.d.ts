/** @param {import('./logic.js').Content} content @param {string} line @param {string} id @param {string} [lang] */
export function renderMichel(content: import("./logic.js").Content, line: string, id: string, lang?: string): string;
/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings @param {import('./logic.js').ConversationState} state @param {string} [lang] */
export function renderDebrief(content: import("./logic.js").Content, strings: import("./strings.js").Strings, state: import("./logic.js").ConversationState, lang?: string): string;
/** @param {import('./logic.js').Content} content @param {'opening' | import('./logic.js').Branch} node @param {string} [lang] */
export function renderChoices(content: import("./logic.js").Content, node: "opening" | import("./logic.js").Branch, lang?: string): string;
/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings @param {{ id: string, lang: string }} options */
export function render(content: import("./logic.js").Content, strings: import("./strings.js").Strings, { id, lang }: {
    id: string;
    lang: string;
}): string;
