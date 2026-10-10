/** Escape plain text for HTML text nodes and quoted attributes.
 * @param {string} value @param {string} [lang]
 * @returns {string}
 */
export function escapeHtml(value, lang = 'en') {
  value = frenchTypography(value, lang);
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character] ?? character);
}


/** French nonbreaking punctuation, groups and currency. Preserve authored spaces and URLs.
 * @param {string} value @param {string} [lang] @returns {string}
 */
export function frenchTypography(value, lang = 'en') {
  if (!/^fr(?:-|$)/i.test(lang)) return value;
  const space = /** @param {string} existing */ existing => existing.includes('\u00a0') ? '\u00a0' : '\u202f';
  return value.split(/(https?:\/\/\S+)/gi).map(part => {
    if (/^https?:\/\//i.test(part)) return part;
    return part
      .replace(/(\d)[ \t\u00a0\u202f]+(?=\d{3}(?:\D|$))/g, (match, digit) => `${digit}${space(match)}`)
      .replace(/([^\s:;!?$€£¥«])[ \t\u00a0\u202f]*([:;!?%$€£¥»])/g, (match, before, punctuation, offset, text) => {
        if (punctuation === ':' && /\d/.test(before) && /\d/.test(text[offset + match.length] ?? '')) return match;
        return `${before}${space(match)}${punctuation}`;
      })
      .replace(/[ \t]+(?=[:;!?%$€£¥])/g, '\u202f')
      .replace(/«[ \t\u00a0\u202f]*/g, match => `«${space(match)}`);
  }).join('');
}
