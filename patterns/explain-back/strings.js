export const strings = {
  en: {
    tooLong: 'Your answer must be {max} characters or fewer.',
    ready: "I'm ready to explain it", readAgain: 'Read the text again',
    placeholder: 'Type your explanation here…', check: 'Check my explanation',
    empty: 'Write an explanation first.', checking: 'Checking your explanation…',
    summary: '{count} of {total} key ideas', found: 'Found', missed: 'To add', unsure: 'Not sure',
    reread: 'Reread "{heading}"', model: 'A model answer',
    fallback: "Automatic checking is unavailable. Tick the ideas in your explanation."
  },
  fr: {
    tooLong: 'Votre réponse doit contenir {max} caractères ou moins.',
    ready: "Passer à l’explication", readAgain: 'Relire le texte',
    placeholder: 'Écrivez votre explication ici…', check: 'Vérifier mon explication',
    empty: "Écrivez d’abord une explication.", checking: 'Vérification de votre explication…',
    summary: 'Idées clés : {count} sur {total}', found: 'Trouvé', missed: 'À ajouter', unsure: 'Pas certain',
    reread: 'Relire « {heading} »', model: 'Un modèle de réponse',
    fallback: "La vérification automatique est indisponible. Cochez les idées dans votre explication."
  }
};
/** @typedef {typeof strings.en} Strings */
