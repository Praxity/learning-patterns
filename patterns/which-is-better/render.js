import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { NEITHER, answerText, format, summary, validateContent } from './logic.js';

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
  /** One version as an email: a plain header line, then the body in a quote block. Body sentences
   * come from `sentence`, given the text and its 1-based number; the greeting and sign-off are text.
   * @param {'a' | 'b'} version @param {string} head @param {(text: string, n: number) => string} sentence @param {string} [attributes] */
  const email = (version, head, sentence, attributes = '') => {
    const { subject, greeting, body, signoff } = content.versions[version];
    let n = 0;
    return `<div class="lp-which-is-better-email"${attributes}>${head}<p class="lp-which-is-better-subject"><span class="lp-which-is-better-field">${h(strings.subject)}</span> ${h(subject)}</p><div class="lp-quote lp-which-is-better-body"><p>${h(greeting)}</p>${body.map(paragraph => `<p>${paragraph.map(text => sentence(text, n += 1)).join(' ')}</p>`).join('')}<p>${h(signoff)}</p></div></div>`;
  };
  const plain = (/** @type {string} */ text) => h(text);
  // Each body sentence is an inline toggle, as in Highlight the key passage, so the email reads as
  // running text. After the check its result mark is inserted after it. Each email is a group named by its
  // version, so a screen reader says which version focus has moved into.
  const chunk = (/** @type {'a' | 'b'} */ version) => (/** @type {string} */ text, /** @type {number} */ n) => `<span class="lp-which-is-better-chunk" role="button" tabindex="0" aria-pressed="false" data-lp-pick="${version}${n}">${h(text)}</span>`;
  const noted = end.paragraphs.flat();
  const annotated = (/** @type {string} */ text, /** @type {number} */ n) => {
    const { note } = noted[n - 1];
    return note ? `<mark>${h(text)}</mark><span class="lp-which-is-better-note"><span class="lp-visually-hidden">${h(strings.shows)} </span>${h(note)}</span>` : h(text);
  };
  // The hidden comma gives screen readers a pause between the progress and the question. It belongs
  // to the progress label, which is a block.
  return `<section class="lp lp-which-is-better" data-lp-pattern="which-is-better" lang="${html(lang)}">
  <h2 class="lp-heading">${h(content.title)}</h2>
  <p class="lp-context">${h(content.context)}</p>
  <div data-lp-fallback>
    <div class="lp-which-is-better-pair">${versions.map(version => `
      ${email(version, `<h3 class="lp-run-in">${name(version)}</h3>`, plain)}`).join('')}
    </div>
    <ol class="lp-which-is-better-questions">${content.qualities.map((quality, i) => `
      <li><p class="lp-run-in">${h(quality.question)}</p><details class="lp-details"><summary>${h(strings.answer)}</summary><p>${h(answerText(content, strings, i))}</p><p>${h(quality.reason)}</p></details></li>`).join('')}
    </ol>
  </div>
  <div class="lp-stack" data-lp-step hidden>
    <p class="lp-stem" id="${ids('question')}" tabindex="-1" data-lp-question><span class="lp-label"><span data-lp-progress>${h(format(strings.progress, { n: 1, total: content.qualities.length }))}</span><span class="lp-visually-hidden">, </span></span><span data-lp-question-text>${h(first.question)}</span></p>
    <p class="lp-run-in lp-which-is-better-hint" id="${ids('hint')}">${h(strings.chooseOne)}</p>
    <div class="lp-which-is-better-choices" role="group" data-lp-choices aria-labelledby="${ids('question')}" aria-describedby="${ids('hint')}">
      <div class="lp-which-is-better-pair">${versions.map(version => `
        ${email(version, `<h3 class="lp-run-in" id="${ids(version)}">${name(version)}</h3>`, chunk(version), ` role="group" aria-labelledby="${ids(version)}"`)}`).join('')}
      </div>
      <div class="lp-choices"><button class="lp-choice lp-which-is-better-neither" type="button" aria-pressed="false" data-lp-pick="${NEITHER}"><span>${h(strings.neither)}</span></button></div>
      <p class="lp-which-is-better-feedback" tabindex="-1" data-lp-feedback hidden><span class="lp-which-is-better-verdict" data-lp-verdict></span><span data-lp-reason></span></p>
    </div>
    <p class="lp-error-text" id="${ids('error')}" data-lp-error hidden>${icons['alert-circle']}<span>${h(strings.choose)}</span></p>
    <div class="lp-actions"><button class="lp-button" type="button" data-lp-check>${h(strings.check)}</button><button class="lp-button" type="button" data-lp-next hidden>${h(strings.next)}</button></div>
  </div>
  <div class="lp-stack" data-lp-summary hidden>
    <p tabindex="-1" data-lp-result></p>
    <h3 class="lp-stem">${h(end.version === 'a' ? strings.summaryA : strings.summaryB)}</h3>
    ${email(end.version, `<p class="lp-visually-hidden">${name(end.version)}</p>`, annotated)}${end.missing.length ? `
    <div class="lp-which-is-better-group">
      <p class="lp-label">${h(strings.missing)}</p>
      <ul class="lp-which-is-better-missing" role="list">${end.missing.map(note => `<li>${h(note)}</li>`).join('')}</ul>
    </div>` : ''}
    <div class="lp-actions"><button class="lp-button lp-button-quiet" type="button" data-lp-restart>${icons.refresh}${h(strings.restart)}</button></div>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
