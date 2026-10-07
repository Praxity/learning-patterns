import { escapeHtml as html } from '../../lib/html.js';
import { validateContent, targetOf, MAX_OPTION, MAX_CUSTOM, OTHER } from './logic.js';

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
    return `<fieldset class="lp-write-distractors-option" data-lp-option>
    <legend>${html(strings.option.replaceAll('{n}', String(index + 1)))}</legend>
    <label for="${fieldId('text')}">${html(strings.text)}</label>
    <textarea id="${fieldId('text')}" data-lp-text rows="3" maxlength="${MAX_OPTION}" aria-describedby="${fieldId('text-error')}"></textarea>
    <p class="lp-write-distractors-error" id="${fieldId('text-error')}" data-lp-text-error hidden></p>
    <label for="${fieldId('misconception')}">${html(strings.misconception)}</label>
    <select id="${fieldId('misconception')}" data-lp-misconception aria-describedby="${fieldId('misconception-error')}">
      <option value="">${html(strings.chooseOne)}</option>
      ${content.misconceptions.map(item => `<option value="${html(item.id)}">${html(item.label)}</option>`).join('\n      ')}
      <option value="${OTHER}">${html(strings.other)}</option>
    </select>
    <p class="lp-write-distractors-error" id="${fieldId('misconception-error')}" data-lp-misconception-error hidden></p>
    <div data-lp-custom-wrap hidden>
      <label for="${fieldId('custom')}">${html(strings.custom)}</label>
      <input id="${fieldId('custom')}" data-lp-custom type="text" maxlength="${MAX_CUSTOM}" aria-describedby="${fieldId('custom-error')}">
      <p class="lp-write-distractors-error" id="${fieldId('custom-error')}" data-lp-custom-error hidden></p>
    </div>
  </fieldset>`;
  }).join('\n  ');
  return `<section class="lp-write-distractors" data-lp-pattern="write-distractors" lang="${html(lang)}">
  <h2>${html(strings.question)}</h2><p>${html(content.question)}</p>
  <h2>${html(strings.rightAnswer)}</h2><p>${html(content.rightAnswer)}</p>
  <details class="lp-write-distractors-fallback" data-lp-fallback>
    <summary>${html(strings.author)}</summary>
    <ul>${content.authorOptions.map(item => `<li><p>${html(item.text)}</p><p>${html(strings.targets.replaceAll('{target}', targetOf(content, item)))}</p></li>`).join('')}</ul>
  </details>
  <div data-lp-flow hidden>
    <p>${html(strings.instruction.replaceAll('{count}', String(content.count)))}</p>
    ${fields}
    <button class="lp-write-distractors-button" type="button" data-lp-compare>${html(strings.compare)}</button>
    <div data-lp-result hidden></div>
    <button class="lp-write-distractors-button lp-write-distractors-button-secondary" type="button" data-lp-clear hidden>${html(strings.clear)}</button>
  </div>
  <p class="lp-write-distractors-status" role="status" aria-atomic="true"></p>
</section>`;
}
