import { escapeHtml as html } from '../../lib/html.js';
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
  <div class="lp-section" data-lp-list aria-live="off" hidden>
    <p class="lp-run-in" data-lp-summary>${html(strings.checklist)}</p>
    <ul class="lp-live-feedback-results" data-lp-items role="list">${content.criteria.map(item => `<li class="lp-live-feedback-item" data-lp-criterion="${html(item.id)}" data-lp-mark="todo"><span class="lp-live-feedback-bullet" aria-hidden="true"></span><span class="lp-visually-hidden" data-lp-item-state>${html(strings.todo)} </span><span data-lp-item-text>${html(item.todo)}</span></li>`).join('')}</ul>
  </div>
  <div class="lp-section" data-lp-fallback>
    <fieldset class="lp-choices"><legend class="lp-run-in" data-lp-fallback-text>${html(strings.selfCheck)}</legend>
    ${content.criteria.map(item => `<label class="lp-live-feedback-tick" for="${html(`${id}-tick-${item.id}`)}"><input type="checkbox" id="${html(`${id}-tick-${item.id}`)}" value="${html(item.id)}"><span>${html(item.done)}</span></label>`).join('\n')}
    </fieldset>
  </div>
  <p class="lp-small" data-lp-checking hidden>${html(strings.checking)}</p>
  <p class="lp-small" data-lp-paused hidden>${html(strings.paused)}</p>
  <div data-lp-challenge hidden></div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
