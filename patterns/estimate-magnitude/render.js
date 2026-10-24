import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { positionOf, scaleFor } from './logic.js';

/** Replace placeholders without interpreting inserted text as another placeholder.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
}

/** @param {number} value @param {string} lang */
export function numberText(value, lang) {
  return value.toLocaleString(/^fr(?:-|$)/i.test(lang) ? 'fr-CA' : 'en', { maximumFractionDigits: 15 });
}

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 */
export function render(content, strings, { id, lang }) {
  const { stops, bands, start, ratio } = scaleFor(content);
  const [low, high] = bands[start];
  const range = format(strings.range, { low: numberText(low, lang), high: numberText(high, lang) });
  return `<section class="lp lp-estimate-magnitude" data-lp-pattern="estimate-magnitude" lang="${html(lang)}">
  <header class="lp-scene"><span class="lp-scene-icon">${icons['file-text']}</span><div><h2 class="lp-scene-title">${html(content.title, lang)}</h2></div></header>
  <div class="lp-context"><p><strong>${html(strings.context, lang)}</strong> ${html(content.context, lang)}</p></div>
  <div data-lp-interaction>
    <p class="lp-small" data-lp-instructions hidden>${html(format(strings.instructions, { ratio: ratio === 10 ? strings.ten : numberText(ratio, lang) }), lang)}</p>
    ${content.questions.map((question, index) => `<fieldset class="lp-stack lp-estimate-magnitude-question" data-lp-question>
      <legend class="lp-stem">${html(question.question, lang)}</legend>
      <div class="lp-estimate-magnitude-scale" hidden><div class="lp-estimate-magnitude-line" data-lp-line>
        ${stops.map(stop => `<span class="lp-estimate-magnitude-tick" aria-hidden="true" style="inset-inline-start:${positionOf(stop, stops)}%"></span>`).join('')}
        <button type="button" class="lp-estimate-magnitude-band" role="slider" id="${html(`${id}-q${index}-band`)}" value="${start}" aria-valuemin="0" aria-valuemax="${bands.length - 1}" aria-valuenow="${start}" aria-valuetext="${html(`${range} ${question.unit}`, lang)}" aria-label="${html(format(strings.band, { number: index + 1 }), lang)}" data-edge="" data-lp-band style="inset-inline-start:${positionOf(low, stops)}%;inline-size:${positionOf(high, stops) - positionOf(low, stops)}%"><span class="lp-estimate-magnitude-value" aria-hidden="true" data-lp-value>${html(range, lang)}</span></button>
        <span class="lp-estimate-magnitude-answer" aria-hidden="true" data-lp-answer hidden></span>
      </div></div>
      <p class="lp-error-text" id="${html(`${id}-q${index}-error`)}" data-lp-error hidden>${icons['alert-circle']}<span>${html(strings.empty, lang)}</span></p>
      <div data-lp-feedback hidden></div>
    </fieldset>`).join('')}
  </div>
  <details class="lp-details lp-section" data-lp-fallback>
    <summary>${html(strings.answers, lang)}</summary>
    <ol class="lp-estimate-magnitude-answers">${content.questions.map(question => `<li><p class="lp-run-in">${html(question.question, lang)}</p><p>${html(`${numberText(question.answer, lang)} ${question.unit}`, lang)}</p><p class="lp-small">${html(strings.source, lang)} ${html(question.source, lang)}</p></li>`).join('')}</ol>
  </details>
  <p class="lp-summary" data-lp-result hidden></p>
  <div class="lp-actions"><button class="lp-button" type="button" data-lp-check hidden>${html(strings.check, lang)}</button><button class="lp-button lp-button-quiet" type="button" data-lp-try-again hidden>${icons['arrow-back-up']}${html(strings.tryAgain, lang)}</button></div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
