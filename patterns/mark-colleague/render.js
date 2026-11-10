import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { format, validateContent } from './logic.js';

/** One issue: what to look at, an optional mark from the learner's tick, and the explanation.
 * @param {import('./logic.js').Issue} issue @param {import('./strings.js').Strings} strings @param {string} lang
 * @param {boolean | null} raised `null` leaves the mark out, as in the version without JavaScript.
 */
export function issueItem(issue, strings, lang, raised) {
  const mark = raised === null ? '' : `<p class="lp-mark-colleague-mark" data-lp-raised="${raised}">${raised ? icons.check : icons['circle-dashed']}<span>${html(raised ? strings.raised : strings.notRaised, lang)}</span></p>`;
  return `<li><p class="lp-run-in">${html(issue.label, lang)}</p>${mark}<p>${html(issue.explanation, lang)}</p></li>`;
}

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 * @returns {string}
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const h = (/** @type {string} */ text) => html(text, lang);
  const key = (/** @type {string} */ suffix) => html(`${id}-${suffix}`);
  const lines = (/** @type {string} */ body) => body.split('\n').filter(line => line.trim()).map(line => `<p>${h(line)}</p>`).join('');
  return `<section class="lp lp-mark-colleague" data-lp-pattern="mark-colleague" lang="${html(lang)}">
  <h2 class="lp-heading">${h(content.title)}</h2>
  <p class="lp-context">${h(content.context)}</p>
  ${content.messages.map(message => `<div class="lp-section lp-mark-colleague-mail">
    <h3 class="lp-mark-colleague-from">${icons.mail}<span>${h(message.heading)}</span></h3>
    ${message.subject ? `<p class="lp-small">${h(format(strings.subject, { subject: message.subject }))}</p>
    ` : ''}<div class="lp-mark-colleague-body">${lines(message.body)}</div>
  </div>`).join('\n  ')}
  <div class="lp-section">
    <label class="lp-stem" for="${key('feedback')}">${h(format(strings.prompt, { colleague: content.colleague }))}</label>
    <textarea class="lp-input" id="${key('feedback')}" rows="5"></textarea>
    <p class="lp-error-text" id="${key('error')}" data-lp-error hidden>${icons['alert-circle']}<span data-lp-error-text></span></p>
    <div class="lp-actions"><button class="lp-button" type="button" data-lp-check hidden>${h(strings.check)}</button></div>
  </div>
  <details class="lp-details lp-section" data-lp-fallback>
    <summary>${h(strings.show)}</summary>
    <ul class="lp-mark-colleague-issues">${content.issues.map(issue => issueItem(issue, strings, lang, null)).join('')}</ul>
  </details>
  <div data-lp-flow hidden>
    <div class="lp-section" data-lp-ticks hidden>
      <fieldset class="lp-choices" aria-describedby="${key('hint')}">
        <legend class="lp-stem">${h(format(strings.legend, { colleague: content.colleague }))}</legend>
        <p class="lp-small" id="${key('hint')}">${h(strings.hint)}</p>
        ${content.issues.map((issue, index) => `<label class="lp-choice" for="${key(`issue-${index}`)}"><input type="checkbox" id="${key(`issue-${index}`)}" value="${html(issue.id)}"><span>${h(issue.label)}</span></label>`).join('\n        ')}
      </fieldset>
      <div class="lp-actions"><button class="lp-button" type="button" data-lp-show>${h(strings.show)}</button></div>
    </div>
    <div class="lp-section" data-lp-result hidden>
      <p class="lp-stem" tabindex="-1" data-lp-summary></p>
      <ul class="lp-mark-colleague-issues" data-lp-issues></ul>
    </div>
    <div class="lp-actions" data-lp-keep><button class="lp-button lp-button-quiet" type="button" data-lp-restart hidden>${icons.refresh}${h(strings.restart)}</button></div>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
