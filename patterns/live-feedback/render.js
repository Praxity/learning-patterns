import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { validateContent, ANSWER_LIMIT } from './logic.js';

/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options @returns {string}
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  return `<section class="lp lp-live-feedback" data-lp-pattern="live-feedback" lang="${html(lang)}">
  <h2 class="lp-stem" id="${html(`${id}-prompt`)}">${html(content.prompt)}</h2>
  <textarea class="lp-input" id="${html(`${id}-answer`)}" aria-labelledby="${html(`${id}-prompt`)}" rows="5" maxlength="${ANSWER_LIMIT}" placeholder="${html(strings.placeholder)}"></textarea>
  <div data-lp-notice id="${html(`${id}-notice`)}" hidden></div>
  <p class="lp-error-text" id="${html(`${id}-error`)}" data-lp-error hidden>${icons['alert-circle']}<span>${html(strings.empty)}</span></p>
  <div class="lp-section" data-lp-list aria-live="off" hidden>
    <p class="lp-run-in" data-lp-summary>${html(strings.checklist)}</p>
    <ol class="lp-choices lp-live-feedback-results" data-lp-items>${content.criteria.map((item, index) => `<li class="lp-choice"><span class="lp-choice-key" aria-hidden="true">${index + 1}</span><span>${html(item.label)}</span></li>`).join('')}</ol>
  </div>
  <div class="lp-section" data-lp-fallback>
    <fieldset class="lp-choices"><legend class="lp-run-in" data-lp-fallback-text>${html(strings.selfCheck)}</legend>
    ${content.criteria.map(item => `<label class="lp-choice" for="${html(`${id}-tick-${item.id}`)}"><input type="checkbox" id="${html(`${id}-tick-${item.id}`)}" value="${html(item.id)}"><span>${html(item.label)}</span></label>`).join('\n')}
    </fieldset>
  </div>
  <p class="lp-small" data-lp-checking hidden>${html(strings.checking)}</p>
  <p class="lp-small" data-lp-paused hidden>${html(strings.paused)}</p>
  <div class="lp-actions"><button class="lp-button" type="button" data-lp-check hidden>${html(strings.check)}</button></div>
  <div data-lp-challenge hidden></div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
