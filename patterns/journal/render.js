import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { validateContent, ANSWER_LIMIT } from './logic.js';

/** @param {import('./logic.js').Content} content @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string, date?: Date }} options @returns {string}
 */
export function render(content, strings, { id, lang, date = new Date() }) {
  validateContent(content);
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dated = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'long' }).format(date);
  return `<section class="lp lp-journal" data-lp-pattern="journal" lang="${html(lang)}">
    <p class="lp-small lp-journal-date">${icons.calendar}<time datetime="${html(today, lang)}" data-lp-date>${html(dated, lang)}</time></p>
    <h2 class="lp-stem" id="${html(`${id}-prompt`)}">${html(content.prompt, lang)}</h2>
    <textarea class="lp-input lp-journal-page" id="${html(`${id}-entry`)}" aria-labelledby="${html(`${id}-prompt`)}" rows="8" maxlength="${ANSWER_LIMIT}" placeholder="${html(strings.placeholder, lang)}"></textarea>
    <p class="lp-error-text" id="${html(`${id}-error`)}" data-lp-error hidden></p>
    <div class="lp-actions lp-journal-actions" data-lp-actions hidden>
      <div class="lp-journal-action">
        <button class="lp-button" type="button" data-lp-save>${html(strings.save, lang)}</button>
      </div>
      <div class="lp-journal-action lp-journal-suggest">
        <button class="lp-button lp-button-secondary" type="button" data-lp-suggest>${html(strings.suggest, lang)}</button>
        <div data-lp-notice id="${html(`${id}-notice`)}" hidden></div>
      </div>
      <p class="lp-small" data-lp-saved hidden></p>
    </div>
    <div data-lp-challenge hidden></div>
    <p class="lp-small" data-lp-changed hidden></p>
    <p class="lp-journal-result" data-lp-result hidden></p>
    <p class="lp-small" data-lp-offline hidden>${html(strings.fallback, lang)}</p>
    <details class="lp-details lp-section" data-lp-questions open>
      <summary>${html(strings.showQuestions, lang)}</summary>
      <ul class="lp-journal-questions">${content.questions.map(question => `<li>${html(question.text, lang)}</li>`).join('')}</ul>
    </details>
    <p class="lp-small" data-lp-support>${html(content.supportNote, lang)}</p>
    <p class="lp-small" data-lp-no-script>${html(strings.noScript, lang)}</p>
    <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
  </section>`;
}
