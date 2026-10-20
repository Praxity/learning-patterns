import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/course-lookup-icons.js';
import { validateContent, QUESTION_LIMIT } from './logic.js';

/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options @returns {string}
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  /** @param {import('./logic.js').Entry} entry */
  const target = entry => html(`${id}-section-${entry.id}`);
  return `<section class="lp lp-course-lookup" data-lp-pattern="course-lookup" data-lp-kind="${content.kind}" lang="${html(lang)}">
  <h2 class="lp-stem" id="${html(`${id}-prompt`)}">${html(content.prompt, lang).replaceAll('{course}', () => `<em>${html(content.course ?? '', lang)}</em>`)}</h2>
  <div data-lp-controls hidden class="lp-stack">
    <textarea class="lp-input" rows="2" maxlength="${QUESTION_LIMIT}" id="${html(`${id}-question`)}" aria-labelledby="${html(`${id}-prompt`)}" placeholder="${html(strings.placeholder, lang)}"></textarea>
    <div data-lp-notice id="${html(`${id}-notice`)}" hidden></div>
    <p class="lp-small" data-lp-checking hidden>${html(strings.checking, lang)}</p>
    <p class="lp-small" data-lp-paused hidden>${html(strings.paused, lang)}</p>
    <div class="lp-section lp-stack" data-lp-result aria-live="off" hidden></div>
    <button type="button" class="lp-button lp-button-secondary" data-lp-add hidden>${html(strings.add, lang)}</button>
    <p class="lp-small" data-lp-bank-message hidden></p>
    <div data-lp-challenge hidden></div>
  </div>
  <p class="lp-small" data-lp-fallback-message hidden>${html(strings.fallback, lang)}</p>
  <div class="lp-section lp-stack" data-lp-fallback>
    <h3 class="lp-run-in">${html(content.kind === 'faq' ? strings.faqList : strings.sectionList, lang)}</h3>
    ${content.kind === 'faq' ? content.entries.map(entry => `<details class="lp-details lp-course-lookup-faq"><summary><span class="lp-course-lookup-q">${icons['help-circle']}<span>${html(entry.title, lang)}</span></span></summary><p>${html(entry.answer ?? '', lang)}</p></details>`).join('\n') : `<ul class="lp-course-lookup-outline">${content.entries.map(entry => `<li id="${target(entry)}"><a href="#${target(entry)}">${html(entry.title, lang)}</a><p>${html(entry.summary ?? '', lang)}</p></li>`).join('\n')}</ul>`}
  </div>
  <div class="lp-section lp-stack" data-lp-bank hidden>
    <h3 class="lp-run-in">${html(strings.bank, lang)}</h3>
    <p class="lp-small">${html(strings.bankNotice, lang)}</p>
    <ul class="lp-course-lookup-bank" id="${html(`${id}-bank-list`)}" data-lp-bank-list></ul>
    <button type="button" class="lp-button lp-button-quiet" data-lp-bank-toggle aria-controls="${html(`${id}-bank-list`)}" aria-expanded="false" hidden>${html(strings.showAll, lang)}</button>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
