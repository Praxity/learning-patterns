import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { COUNT_FIELDS, courseEstimate } from './logic.js';
import { formatText, summaryText } from './strings.js';

/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options @returns {string}
 */
export function render(content, strings, { id, lang }) {
  const estimate = courseEstimate(content);
  const title = html(`${id}-title`);
  return `<section class="lp lp-minutes" data-lp-pattern="minutes" lang="${html(lang)}" aria-labelledby="${title}">
  <header class="lp-scene">
    <span class="lp-scene-icon">${icons['list-details']}</span>
    <div><p class="lp-scene-label">${html(strings.outline)}</p><h2 class="lp-scene-title" id="${title}">${html(content.title)}</h2></div>
  </header>
  <button type="button" class="lp-button lp-button-secondary" data-lp-toggle aria-pressed="false" hidden>${html(strings.authorView)}</button>
  <p class="lp-small" data-lp-instruction hidden>${html(strings.instruction)}</p>
  <ol class="lp-minutes-outline">
  ${content.sections.map((section, index) => {
    const heading = html(`${id}-heading-${index}`);
    const row = estimate.sections[index];
    return `<li class="lp-minutes-section" data-lp-section="${html(section.id)}">
    <div class="lp-minutes-row"><div class="lp-minutes-heading"><h3 class="lp-run-in" id="${heading}">${html(section.title)}</h3>
      <p class="lp-small" data-lp-breakdown>${html(formatText(strings.breakdown, { words: section.words, questions: section.questions }, lang))}</p></div>
      <span class="lp-small lp-minutes-chip">${icons.history}<span data-lp-minutes>${html(formatText(strings.minutes, { n: row?.minutes ?? 0 }, lang))}</span></span>
    </div>
    <p class="lp-small lp-minutes-chip lp-minutes-warning" data-lp-warning${row?.overLimit ? '' : ' hidden'}>${icons['alert-circle']}<span>${html(strings.warning)}</span></p>
    <div class="lp-minutes-inputs" data-lp-inputs role="group" aria-labelledby="${heading}" hidden>
      ${COUNT_FIELDS.map(key => {
        const fieldId = html(`${id}-${index}-${key}`), errorId = html(`${id}-${index}-${key}-error`), labelId = html(`${id}-${index}-${key}-label`);
        return `<div><label class="lp-label" id="${labelId}" for="${fieldId}">${html(strings[key])}</label>
        <input class="lp-input lp-minutes-input" type="number" id="${fieldId}" min="0" max="9007199254740991" step="1" inputmode="numeric" value="${section[key]}" data-lp-field="${key}" aria-labelledby="${heading} ${labelId}">
        <p class="lp-error-text" id="${errorId}" data-lp-error="${key}" hidden>${icons['alert-circle']}<span>${html(strings.invalid)}</span></p></div>`;
      }).join('\n      ')}
    </div>
  </li>`;
  }).join('\n  ')}
  </ol>
  <footer class="lp-section"><p class="lp-run-in" data-lp-summary>${html(summaryText(strings, estimate.total, estimate.sections.filter(row => row.overLimit).length, lang))}</p>
    <p class="lp-small">${html(formatText(strings.assumptions, content.rates, lang))}</p></footer>
  <p class="lp-visually-hidden" role="status" aria-live="polite" aria-atomic="true"></p>
</section>`;
}
