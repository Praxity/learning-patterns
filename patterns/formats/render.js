import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { FORMATS, spokenLines, validateContent } from './logic.js';

/** @type {Record<import('./logic.js').Format, keyof typeof icons>} */
const formatIcons = { text: 'file-text', slides: 'presentation', audio: 'headphones', outline: 'list-details', quiz: 'list-check' };
const SAMPLE_SECONDS = 80;
/** @param {number} seconds @returns {string} */
function timestamp(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
/** @param {import('./logic.js').Point} point @returns {string} */
function outline(point, tag = 'ul') {
  return `<${tag} class="lp-formats-points">${[...point.outline, ...(point.exampleOutline ? [point.exampleOutline] : [])].map(line => `<li>${html(line)}</li>`).join('')}</${tag}>`;
}
/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options @returns {string}
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  return `<section class="lp lp-formats" data-lp-pattern="formats" lang="${html(lang)}">
  <header class="lp-scene">
    <span class="lp-scene-icon">${icons.presentation}</span>
    <div><p class="lp-scene-label">${html(strings.scene)}</p><h3 class="lp-scene-title">${html(content.title)}</h3></div>
  </header>
  <div class="lp-formats-switcher" role="group" aria-label="${html(strings.formats)}" data-lp-formats hidden>
    ${FORMATS.map(format => `<button type="button" class="lp-button lp-button-secondary" data-lp-format="${format}" aria-pressed="${format === 'text'}">${icons[formatIcons[format]]}<span>${html(strings[format])}</span></button>`).join('\n    ')}
  </div>
  <p class="lp-small" data-lp-place hidden></p>
  <div class="lp-section lp-formats-lesson">
  ${content.points.map((point, index) => `<section class="lp-formats-point" data-lp-point="${html(point.id)}" aria-labelledby="${html(`${id}-heading-${index}`)}">
    <article class="lp-stack lp-formats-article" data-lp-view="text">
      <h4 class="lp-stem" id="${html(`${id}-heading-${index}`)}">${html(point.title)}</h4>
      <p>${html(point.sentences.join(' '))}</p>
      ${point.example ? `<p class="lp-quote">${html(point.example.join(' '))}</p>` : ''}
    </article>
    <div class="lp-stack lp-formats-slide" data-lp-view="slides" hidden>
      <h4 class="lp-stem">${html(point.title)}</h4>
      ${outline(point)}
      <span class="lp-small lp-formats-slide-number" data-lp-slide-number>${index + 1} / ${content.points.length}</span>
    </div>
    <div class="lp-stack lp-formats-audio" data-lp-view="audio" hidden>
      <div class="lp-formats-player">
        <button type="button" class="lp-button lp-button-secondary" disabled aria-label="${html(strings.playUnavailable)}">${html(strings.play)}</button>
        <div class="lp-formats-player-detail"><p class="lp-small">${html(strings.sample)}</p><div class="lp-formats-track" aria-hidden="true"></div></div>
        <span class="lp-small lp-formats-player-time">${timestamp(0)} / ${timestamp(SAMPLE_SECONDS)}</span>
      </div>
      <p class="lp-small">${html(strings.scriptNote)}</p>
      <ol class="lp-formats-script">${spokenLines(point).map((line, n, lines) => {
        // Evenly spaced cues illustrate an 80-second sample, not recording timings.
        const seconds = Math.floor(n * SAMPLE_SECONDS / lines.length);
        return `<li><time datetime="PT${seconds}S">${timestamp(seconds)}</time>${n === 0 ? '<h4 class="lp-stem"' : '<span'} data-lp-script-line>${html(line)}${n === 0 ? '</h4>' : '</span>'}</li>`;
      }).join('')}</ol>
    </div>
    <div data-lp-view="outline" hidden><ol class="lp-formats-outline">${content.points.map((section, n) => `<li${n === index ? ' aria-current="step"' : ''}>${n === index ? `<h4 class="lp-stem">${html(section.title)}</h4>${outline(section, 'ol')}` : `<span>${html(section.title)}</span>`}</li>`).join('')}</ol></div>
    <div class="lp-stack" data-lp-view="quiz" hidden>
      <h4 class="lp-stem">${html(point.title)}</h4>
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
    <div class="lp-formats-nav-slot"><button type="button" class="lp-button lp-button-secondary" data-lp-previous hidden>${icons['arrow-back-up']}<span>${html(strings.previous)}</span></button></div>
    <div class="lp-formats-nav-slot"><button type="button" class="lp-button lp-button-secondary" data-lp-next${content.points.length === 1 ? ' hidden' : ''}><span>${html(strings.next)}</span>${icons['arrow-right']}</button></div>
  </nav>
  <div class="lp-section lp-stack" data-lp-summary>
    <p class="lp-run-in">${html(strings.summary)}</p><p>${html(content.summary)}</p>
    <p class="lp-small" data-lp-quiz-summary hidden></p>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
