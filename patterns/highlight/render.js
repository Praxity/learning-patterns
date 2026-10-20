import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { markLimit, validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options @returns {string}
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const chunks = content.paragraphs.flat();
  return `<section class="lp lp-highlight" data-lp-pattern="highlight" lang="${html(lang)}">
  <header class="lp-scene">
    <span class="lp-scene-icon">${icons['file-text']}</span>
    <div><h2 class="lp-scene-title">${html(content.title, lang)}</h2></div>
  </header>
  ${content.mode === 'evidence' ? `<p class="lp-stem">${html(strings.evidenceInstruction.replaceAll('{question}', content.question ?? ''), lang)}</p>` : `${content.question ? `<p class="lp-stem">${html(content.question, lang)}</p>` : ''}<p class="lp-run-in">${html(strings.keyInstruction, lang)}</p>`}
  <p class="lp-small" id="${html(`${id}-instructions`)}" data-lp-instructions hidden>${html(strings.controls, lang)}</p>
  <div class="lp-highlight-passage" data-lp-passage>${content.paragraphs.map(paragraph => `<p>${paragraph.map(chunk => `<span class="lp-highlight-chunk" data-lp-chunk="${html(chunk.id)}">${html(chunk.text, lang)}</span><span class="lp-highlight-feedback" id="${html(`${id}-feedback-${chunk.id}`)}" data-lp-feedback hidden></span>`).join(' ')}</p>`).join('\n    ')}</div>
  <p class="lp-highlight-limit" data-lp-limit hidden></p>
  <div data-lp-flow hidden>
    <p class="lp-small lp-highlight-count" data-lp-count>${html(strings.count.replaceAll('{n}', '0').replaceAll('{max}', String(markLimit(content))), lang)}</p>
    <p class="lp-run-in lp-highlight-summary" data-lp-summary hidden></p>
    <div class="lp-actions">
      <button class="lp-button" type="button" data-lp-check>${html(strings.check, lang)}</button>
      <button class="lp-button lp-button-quiet" type="button" data-lp-restart hidden>${icons.refresh}${html(strings.restart, lang)}</button>
    </div>
  </div>
  <details class="lp-details" data-lp-fallback>
    <summary>${html(strings.answer, lang)}</summary>
    <ul class="lp-highlight-answer">${chunks.filter(chunk => chunk.key === true || chunk.note).map(chunk => `<li><p><span class="lp-run-in">${html(chunk.key === true ? (content.mode === 'key' ? strings.correctKey : strings.correctEvidence) : (content.mode === 'key' ? strings.wrongKey : strings.wrongEvidence), lang)}</span> ${html(chunk.text, lang)}</p>${chunk.note ? `<p class="lp-small">${html(chunk.note, lang)}</p>` : ''}</li>`).join('')}</ul>
  </details>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
