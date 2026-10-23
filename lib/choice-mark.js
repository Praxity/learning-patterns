import { escapeHtml } from './html.js';
import { icons } from './icons.js';

/** @typedef {'correct' | 'wrong' | 'missed'} ChoiceMark
 * @typedef {{ markCorrect: string, markWrong: string, markAnswer: string }} MarkStrings
 */
const marks = /** @type {const} */ ({
  correct: { tone: 'lp-met', icon: 'check', word: 'markCorrect' },
  wrong: { tone: 'lp-missed', icon: 'x', word: 'markWrong' },
  missed: { tone: 'lp-neutral', icon: 'circle-dashed', word: 'markAnswer' }
});

/** @param {ChoiceMark} kind */
function definition(kind) {
  if (!Object.hasOwn(marks, kind)) throw new RangeError(`Unknown choice mark: ${kind}`);
  return marks[kind];
}

/** Render a badge with an authored word, for server-rendered answer rows too.
 * @param {ChoiceMark} kind @param {string} word @param {string} [lang]
 * @returns {string}
 */
export function renderChoiceMark(kind, word, lang = 'en') {
  const { tone, icon } = definition(kind);
  return `<span class="lp-choice-mark ${tone}">${icons[icon]}<span>${escapeHtml(word, lang)}</span></span>`;
}

/** Mark an answer row, or remove its mark with null. Update a server-rendered badge if present.
 * @param {HTMLElement} row @param {ChoiceMark | null} kind
 * @param {MarkStrings} strings @param {string} [lang] The pattern root's language.
 */
export function markChoice(row, kind, strings, lang = 'en') {
  const mark = row.querySelector(':scope > .lp-choice-mark');
  if (kind === null) {
    row.removeAttribute('data-lp-mark');
    mark?.remove();
    return;
  }
  const { word } = definition(kind);
  const markup = renderChoiceMark(kind, strings[word], lang);
  row.dataset.lpMark = kind;
  if (mark) mark.outerHTML = markup;
  else row.insertAdjacentHTML('beforeend', markup);
}
