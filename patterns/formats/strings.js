/** @typedef {typeof strings.en} Strings */
export const strings = {
  en: {
    formats: 'Lesson format',
    text: 'Text', slides: 'Slides', audio: 'Audio script', quiz: 'Quiz',
    place: 'Section {n} of {total}', showing: 'Showing {format}, section {n}.',
    previous: 'Previous', next: 'Next',
    play: 'Play', playUnavailable: 'Play unavailable: sample, no audio recording', sample: 'Sample, no audio',
    noQuestion: 'There is no quiz question for this section. Review the outline, then choose Next.',
    check: 'Check answer', choose: 'Choose an answer first.', correct: 'Correct', wrong: 'Not quite',
    quizSummary: '{count} of {total} questions checked.', summary: 'What to remember'
  },
  fr: {
    formats: 'Format de la leçon',
    text: 'Texte', slides: 'Diapos', audio: 'Script audio', quiz: 'Quiz',
    place: 'Section {n} sur {total}', showing: 'Format affiché : {format}, section {n}.',
    previous: 'Précédent', next: 'Suivant',
    play: 'Lire', playUnavailable: 'Lecture indisponible : exemple sans enregistrement audio', sample: 'Exemple, sans audio',
    noQuestion: "Cette section n'a pas de question de quiz. Relisez le plan, puis choisissez Suivant.",
    check: 'Vérifier la réponse', choose: "Choisissez d'abord une réponse.", correct: 'Bonne réponse', wrong: 'À revoir',
    quizSummary: '{count} questions sur {total} vérifiées.', summary: 'À retenir'
  }
};
