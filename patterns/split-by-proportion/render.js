import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { format, initialDividers, quantity, shares, validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const d = initialDividers(content);
  const mine = shares(content, d);
  const h = (/** @type {string} */ text) => html(text, lang);
  const q = (/** @type {number} */ value) => h(quantity(value, content, lang));
  /** @param {number[]} values @param {boolean} [withText] */
  const segments = (values, withText = true) => values.map((v, i) => `<span class="lp-split-by-proportion-seg" data-opt="${i}" style="inline-size:${v / content.total * 100}%"${v === 0 ? ' hidden' : ''}>${withText ? `<span class="lp-split-by-proportion-letter">${'ABCDEF'[i]}</span><span class="lp-split-by-proportion-pct" data-lp-segment-value>${q(v)}</span>` : ''}</span>`).join('');
  return `<section class="lp lp-split-by-proportion" data-lp-pattern="split-by-proportion" lang="${html(lang)}">
  <header class="lp-scene"><span class="lp-scene-icon">${icons.presentation}</span><div><h2 class="lp-scene-title">${h(content.title)}</h2></div></header>
  <div><p><strong>${h(strings.context)}</strong> ${h(content.context)}</p></div>
  <fieldset class="lp-split-by-proportion-estimate" aria-describedby="${html(`${id}-help`)}">
    <legend class="lp-stem">${h(content.question)}</legend>
    <p class="lp-small" id="${html(`${id}-help`)}" data-lp-help hidden>${h(format(strings.help, { total: quantity(content.total, content, lang) }))}</p>
    <div data-lp-interaction hidden>
    <div class="lp-split-by-proportion-split" data-lp-split>
      ${d.map((value, i) => `<input type="range" id="${html(`${id}-divider-${i}`)}" data-i="${i}" min="0" max="${content.total}" step="${content.step}" value="${value}" aria-label="${h(format(strings.divider, { left: content.options[i].label, right: content.options[i + 1].label }))}" aria-valuetext="${h(`${content.options[i].label} ${quantity(mine[i], content, lang)}, ${content.options[i + 1].label} ${quantity(mine[i + 1], content, lang)}`)}">`).join('')}
      <div class="lp-split-by-proportion-bar" data-lp-bar aria-hidden="true">${segments(mine)}${d.map((v, i) => `<span class="lp-split-by-proportion-grip" data-i="${i}" style="inset-inline-start:${v / content.total * 100}%"></span>`).join('')}</div>
    </div>
    </div>
    <ul class="lp-split-by-proportion-key">${content.options.map((o, i) => `<li data-opt="${i}"><span class="lp-split-by-proportion-swatch" aria-hidden="true">${'ABCDEF'[i]}</span><span>${h(o.label)} <strong data-lp-share hidden>${q(mine[i])}</strong></span></li>`).join('')}</ul>
  </fieldset>
  <p class="lp-error-text" data-lp-error hidden>${icons['alert-circle']}<span>${h(strings.untouched)}</span></p>
  <div class="lp-actions"><button class="lp-button" type="button" data-lp-check hidden>${h(strings.check)}</button></div>
  <details class="lp-details lp-section" data-lp-fallback>
    <summary>${h(strings.answers)}</summary><h3 class="lp-stem">${h(content.resultTitle)}</h3>
    <table class="lp-split-by-proportion-answer-table"><thead><tr><th scope="col">${h(content.optionHeading)}</th><th scope="col">${h(strings.real)}</th></tr></thead><tbody>${content.options.map(o => `<tr><th scope="row">${h(o.label)}</th><td>${q(o.share)}</td></tr>`).join('')}</tbody></table>
    <p class="lp-small"><strong>${h(strings.source)}</strong> ${h(content.source)}</p>
  </details>
  <div class="lp-section" data-lp-result hidden>
    <h3 class="lp-stem">${h(content.resultTitle)}</h3>
    <div class="lp-split-by-proportion-chart">
      ${[mine, content.options.map(o => o.share)].map((values, row) => `<div><p class="lp-small" aria-hidden="true">${h(row === 0 ? strings.mine : strings.real)}</p><div class="lp-split-by-proportion-letters" aria-hidden="true">${values.map((v, i) => `<span style="inline-size:${v / content.total * 100}%"${v === 0 ? ' hidden' : ''}><span class="lp-split-by-proportion-label"><span class="lp-split-by-proportion-letter">${'ABCDEF'[i]}</span><span class="lp-split-by-proportion-pct" data-lp-segment-value>${q(v)}</span></span></span>`).join('')}</div><div class="lp-split-by-proportion-bar" aria-hidden="true">${segments(values, false)}</div></div>`).join('')}
      <div class="lp-visually-hidden"><table class="lp-split-by-proportion-answer-table lp-split-by-proportion-table"><caption>${h(strings.caption)}</caption><thead><tr><th scope="col">${h(content.optionHeading)}</th><th scope="col">${h(strings.mine)}</th><th scope="col">${h(strings.real)}</th></tr></thead><tbody>${content.options.map(o => `<tr><th scope="row">${h(o.label)}</th><td data-lp-mine></td><td>${q(o.share)}</td></tr>`).join('')}</tbody></table></div>
    </div>
    <p class="lp-small"><strong>${h(strings.source)}</strong> ${h(content.source)}</p>
  </div>
  <p class="lp-split-by-proportion-summary" data-lp-summary hidden></p>
  <div class="lp-actions"><button class="lp-button lp-button-quiet" type="button" data-lp-try-again hidden>${icons['arrow-back-up']}${h(strings.tryAgain)}</button></div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
