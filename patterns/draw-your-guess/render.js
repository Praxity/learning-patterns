import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { format, snap, validateContent, x, y } from './logic.js';

/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const all = [...content.known, ...content.future], n = all.length, k = content.known.length;
  const cls = 'lp-draw-your-guess-';
  const text = /** @param {string} value */ value => html(value, lang);
  const identifier = /** @param {string} suffix */ suffix => html(`${id}-${suffix}`);
  const numbers = new Intl.NumberFormat(lang);
  const tick = Math.ceil(content.top / 3 / content.step) * content.step;
  const ticks = [...Array.from({ length: Math.ceil(content.top / tick) }, (_, i) => i * tick), content.top];
  const position = /** @param {number} i @param {number} value */ (i, value) => `inset-inline-start:${x(i, n) * 100}%;inset-block-start:${y(value, content.top) * 100}%`;
  return `<section class="lp lp-draw-your-guess" data-lp-pattern="draw-your-guess" lang="${html(lang)}" aria-labelledby="${identifier('title')}">
  <header class="lp-scene"><span class="lp-scene-icon">${icons.presentation}</span><div><h2 class="lp-scene-title" id="${identifier('title')}">${text(content.title)}</h2></div></header>
  <div><p><strong>${text(strings.context)}</strong> ${text(content.context)}</p></div>
  <fieldset class="${cls}fieldset">
    <legend class="lp-stem">${text(content.question)}</legend>
    <p class="lp-small" id="${identifier('help')}" data-lp-help hidden>${text(strings.help)}</p>
    <ul class="lp-visually-hidden">${content.known.map(p => `<li>${text(format(strings.value, { name: p.name, value: numbers.format(p.value), unit: content.unit }))}</li>`).join('')}</ul>
    <div class="${cls}chart" data-lp-chart>
      <div class="${cls}y" aria-hidden="true">${ticks.map(v => `<span style="inset-block-start:${y(v, content.top) * 100}%">${text(numbers.format(v))}</span>`).join('')}</div>
      <div class="${cls}plot">
        <div class="${cls}zone" style="inset-inline-start:${k / n * 100}%" aria-hidden="true"><span>${text(content.changeLabel)}</span></div>
        <div class="${cls}grid" aria-hidden="true">${ticks.map(v => `<span style="inset-block-start:${y(v, content.top) * 100}%"></span>`).join('')}</div>
        <svg class="${cls}lines" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <polyline class="${cls}real" data-lp-real points="${content.known.map((p, i) => `${x(i, n) * 800},${y(p.value, content.top) * 300}`).join(' ')}" fill="none" vector-effect="non-scaling-stroke"/>
          <polyline class="${cls}guess" data-lp-guess fill="none" vector-effect="non-scaling-stroke"/>
        </svg>
        <div class="${cls}marks" data-lp-marks aria-hidden="true">${content.known.map((p, i) => `<span class="${cls}sq" style="${position(i, p.value)}"></span>`).join('')}</div>
        <div class="${cls}future" data-lp-future hidden style="inset-inline-start:${k / n * 100}%;grid-template-columns:repeat(${content.future.length},minmax(0,1fr))">${content.future.map((p, i) => `<div class="${cls}col"><input type="range" id="${identifier(`point-${i}`)}" aria-label="${text(p.name)}" aria-valuetext="${text(format(strings.notSet, { name: p.name }))}" min="0" max="${content.top}" step="${content.step}" value="${snap(content, content.known[content.known.length - 1].value)}"></div>`).join('')}</div>
      </div>
      <div class="${cls}x" aria-hidden="true" style="grid-template-columns:repeat(${n},minmax(0,1fr))">${all.map(p => `<span>${text(p.label)}</span>`).join('')}</div>
    </div>
    <ul class="${cls}key" aria-hidden="true">
      <li><svg width="28" height="12" viewBox="0 0 28 12"><line class="${cls}real" x1="0" y1="6" x2="28" y2="6"/><rect class="${cls}sq-ico" x="10" y="2" width="8" height="8"/></svg>${text(content.realLabel)}</li>
      <li data-lp-guess-key hidden><svg width="28" height="12" viewBox="0 0 28 12"><line class="${cls}guess" x1="0" y1="6" x2="28" y2="6"/><circle class="${cls}dot-ico" cx="14" cy="6" r="4.5"/></svg>${text(strings.guess)}</li>
    </ul>
  </fieldset>
  <p class="lp-error-text" id="${identifier('error')}" data-lp-error hidden>${icons['alert-circle']}<span></span></p>
  <div class="lp-actions"><button class="lp-button" type="button" data-lp-check hidden>${text(strings.check)}</button></div>
  <details class="lp-details lp-section" data-lp-fallback><summary>${text(strings.answers)}</summary>
    <table class="${cls}table"><caption>${text(content.realLabel)}</caption><thead><tr><th scope="col">${text(strings.point)}</th><th scope="col">${text(content.unit)}</th></tr></thead><tbody>${all.map(p => `<tr><th scope="row">${text(p.name)}</th><td>${text(numbers.format(p.value))}</td></tr>`).join('')}</tbody></table>
    <p><strong>${text(content.explanationLabel)}</strong> ${text(content.explanation)}</p><p class="lp-small"><strong>${text(strings.source)}</strong> ${text(content.source)}</p>
  </details>
  <div class="lp-section" data-lp-result hidden><h3 class="lp-stem">${text(content.resultTitle)}</h3><p><strong>${text(content.explanationLabel)}</strong> ${text(content.explanation)}</p><p class="lp-small"><strong>${text(strings.source)}</strong> ${text(content.source)}</p></div>
  <ul class="lp-visually-hidden" data-lp-comparison hidden></ul>
  <p class="lp-summary ${cls}summary" data-lp-summary hidden></p>
  <div class="lp-actions"><button class="lp-button lp-button-quiet" type="button" data-lp-try-again hidden>${icons['arrow-back-up']}${text(strings.again)}</button></div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
