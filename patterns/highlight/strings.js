export const strings = {
  en: {
    keyInstruction: 'Highlight the key ideas.',
    evidenceInstruction: 'Highlight what answers this question. {question}',
    controls: 'Select a passage to highlight it. Select it again to remove the highlight. With a keyboard, press Tab to move and Space to highlight.',
    count: '{n} of {max} highlighted',
    limitMany: 'You can highlight up to {n} passages. Remove a highlight to choose another.',
    check: 'Check',
    restart: 'Start over',
    answer: 'Answer',
    markCorrect: 'Correct',
    markWrong: 'Incorrect',
    markAnswer: 'Correct answer',
    // Deprecated: kept for hosts that read the old keys (Praxity Studio). Use markCorrect for
    // correctKey and correctEvidence, markWrong for wrongKey and wrongEvidence, markAnswer for missed.
    correctKey: 'Correct',
    correctEvidence: 'Correct',
    wrongKey: 'Incorrect',
    wrongEvidence: 'Incorrect',
    missed: 'Correct answer',
    keySummary: 'Key ideas found: {n} of {total}.',
    evidenceSummary: 'Passages found: {n} of {total}.'
  },
  fr: {
    keyInstruction: 'Surlignez les idées clés.',
    evidenceInstruction: 'Surlignez ce qui répond à cette question. {question}',
    controls: 'Sélectionnez un passage pour le surligner. Sélectionnez-le de nouveau pour enlever le surlignage. Au clavier, appuyez sur Tab pour vous déplacer et sur Espace pour surligner.',
    count: 'Passages surlignés : {n} sur {max}',
    limitMany: "Vous pouvez surligner jusqu’à {n} passages. Enlevez un surlignage pour en choisir un autre.",
    check: 'Vérifier',
    restart: 'Recommencer',
    answer: 'Réponse',
    markCorrect: 'Correct',
    markWrong: 'Incorrect',
    markAnswer: 'Bonne réponse',
    // Deprecated: kept for hosts that read the old keys (Praxity Studio). Use markCorrect for
    // correctKey and correctEvidence, markWrong for wrongKey and wrongEvidence, markAnswer for missed.
    correctKey: 'Correct',
    correctEvidence: 'Correct',
    wrongKey: 'Incorrect',
    wrongEvidence: 'Incorrect',
    missed: 'Bonne réponse',
    keySummary: 'Idées clés trouvées : {n} sur {total}.',
    evidenceSummary: 'Passages trouvés : {n} sur {total}.'
  }
};
/** @typedef {typeof strings.en} Strings */
