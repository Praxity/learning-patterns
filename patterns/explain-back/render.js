import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { validateContent, ANSWER_LIMIT } from './logic.js';

/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options @returns {string}
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  return `<section class="lp lp-unboxed lp-explain-back" data-lp-pattern="explain-back" lang="${html(lang)}">
  <div class="lp-stack lp-explain-back-lesson">${content.ideas.map(idea => `<h2 class="lp-stem" id="${html(`${id}-lesson-${idea.id}`)}" tabindex="-1">${html(idea.heading)}</h2><p>${html(idea.body)}</p>`).join('\n')}</div>
  <div class="lp-box">
    <h2 class="lp-stem" id="${html(`${id}-task`)}">${html(content.task)}</h2>
    <div class="lp-explain-back-composer">
      <textarea class="lp-input" id="${html(`${id}-answer`)}" aria-labelledby="${html(`${id}-task`)}" rows="4" maxlength="${ANSWER_LIMIT}" placeholder="${html(strings.placeholder)}"></textarea>
    </div>
    <div data-lp-notice id="${html(`${id}-notice`)}" hidden></div>
    <p class="lp-error-text" id="${html(`${id}-error`)}" data-lp-error hidden>${icons['alert-circle']}<span>${html(strings.empty)}</span></p>
    <div class="lp-actions"><button class="lp-button" type="button" data-lp-check hidden>${html(strings.check)}</button></div>
    <div data-lp-challenge hidden></div>
    <div class="lp-section" data-lp-result hidden></div>
    <div class="lp-section" data-lp-fallback>
      <fieldset class="lp-choices">
        <legend class="lp-run-in">${html(strings.fallback)}</legend>
        ${content.ideas.map(idea => `<label class="lp-choice" for="${html(`${id}-tick-${idea.id}`)}"><input type="checkbox" id="${html(`${id}-tick-${idea.id}`)}" value="${html(idea.id)}"><span>${html(idea.label)}</span></label>`).join('\n')}
      </fieldset>
    </div>
    <details class="lp-details lp-section" data-lp-model open>
      <summary>${html(strings.model)}</summary><p>${html(content.model)}</p>
    </details>
    <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
  </div>
</section>`;
}
