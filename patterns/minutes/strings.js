export const strings = {
  en: {
    outline: 'Course outline', authorView: 'Author view',
    instruction: 'Change the counts to see how much time each section needs.',
    words: 'Words', narrationSeconds: 'Narration in seconds', questions: 'Questions',
    breakdown: '{words} words, {questions} questions', minutes: '{n} min',
    warning: 'Over 15 minutes', noEstimate: 'No estimate until fixed',
    invalid: 'Enter a whole number, 0 or more.',
    tooLarge: 'That number is too large. Enter a smaller whole number.',
    estimateTooLarge: 'These counts make the estimate too large. Enter smaller numbers.',
    fix: 'Fix the highlighted numbers to see the total.',
    total: 'Total {n} min.', flaggedOne: '1 section over 15 minutes.',
    flaggedMany: '{count} sections over 15 minutes.', noneFlagged: 'No section over 15 minutes.',
    assumptions: 'Assumes {readingWordsPerMinute} words per minute and {minutesPerQuestion} minutes per question. Narration plays during reading.'
  },
  fr: {
    outline: 'Plan du cours', authorView: 'Vue auteur',
    instruction: 'Modifiez les nombres pour voir le temps nécessaire à chaque section.',
    words: 'Mots', narrationSeconds: 'Narration en secondes', questions: 'Questions',
    breakdown: '{words} mots, {questions} questions', minutes: '{n} min',
    warning: 'Plus de 15 minutes', noEstimate: "Pas d'estimation avant correction",
    invalid: 'Entrez un nombre entier de 0 ou plus.',
    tooLarge: 'Ce nombre est trop grand. Entrez un nombre entier plus petit.',
    estimateTooLarge: "Ces nombres rendent l'estimation trop grande. Entrez des nombres plus petits.",
    fix: 'Corrigez les nombres signalés pour voir le total.',
    total: 'Total de {n} min.', flaggedOne: '1 section de plus de 15 minutes.',
    flaggedMany: '{count} sections de plus de 15 minutes.', noneFlagged: 'Aucune section de plus de 15 minutes.',
    assumptions: 'On suppose {readingWordsPerMinute} mots par minute et {minutesPerQuestion} minutes par question. La narration joue pendant la lecture.'
  }
};
/** @typedef {typeof strings.en} Strings */
/** Format numbers in authored messages, including repeated placeholders.
 * @param {string} template @param {Record<string, number>} values @param {string} lang @returns {string}
 */
export function formatText(template, values, lang) {
  const numbers = new Intl.NumberFormat(lang.toLowerCase().startsWith('fr') ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 20 });
  return template.replace(/\{(\w+)\}/g, (placeholder, key) => Object.hasOwn(values, key) ? numbers.format(values[key]) : placeholder);
}
/** @param {Strings} strings @param {number} total @param {number} flagged @param {string} lang @returns {string} */
export function summaryText(strings, total, flagged, lang) {
  return `${formatText(strings.total, { n: total }, lang)} ${formatText(flagged === 0 ? strings.noneFlagged : flagged === 1 ? strings.flaggedOne : strings.flaggedMany, { count: flagged }, lang)}`;
}
