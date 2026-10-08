export const strings = {
  en: {
    run: 'Run the samples', running: 'Running…', samples: 'Sample answers', language: 'Sample language',
    english: 'English', french: 'French', author: 'Author', model: 'Decision model',
    met: 'met', missed: 'missed', unsure: 'not sure', agree: 'agrees', disagree: 'disagrees', notRun: 'not run',
    failed: 'This sample failed to run.', review: 'Compare labels', answer: 'Answer text',
    cellsNote: "Each cell shows the author's label and whether the decision model agrees.",
    cell: '{label}, decision model {outcome}', allAgree: 'The decision model agreed on every label.',
    summary: 'The decision model agreed on {agree} of {total} labels. {disagree} {disagreementWord}, {unsure} {unsureWord}.',
    disagreement: 'disagreement', disagreements: 'disagreements', uncertainty: 'not sure', uncertainties: 'not sure',
    unrun: '{notRun} labels not run.', progress: '{done} of {total} samples finished.',
    saved: 'Saved run · {date} · {model}', live: 'Current run · {model}', ready: 'Ready to run · {model}',
    unavailable: 'A live run is unavailable. The saved run is shown.',
    partial: 'Some samples could not run. Their cells are marked “not run”.'
  },
  fr: {
    run: 'Tester les exemples', running: 'Test en cours…', samples: 'Exemples de réponses', language: 'Langue des exemples',
    english: 'Anglais', french: 'Français', author: 'Auteur', model: 'Modèle de décision',
    met: 'présent', missed: 'absent', unsure: 'incertain', agree: 'en accord', disagree: 'en désaccord', notRun: 'non testé',
    failed: 'Cet exemple n’a pas pu être testé.', review: 'Comparer les étiquettes', answer: 'Texte de la réponse',
    cellsNote: 'Chaque cellule indique l’étiquette de l’auteur et si le modèle de décision est en accord.',
    cell: '{label}, modèle de décision {outcome}', allAgree: 'Le modèle de décision est en accord avec toutes les étiquettes.',
    summary: 'Le modèle de décision est en accord avec {agree} des {total} étiquettes. {disagree} {disagreementWord}, {unsure} {unsureWord}.',
    disagreement: 'désaccord', disagreements: 'désaccords', uncertainty: 'incertitude', uncertainties: 'incertitudes',
    unrun: '{notRun} étiquettes non testées.', progress: '{done} des {total} exemples terminés.',
    saved: 'Test enregistré · {date} · {model}', live: 'Test actuel · {model}', ready: 'Prêt à tester · {model}',
    unavailable: 'Un test en direct n’est pas disponible. Le test enregistré est affiché.',
    partial: 'Certains exemples n’ont pas pu être testés. Leurs cellules portent la mention « non testé ».'
  }
};
/** @typedef {typeof strings.en} Strings */
