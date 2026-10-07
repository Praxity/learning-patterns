import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { format, validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const questions = content.sections.flatMap(section => content.questions.filter(q => q.section === section.id));
  return `<section class="lp lp-test-out" data-lp-pattern="test-out" lang="${html(lang)}">
  <header class="lp-scene">
    <span class="lp-scene-icon">${icons['list-details']}</span>
    <div><p class="lp-scene-label">${html(strings.placement)}</p><h2 class="lp-scene-title">${html(content.title)}</h2></div>
  </header>
  <div class="lp-test-out-stepper" data-lp-stepper>
    <div class="lp-test-out-panel" data-lp-panel="outline">
      <h3 class="lp-stem" id="${html(`${id}-outline`)}" tabindex="-1" data-lp-outline-heading>${html(strings.outline)}</h3>
      <p class="lp-run-in" data-lp-result hidden></p>
      <ol class="lp-test-out-outline-list">${content.sections.map(s => `<li>
        <div class="lp-test-out-outline-row">
          <div><p class="lp-run-in">${html(s.title)}</p><p class="lp-small" data-lp-credit hidden></p></div>
          <span class="lp-small lp-test-out-status" data-lp-section-status="${s.id}" hidden></span>
        </div>
      </li>`).join('')}</ol>
      <p class="lp-small" data-lp-intro>${html(content.allowTestOut ? strings.instructions : strings.required)}</p>
      ${content.allowTestOut ? `<div class="lp-actions" data-lp-start-actions hidden><button class="lp-button" type="button" data-lp-start>${html(strings.start)}</button></div>` : ''}
      <details class="lp-details lp-section" data-lp-review hidden><summary>${html(strings.review)}</summary></details>
      <div class="lp-actions" data-lp-restart-actions hidden><button class="lp-button lp-button-quiet" type="button" data-lp-restart hidden>${icons.refresh}${html(strings.restart)}</button></div>
    </div>
    <div class="lp-test-out-questions" data-lp-questions>
      ${questions.map((q, index) => `<div class="lp-test-out-panel lp-section" data-lp-panel="question" data-lp-section="${q.section}">
        <h3 class="lp-label" tabindex="-1" data-lp-panel-heading>${html(format(strings.question, { number: index + 1, total: questions.length }))}</h3>
        <div aria-hidden="true" class="lp-test-out-progress"><span style="inline-size: ${(index + 1) / questions.length * 100}%"></span></div>
        <p class="lp-small">${html(content.sections.find(s => s.id === q.section)?.title ?? '')}</p>
        <fieldset class="lp-choices" id="${html(`${id}-question-${q.id}`)}" tabindex="-1" data-lp-question="${html(q.id)}">
          <legend class="lp-stem">${html(q.text)}</legend>
          ${q.options.map((o, n) => `<label class="lp-choice" for="${html(`${id}-question-${q.id}-option-${n}`)}"><input type="radio" id="${html(`${id}-question-${q.id}-option-${n}`)}" name="${html(`${id}-question-${q.id}`)}" value="${html(o.id)}"><span>${html(o.text)}</span></label>`).join('\n          ')}
          <p class="lp-error-text" id="${html(`${id}-question-${q.id}-error`)}" data-lp-question-error hidden>${icons['alert-circle']}<span>${html(strings.choose)}</span></p>
          <p class="lp-outcome-detail lp-small" data-lp-explanation hidden>${html(q.explanation)}</p>
        </fieldset>
        <div class="lp-actions lp-test-out-navigation" data-lp-navigation hidden>
          <button class="lp-button lp-button-quiet" type="button" data-lp-back>${icons['arrow-back-up']}${html(strings.back)}</button>
          <button class="lp-button" type="button" ${index === questions.length - 1 ? 'data-lp-check' : 'data-lp-next'}>${html(index === questions.length - 1 ? strings.check : strings.next)}</button>
        </div>
      </div>`).join('')}
    </div>
  </div>
  <p class="lp-small lp-section" data-lp-policy>${html(strings.policy)}</p>
  <details class="lp-details lp-section" data-lp-fallback>
    <summary>${html(strings.answers)}</summary>
    <ul class="lp-test-out-fallback-list">${content.questions.map(q => `<li><strong class="lp-run-in">${html(q.text)}</strong><p>${html(format(strings.correct, { option: q.options.find(o => o.id === q.correct)?.text ?? '' }))}</p><p class="lp-small">${html(q.explanation)}</p></li>`).join('')}</ul>
  </details>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
