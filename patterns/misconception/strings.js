export const strings = {
  en: {
    tooLong: 'Your answer must be {max} characters or fewer.',
    check: 'Check my answer',
    empty: 'Write an answer first.', checking: 'Checking your answer…',
    found: 'Key idea found', misconception: 'Common misconception', unsure: 'Possible match', noMatch: 'No match',
    misconceptionHeading: 'Common misconception: "{label}"',
    model: 'A model answer', common: 'Common misconceptions',
    fallback: "Automatic checking is unavailable. Tick the misconceptions in your answer."
  },
  fr: {
    tooLong: 'Votre réponse doit contenir {max} caractères ou moins.',
    check: 'Vérifier ma réponse',
    empty: "Écrivez d’abord une réponse.", checking: 'Vérification de votre réponse…',
    found: 'Idée clé trouvée', misconception: 'Idée fausse courante', unsure: 'Correspondance possible', noMatch: 'Aucune correspondance',
    misconceptionHeading: 'Idée fausse courante : « {label} »',
    model: 'Un modèle de réponse', common: 'Idées fausses courantes',
    fallback: "La vérification automatique est indisponible. Cochez les idées fausses dans votre réponse."
  }
};
/** @typedef {typeof strings.en} Strings */
