import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { DONT_KNOW, format, validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const locale = lang === 'fr' || lang.startsWith('fr-') ? 'fr' : 'en';
  const numbers = new Intl.NumberFormat(locale, { useGrouping: false, maximumSignificantDigits: 21 });
  const plurals = new Intl.PluralRules(locale);
  /** @param {number} value @param {string} gain @param {string} loss @param {string} zero */
  function rule(value, gain, loss, zero) {
    if (value === 0) return zero;
    const count = Math.abs(value);
    const points = count === 1 ? strings.pointOne : format(plurals.select(count) === 'one' ? strings.pointSingular : strings.pointPlural, { count: numbers.format(count) });
    return format(value > 0 ? gain : loss, { points });
  }
  const scoring = [
    rule(content.points.right, strings.ruleRightGain, strings.ruleRightLoss, strings.ruleRightZero),
    rule(content.points.wrong, strings.ruleWrongGain, strings.ruleWrongLoss, strings.ruleWrongZero),
    rule(content.points.unknown, strings.ruleUnknownGain, strings.ruleUnknownLoss, strings.ruleUnknownZero)
  ].join(' ');
  return `<section class="lp lp-dont-know" data-lp-pattern="dont-know" lang="${html(lang)}">
  <header class="lp-scene">
    <span class="lp-scene-icon">${icons['list-check']}</span>
    <div><h2 class="lp-scene-title">${html(content.title)}</h2>
      <p class="lp-scene-sub">${html(scoring)}</p></div>
  </header>
  ${content.questions.map((q, n) => `<div class="lp-section">
  <p class="lp-small lp-dont-know-question-number">${html(format(strings.questionNumber, { number: n + 1, total: content.questions.length }))}</p>
  <fieldset class="lp-choices" id="${html(`${id}-question-${n}`)}" tabindex="-1" data-lp-question="${html(q.id)}">
    <legend class="lp-stem">${html(q.text)}</legend>
    ${[...q.options, { id: DONT_KNOW, text: strings.unknown }].map((o, index) => `<label class="lp-choice" for="${html(`${id}-question-${n}-option-${index}`)}"><input type="radio" id="${html(`${id}-question-${n}-option-${index}`)}" name="${html(`${id}-question-${n}`)}" value="${html(o.id)}"><span>${html(o.text)}</span></label>`).join('\n    ')}
    <p class="lp-error-text" id="${html(`${id}-question-${n}-error`)}" data-lp-question-error hidden>${icons['alert-circle']}<span>${html(strings.choose)}</span></p>
    <p class="lp-quote lp-dont-know-explanation" data-lp-explanation hidden>${icons['info-circle']}<span>${html(q.explanation)}</span></p>
  </fieldset>
  </div>`).join('\n  ')}
  <div data-lp-flow hidden>
    <div class="lp-actions"><button class="lp-button" type="button" data-lp-check>${html(strings.check)}</button></div>
    <p class="lp-error-text" data-lp-error hidden></p>
    <div class="lp-section" data-lp-result hidden></div>
    <div class="lp-actions"><button class="lp-button lp-button-quiet" type="button" data-lp-restart hidden>${icons.refresh}${html(strings.restart)}</button></div>
  </div>
  <details class="lp-details lp-section" data-lp-fallback>
    <summary>${html(strings.answers)}</summary>
    <ul class="lp-dont-know-fallback-list">${content.questions.map(q => `<li><strong class="lp-run-in">${html(q.text)}</strong><p>${html(format(strings.correct, { option: q.options.find(o => o.id === q.correct)?.text ?? '' }))}</p><p class="lp-outcome-detail">${html(q.explanation)}</p></li>`).join('')}</ul>
  </details>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
