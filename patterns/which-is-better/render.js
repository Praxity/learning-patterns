import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { NEITHER, answerText, format, pickName, summary, validateContent } from './logic.js';

/** @typedef {import('./logic.js').Content} Content
 * @typedef {import('./strings.js').Strings} Strings
 */

/** @param {Content} content @param {Strings} strings @param {{ id: string, lang: string }} options */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const h = (/** @type {string} */ text) => html(text, lang);
  const ids = (/** @type {string} */ suffix) => html(`${id}-${suffix}`);
  const name = (/** @type {'a' | 'b'} */ version) => h(version === 'a' ? strings.versionA : strings.versionB);
  const versions = /** @type {const} */ (['a', 'b']);
  const end = summary(content);
  const first = content.qualities[0];
  // The hidden comma gives screen readers a pause between the progress and the question. It belongs
  // to the progress label, which is a block.
  // Each sentence is a toggle button named with its version and number, then its text.
  const choice = (/** @type {'a' | 'b'} */ version, /** @type {string} */ text, /** @type {number} */ i) => `<button class="lp-choice" type="button" aria-pressed="false" data-lp-pick="${version}${i + 1}"><span class="lp-choice-key" aria-hidden="true">${i + 1}</span><span><span class="lp-visually-hidden">${h(`${pickName(content, strings, `${version}${i + 1}`)}: `)}</span><span class="lp-which-is-better-text">${h(text)}</span></span></button>`;
  return `<section class="lp lp-which-is-better" data-lp-pattern="which-is-better" lang="${html(lang)}">
  <h2 class="lp-heading">${h(content.title)}</h2>
  <p class="lp-context">${h(content.context)}</p>
  <div data-lp-fallback>
    <div class="lp-which-is-better-pair">${versions.map(version => `
      <div><h3 class="lp-run-in">${name(version)}</h3><ol class="lp-which-is-better-plain">${content.versions[version].map(text => `<li>${h(text)}</li>`).join('')}</ol></div>`).join('')}
    </div>
    <ol class="lp-which-is-better-questions">${content.qualities.map((quality, i) => `
      <li><p class="lp-run-in">${h(quality.question)}</p><details class="lp-details"><summary>${h(strings.answer)}</summary><p>${h(format(strings.correct, { answer: answerText(content, strings, i) }))}</p><p>${h(quality.reason)}</p></details></li>`).join('')}
    </ol>
  </div>
  <div class="lp-stack" data-lp-step hidden>
    <p class="lp-stem" id="${ids('question')}" tabindex="-1" data-lp-question><span class="lp-label"><span data-lp-progress>${h(format(strings.progress, { n: 1, total: content.qualities.length }))}</span><span class="lp-visually-hidden">, </span></span><span data-lp-question-text>${h(first.question)}</span></p>
    <div class="lp-which-is-better-choices" role="group" aria-labelledby="${ids('question')}" aria-describedby="${ids('hint')}">
      <p class="lp-visually-hidden" id="${ids('hint')}">${h(strings.chooseOne)}</p>
      <p class="lp-error-text" id="${ids('error')}" data-lp-error hidden>${icons['alert-circle']}<span>${h(strings.choose)}</span></p>
      <div class="lp-which-is-better-pair">${versions.map(version => `
        <div><h3 class="lp-run-in">${name(version)}</h3><div class="lp-choices">${content.versions[version].map((text, i) => choice(version, text, i)).join('')}</div></div>`).join('')}
      </div>
      <div class="lp-choices"><button class="lp-choice lp-which-is-better-neither" type="button" aria-pressed="false" data-lp-pick="${NEITHER}"><span>${h(strings.neither)}</span></button></div>
      <p class="lp-which-is-better-feedback" tabindex="-1" data-lp-feedback hidden><span class="lp-visually-hidden" data-lp-verdict></span><span data-lp-reason></span></p>
    </div>
    <div class="lp-actions"><button class="lp-button" type="button" data-lp-check>${h(strings.check)}</button><button class="lp-button" type="button" data-lp-next hidden>${h(strings.next)}</button></div>
  </div>
  <div class="lp-stack" data-lp-summary hidden>
    <h3 class="lp-stem">${h(end.version === 'a' ? strings.summaryA : strings.summaryB)}</h3>
    <p tabindex="-1" data-lp-result></p>
    <div class="lp-which-is-better-group">
      <p class="lp-label">${name(end.version)}</p>
      <ol class="lp-which-is-better-notes">${end.sentences.map(({ text, note }) => note
        ? `<li><span class="lp-which-is-better-sentence"><mark>${h(text)}</mark></span><span class="lp-which-is-better-note"><span class="lp-visually-hidden">${h(strings.shows)} </span>${h(note)}</span></li>`
        : `<li><span class="lp-which-is-better-sentence">${h(text)}</span></li>`).join('')}</ol>
    </div>${end.missing.length ? `
    <div class="lp-which-is-better-group">
      <p class="lp-label">${h(strings.missing)}</p>
      <ul class="lp-which-is-better-missing" role="list">${end.missing.map(note => `<li>${h(note)}</li>`).join('')}</ul>
    </div>` : ''}
    <div class="lp-actions"><button class="lp-button lp-button-quiet" type="button" data-lp-restart>${icons.refresh}${h(strings.restart)}</button></div>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
