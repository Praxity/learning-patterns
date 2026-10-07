import { escapeHtml as html } from '../../lib/html.js';
import { validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options @returns {string}
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  return `<section class="lp lp-unboxed lp-review-prompts" data-lp-pattern="review-prompts" lang="${html(lang)}">
  ${content.parts.map((part, index) => {
    const heading = html(`${id}-heading-${index}`), label = html(`${id}-prompt-${index}`);
    return `<section class="lp-review-prompts-part lp-stack" data-lp-part="${html(part.id)}" aria-labelledby="${heading}">
    <h3 class="lp-review-prompts-heading" id="${heading}">${html(part.heading)}</h3>
    ${part.paragraphs.map(text => `<p>${html(text)}</p>`).join('\n    ')}
    <div class="lp-box" role="group" aria-labelledby="${label}">
      <p class="lp-run-in" id="${label}">${html(strings.check)}</p>
      <p class="lp-stem">${html(part.question)}</p>
      <p class="lp-small">${html(strings.instruction)}</p>
      <details class="lp-details">
        <summary>${html(strings.show)}</summary>
        <p class="lp-quote" data-lp-answer>${html(part.answer)}</p>
        <div class="lp-stack" data-lp-rating hidden>
          <div class="lp-actions">
            <button class="lp-button lp-button-secondary" type="button" data-lp-result="remembered" aria-pressed="false">${html(strings.remembered)}</button>
            <button class="lp-button lp-button-secondary" type="button" data-lp-result="forgot" aria-pressed="false">${html(strings.forgot)}</button>
          </div>
          <p class="lp-run-in" data-lp-review hidden></p>
        </div>
      </details>
    </div>
  </section>`;
  }).join('\n  ')}
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
