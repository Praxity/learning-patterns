import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options @returns {string}
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const chunks = content.paragraphs.flat();
  return `<section class="lp lp-highlight" data-lp-pattern="highlight" lang="${html(lang)}">
  <header class="lp-highlight-scene">${icons['file-text']}<p class="lp-small">${html(strings.scene)}</p></header>
  <h2 class="lp-highlight-title">${html(content.title)}</h2>
  ${content.question ? `<p class="lp-stem">${html(content.question)}</p>` : ''}
  <p class="lp-run-in">${html(content.mode === 'key' ? strings.keyInstruction : strings.evidenceInstruction)}</p>
  <p class="lp-small" id="${html(`${id}-instructions`)}" data-lp-instructions hidden>${html(strings.controls)}</p>
  <div class="lp-highlight-passage" data-lp-passage>${content.paragraphs.map(paragraph => `<p>${paragraph.map(chunk => `<span class="lp-highlight-chunk" data-lp-chunk="${html(chunk.id)}">${html(chunk.text)}</span><span class="lp-highlight-feedback" id="${html(`${id}-feedback-${chunk.id}`)}" data-lp-feedback hidden></span>`).join(' ')}</p>`).join('\n    ')}</div>
  <div data-lp-flow hidden>
    <p class="lp-small lp-highlight-count" data-lp-count>${html(strings.count.replaceAll('{n}', '0'))}</p>
    <p class="lp-run-in lp-highlight-summary" data-lp-summary hidden></p>
    <div class="lp-actions">
      <button class="lp-button" type="button" data-lp-check>${html(strings.check)}</button>
      <button class="lp-button lp-button-quiet" type="button" data-lp-restart hidden>${icons.refresh}${html(strings.restart)}</button>
    </div>
  </div>
  <details class="lp-details lp-section" data-lp-fallback>
    <summary>${html(strings.answer)}</summary>
    <ul class="lp-highlight-answer">${chunks.filter(chunk => chunk.key === true || chunk.note).map(chunk => `<li><p><span class="lp-run-in">${html(chunk.key === true ? (content.mode === 'key' ? strings.correctKey : strings.correctEvidence) : (content.mode === 'key' ? strings.wrongKey : strings.wrongEvidence))}</span> ${html(chunk.text)}</p>${chunk.note ? `<p class="lp-small">${html(chunk.note)}</p>` : ''}</li>`).join('')}</ul>
  </details>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
