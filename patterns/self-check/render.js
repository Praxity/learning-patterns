import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 * @returns {string}
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const answerId = html(`${id}-answer`);
  const errorId = html(`${id}-error`);
  return `<section class="lp lp-self-check" data-lp-pattern="self-check" lang="${html(lang)}">
  <p class="lp-stem">${html(content.task)}</p>
  <div>
    <label class="lp-label" for="${answerId}">${html(strings.answer)}</label>
    <textarea class="lp-input" id="${answerId}" rows="5"></textarea>
  </div>
  <p class="lp-error-text" id="${errorId}" data-lp-error hidden>${html(strings.empty)}</p>
  <details class="lp-details lp-section" data-lp-fallback>
    <summary>${html(strings.checkOwn)}</summary>
    <p>${html(strings.partsQuestion)}</p>
    <ul class="lp-self-check-fallback-list">${content.parts.map(part => `<li><span class="lp-run-in">${html(part.label)}</span><p>${html(part.missed)}</p></li>`).join('')}</ul>
    <h3 class="lp-run-in">${html(strings.model)}</h3>
    <p class="lp-quote">${html(content.model)}</p>
  </details>
  <div data-lp-flow hidden>
    <div class="lp-actions" data-lp-check-row>
      <button class="lp-button" type="button" data-lp-check>${html(strings.check)}</button>
    </div>
    <div class="lp-section" data-lp-ticks hidden>
      <fieldset class="lp-choices">
        <legend>${html(strings.tick)}</legend>
        ${content.parts.map((part, index) => `<label class="lp-choice" for="${html(`${id}-part-${index}`)}"><input type="checkbox" id="${html(`${id}-part-${index}`)}" value="${html(part.id)}"><span>${html(part.label)}</span></label>`).join('\n        ')}
      </fieldset>
      <div class="lp-actions">
        <button class="lp-button" type="button" data-lp-show>${html(strings.show)}</button>
      </div>
    </div>
    <div class="lp-section" data-lp-result hidden></div>
    <div class="lp-actions">
      <button class="lp-button lp-button-quiet" type="button" data-lp-restart hidden>${icons.refresh}${html(strings.restart)}</button>
    </div>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
