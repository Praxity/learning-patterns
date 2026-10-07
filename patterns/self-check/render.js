import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 * @returns {string}
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const answerId = html(`${id}-answer`);
  const errorId = html(`${id}-error`);
  return `<section class="lp lp-self-check" data-lp-pattern="self-check" lang="${html(lang)}">
  <header class="lp-scene">
    <span class="lp-scene-icon">${icons.mail}</span>
    <div><p class="lp-scene-label">${html(strings.scenario)}</p><p class="lp-scene-title">${html(content.task)}</p></div>
  </header>
  <div class="lp-self-check-composer">
    <p class="lp-self-check-meta"><span class="lp-self-check-meta-key">${html(strings.to)}</span><span class="lp-self-check-recipient"><span class="lp-self-check-avatar" aria-hidden="true">${html(content.context.initials)}</span>${html(content.context.to)}</span></p>
    <p class="lp-self-check-meta"><span class="lp-self-check-meta-key">${html(strings.subject)}</span><span>${html(content.context.subject)}</span></p>
    <label class="lp-label lp-self-check-composer-label" for="${answerId}">${html(strings.answer)}</label>
    <textarea class="lp-input lp-self-check-composer-body" id="${answerId}" rows="5"></textarea>
    <div class="lp-self-check-composer-foot">
      <p class="lp-error-text" id="${errorId}" data-lp-error hidden>${icons['alert-circle']}<span>${html(strings.empty)}</span></p>
      <button class="lp-button" type="button" data-lp-check hidden>${html(strings.check)}</button>
    </div>
  </div>
  <details class="lp-details lp-section" data-lp-fallback>
    <summary>${html(strings.checkOwn)}</summary>
    <p>${html(strings.partsQuestion)}</p>
    <ul class="lp-self-check-fallback-list">${content.parts.map(part => `<li><span class="lp-run-in">${html(part.label)}</span><p>${html(part.missed)}</p></li>`).join('')}</ul>
    <h3 class="lp-run-in">${html(strings.model)}</h3>
    <p class="lp-quote">${html(content.model)}</p>
  </details>
  <div data-lp-flow hidden>
    <div class="lp-section" data-lp-ticks hidden>
      <div class="lp-self-check-step-head">
        <div><h3 class="lp-run-in" id="${html(`${id}-ticks`)}">${html(strings.tick)}</h3><p class="lp-small">${html(strings.tickHelp)}</p></div>
        <div class="lp-self-check-meter" data-lp-meter>${ring(0, content.parts.length)}<span>${html(strings.meter.replaceAll('{count}', '0').replaceAll('{total}', String(content.parts.length)))}</span></div>
      </div>
      <fieldset class="lp-choices">
        <legend class="lp-visually-hidden">${html(strings.tick)}</legend>
        ${content.parts.map((part, index) => `<label class="lp-choice" for="${html(`${id}-part-${index}`)}"><input type="checkbox" id="${html(`${id}-part-${index}`)}" value="${html(part.id)}"><span>${html(part.label)}</span></label>`).join('\n        ')}
      </fieldset>
      <div class="lp-actions lp-self-check-step-actions">
        <button class="lp-button" type="button" data-lp-show>${html(strings.show)}</button>
      </div>
    </div>
    <div class="lp-section" data-lp-result hidden></div>
    <div class="lp-actions">
      <button class="lp-button lp-button-quiet" type="button" data-lp-restart hidden>${icons.refresh}${html(strings.restart)}</button>
    </div>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}

/** Decorative progress ring. The adjacent authored text carries the count.
 * @param {number} count @param {number} total @param {number} [size]
 * @returns {string}
 */
export function ring(count, total, size = 44) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  return `<svg class="lp-self-check-ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true" focusable="false"><circle cx="${size / 2}" cy="${size / 2}" r="${radius}" class="lp-self-check-ring-track"/><circle cx="${size / 2}" cy="${size / 2}" r="${radius}" class="lp-self-check-ring-fill" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * (1 - count / total)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}
