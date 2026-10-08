import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { validateContent, targetOf, optionKey, MAX_OPTION, MAX_CUSTOM, OTHER } from './logic.js';

/** Render keyed rows for both the native fallback and the enhanced comparison.
 * @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {(import('./logic.js').AuthorOption | import('./logic.js').LearnerOption)[]} options
 * @param {{ author?: boolean, matches?: boolean[], heading?: boolean }} [settings]
 * @returns {string}
 */
export function renderQuestionPreview(content, strings, options, { author = false, matches = [], heading = true } = {}) {
  return `<div class="lp-stack lp-write-distractors-question" data-lp-preview="${author ? 'author' : 'yours'}">
    ${heading ? `<h3 class="lp-label">${html(author ? strings.authorQuestion : strings.yourQuestion)}</h3>` : ''}
    <p class="lp-run-in">${html(content.question)}</p>
    <ol class="lp-write-distractors-preview">
      ${[{ text: content.rightAnswer }, ...options].map((item, index) => {
        const mark = index === 0 ? strings.correctAnswer : matches[index - 1] ? strings.match : '';
        return `<li class="lp-choice lp-write-distractors-preview-row"${mark ? ' data-lp-mark="correct"' : ''}>
          <span class="lp-choice-key" aria-hidden="true" data-lp-preview-key>${html(optionKey(index))}</span>
          <div class="lp-write-distractors-option-content">
            <span data-lp-option-text>${html(item.text)}</span>
            ${'misconception' in item ? `<p class="lp-small">${html(strings.targets.replaceAll('{target}', targetOf(content, item)))}</p>` : ''}
          </div>
          ${mark ? `<span class="lp-choice-mark lp-met">${icons.check}${html(mark)}</span>` : ''}
        </li>`;
      }).join('')}
    </ol>
  </div>`;
}

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
  <fieldset class="lp-write-distractors-option" data-lp-option>
    <legend class="lp-run-in" id="${fieldId('legend')}">${html(strings.option.replaceAll('{key}', optionKey(index + 1)))}</legend>
    <div>
    <textarea class="lp-input" id="${fieldId('text')}" data-lp-text rows="3" maxlength="${MAX_OPTION}" aria-labelledby="${fieldId('legend')}" aria-describedby="${fieldId('text-error')}"></textarea>
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
  <div class="lp-choice lp-write-distractors-preview-row" data-lp-option-summary="${index}" hidden></div>
  </div>`;
  }).join('\n  ');
  return `<section class="lp lp-write-distractors" data-lp-pattern="write-distractors" lang="${html(lang)}">
  <header class="lp-scene" data-lp-scene>
    <span class="lp-scene-icon">${icons.pencil}</span>
    <div><h2 class="lp-scene-title">${html(content.question)}</h2></div>
  </header>
  <div class="lp-write-distractors-body">
  <div class="lp-stack">
    <div>
      <label class="lp-label" for="${html(id)}-answer">${html(strings.answer)}</label>
      <textarea class="lp-input lp-write-distractors-answer" id="${html(id)}-answer" data-lp-answer rows="3"></textarea>
      <p class="lp-error-text" id="${html(id)}-answer-error" data-lp-answer-error hidden>${icons['alert-circle']}<span>${html(strings.emptyAnswer)}</span></p>
    </div>
    <div class="lp-actions"><button class="lp-button" type="button" data-lp-check hidden>${html(strings.check)}</button></div>
  </div>
  <details class="lp-details lp-section" data-lp-answer-fallback>
    <summary>${html(strings.rightAnswer)}</summary><p>${html(content.rightAnswer)}</p>
  </details>
  <details class="lp-details lp-section" data-lp-fallback>
    <summary>${html(strings.authorQuestion)}</summary>
    ${renderQuestionPreview(content, strings, content.authorOptions, { author: true, heading: false })}
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
    <h3 class="lp-run-in" id="${html(id)}-write-heading" data-lp-write-heading tabindex="-1">${html(content.count === 1 ? strings.writeOne : strings.write.replaceAll('{count}', [strings.two, strings.three, strings.four, strings.five][content.count - 2] ?? String(content.count)))}</h3>
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
