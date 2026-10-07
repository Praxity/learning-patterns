import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { format, validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  return `<section class="lp lp-test-out" data-lp-pattern="test-out" lang="${html(lang)}">
  <header class="lp-test-out-scene">
    <span class="lp-test-out-icon">${icons['list-details']}</span>
    <div><p class="lp-label">${html(strings.placement)}</p><h2 class="lp-stem">${html(content.title)}</h2></div>
  </header>
  <div class="lp-test-out-layout lp-section">
    <nav class="lp-test-out-outline" aria-labelledby="${html(`${id}-outline`)}">
      <h3 class="lp-label" id="${html(`${id}-outline`)}">${html(strings.outline)}</h3>
      <ol class="lp-test-out-outline-list">${content.sections.map(s => `<li>
        <p class="lp-run-in">${html(s.title)}</p>
        <p class="lp-small lp-neutral lp-test-out-status" data-lp-section-status="${s.id}">${icons['circle-dashed']}<span>${html(strings.todo)}</span></p>
      </li>`).join('')}</ol>
    </nav>
    <div class="lp-test-out-questions">
      <h3 class="lp-stem">${html(strings.questions)}</h3>
      <p class="lp-small">${html(strings.instructions)}</p>
      ${content.sections.map((s, index) => `<div class="${index ? 'lp-section ' : ''}lp-test-out-question-group" data-lp-section="${s.id}">
        <h4 class="lp-label">${html(format(strings.section, { number: s.id, title: s.title }))}</h4>
        ${s.requires.length ? `<p class="lp-small">${html(format(strings.buildsOn, { sections: s.requires.map(r => content.sections.find(section => section.id === r)?.title ?? '').join(', ') }))}</p>` : ''}
        ${content.questions.filter(q => q.section === s.id).map(q => `<fieldset class="lp-choices" id="${html(`${id}-question-${q.id}`)}" tabindex="-1" data-lp-question="${html(q.id)}">
          <legend class="lp-stem">${html(q.text)}</legend>
          ${q.options.map((o, n) => `<label class="lp-choice" for="${html(`${id}-question-${q.id}-option-${n}`)}"><input type="radio" id="${html(`${id}-question-${q.id}-option-${n}`)}" name="${html(`${id}-question-${q.id}`)}" value="${html(o.id)}"><span>${html(o.text)}</span></label>`).join('\n          ')}
          <p class="lp-error-text" id="${html(`${id}-question-${q.id}-error`)}" data-lp-question-error hidden>${icons['alert-circle']}<span>${html(strings.choose)}</span></p>
          <p class="lp-outcome-detail lp-small" data-lp-explanation hidden>${html(q.explanation)}</p>
        </fieldset>`).join('')}
      </div>`).join('')}
      <div data-lp-flow hidden>
        <p class="lp-error-text" data-lp-error hidden></p>
        <div class="lp-actions"><button class="lp-button" type="button" data-lp-check>${html(strings.check)}</button><button class="lp-button lp-button-quiet" type="button" data-lp-restart hidden>${icons.refresh}${html(strings.restart)}</button></div>
        <p class="lp-run-in lp-section" data-lp-result hidden></p>
      </div>
    </div>
  </div>
  <p class="lp-small lp-section" data-lp-policy>${html(strings.policy)}${content.allowTestOut ? '' : ` ${html(strings.required)}`}</p>
  <details class="lp-details lp-section" data-lp-fallback>
    <summary>${html(strings.answers)}</summary>
    <ul class="lp-test-out-fallback-list">${content.questions.map(q => `<li><strong class="lp-run-in">${html(q.text)}</strong><p>${html(format(strings.correct, { option: q.options.find(o => o.id === q.correct)?.text ?? '' }))}</p><p class="lp-small">${html(q.explanation)}</p></li>`).join('')}</ul>
  </details>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
