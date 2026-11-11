import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { format, principleName, quoteParts, validateContent } from './logic.js';

/** Every case in full, usable without JavaScript: each case is a radio group with its answer in a
 * disclosure. `enhance` shows one case at a time, checks each one and adds the result.
 * @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const total = content.cases.length;
  /** @param {string} template @param {Record<string, string | number>} [values] */
  const t = (template, values = {}) => html(format(template, values), lang);
  // Feedback sets each principle name it quotes in italics.
  const quoted = (/** @type {string} */ value) => quoteParts(content, value).map(part => part.principle ? `<em>${html(part.text, lang)}</em>` : html(part.text, lang)).join('');
  return `<section class="lp lp-sort-by-principle" data-lp-pattern="sort-by-principle" lang="${html(lang)}">
  <h2 class="lp-heading">${html(content.title, lang)}</h2>
  ${content.context ? `<p class="lp-context">${html(content.context, lang)}</p>` : ''}
  ${content.cases.map((item, c) => {
    const group = html(`${id}-case-${c}`);
    return `<div class="lp-section lp-sort-by-principle-case" data-lp-case>
    <h3 class="lp-run-in" id="${group}-heading" tabindex="-1" data-lp-case-heading>${t(strings.case, { number: c + 1, total })}</h3>
    <p class="lp-sort-by-principle-text">${html(item.text, lang)}</p>
    <fieldset class="lp-choices" id="${group}">
      <legend class="lp-stem">${html(content.question, lang)}</legend>
      ${content.principles.map((p, n) => `<label class="lp-choice" for="${group}-option-${n}"><input type="radio" id="${group}-option-${n}" name="${group}" value="${html(p.id)}"><span><span class="lp-sort-by-principle-name">${html(p.name, lang)}</span><span class="lp-visually-hidden">. </span><span class="lp-sort-by-principle-rule">${html(p.rule, lang)}</span></span></label>`).join('\n      ')}
      <p class="lp-error-text" id="${group}-error" data-lp-error hidden>${icons['alert-circle']}<span>${t(strings.choose)}</span></p>
    </fieldset>
    <p class="lp-sort-by-principle-feedback" tabindex="-1" data-lp-feedback hidden></p>
    <div class="lp-actions" data-lp-actions hidden>
      <button class="lp-button" type="button" data-lp-check>${t(strings.check)}</button>${c < total - 1 ? `
      <button class="lp-button" type="button" data-lp-next data-lp-keep hidden>${t(strings.next)}</button>` : ''}
    </div>
    <details class="lp-details" data-lp-fallback>
      <summary>${t(strings.answers, { number: c + 1 })}</summary>
      <p><strong>${t(strings.correctAnswer, { answer: principleName(content, item.correct) })}</strong></p>
      <p>${quoted(item.looksLike)} ${quoted(item.decides)}</p>
    </details>
  </div>`;
  }).join('\n  ')}
  <div class="lp-section" data-lp-result hidden>
    <p class="lp-run-in" data-lp-score></p>
    <div data-lp-pairs hidden>
      <h3 class="lp-label">${t(strings.pairsLabel)}</h3>
      <ul class="lp-sort-by-principle-pairs" data-lp-pair-list></ul>
    </div>
    <div class="lp-actions"><button class="lp-button lp-button-quiet" type="button" data-lp-restart data-lp-keep>${icons.refresh}${t(strings.restart)}</button></div>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
