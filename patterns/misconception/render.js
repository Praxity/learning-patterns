import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { validateContent, ANSWER_LIMIT } from './logic.js';

/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options @returns {string}
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  return `<section class="lp lp-misconception" data-lp-pattern="misconception" lang="${html(lang)}">
  <h2 class="lp-stem" id="${html(`${id}-question`)}">${html(content.question)}</h2>
  <textarea class="lp-input" id="${html(`${id}-answer`)}" aria-labelledby="${html(`${id}-question`)}" rows="3" maxlength="${ANSWER_LIMIT}" placeholder="${html(strings.placeholder)}"></textarea>
  <div data-lp-notice id="${html(`${id}-notice`)}" hidden></div>
  <p class="lp-error-text" id="${html(`${id}-error`)}" data-lp-error hidden>${icons['alert-circle']}<span>${html(strings.empty)}</span></p>
  <div class="lp-actions"><button class="lp-button" type="button" data-lp-check hidden>${html(strings.check)}</button></div>
  <div data-lp-challenge hidden></div>
  <div class="lp-section" data-lp-result hidden></div>
  <details class="lp-details lp-section" data-lp-model open>
    <summary>${html(strings.model)}</summary><p>${html(content.model)}</p>
  </details>
  <div class="lp-section" data-lp-fallback>
    <fieldset class="lp-choices">
      <legend><span class="lp-run-in">${html(strings.common)}</span><br><span class="lp-small">${html(strings.fallback)}</span></legend>
      <div class="lp-choices">${content.misconceptions.map(item => `<label class="lp-choice" for="${html(`${id}-tick-${item.id}`)}"><input type="checkbox" id="${html(`${id}-tick-${item.id}`)}" value="${html(item.id)}"><span><span class="lp-run-in">${html(item.label)}</span><br>${html(item.why)}</span></label>`).join('\n')}</div>
    </fieldset>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
