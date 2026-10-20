// Keep the existing exports; enhancers can import the UI without provider configuration.
export { renderDataNotice, CAP_MESSAGES, renderCapNotice, showCapNotice } from './notice-ui.js';
/** @typedef {import('./notice-ui.js').CapReason} CapReason */

/** @typedef {{ en: string, fr: string }} Notice */
/** @typedef {{ providerName: string, dataNotice: Notice, questionNotice?: Notice }} NoticeConfig */

/** @param {string} provider @returns {NoticeConfig} */
export function noticeConfig(provider) {
  const providerName = provider === 'perplexity' ? 'Perplexity (US)' : provider === 'clef' ? 'Cloudflare Workers AI' : provider === 'jev' ? 'TypeSafe (US)' : null;
  if (!providerName) throw new Error('Invalid provider');
  const recipient = providerName.replace(' (US)', '');
  return { providerName, dataNotice: {
    en: `Your answer is sent to ${recipient} to choose which feedback to show. Praxity doesn't keep it. ${recipient}'s terms apply.`,
    fr: `Votre réponse est envoyée à ${recipient} pour choisir la rétroaction à vous afficher. Praxity ne la conserve pas. Les conditions de ${recipient} s'appliquent.`
  }, questionNotice: {
    en: `Your question is sent to ${recipient} to choose which information to show. Praxity doesn't keep it. ${recipient}'s terms apply.`,
    fr: `Votre question est envoyée à ${recipient} pour choisir les informations à vous afficher. Praxity ne la conserve pas. Les conditions de ${recipient} s'appliquent.`
  } };
}

