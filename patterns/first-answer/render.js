import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { MAX_LENGTH, validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string, stage?: 'first' | 'end' | 'both' }} options
 * @returns {string}
 */
export function render(content, strings, { id, lang, stage = 'both' }) {
  validateContent(content);
  if (!['first', 'end', 'both'].includes(stage)) throw new Error('Invalid stage');
  /** @param {string} suffix */
  const key = suffix => html(`${id}-${suffix}`);
  /** @param {'first' | 'now'} name @param {string} label */
  const input = (name, label) => `<div>
    <label class="lp-label" for="${key(name)}">${html(label, lang)}</label>
    <textarea class="lp-input lp-first-answer-page" id="${key(name)}" data-lp-${name}-input rows="5" maxlength="${MAX_LENGTH}"></textarea>
    <p class="lp-error-text" id="${key(`${name}-error`)}" data-lp-${name}-error hidden></p>
  </div>`;
  const first = `<section class="lp-stack lp-first-answer-step" data-lp-first-step aria-labelledby="${key('start')}">
    <h3 class="lp-run-in lp-first-answer-heading" id="${key('start')}">${html(strings.start, lang)}</h3>
    <div data-lp-first-editor>${input('first', strings.firstLabel)}</div>
    <div class="lp-actions">
      <button class="lp-button" type="button" data-lp-save-first hidden>${html(strings.saveFirst, lang)}</button>
    </div>
    <div class="lp-stack lp-first-answer-card lp-first-answer-saved" data-lp-first-saved hidden>
      <p class="lp-small lp-first-answer-date">${icons.calendar}<span data-lp-first-date></span></p>
      <blockquote class="lp-first-answer-quote" data-lp-first-quote></blockquote>
    </div>
  </section>`;
  const end = `<section class="lp-stack lp-first-answer-step${stage === 'both' ? ' lp-section' : ''}" data-lp-end-step aria-labelledby="${key('end')}" hidden>
    <h3 class="lp-run-in lp-first-answer-heading" id="${key('end')}" data-lp-end-heading tabindex="-1">${html(strings.end, lang)}</h3>
    <p class="lp-small" data-lp-missing hidden>${html(strings.missing, lang)}</p>
    ${input('now', strings.nowLabel)}
    <div class="lp-actions"><button class="lp-button" type="button" data-lp-compare>${html(strings.compare, lang)}</button></div>
    <div class="lp-stack" data-lp-result hidden>
      <div class="lp-stack lp-first-answer-card" data-lp-panel-first-card>
        <h4 class="lp-label" tabindex="-1" data-lp-result-heading>${html(strings.start, lang)}</h4>
        <p class="lp-small lp-first-answer-date">${icons.calendar}<span data-lp-panel-first-date></span></p>
        <blockquote class="lp-first-answer-quote" data-lp-panel-first></blockquote>
      </div>
      <fieldset class="lp-choices"><legend>${html(strings.tick, lang)}</legend>
        ${content.checks.map((check, index) => `<label class="lp-choice" for="${key(`check-${index}`)}"><input id="${key(`check-${index}`)}" type="checkbox" value="${html(check.id)}"><span class="lp-first-answer-check-text">${html(check.label, lang)}</span></label>`).join('\n        ')}
      </fieldset>
      <p class="lp-small" data-lp-summary></p>
    </div>
  </section>`;
  return `<section class="lp lp-first-answer" data-lp-pattern="first-answer" data-lp-stage="${stage}" lang="${html(lang)}">
  <header class="lp-scene">
    <span class="lp-scene-icon">${icons.notebook}</span>
    <div><h2 class="lp-scene-title">${html(content.prompt, lang)}</h2></div>
  </header>
  <p class="lp-error-text" data-lp-storage-error hidden></p>
  ${stage === 'end' ? '' : first}
  ${stage === 'both' ? `<div class="lp-first-answer-timeline" data-lp-course hidden><span class="lp-first-answer-history">${icons.history}</span><div><p class="lp-small">${html(strings.courseNote, lang)}</p><div class="lp-actions"><button class="lp-button lp-button-secondary" type="button" data-lp-skip>${html(strings.skip, lang)}</button></div></div></div>` : ''}
  ${stage === 'first' ? '' : end}
  ${stage === 'end' ? `<div class="lp-stack" data-lp-end-fallback>${input('first', strings.firstLabel)}</div>` : ''}
  <p class="lp-small" data-lp-fallback>${html(strings.noScript, lang)}</p>
  <div class="lp-actions">
    ${stage === 'first' ? '' : `<button class="lp-button lp-button-quiet" type="button" data-lp-try-again hidden>${icons['arrow-back-up']}${html(strings.tryAgain, lang)}</button>`}
    <button class="lp-button lp-button-quiet" type="button" data-lp-restart hidden>${icons.refresh}${html(strings.restart, lang)}</button>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
