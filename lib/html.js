/** Escape plain text for HTML text nodes and quoted attributes.
 * Set literal for code, identifiers or text already formatted in context.
 * @param {string} value @param {string} [lang] @param {{ literal?: boolean }} [options]
 * @returns {string}
 */
export function escapeHtml(value, lang = 'en', { literal = false } = {}) {
  if (!literal) value = frenchTypography(value, lang);
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character] ?? character);
}


/** French nonbreaking punctuation, groups and currency. Preserve literal tokens.
 * @param {string} value @param {string} [lang] @returns {string}
 */
export function frenchTypography(value, lang = 'en') {
  if (!/^fr(?:-|$)/i.test(lang)) return value;
  const space = /** @param {string} existing */ existing => existing.includes('\u00a0') ? '\u00a0' : '\u202f';
  /** @param {string} part */
  const format = part => part
      .replace(/(\d)[ \t\u00a0\u202f]+(?=\d{3}(?:\D|$))/g, (match, digit) => `${digit}${space(match)}`)
      .replace(/([^\s:;!?$€£¥«])[ \t\u00a0\u202f]*([:;!?%$€£¥»])/g, (match, before, punctuation, offset, text) => {
        if (punctuation === ':' && /\d/.test(before) && /\d/.test(text[offset + match.length] ?? '')) return match;
        return `${before}${space(match)}${punctuation}`;
      })
      .replace(/[ \t]+(?=[:;!?%$€£¥])/g, '\u202f')
      .replace(/«[ \t\u00a0\u202f]*/g, match => `«${space(match)}`);
  const tokens = /(`+)[\s\S]*?\1|&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]*);|[^\s<>`]+@[a-z0-9.-]+\.[a-z]{2,}|[a-z][a-z0-9+.-]*:\/\/[^\s<>`]+|(?:[a-z0-9-]+\.)+[a-z]{2,}[^\s<>`]*|(?:\.{0,2}\/|[\w.-]+[/?])[^\s<>`]+/gi;
  let result = '', at = 0;
  for (const match of value.matchAll(tokens)) {
    result += format(value.slice(at, match.index)) + match[0];
    at = match.index + match[0].length;
  }
  return result + format(value.slice(at));
}
