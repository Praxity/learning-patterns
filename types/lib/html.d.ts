/** @param {string} value @param {string} [lang] @param {{ literal?: boolean }} [options]
 * @returns {string} */
export function escapeHtml(value: string, lang?: string, { literal }?: {
    literal?: boolean;
}): string;
/** @param {string} value @param {string} [lang] @returns {string} */
export function frenchTypography(value: string, lang?: string): string;
