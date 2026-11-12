export const strings = {
  en: {
    tooLong: 'Your answer must be {max} characters or fewer.',
    placeholder: 'I will…', checking: 'Checking…',
    summary: '{count} of {total} done', checklist: 'Checklist for your plan', done: 'Done:', todo: 'To add:',
    complete: 'Your plan has everything on the checklist.',
    paused: 'Automatic checks have stopped for this session.',
    selfCheck: 'Tick each item your plan includes.',
    fallback: "Automatic checking is unavailable. Tick each item your plan includes."
  },
  fr: {
    tooLong: 'Votre réponse doit contenir {max} caractères ou moins.',
    placeholder: 'Je vais…', checking: 'Vérification…',
    summary: 'Fait : {count} sur {total}', checklist: 'Liste de vérification de votre plan', done: 'Fait :', todo: 'À ajouter :',
    complete: 'Votre plan contient tout ce qui est sur la liste.',
    paused: 'Les vérifications automatiques sont arrêtées pour cette session.',
    selfCheck: 'Cochez chaque élément que contient votre plan.',
    fallback: "La vérification automatique est indisponible. Cochez chaque élément que contient votre plan."
  }
};
/** @typedef {typeof strings.en} Strings */
