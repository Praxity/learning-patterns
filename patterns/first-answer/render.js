import { escapeHtml as html } from '../../lib/html.js';
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
  const input = (name, label) => `<label class="lp-first-answer-label" for="${key(name)}">${html(label)}</label>
    <textarea class="lp-first-answer-input" id="${key(name)}" data-lp-${name}-input rows="5" maxlength="${MAX_LENGTH}"></textarea>
    <p class="lp-first-answer-error" id="${key(`${name}-error`)}" data-lp-${name}-error hidden></p>`;
  const first = `<section class="lp-first-answer-step" data-lp-first-step aria-labelledby="${key('start')}">
    <p class="lp-first-answer-step-label">${html(strings.stepFirst)}</p>
    <h2 id="${key('start')}">${html(strings.start)}</h2>
    <p>${html(content.prompt)}</p>
    <div data-lp-first-form><div data-lp-first-editor>${input('first', strings.firstLabel)}</div>
      <button class="lp-first-answer-button" type="button" data-lp-save-first hidden>${html(strings.saveFirst)}</button>
    </div>
    <div data-lp-first-saved hidden><p class="lp-first-answer-label">${html(strings.firstLabel)}</p>
      <blockquote class="lp-first-answer-quote" data-lp-first-quote></blockquote><p class="lp-first-answer-date" data-lp-first-date></p>
    </div>
  </section>`;
  const end = `<section class="lp-first-answer-step" data-lp-end-step aria-labelledby="${key('end')}" hidden>
    <p class="lp-first-answer-step-label">${html(strings.stepEnd)}</p>
    <h2 id="${key('end')}" data-lp-end-heading tabindex="-1">${html(strings.end)}</h2>
    <p>${html(content.prompt)}</p>
    <p data-lp-missing hidden>${html(strings.missing)}</p>
    ${input('now', strings.nowLabel)}
    <button class="lp-first-answer-button" type="button" data-lp-compare>${html(strings.compare)}</button>
    <div data-lp-result hidden>
      <div class="lp-first-answer-panels">
        <section class="lp-first-answer-panel" aria-labelledby="${key('first-panel')}"><h3 id="${key('first-panel')}">${html(strings.firstPanel)}</h3>
          <p class="lp-first-answer-date" data-lp-panel-first-date></p><blockquote class="lp-first-answer-quote" data-lp-panel-first></blockquote>
        </section>
        <section class="lp-first-answer-panel" aria-labelledby="${key('now-panel')}"><h3 id="${key('now-panel')}">${html(strings.nowPanel)}</h3>
          <p class="lp-first-answer-date" data-lp-panel-now-date></p><blockquote class="lp-first-answer-quote" data-lp-panel-now></blockquote>
        </section>
      </div>
      <fieldset class="lp-first-answer-ticks"><legend>${html(strings.tick)}</legend>
        ${content.checks.map((check, index) => `<label class="lp-first-answer-check" for="${key(`check-${index}`)}"><input id="${key(`check-${index}`)}" type="checkbox" value="${html(check.id)}"><span>${html(check.label)}</span></label>`).join('\n        ')}
      </fieldset>
      <p class="lp-first-answer-summary" data-lp-summary></p>
    </div>
  </section>`;
  return `<section class="lp-first-answer" data-lp-pattern="first-answer" data-lp-stage="${stage}" lang="${html(lang)}">
  <p class="lp-first-answer-error" data-lp-storage-error hidden></p>
  ${stage === 'end' ? '' : first}
  ${stage === 'both' ? `<div class="lp-first-answer-course" data-lp-course hidden><p>${html(strings.courseNote)}</p><button class="lp-first-answer-button lp-first-answer-button-secondary" type="button" data-lp-skip>${html(strings.skip)}</button></div>` : ''}
  ${stage === 'first' ? '' : end}
  ${stage === 'end' ? `<div data-lp-end-fallback><p>${html(content.prompt)}</p>${input('first', strings.firstLabel)}</div>` : ''}
  <p data-lp-fallback>${html(strings.noScript)}</p>
  <button class="lp-first-answer-button lp-first-answer-button-secondary" type="button" data-lp-restart hidden>${html(strings.restart)}</button>
  <p class="lp-first-answer-status" role="status" aria-atomic="true"></p>
</section>`;
}
