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
  return `<section class="lb-self-check" data-lb-block="self-check" lang="${html(lang)}">
  <p class="lb-self-check-task">${html(content.task)}</p>
  <label class="lb-self-check-answer-label" for="${answerId}">${html(strings.answer)}</label>
  <textarea class="lb-self-check-answer" id="${answerId}" rows="5"></textarea>
  <p class="lb-self-check-error" id="${errorId}" data-lb-error hidden>${html(strings.empty)}</p>
  <details class="lb-self-check-fallback" data-lb-fallback>
    <summary>${html(strings.checkOwn)}</summary>
    <p>${html(strings.partsQuestion)}</p>
    <ul>${content.parts.map(part => `<li><strong>${html(part.label)}</strong><p>${html(part.missed)}</p></li>`).join('')}</ul>
    <h2 class="lb-self-check-model-label">${html(strings.model)}</h2>
    <p>${html(content.model)}</p>
  </details>
  <div class="lb-self-check-flow" data-lb-flow hidden>
    <button class="lb-self-check-button" type="button" data-lb-check>${html(strings.check)}</button>
    <fieldset class="lb-self-check-ticks" data-lb-ticks hidden>
      <legend>${html(strings.tick)}</legend>
      ${content.parts.map((part, index) => `<label class="lb-self-check-part" for="${html(`${id}-part-${index}`)}"><input type="checkbox" id="${html(`${id}-part-${index}`)}" value="${html(part.id)}"> <span>${html(part.label)}</span></label>`).join('\n      ')}
      <button class="lb-self-check-button" type="button" data-lb-show>${html(strings.show)}</button>
    </fieldset>
    <div class="lb-self-check-result" data-lb-result hidden></div>
    <button class="lb-self-check-button" type="button" data-lb-restart>${html(strings.restart)}</button>
  </div>
  <p class="lb-self-check-status" role="status" aria-atomic="true"></p>
</section>`;
}
