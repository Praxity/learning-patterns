export const strings = {
  en: {
    placeholder: 'I will…', check: 'Check my answer so far',
    empty: 'Write at least 20 characters first.', checking: 'Checking…',
    summary: '{count} of {total} done so far.', missingSummary: 'Missing: {items}.', unsureSummary: 'Not sure: {items}.',
    found: 'Found', missed: 'To add', unsure: 'Not sure', checklist: 'Your plan includes:',
    paused: 'Automatic checks are paused. Select "Check my answer so far" to check again.',
    selfCheck: 'Tick each item your plan includes.',
    fallback: "Automatic checking is unavailable. Tick the items in your plan."
  },
  fr: {
    placeholder: 'Je vais…', check: "Vérifier ma réponse jusqu'ici",
    empty: "Écrivez d'abord au moins 20 caractères.", checking: 'Vérification…',
    summary: "{count} éléments sur {total} pour l'instant.", missingSummary: 'À ajouter : {items}.', unsureSummary: 'Pas certain : {items}.',
    found: 'Trouvé', missed: 'À ajouter', unsure: 'Pas certain', checklist: 'Votre plan comprend :',
    paused: "Les vérifications automatiques sont en pause. Sélectionnez « Vérifier ma réponse jusqu'ici » pour vérifier de nouveau.",
    selfCheck: 'Cochez chaque élément que contient votre plan.',
    fallback: "La vérification automatique est indisponible. Cochez les éléments dans votre plan."
  }
};
/** @typedef {typeof strings.en} Strings */
