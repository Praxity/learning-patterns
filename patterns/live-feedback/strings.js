export const strings = {
  en: {
    placeholder: 'I will…', check: 'Check my answer so far',
    empty: 'Write at least 20 characters first.', checking: 'Checking…',
    summary: '{count} of {total} done so far.', missingSummary: 'Missing: {items}.', unsureSummary: 'Not sure: {items}.',
    found: 'Found', missed: 'To add', unsure: 'Not sure', checklist: 'Your plan includes:',
    hint: 'After you pause for 0.7 seconds, the decision model checks these four things. Use the button to hear a summary.',
    paused: 'Automatic checks are paused. You can still select "Check my answer so far".',
    selfCheck: 'Tick each item your plan includes.',
    fallback: "The automatic check isn't available. Tick each item your plan includes."
  },
  fr: {
    placeholder: 'Je vais…', check: "Vérifier ma réponse jusqu'ici",
    empty: "Écrivez d'abord au moins 20 caractères.", checking: 'Vérification…',
    summary: "{count} éléments sur {total} pour l'instant.", missingSummary: 'À ajouter : {items}.', unsureSummary: 'Pas certain : {items}.',
    found: 'Trouvé', missed: 'À ajouter', unsure: 'Pas certain', checklist: 'Votre plan comprend :',
    hint: 'Après une pause de 0,7 seconde, le modèle de décision vérifie ces quatre éléments. Utilisez le bouton pour entendre un résumé.',
    paused: "Les vérifications automatiques sont en pause. Vous pouvez encore sélectionner « Vérifier ma réponse jusqu'ici ».",
    selfCheck: 'Cochez chaque élément que contient votre plan.',
    fallback: "La vérification automatique n'est pas disponible. Cochez chaque élément que contient votre plan."
  }
};
/** @typedef {typeof strings.en} Strings */
