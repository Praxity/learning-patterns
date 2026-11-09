import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { format, rounds } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 */
export function render(content, strings, { id, lang }) {
  const all = rounds(content);
  const h = (/** @type {string} */ text) => html(text, lang);
  const answer = (/** @type {string} */ option) => h(format(strings.correct, { option: content.options.find(o => o.id === option)?.text ?? '' }));
  // The hidden labels give screen readers the change in words; struck and highlighted text shows it.
  // One line: paragraphs keep authored line breaks, so a break in this markup would show.
  const quote = (/** @type {import('./logic.js').Round} */ round) => `<p class="lp-quote lp-change-one-detail-case">${round.parts.map(part =>
    part.kind === 'before' ? `<del><span class="lp-visually-hidden">${h(strings.before)} </span>${h(part.text)}</del> `
      : part.kind === 'now' ? `<ins><span class="lp-visually-hidden">${h(strings.now)} </span>${h(part.text)}</ins>` : h(part.text)).join('')}</p>`;
  const changed = (/** @type {import('./logic.js').Round} */ round, /** @type {number} */ i) => `<h3 class="lp-run-in">${h(i === 1 ? strings.changeFirst : strings.changeNext)}</h3>
    ${quote(round)}
    <p class="lp-small">${h(strings.same)}</p>`;
  const verdict = (/** @type {import('./logic.js').Round} */ round) => round.moves === null ? '' : `<strong>${h(round.moves ? strings.moves : strings.stays)}</strong> `;
  return `<section class="lp lp-change-one-detail" data-lp-pattern="change-one-detail" lang="${html(lang)}">
  <h2 class="lp-heading">${h(content.title)}</h2>
  ${content.context ? `<p class="lp-context">${h(content.context)}</p>` : ''}
  ${all.map((round, i) => `<div class="${i ? 'lp-section' : 'lp-stack'}" data-lp-round${i ? ' hidden' : ''}>
    ${i ? changed(round, i) : quote(round)}
    <fieldset class="lp-choices" id="${html(`${id}-round-${i}`)}">
      <legend class="lp-stem">${h(content.question)}</legend>
      ${content.options.map((o, n) => `<label class="lp-choice" for="${html(`${id}-round-${i}-option-${n}`)}"><input type="radio" id="${html(`${id}-round-${i}-option-${n}`)}" name="${html(`${id}-round-${i}`)}" value="${html(o.id)}"><span>${h(o.text)}</span></label>`).join('\n      ')}
      <p class="lp-error-text" id="${html(`${id}-round-${i}-error`)}" data-lp-error hidden>${icons['alert-circle']}<span>${h(strings.choose)}</span></p>
      <p class="lp-change-one-detail-feedback" tabindex="-1" data-lp-feedback hidden><span class="lp-visually-hidden" data-lp-verdict></span>${verdict(round)}${h(round.explanation)}</p>
    </fieldset>
    <div class="lp-actions"><button class="lp-button" type="button" data-lp-check hidden>${h(strings.check)}</button></div>
  </div>`).join('\n  ')}
  <div data-lp-fallback>
    ${all.map((round, i) => `${i ? `<div class="lp-section">${changed(round, i)}` : ''}<details class="lp-details"><summary>${h(strings.answer)}</summary><p>${verdict(round)}${answer(round.correct)}</p><p>${h(round.explanation)}</p></details>${i ? '</div>' : ''}`).join('\n    ')}
    <details class="lp-details lp-section"><summary>${h(strings.ruleLabel)}</summary><p>${h(content.rule)}</p></details>
  </div>
  <div class="lp-section" data-lp-result hidden>
    <p data-lp-score></p>
    <h3 class="lp-run-in">${h(strings.ruleLabel)}</h3>
    <p>${h(content.rule)}</p>
    <div class="lp-actions"><button class="lp-button lp-button-quiet" type="button" data-lp-restart>${icons.refresh}${h(strings.restart)}</button></div>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
