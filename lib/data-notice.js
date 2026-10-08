import { escapeHtml as html } from './html.js';

/** @typedef {{ providerName: string, dataNotice: { en: string, fr: string } }} NoticeConfig */

/** The proxy owns the notice and publishes it in /config.
 * @param {string} provider @returns {NoticeConfig}
 */
export function noticeConfig(provider) {
  const providerName = provider === 'perplexity' ? 'Perplexity (US)' : provider === 'clef' ? 'Cloudflare Workers AI' : provider === 'jev' ? 'TypeSafe (US)' : null;
  if (!providerName) throw new Error('Invalid provider');
  return { providerName, dataNotice: {
    en: 'Your answer is sent to a decision model; it is not stored and not used for training.',
    fr: "Votre réponse est envoyée à un modèle de décision. Elle n'est ni conservée ni utilisée pour l'entraînement."
  } };
}

/** Render the configured notice under an input. All configuration text stays plain text.
 * @param {NoticeConfig} config @param {string} lang @param {string} id @returns {string}
 */
export function renderDataNotice(config, lang, id) {
  return `<p class="lp-small" id="${html(id)}">${html(lang === 'fr' ? config.dataNotice.fr : config.dataNotice.en)}</p>`;
}
