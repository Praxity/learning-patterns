// {colleague} is the content's colleague name; {count}, {total} and {max} are numbers.
export const strings = {
  en: {
    subject: 'Subject: {subject}',
    prompt: 'What would you tell {colleague} to change, and why?',
    check: 'Check my feedback',
    empty: 'Write your feedback first.',
    tooLong: 'Your feedback must be {max} characters or fewer.',
    legend: 'Which of these does your feedback ask {colleague} to change?',
    hint: 'If you missed one, reread the reply and add to your feedback first.',
    show: 'Show the issues',
    raised: 'Raised',
    notRaised: 'Not raised',
    resultAll: 'Your feedback raised all {total} issues.',
    resultSome: 'Your feedback raised {count} of {total} issues.',
    resultNone: 'Your feedback raised none of the {total} issues.',
    restart: 'Start over',
    cleared: 'Feedback cleared.'
  },
  fr: {
    subject: 'Objet : {subject}',
    prompt: 'Que demanderiez-vous à {colleague} de modifier, et pourquoi ?',
    check: 'Vérifier ma rétroaction',
    empty: 'Écrivez d’abord votre rétroaction.',
    tooLong: 'Votre rétroaction doit contenir {max} caractères ou moins.',
    legend: 'Cochez les points que votre rétroaction demande à {colleague} de modifier.',
    hint: 'S’il vous en manque un, relisez la réponse et complétez d’abord votre rétroaction.',
    show: 'Afficher les points à corriger',
    raised: 'Relevé',
    notRaised: 'Non relevé',
    resultAll: 'Votre rétroaction relève les {total} points à corriger.',
    resultSome: 'Votre rétroaction relève {count} des {total} points à corriger.',
    resultNone: 'Votre rétroaction ne relève aucun des {total} points à corriger.',
    restart: 'Recommencer',
    cleared: 'Rétroaction effacée.'
  }
};
/** @typedef {typeof strings.en} Strings */
