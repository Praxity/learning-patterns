import { escapeHtml as html } from './html.js';

/** @typedef {{ en: string, fr: string }} Notice */
/** @typedef {{ providerName: string, dataNotice: Notice, questionNotice?: Notice }} NoticeConfig */

/** @param {string} provider @returns {NoticeConfig} */
export function noticeConfig(provider) {
  const providerName = provider === 'perplexity' ? 'Perplexity (US)' : provider === 'clef' ? 'Cloudflare Workers AI' : provider === 'jev' ? 'TypeSafe (US)' : null;
  if (!providerName) throw new Error('Invalid provider');
  return { providerName, dataNotice: {
    en: 'Your answer is sent to a decision model; it is not stored and not used for training.',
    fr: "Votre réponse est envoyée à un modèle décisionnel. Elle n'est ni conservée ni utilisée pour l'entraînement."
  }, questionNotice: {
    en: 'Your question is sent to a decision model; it is not stored and not used for training.',
    fr: "Votre question est envoyée à un modèle décisionnel. Elle n'est ni conservée ni utilisée pour l'entraînement."
  } };
}

/** @param {NoticeConfig} config @param {string} lang @param {string} id @param {'answer' | 'question'} [subject] */
export function renderDataNotice(config, lang, id, subject = 'answer') {
  const notice = subject === 'question' && config.questionNotice ? config.questionNotice : config.dataNotice;
  return `<p class="lp-small" id="${html(id)}">${html(lang === 'fr' ? notice.fr : notice.en)}</p>`;
}

/** @typedef {'ip_daily' | 'budget'} CapReason */

export const CAP_MESSAGES = Object.freeze({
  ip_daily: {
    en: "You've used today's live checks. They reset at midnight UTC.",
    fr: "Vous avez utilisé les vérifications en direct d'aujourd'hui. Elles reprennent à minuit UTC."
  },
  budget: {
    en: "Live checks are paused until midnight UTC because today's budget is used up.",
    fr: "Le budget d'aujourd'hui est épuisé. Les vérifications en direct reprennent à minuit UTC."
  }
});

/** @param {CapReason} reason @param {string} lang */
export function renderCapNotice(reason, lang) {
  return `<p class="lp-small" data-lp-cap>${html(CAP_MESSAGES[reason][lang === 'fr' ? 'fr' : 'en'])}</p>`;
}

/** @param {unknown} error @param {HTMLElement} root @param {HTMLElement} fallback @param {HTMLElement} status */
export function showCapNotice(error, root, fallback, status) {
  const reason = /** @type {import('./ask.js').AskError} */ (error)?.reason;
  if (reason !== 'ip_daily' && reason !== 'budget') return false;
  if (!root.querySelector('[data-lp-cap]')) {
    fallback.insertAdjacentHTML('beforebegin', renderCapNotice(reason, root.lang));
    status.textContent = CAP_MESSAGES[reason][root.lang === 'fr' ? 'fr' : 'en'];
  }
  return true;
}
