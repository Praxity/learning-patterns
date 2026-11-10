import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { format, validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const h = (/** @type {string} */ text) => html(text, lang);
  const { hints, followUp } = content;
  const hintLabel = (/** @type {number} */ n) => h(format(strings.hintLabel, { number: n + 1, total: hints.length }));
  const answer = (/** @type {{ id: string, text: string }[]} */ options, /** @type {string} */ correct) => h(format(strings.correct, { option: options.find(o => o.id === correct)?.text ?? '' }));
  /** One question group. A wrong option on the first question carries its reason, closed until that option is checked.
   * @param {string} group @param {string} question @param {import('./logic.js').Option[]} options @param {string} [more] */
  const question = (group, question, options, more = '') => `<fieldset class="lp-choices" id="${html(`${id}-${group}`)}">
      <legend class="lp-stem">${h(question)}</legend>
      ${options.map((o, n) => `<label class="lp-choice" for="${html(`${id}-${group}-option-${n}`)}"><input type="radio" id="${html(`${id}-${group}-option-${n}`)}" name="${html(`${id}-${group}`)}" value="${html(o.id)}"><span>${h(o.text)}</span>${o.feedback ? `<span class="lp-hint-ladder-reason" data-lp-reason hidden>${h(o.feedback)}</span>` : ''}</label>`).join('\n      ')}
      <p class="lp-error-text" id="${html(`${id}-${group}-error`)}" data-lp-error hidden>${icons['alert-circle']}<span>${h(strings.choose)}</span></p>${more}
    </fieldset>`;
  const check = `<button class="lp-button" type="button" data-lp-check hidden>${h(strings.check)}</button>`;
  return `<section class="lp lp-hint-ladder" data-lp-pattern="hint-ladder" lang="${html(lang)}">
  <h2 class="lp-heading">${h(content.title)}</h2>
  ${content.context ? `<p class="lp-context">${h(content.context)}</p>` : ''}
  <div class="lp-stack" data-lp-first>
    ${question('first', content.question, content.options)}
    <ol class="lp-hint-ladder-steps" role="list" data-lp-steps hidden>
      ${hints.map((hint, n) => `<li tabindex="-1" hidden>${icons.bulb}<p class="lp-run-in">${hintLabel(n)}</p><p>${h(hint)}</p></li>`).join('\n      ')}
      <li tabindex="-1" hidden><span class="lp-visually-hidden" data-lp-verdict></span>${icons['list-details']}<p class="lp-run-in">${h(strings.workedLabel)}</p><p>${h(content.worked)}</p></li>
    </ol>
    <div class="lp-actions">${check}<button class="lp-button lp-button-secondary" type="button" data-lp-hint hidden>${icons.bulb}<span data-lp-hint-label>${h(format(strings.showHint, { number: 1, total: hints.length }))}</span></button></div>
    <p class="lp-small lp-hint-ladder-gate" id="${html(`${id}-gate`)}" data-lp-gate hidden>${h(strings.gate)}</p>
  </div>
  <div class="lp-hint-ladder-fallback" data-lp-fallback>
    ${hints.map((hint, n) => `<details class="lp-details"><summary>${hintLabel(n)}</summary><p>${h(hint)}</p></details>`).join('\n    ')}
    <details class="lp-details"><summary>${h(strings.workedLabel)}</summary><p>${answer(content.options, content.correct)}</p><p>${h(content.worked)}</p><ul>${content.options.filter(o => o.feedback).map(o => `<li><strong class="lp-run-in">${h(o.text)}</strong><p>${h(o.feedback ?? '')}</p></li>`).join('')}</ul></details>
  </div>
  <div class="lp-section" data-lp-follow-up>
    <h3 class="lp-label">${h(strings.followUpTitle)}</h3>
    ${question('follow-up', followUp.question, followUp.options, `
      <p class="lp-hint-ladder-feedback" tabindex="-1" data-lp-feedback hidden><span class="lp-visually-hidden" data-lp-verdict></span>${h(followUp.explanation)}</p>`)}
    <div class="lp-actions">${check}</div>
    <details class="lp-details" data-lp-fallback><summary>${h(strings.answer)}</summary><p>${answer(followUp.options, followUp.correct)}</p><p>${h(followUp.explanation)}</p></details>
  </div>
  <div class="lp-section" data-lp-result hidden>
    <p data-lp-summary></p>
    <div class="lp-actions"><button class="lp-button lp-button-quiet" type="button" data-lp-restart>${icons.refresh}${h(strings.restart)}</button></div>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
