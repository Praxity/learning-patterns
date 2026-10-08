import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { dateAfterDays, defaultDate, formatDate, formatShortDate, presetDays, validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string, today?: Date }} options @returns {string}
 */
export function render(content, strings, { id, lang, today = new Date() }) {
  validateContent(content);
  const date = defaultDate(today), displayDate = formatDate(date, lang);
  const title = html(`${id}-title`), error = html(`${id}-date-error`);
  const labels = [strings.in2Days, strings.in1Week, strings.in2Weeks, strings.in1Month];
  return `<section class="lp lp-retrieval-sheet" data-lp-pattern="retrieval-sheet" lang="${html(lang)}" aria-labelledby="${title}">
  <header class="lp-scene">
    <span class="lp-scene-icon">${icons['file-text']}</span>
    <div><h2 class="lp-scene-title" id="${title}">${html(content.title)}</h2></div>
  </header>
  <div class="lp-retrieval-sheet-controls" data-lp-controls hidden>
    <fieldset class="lp-choices lp-retrieval-sheet-spacing" data-lp-spacing>
      <legend class="lp-stem">${html(strings.spacingLegend)}</legend>
      ${[...presetDays, 'custom'].map((days, index) => `<label class="lp-choice" for="${html(`${id}-spacing-${days}`)}"><input type="radio" id="${html(`${id}-spacing-${days}`)}" name="${html(`${id}-spacing`)}" value="${days}"${days === 7 ? ' checked' : ''}><span>${html(days === 'custom' ? strings.anotherDate : labels[index])}<span class="lp-small lp-retrieval-sheet-choice-date" data-lp-choice-date${days === 'custom' ? ' hidden' : ''}><span class="lp-visually-hidden">, </span><span data-lp-choice-date-text>${days === 'custom' ? '' : html(formatShortDate(dateAfterDays(today, Number(days)), lang))}</span></span></span></label>`).join('\n      ')}
    </fieldset>
    <div class="lp-retrieval-sheet-date-field" data-lp-custom-date hidden>
      <label class="lp-label" for="${html(`${id}-date`)}">${html(strings.customDateLabel)}</label>
      <input class="lp-input" type="date" id="${html(`${id}-date`)}" data-lp-date value="${date}" min="0001-01-01" max="9999-12-31" required>
      <p class="lp-error-text" id="${error}" data-lp-date-error hidden>${icons['alert-circle']}<span>${html(strings.dateError)}</span></p>
    </div>
  </div>
  <div class="lp-retrieval-sheet-tabs" data-lp-tabs aria-label="${html(strings.sides)}" hidden>
    <button class="lp-retrieval-sheet-tab" type="button" id="${html(`${id}-tab-front`)}" data-lp-tab="front" aria-controls="${html(`${id}-front`)}">${html(strings.front)}</button>
    <button class="lp-retrieval-sheet-tab" type="button" id="${html(`${id}-tab-back`)}" data-lp-tab="back" aria-controls="${html(`${id}-back`)}">${html(strings.back)}</button>
  </div>
  <div class="lp-retrieval-sheet-pages">
    ${['front', 'back'].map(side => {
      const heading = html(`${id}-${side}-heading`);
      return `<section class="lp-retrieval-sheet-page" id="${html(`${id}-${side}`)}" data-lp-side="${side}" aria-labelledby="${heading}">
      <header class="lp-retrieval-sheet-page-header">
        <p class="lp-small">${html(content.title)}</p>
        <h3 class="lp-stem" id="${heading}">${html(side === 'front' ? strings.questions : strings.answers)}</h3>
        <p class="lp-small">${html(strings.dateLabel)} <time datetime="${date}" data-lp-print-date>${html(displayDate)}</time></p>
      </header>
      <p class="lp-small">${html(side === 'front' ? strings.instruction : strings.backInstruction)}</p>
      <ol class="lp-retrieval-sheet-list">
        ${content.questions.map(row => `<li data-lp-question="${html(row.id)}"><p>${html(side === 'front' ? row.question : row.answer)}</p>${side === 'front' ? '<div class="lp-retrieval-sheet-space" aria-hidden="true"></div>' : ''}</li>`).join('\n        ')}
      </ol>
    </section>`;
    }).join('\n    ')}
  </div>
  <div class="lp-actions" data-lp-print-controls hidden><button class="lp-button" type="button" data-lp-print>${icons['file-text']}<span>${html(strings.print)}</span></button></div>
  <p class="lp-small">${html(strings.printHint)}</p>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
