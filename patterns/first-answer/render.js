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
    <label class="lp-label" for="${key(name)}">${html(label)}</label>
    <textarea class="lp-input" id="${key(name)}" data-lp-${name}-input rows="5" maxlength="${MAX_LENGTH}"></textarea>
    <p class="lp-error-text" id="${key(`${name}-error`)}" data-lp-${name}-error hidden></p>
  </div>`;
  const first = `<section class="lp-stack lp-first-answer-step" data-lp-first-step aria-labelledby="${key('start')}">
    <p class="lp-small">${html(strings.stepFirst)}</p>
    <h2 class="lp-run-in lp-first-answer-heading" id="${key('start')}">${html(strings.start)}</h2>
    <p class="lp-stem">${html(content.prompt)}</p>
    <div data-lp-first-editor>${input('first', strings.firstLabel)}</div>
    <div class="lp-actions">
      <button class="lp-button" type="button" data-lp-save-first hidden>${html(strings.saveFirst)}</button>
    </div>
    <div class="lp-stack" data-lp-first-saved hidden>
      <blockquote class="lp-quote lp-first-answer-quote" data-lp-first-quote></blockquote><p class="lp-small" data-lp-first-date></p>
    </div>
  </section>`;
  const end = `<section class="lp-stack lp-first-answer-step${stage === 'both' ? ' lp-section' : ''}" data-lp-end-step aria-labelledby="${key('end')}" hidden>
    <p class="lp-small">${html(strings.stepEnd)}</p>
    <h2 class="lp-run-in lp-first-answer-heading" id="${key('end')}" data-lp-end-heading tabindex="-1">${html(strings.end)}</h2>
    <p class="lp-stem">${html(content.prompt)}</p>
    <p class="lp-small" data-lp-missing hidden>${html(strings.missing)}</p>
    ${input('now', strings.nowLabel)}
    <div class="lp-actions"><button class="lp-button" type="button" data-lp-compare>${html(strings.compare)}</button></div>
    <div class="lp-stack" data-lp-result hidden>
      <p class="lp-run-in" data-lp-panel-first-date></p>
      <blockquote class="lp-quote lp-first-answer-quote" data-lp-panel-first></blockquote>
      <fieldset class="lp-choices"><legend>${html(strings.tick)}</legend>
        ${content.checks.map((check, index) => `<label class="lp-choice" for="${key(`check-${index}`)}"><input id="${key(`check-${index}`)}" type="checkbox" value="${html(check.id)}"><span class="lp-first-answer-check-text">${html(check.label)}</span></label>`).join('\n        ')}
      </fieldset>
      <p class="lp-small" data-lp-summary></p>
    </div>
  </section>`;
  return `<section class="lp lp-first-answer" data-lp-pattern="first-answer" data-lp-stage="${stage}" lang="${html(lang)}">
  <p class="lp-error-text" data-lp-storage-error hidden></p>
  ${stage === 'end' ? '' : first}
  ${stage === 'both' ? `<div class="lp-section" data-lp-course hidden><p class="lp-small">${html(strings.courseNote)}</p><div class="lp-actions"><button class="lp-button lp-button-secondary" type="button" data-lp-skip>${html(strings.skip)}</button></div></div>` : ''}
  ${stage === 'first' ? '' : end}
  ${stage === 'end' ? `<div class="lp-stack" data-lp-end-fallback><p class="lp-stem">${html(content.prompt)}</p>${input('first', strings.firstLabel)}</div>` : ''}
  <p class="lp-small" data-lp-fallback>${html(strings.noScript)}</p>
  <div class="lp-actions">
    ${stage === 'first' ? '' : `<button class="lp-button lp-button-quiet" type="button" data-lp-try-again hidden>${icons['arrow-back-up']}${html(strings.tryAgain)}</button>`}
    <button class="lp-button lp-button-quiet" type="button" data-lp-restart hidden>${icons.refresh}${html(strings.restart)}</button>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
