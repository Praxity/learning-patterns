import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { renderChoiceMark } from '../../lib/choice-mark.js';
import { validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const h = (/** @type {string} */ text) => html(text, lang);
  /** One payment: its record, its status line, Approve and Hold, its recovery steps and, for the
   * request, what approving does and how to recover behind closed disclosures for readers without JavaScript.
   * @param {import('./logic.js').Request | import('./logic.js').Colleague} item @param {number} n */
  const payment = (item, n) => {
    const request = n === 0, key = `${id}-${request ? 'request' : 'colleague'}`;
    return `<section class="lp-section lp-stack" aria-labelledby="${html(`${key}-title`)}" data-lp-item="${n}"${request ? '' : ' data-lp-colleague hidden'}>
    <h3 class="lp-stem" id="${html(`${key}-title`)}">${h(item.title)}</h3>
    <p>${h(item.summary)}</p>
    <dl class="lp-mistake-recover-record">
      ${item.checks.map(check => `<div><dt>${h(`${check.label}:`)}</dt> <dd>${h(check.value)}</dd></div>`).join('\n      ')}
    </dl>
    <p class="lp-mistake-recover-status" tabindex="-1" data-lp-status hidden><span class="lp-run-in">${h(strings.status)}</span> <span data-lp-status-text></span></p>
    ${request ? `<div class="lp-actions" data-lp-decide hidden><button class="lp-button lp-button-secondary" type="button" data-lp-approve>${h(strings.approve)}</button><button class="lp-button lp-button-secondary" type="button" data-lp-hold>${h(strings.hold)}</button></div>` : ''}
    <div class="lp-stack" data-lp-recover hidden>
      <fieldset class="lp-choices" aria-describedby="${html(`${key}-hint`)}">
        <legend class="lp-run-in">${h(strings.stepsLegend)}</legend>
        <p class="lp-small" id="${html(`${key}-hint`)}">${h(strings.stepsHint)}</p>
        ${item.steps.map((step, s) => `<label class="lp-choice" for="${html(`${key}-step-${s}`)}"><input type="checkbox" id="${html(`${key}-step-${s}`)}" name="${html(`${key}-steps`)}" value="${html(step.id)}"><span>${h(step.text)}</span><span class="lp-mistake-recover-reason" data-lp-reason hidden>${h(step.feedback)}</span></label>`).join('\n        ')}
        <p class="lp-error-text" id="${html(`${key}-error`)}" data-lp-error hidden>${icons['alert-circle']}<span>${h(strings.choose)}</span></p>
      </fieldset>
      <div class="lp-actions"><button class="lp-button" type="button" data-lp-check>${h(strings.check)}</button></div>
    </div>${request ? `
    <details class="lp-details" data-lp-fallback><summary>${h(strings.ifApprove)}</summary><p>${h(/** @type {import('./logic.js').Request} */ (item).approved)}</p></details>
    <details class="lp-details" data-lp-fallback><summary>${h(strings.howRecover)}</summary><ul class="lp-mistake-recover-fallback">${item.steps.map(step => `<li><p>${h(step.text)} ${renderChoiceMark(step.correct ? 'correct' : 'wrong', step.correct ? strings.markCorrect : strings.markWrong, lang)}</p><p>${h(step.feedback)}</p></li>`).join('')}</ul></details>` : ''}
  </section>`;
  };
  return `<section class="lp lp-mistake-recover" data-lp-pattern="mistake-recover" lang="${html(lang)}">
  <h2 class="lp-heading">${h(content.title)}</h2>
  <p class="lp-context">${h(content.context)}</p>
  ${[content.request, content.colleague].map(payment).join('\n  ')}
  <div class="lp-section" data-lp-result hidden>
    <p data-lp-summary></p>
    <div class="lp-actions"><button class="lp-button lp-button-quiet" type="button" data-lp-restart>${icons.refresh}${h(strings.restart)}</button></div>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
