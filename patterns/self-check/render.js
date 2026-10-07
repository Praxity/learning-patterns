import { escapeHtml as html } from '../../lib/html.js';
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
  return `<section class="lp-self-check" data-lp-pattern="self-check" lang="${html(lang)}">
  <p class="lp-self-check-task">${html(content.task)}</p>
  <label class="lp-self-check-answer-label" for="${answerId}">${html(strings.answer)}</label>
  <textarea class="lp-self-check-answer" id="${answerId}" rows="5"></textarea>
  <p class="lp-self-check-error" id="${errorId}" data-lp-error hidden>${html(strings.empty)}</p>
  <details class="lp-self-check-fallback" data-lp-fallback>
    <summary>${html(strings.checkOwn)}</summary>
    <p>${html(strings.partsQuestion)}</p>
    <ul>${content.parts.map(part => `<li><strong>${html(part.label)}</strong><p>${html(part.missed)}</p></li>`).join('')}</ul>
    <h2 class="lp-self-check-model-label">${html(strings.model)}</h2>
    <p>${html(content.model)}</p>
  </details>
  <div class="lp-self-check-flow" data-lp-flow hidden>
    <button class="lp-self-check-button" type="button" data-lp-check>${html(strings.check)}</button>
    <fieldset class="lp-self-check-ticks" data-lp-ticks hidden>
      <legend>${html(strings.tick)}</legend>
      ${content.parts.map((part, index) => `<label class="lp-self-check-part" for="${html(`${id}-part-${index}`)}"><input type="checkbox" id="${html(`${id}-part-${index}`)}" value="${html(part.id)}"> <span>${html(part.label)}</span></label>`).join('\n      ')}
      <button class="lp-self-check-button" type="button" data-lp-show>${html(strings.show)}</button>
    </fieldset>
    <div class="lp-self-check-result" data-lp-result hidden></div>
    <button class="lp-self-check-button lp-self-check-button-secondary" type="button" data-lp-restart hidden>${html(strings.restart)}</button>
  </div>
  <p class="lp-self-check-status" role="status" aria-atomic="true"></p>
</section>`;
}
