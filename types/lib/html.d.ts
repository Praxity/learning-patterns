/** Escape plain text for HTML text nodes and quoted attributes.
 * Set literal for code, identifiers or text already formatted in context.
 * @param {string} value @param {string} [lang] @param {{ literal?: boolean }} [options]
 * @returns {string}
 */
export function escapeHtml(value: string, lang?: string, { literal }?: {
    literal?: boolean;
}): string;
/** French nonbreaking punctuation, groups and currency. Preserve literal tokens.
 * @param {string} value @param {string} [lang] @returns {string}
 */
export function frenchTypography(value: string, lang?: string): string;
