// Keep the existing exports; enhancers can import the UI without provider configuration.
export { renderDataNotice, CAP_MESSAGES, renderCapNotice, showCapNotice } from './notice-ui.js';
/** @typedef {import('./notice-ui.js').CapReason} CapReason */

/** @typedef {{ en: string, fr: string }} Notice */
/** @typedef {{ providerName: string, dataNotice: Notice, questionNotice?: Notice, replyNotice?: Notice, entryNotice?: Notice }} NoticeConfig */

/** @param {string} provider @returns {NoticeConfig} */
export function noticeConfig(provider) {
  const providerName = provider === 'perplexity' ? 'Perplexity (US)' : provider === 'clef' ? 'Cloudflare Workers AI' : provider === 'jev' ? 'TypeSafe (US)' : null;
  if (!providerName) throw new Error('Invalid provider');
  // Learner-facing: name the model's job, not the vendor. The privacy page or the course's
  // terms of participation name the provider and say who keeps what (owner, 2026-11-03).
  return { providerName, dataNotice: {
    en: 'Your answer is sent to a decision model to give instant feedback.',
    fr: 'Votre réponse est envoyée à un modèle de décision pour vous donner une rétroaction immédiate.'
  }, questionNotice: {
    en: 'Your question is sent to a decision model to find where the course answers it.',
    fr: 'Votre question est envoyée à un modèle de décision pour trouver où le cours y répond.'
  }, replyNotice: {
    en: 'Your reply is sent to a decision model to choose how the conversation goes on.',
    fr: 'Votre réponse est envoyée à un modèle de décision pour choisir la suite de la conversation.'
  }, entryNotice: {
    en: 'When you ask for a suggestion, your entry is sent to a decision model to choose a question or a support message.',
    fr: 'Quand vous demandez une suggestion, votre entrée est envoyée à un modèle de décision pour choisir une question ou un message de soutien.'
  } };
}

