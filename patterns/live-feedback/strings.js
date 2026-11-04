export const strings = {
  en: {
    tooLong: 'Your answer must be {max} characters or fewer.',
    placeholder: 'I will…', checking: 'Checking…',
    summary: '{count} of {total} done', checklist: 'Your plan', done: 'Done:', todo: 'To add:',
    complete: 'Your plan includes all four items.',
    paused: 'Automatic checks are finished for this session. Tick the items in your plan.',
    selfCheck: 'Tick each item your plan includes.',
    fallback: "Automatic checking is unavailable. Tick the items in your plan."
  },
  fr: {
    tooLong: 'Votre réponse doit contenir {max} caractères ou moins.',
    placeholder: 'Je vais…', checking: 'Vérification…',
    summary: '{count} éléments sur {total} complétés', checklist: 'Votre plan', done: 'Fait :', todo: 'À ajouter :',
    complete: 'Votre plan comprend les quatre éléments.',
    paused: 'Les vérifications automatiques sont terminées pour cette session. Cochez les éléments dans votre plan.',
    selfCheck: 'Cochez chaque élément que contient votre plan.',
    fallback: "La vérification automatique est indisponible. Cochez les éléments dans votre plan."
  }
};
/** @typedef {typeof strings.en} Strings */
