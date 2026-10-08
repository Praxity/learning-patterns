import { escapeHtml as html } from './html.js';

/** @typedef {{ providerName: string, dataNotice: { en: string, fr: string } }} NoticeConfig */

/** The proxy owns the notice and publishes it in /config.
 * @param {string} provider @returns {NoticeConfig}
 */
export function noticeConfig(provider) {
  const providerName = provider === 'perplexity' ? 'Perplexity (US)' : provider === 'clef' ? 'Cloudflare Workers AI' : provider === 'jev' ? 'TypeSafe (US)' : null;
  if (!providerName) throw new Error('Invalid provider');
  return { providerName, dataNotice: {
    en: `To choose the feedback, your answer is sent to ${providerName}. We don't store your text. Don't include names or personal details.`,
    fr: `Pour choisir la rétroaction, votre réponse est envoyée à ${providerName}. Nous ne conservons pas votre texte. N'incluez pas de noms ni de renseignements personnels.`
  } };
}

/** Render the configured notice under an input. All configuration text stays plain text.
 * @param {NoticeConfig} config @param {string} lang @param {string} id @returns {string}
 */
export function renderDataNotice(config, lang, id) {
  return `<p class="lp-small" id="${html(id)}">${html(lang === 'fr' ? config.dataNotice.fr : config.dataNotice.en)}</p>`;
}
