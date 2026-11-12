export const strings = {
  en: {
    instructions: 'Slide each range to where you think the answer is. The top of a range is always {ratio} times the bottom.',
    ten: 'ten',
    check: 'Check my ranges',
    tryAgain: 'Try again',
    cleared: 'Cleared. Start again.',
    empty: 'Slide this range to set your estimate.',
    missingOne: 'Question {questions} needs a range before the check.',
    missingMany: 'Questions {questions} need a range before the check.',
    // The fieldset legend already names the question; the slider names only itself, numbered like the validation message, so NVDA does not read the question twice.
    band: 'Range for question {number}',
    range: '{low} to {high}',
    caught: 'In your range: {answer} {unit}.',
    below: 'Below your range: {answer} {unit}.',
    above: 'Above your range: {answer} {unit}.',
    summary: 'Answers in your ranges: {count} of {total}.',
    answers: 'Answers',
    source: 'Source:'
  },
  fr: {
    instructions: 'Faites glisser chaque plage là où se trouve la réponse, selon vous. Le haut d’une plage vaut toujours {ratio} fois le bas.',
    ten: 'dix',
    check: 'Vérifier mes plages',
    tryAgain: 'Réessayer',
    cleared: 'Plages effacées. Recommencez.',
    empty: 'Faites glisser cette plage pour donner votre estimation.',
    missingOne: 'Définissez une plage pour la question {questions} avant de vérifier.',
    missingMany: 'Définissez une plage pour les questions {questions} avant de vérifier.',
    band: 'Plage de la question {number}',
    range: '{low} à {high}',
    caught: 'Dans votre plage : {answer} {unit}.',
    below: 'Sous votre plage : {answer} {unit}.',
    above: 'Au-dessus de votre plage : {answer} {unit}.',
    summary: 'Réponses dans vos plages : {count} sur {total}.',
    answers: 'Réponses',
    source: 'Source :'
  }
};
/** @typedef {typeof strings.en} Strings */
