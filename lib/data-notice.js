import { escapeHtml as html } from './html.js';

/** @typedef {{ en: string, fr: string }} Notice */
/** @typedef {{ providerName: string, dataNotice: Notice, questionNotice?: Notice }} NoticeConfig */

/** The proxy owns the notice and publishes it in /config.
 * @param {string} provider @returns {NoticeConfig}
 */
export function noticeConfig(provider) {
  const providerName = provider === 'perplexity' ? 'Perplexity (US)' : provider === 'clef' ? 'Cloudflare Workers AI' : provider === 'jev' ? 'TypeSafe (US)' : null;
  if (!providerName) throw new Error('Invalid provider');
  return { providerName, dataNotice: {
    en: 'Your answer is sent to a decision model; it is not stored and not used for training.',
    fr: "Votre réponse est envoyée à un modèle de décision. Elle n'est ni conservée ni utilisée pour l'entraînement."
  }, questionNotice: {
    en: 'Your question is sent to a decision model; it is not stored and not used for training.',
    fr: "Votre question est envoyée à un modèle de décision. Elle n'est ni conservée ni utilisée pour l'entraînement."
  } };
}

/** Render the configured notice under an input. All configuration text stays plain text.
 * Patterns where the learner asks rather than answers pass 'question'; configs without that wording fall back to the answer notice.
 * @param {NoticeConfig} config @param {string} lang @param {string} id @param {'answer' | 'question'} [subject] @returns {string}
 */
export function renderDataNotice(config, lang, id, subject = 'answer') {
  const notice = subject === 'question' && config.questionNotice ? config.questionNotice : config.dataNotice;
  return `<p class="lp-small" id="${html(id)}">${html(lang === 'fr' ? notice.fr : notice.en)}</p>`;
}
