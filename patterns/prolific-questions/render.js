import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  return `<section class="lp lp-prolific-questions" data-lp-pattern="prolific-questions" lang="${html(lang)}">
  <header class="lp-scene"><span class="lp-scene-icon">${icons['file-text']}</span><div><h2 class="lp-scene-title">${html(content.title, lang)}</h2></div></header>
  <div class="lp-context"><p><strong>${html(strings.context, lang)}</strong> ${html(content.context, lang)}</p></div>
  <div class="lp-section" data-lp-worked>
    <h3 class="lp-run-in" id="${html(`${id}-worked`)}">${html(strings.worked, lang)}</h3>
    <div class="lp-prolific-questions-worked">${content.parts.map((part, i) => `
      <div class="lp-prolific-questions-component">
        <h4 class="lp-run-in" id="${html(`${id}-part-${i}`)}">${html(part.label, lang)}</h4>
        <p class="lp-small">${html(part.definition, lang)}</p><p>${html(content.workedExample[i], lang)}</p>
      </div>`).join('')}
    </div>
  </div>
  <div class="lp-section" data-lp-practice hidden>
    <fieldset class="lp-prolific-questions-deal" tabindex="-1" data-lp-question>
      <legend class="lp-stem">${html(content.question, lang)}</legend>
      <div data-lp-facts>${content.parts.map((_, i) => `
        <fieldset class="lp-choices lp-prolific-questions-fact" data-lp-fact>
          <legend data-lp-fact-text>${html(content.cases[0][i], lang)}</legend>
          ${content.parts.map((part, slot) => `<label class="lp-choice" for="${html(`${id}-fact-${i}-${slot}`)}"><input type="radio" id="${html(`${id}-fact-${i}-${slot}`)}" name="${html(`${id}-fact-${i}`)}" value="${slot}"><span>${html(part.label, lang)}</span></label>`).join('')}
        </fieldset>`).join('')}
      </div>
      <p class="lp-error-text" id="${html(`${id}-error`)}" data-lp-error hidden>${icons['alert-circle']}<span></span></p>
      <div class="lp-actions">
        <button class="lp-button" type="button" data-lp-check>${html(strings.check, lang)}</button>
        <button class="lp-button" type="button" data-lp-next data-lp-keep hidden>${icons['arrows-shuffle']}${html(strings.next, lang)}</button>
      </div>
    </fieldset>
    <p class="lp-run-in" data-lp-result hidden></p>
  </div>
  <details class="lp-details lp-section" data-lp-fallback>
    <summary>${html(strings.answers, lang)}</summary>
    ${content.cases.map((facts, i) => `<section class="lp-section"><h3 class="lp-run-in">${html(strings.case.replace('{number}', String(i + 1)), lang)}</h3><ul>${facts.map((fact, slot) => `<li><strong>${html(`${content.parts[slot].label}:`, lang)}</strong> ${html(fact, lang)}</li>`).join('')}</ul></section>`).join('')}
  </details>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
