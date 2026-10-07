import { escapeHtml as html } from '../../lib/html.js';
import { DONT_KNOW, displayPoints, format, validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  return `<section class="lp-dont-know" data-lp-pattern="dont-know" lang="${html(lang)}">
  <p class="lp-dont-know-rule">${html(format(strings.rule, { right: displayPoints(content.points.right, true), wrong: displayPoints(content.points.wrong, true), unknown: displayPoints(content.points.unknown, true) }))}</p>
  ${content.questions.map((q, n) => `<fieldset class="lp-dont-know-question" data-lp-question="${html(q.id)}">
    <legend>${html(q.text)}</legend>
    ${[...q.options, { id: DONT_KNOW, text: strings.unknown }].map((o, index) => `<label class="lp-dont-know-option" for="${html(`${id}-question-${n}-option-${index}`)}"><input type="radio" id="${html(`${id}-question-${n}-option-${index}`)}" name="${html(`${id}-question-${n}`)}" value="${html(o.id)}"> <span>${html(o.text)}</span></label>`).join('\n    ')}
    <p class="lp-dont-know-error" id="${html(`${id}-question-${n}-error`)}" data-lp-question-error hidden>${html(strings.choose)}</p>
  </fieldset>`).join('\n  ')}
  <div data-lp-flow hidden>
    <button class="lp-dont-know-button" type="button" data-lp-check>${html(strings.check)}</button>
    <p class="lp-dont-know-error" data-lp-error hidden></p>
    <div class="lp-dont-know-result" data-lp-result hidden></div>
    <button class="lp-dont-know-button lp-dont-know-button-secondary" type="button" data-lp-restart hidden>${html(strings.restart)}</button>
  </div>
  <details class="lp-dont-know-fallback" data-lp-fallback>
    <summary>${html(strings.answers)}</summary>
    <ul>${content.questions.map(q => `<li><strong>${html(q.text)}</strong><p>${html(format(strings.correct, { option: q.options.find(o => o.id === q.correct)?.text ?? '' }))}</p><p>${html(q.explanation)}</p></li>`).join('')}</ul>
  </details>
  <p class="lp-dont-know-status" role="status" aria-atomic="true"></p>
</section>`;
}
