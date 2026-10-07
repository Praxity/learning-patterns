import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { validateContent, targetOf, optionKey, MAX_OPTION, MAX_CUSTOM, OTHER } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options @returns {string}
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const fields = Array.from({ length: content.count }, (_, index) => {
    const prefix = `${id}-option-${index}`;
    /** @param {string} field */
    const fieldId = field => html(`${prefix}-${field}`);
    return `<div class="lp-write-distractors-builder lp-section">
  <span class="lp-write-distractors-key" data-lp-option-key aria-hidden="true">${html(optionKey(index + 1))}</span>
  <fieldset class="lp-write-distractors-option" data-lp-option>
    <legend class="lp-run-in">${html(strings.option.replaceAll('{n}', String(index + 1)))}</legend>
    <div>
    <label class="lp-label" for="${fieldId('text')}">${html(strings.text)}</label>
    <textarea class="lp-input" id="${fieldId('text')}" data-lp-text rows="3" maxlength="${MAX_OPTION}" aria-describedby="${fieldId('text-error')}"></textarea>
    <p class="lp-error-text" id="${fieldId('text-error')}" data-lp-text-error hidden></p>
    </div>
    <div>
    <label class="lp-label" for="${fieldId('misconception')}">${html(strings.misconception)}</label>
    <select class="lp-input" id="${fieldId('misconception')}" data-lp-misconception aria-describedby="${fieldId('misconception-error')}">
      <option value="">${html(strings.chooseOne)}</option>
      ${content.misconceptions.map(item => `<option value="${html(item.id)}">${html(item.label)}</option>`).join('\n      ')}
      <option value="${OTHER}">${html(strings.other)}</option>
    </select>
    <p class="lp-error-text" id="${fieldId('misconception-error')}" data-lp-misconception-error hidden></p>
    </div>
    <div data-lp-custom-wrap hidden>
      <label class="lp-label" for="${fieldId('custom')}">${html(strings.custom)}</label>
      <input class="lp-input" id="${fieldId('custom')}" data-lp-custom type="text" maxlength="${MAX_CUSTOM}" aria-describedby="${fieldId('custom-error')}">
      <p class="lp-error-text" id="${fieldId('custom-error')}" data-lp-custom-error hidden></p>
    </div>
  </fieldset>
  </div>`;
  }).join('\n  ');
  return `<section class="lp lp-write-distractors" data-lp-pattern="write-distractors" lang="${html(lang)}">
  <header class="lp-write-distractors-scene" data-lp-scene>
    <span class="lp-write-distractors-scene-icon">${icons.pencil}</span>
    <div><p class="lp-label">${html(strings.scene)}</p><h2 class="lp-stem">${html(content.question)}</h2></div>
  </header>
  <div class="lp-write-distractors-body">
  <div class="lp-stack">
    <h3 class="lp-run-in">${html(strings.answerFirst)}</h3>
    <div>
      <label class="lp-label" for="${html(id)}-answer">${html(strings.answer)}</label>
      <textarea class="lp-input lp-write-distractors-answer" id="${html(id)}-answer" data-lp-answer rows="3" aria-describedby="${html(id)}-answer-error"></textarea>
      <p class="lp-error-text" id="${html(id)}-answer-error" data-lp-answer-error hidden>${icons['alert-circle']}<span>${html(strings.emptyAnswer)}</span></p>
    </div>
    <div class="lp-actions"><button class="lp-button" type="button" data-lp-check hidden>${html(strings.check)}</button></div>
  </div>
  <details class="lp-details lp-section" data-lp-answer-fallback>
    <summary>${html(strings.rightAnswer)}</summary><p>${html(content.rightAnswer)}</p>
  </details>
  <details class="lp-details lp-section" data-lp-fallback>
    <summary>${html(strings.author)}</summary>
    <ul class="lp-write-distractors-list">${content.authorOptions.map(item => `<li><p>${html(item.text)}</p><p class="lp-small">${html(strings.targets.replaceAll('{target}', targetOf(content, item)))}</p></li>`).join('')}</ul>
  </details>
  <div class="lp-section lp-reveal" data-lp-retrieval hidden>
    <div class="lp-write-distractors-right" data-lp-right>
      ${icons.check}<div><p class="lp-run-in lp-met">${html(strings.rightAnswer)}</p><p>${html(content.rightAnswer)}</p></div>
    </div>
    <div class="lp-stack" role="group" aria-labelledby="${html(id)}-had-it">
      <p class="lp-run-in" id="${html(id)}-had-it">${html(strings.hadIt)}</p>
      <div class="lp-write-distractors-toggles">
        <button class="lp-button lp-button-secondary" type="button" data-lp-had-it aria-pressed="false">${html(strings.yes)}</button>
        <button class="lp-button lp-button-secondary" type="button" data-lp-not-quite aria-pressed="false">${html(strings.notQuite)}</button>
      </div>
    </div>
  </div>
  <div class="lp-section lp-reveal" data-lp-flow hidden>
    <h3 class="lp-run-in" id="${html(id)}-write-heading" data-lp-write-heading tabindex="-1">${html(strings.write)}</h3>
    <p class="lp-small">${html(strings.instruction.replaceAll('{count}', String(content.count)))}</p>
    ${fields}
    <div class="lp-actions">
      <button class="lp-button" type="button" data-lp-compare>${html(strings.compare)}</button>
    </div>
    <div class="lp-section lp-reveal" data-lp-result hidden></div>
  </div>
    <div class="lp-actions">
      <button class="lp-button lp-button-quiet" type="button" data-lp-clear hidden>${icons.refresh}${html(strings.clear)}</button>
    </div>
  </div>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
