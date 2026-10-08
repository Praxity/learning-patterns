/** @param {string} template @param {Record<string, unknown>} values */
export function format(template: string, values: Record<string, unknown>): string;
/** @param {ReturnType<typeof summarize>} summary @param {import('./strings.js').Strings} strings */
export function summaryText(summary: ReturnType<typeof summarize>, strings: import("./strings.js").Strings): string;
/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 */
export function render(content: import("./logic.js").Content, strings: import("./strings.js").Strings, { id, lang }: {
    id: string;
    lang: string;
}): string;
/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings
 * @param {ReturnType<typeof summarize>['rows'][number]} row @param {'en' | 'fr'} language
 * @param {string} id @param {boolean} [enhanced]
 */
export function renderRow(content: import("./logic.js").Content, strings: import("./strings.js").Strings, row: ReturnType<typeof summarize>["rows"][number], language: "en" | "fr", id: string, enhanced?: boolean): string;
import { summarize } from './logic.js';
