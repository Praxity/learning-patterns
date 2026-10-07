import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { FORMATS, spokenLines, validateContent } from './logic.js';

/** @type {Record<import('./logic.js').Format, keyof typeof icons>} */
const formatIcons = { text: 'file-text', slides: 'presentation', audio: 'headphones', outline: 'list-details', quiz: 'list-check' };
/** @param {import('./logic.js').Point} point @returns {string} */
function outline(point) {
  return `<ul class="lp-formats-outline">${[...point.outline, ...(point.exampleOutline ? [point.exampleOutline] : [])].map(line => `<li>${html(line)}</li>`).join('')}</ul>`;
}
/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options @returns {string}
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  return `<section class="lp lp-formats" data-lp-pattern="formats" lang="${html(lang)}">
  <header class="lp-formats-scene">
    <span class="lp-formats-scene-icon">${icons.presentation}</span>
    <div><p class="lp-label">${html(strings.scene)}</p><h3 class="lp-stem">${html(content.title)}</h3></div>
  </header>
  <div class="lp-formats-switcher" role="group" aria-label="${html(strings.formats)}" data-lp-formats hidden>
    ${FORMATS.map(format => `<button type="button" class="lp-button lp-button-secondary" data-lp-format="${format}" aria-pressed="${format === 'text'}">${icons[formatIcons[format]]}<span>${html(strings[format])}</span></button>`).join('\n    ')}
  </div>
  <p class="lp-small" data-lp-place hidden></p>
  <div class="lp-section lp-formats-lesson">
  ${content.points.map((point, index) => `<section class="lp-formats-point lp-stack" data-lp-point="${html(point.id)}" aria-labelledby="${html(`${id}-heading-${index}`)}">
    <h4 class="lp-stem" id="${html(`${id}-heading-${index}`)}">${html(point.title)}</h4>
    <div class="lp-stack" data-lp-view="text">
      <p>${html(point.sentences.join(' '))}</p>
      ${point.example ? `<p class="lp-quote">${html(point.example.join(' '))}</p>` : ''}
    </div>
    <div class="lp-stack lp-formats-slide" data-lp-view="slides" hidden>
      ${outline(point)}
      ${point.example ? `<p class="lp-quote">${html(point.example.join(' '))}</p>` : ''}
    </div>
    <div class="lp-stack" data-lp-view="audio" hidden>
      <p class="lp-small">${html(strings.scriptNote)}</p>
      <ol class="lp-formats-script">${spokenLines(point).map(line => `<li>${html(line)}</li>`).join('')}</ol>
    </div>
    <div data-lp-view="outline" hidden>${outline(point)}</div>
    <div class="lp-stack" data-lp-view="quiz" hidden>
      ${content.quiz.some(question => question.section === point.id) ? content.quiz.map((question, q) => question.section !== point.id ? '' : `<div class="lp-stack" data-lp-question="${q}">
        <fieldset class="lp-choices" aria-describedby="${html(`${id}-error-${q}`)}">
          <legend class="lp-run-in">${html(question.prompt)}</legend>
          ${question.options.map((option, o) => `<label class="lp-choice">
            <input type="radio" name="${html(`${id}-question-${q}`)}" value="${o}" aria-describedby="${html(`${id}-feedback-${q}-${o}`)}">
            <span>${html(option.text)}</span>
            <span class="lp-choice-mark" data-lp-mark-word hidden></span>
            <span class="lp-formats-feedback" id="${html(`${id}-feedback-${q}-${o}`)}" data-lp-feedback hidden>${html(option.feedback)}</span>
          </label>`).join('\n          ')}
        </fieldset>
        <p class="lp-error-text" id="${html(`${id}-error-${q}`)}" data-lp-error hidden>${icons['alert-circle']}<span>${html(strings.choose)}</span></p>
        <button type="button" class="lp-button" data-lp-check>${html(strings.check)}</button>
      </div>`).join('') : `<p class="lp-small">${html(strings.noQuestion)}</p>${outline(point)}`}
    </div>
  </section>`).join('\n  ')}
  </div>
  <nav class="lp-formats-navigation lp-section" aria-label="${html(strings.place.replace('{n}', '1').replace('{total}', String(content.points.length)))}" data-lp-navigation hidden>
    <button type="button" class="lp-button lp-button-secondary" data-lp-previous aria-disabled="true">${icons['arrow-back-up']}${html(strings.previous)}</button>
    <button type="button" class="lp-button lp-button-secondary" data-lp-next aria-disabled="${content.points.length === 1}">${html(strings.next)}${icons['arrow-right']}</button>
  </nav>
  <div class="lp-section lp-stack" data-lp-summary>
    <p class="lp-run-in">${html(strings.summary)}</p><p>${html(content.summary)}</p>
    <p class="lp-small" data-lp-quiz-summary hidden></p>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
