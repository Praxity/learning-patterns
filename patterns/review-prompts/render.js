import { escapeHtml as html } from '../../lib/html.js';
import { validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options @returns {string}
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  return `<section class="lp-review-prompts" data-lp-pattern="review-prompts" lang="${html(lang)}">
  ${content.parts.map((part, index) => {
    const heading = html(`${id}-heading-${index}`), label = html(`${id}-prompt-${index}`);
    return `<section class="lp-review-prompts-part" data-lp-part="${html(part.id)}" aria-labelledby="${heading}">
    <h3 id="${heading}">${html(part.heading)}</h3>
    ${part.paragraphs.map(text => `<p>${html(text)}</p>`).join('\n    ')}
    <div class="lp-review-prompts-prompt" role="group" aria-labelledby="${label}">
      <p class="lp-review-prompts-label" id="${label}">${html(strings.check)}</p>
      <p>${html(part.question)}</p>
      <p class="lp-review-prompts-instruction">${html(strings.instruction)}</p>
      <details class="lp-review-prompts-details">
        <summary>${html(strings.show)}</summary>
        <p class="lp-review-prompts-answer" data-lp-answer>${html(part.answer)}</p>
        <div class="lp-review-prompts-rating" data-lp-rating hidden>
          <div class="lp-review-prompts-actions">
            <button class="lp-review-prompts-button" type="button" data-lp-result="remembered" aria-pressed="false">${html(strings.remembered)}</button>
            <button class="lp-review-prompts-button" type="button" data-lp-result="forgot" aria-pressed="false">${html(strings.forgot)}</button>
          </div>
          <p class="lp-review-prompts-review" data-lp-review hidden></p>
        </div>
      </details>
    </div>
  </section>`;
  }).join('\n  ')}
  <p class="lp-review-prompts-status" role="status" aria-atomic="true"></p>
</section>`;
}
