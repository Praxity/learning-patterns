import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { REMINDER_MINUTES, format, validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 * @returns {string}
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const h = (/** @type {string} */ text) => html(text, lang);
  const key = (/** @type {string} */ suffix) => html(`${id}-${suffix}`);
  /** @param {import('./logic.js').StepName} name */
  const step = name => `<fieldset class="lp-choices" id="${key(name)}" data-lp-step="${name}" aria-describedby="${key(`${name}-hint`)}">
      <legend class="lp-stem" data-lp-stem>${h(strings[`${name}Stem`])}</legend>
      <p class="lp-small" id="${key(`${name}-hint`)}">${h(strings[`${name}Hint`])}</p>
      ${content[name].options.map((option, index) => `<label class="lp-choice" for="${key(`${name}-${index}`)}"><input type="radio" id="${key(`${name}-${index}`)}" name="${key(name)}" value="${html(option.id)}"><span>${h(option.text)}</span></label>`).join('\n      ')}
      <p class="lp-error-text" id="${key(`${name}-error`)}" data-lp-error hidden>${icons['alert-circle']}<span>${h(strings[name === 'when' ? 'chooseWhen' : 'chooseWill'])}</span></p>
    </fieldset>`;
  const vague = [...content.when.options, ...content.will.options].filter(option => option.vague !== undefined);
  return `<section class="lp lp-if-then-plan" data-lp-pattern="if-then-plan" lang="${html(lang)}">
  <h2 class="lp-heading">${h(content.title)}</h2>
  <p class="lp-context">${h(content.context)}</p>
  <div class="lp-section" data-lp-steps>
    ${step('when')}
    ${step('will')}
    <div class="lp-actions"><button class="lp-button" type="button" data-lp-add hidden>${h(strings.add)}</button></div>
  </div>
  <div class="lp-section" data-lp-result hidden>
    <div tabindex="-1" data-lp-plan>
      <p class="lp-label">${h(strings.planLabel)}</p>
      <p class="lp-stem" data-lp-plan-text></p>
    </div>
    <div class="lp-section">
      <div>
        <label class="lp-label" for="${key('start')}">${h(content.dateLabel)}</label>
        <p class="lp-small" id="${key('start-hint')}">${h(format(strings.dateHint, { minutes: REMINDER_MINUTES }))}</p>
        <input class="lp-input lp-if-then-plan-start" type="datetime-local" id="${key('start')}" aria-describedby="${key('start-hint')}" data-lp-start>
        <p class="lp-error-text" id="${key('start-error')}" data-lp-start-error hidden>${icons['alert-circle']}<span>${h(strings.past)}</span></p>
      </div>
      <div class="lp-actions"><button class="lp-button" type="button" data-lp-calendar disabled>${icons.calendar}${h(strings.calendar)}</button></div>
      <p class="lp-small" data-lp-downloaded hidden>${h(strings.downloaded)}</p>
    </div>
  </div>
  <div class="lp-section" data-lp-fallback>
    ${vague.length ? `<details class="lp-details">
      <summary>${h(strings.vagueOptions)}</summary>
      <ul class="lp-if-then-plan-reasons">${vague.map(option => `<li><strong class="lp-run-in">${h(option.text)}</strong><p>${h(/** @type {string} */ (option.vague))}</p></li>`).join('')}</ul>
    </details>` : ''}
    <p>${h(strings.noScript)}</p>
    <p class="lp-stem">${h(format(strings.soFar, { when: '…' }))}</p>
  </div>
  <div class="lp-actions"><button class="lp-button lp-button-quiet" type="button" data-lp-restart hidden>${icons.refresh}${h(strings.restart)}</button></div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
