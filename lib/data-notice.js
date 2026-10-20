// Keep the existing exports; enhancers can import the UI without provider configuration.
export { renderDataNotice, CAP_MESSAGES, renderCapNotice, showCapNotice } from './notice-ui.js';
/** @typedef {import('./notice-ui.js').CapReason} CapReason */

/** @typedef {{ en: string, fr: string }} Notice */
/** @typedef {{ providerName: string, dataNotice: Notice, questionNotice?: Notice }} NoticeConfig */

/** @param {string} provider @returns {NoticeConfig} */
export function noticeConfig(provider) {
  const providerName = provider === 'perplexity' ? 'Perplexity (US)' : provider === 'clef' ? 'Cloudflare Workers AI' : provider === 'jev' ? 'TypeSafe (US)' : null;
  if (!providerName) throw new Error('Invalid provider');
  return { providerName, dataNotice: {
    en: 'Your answer is sent to a decision model; the service does not store it or use it for training.',
    fr: "Votre réponse est envoyée à un modèle décisionnel. Le service ne la conserve pas et ne l'utilise pas pour l'entraînement."
  }, questionNotice: {
    en: 'Your question is sent to a decision model; the service does not store it or use it for training.',
    fr: "Votre question est envoyée à un modèle décisionnel. Le service ne la conserve pas et ne l'utilise pas pour l'entraînement."
  } };
}

