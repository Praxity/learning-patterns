import { renderChoiceMark } from '../../lib/choice-mark.js';
import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { DONT_KNOW, SURE, UNSURE, format, validateContent } from './logic.js';

/** @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options
 */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const h = (/** @type {string} */ text) => html(text, lang);
  const many = content.questions.length > 1;
  // Every option row keeps room for the widest mark, so a mark never rewraps the option text. All rows
  // reserve the same width, which gives nothing away about the answer.
  const markSpace = `<span class="lp-answer-with-confidence-mark-space" aria-hidden="true">${renderChoiceMark('correct', strings.markCorrect, lang)}${renderChoiceMark('wrong', strings.markWrong, lang)}${renderChoiceMark('missed', strings.markAnswer, lang)}</span>`;
  /** One feedback box per possible answer. They share one grid cell with the submit control, so the
   * cell is already as tall as the tallest of them and showing one moves nothing.
   * @param {string} answer @param {'right' | 'wrong' | 'unknown'} result
   * @param {[string, string][]} verdicts @param {import('./logic.js').Option} shown
   * @param {import('./logic.js').Option} correct
   */
  const box = (answer, result, verdicts, shown, correct) => `<div class="lp-outcome lp-answer-with-confidence-feedback" data-lp-feedback="${html(answer)}" data-lp-outcome="${result}" tabindex="-1">
        ${icons[result === 'right' ? 'check' : result === 'wrong' ? 'x' : 'question-mark']}
        <p class="lp-outcome-word lp-answer-with-confidence-verdict ${result === 'right' ? 'lp-met' : result === 'wrong' ? 'lp-missed' : 'lp-neutral'}">${verdicts.map(([certainty, text]) => `<span data-lp-verdict="${certainty}">${h(text)}</span>`).join('')}</p>
        ${result === 'right' ? '' : `<p class="lp-visually-hidden">${h(format(strings.correctAnswer, { option: correct.text }))}</p>`}
        <p>${h(shown.feedback)}</p>
        ${result === 'wrong' && shown.rightWhen ? `<p data-lp-right-when><strong>${h(strings.rightWhen)}</strong> ${h(shown.rightWhen)}</p>` : ''}
      </div>`;
  return `<section class="lp lp-answer-with-confidence" data-lp-pattern="answer-with-confidence" lang="${html(lang)}">
  <header class="lp-scene">
    <span class="lp-scene-icon">${icons['list-check']}</span>
    <div><h2 class="lp-scene-title">${h(content.title)}</h2></div>
  </header>
  ${content.context ? `<p>${h(content.context)}</p>` : ''}
  <p data-lp-intro hidden>${h(strings.intro)}</p>
  ${content.questions.map((q, n) => {
    const base = `${id}-question-${n}`;
    const correct = /** @type {import('./logic.js').Option} */ (q.options.find(o => o.id === q.correct));
    return `<div class="lp-section" data-lp-question="${html(q.id)}">
    <fieldset class="lp-choices" id="${html(base)}" tabindex="-1">
      <legend class="lp-stem">${many ? `<span class="lp-small lp-answer-with-confidence-question-number">${h(format(strings.questionNumber, { number: n + 1, total: content.questions.length }))}</span><span class="lp-visually-hidden">, </span>` : ''}${h(q.text)}</legend>
      ${q.options.map((o, index) => `<label class="lp-choice" for="${html(`${base}-option-${index}`)}"><input type="radio" id="${html(`${base}-option-${index}`)}" name="${html(base)}" value="${html(o.id)}"><span>${h(o.text)}</span>${markSpace}</label>`).join('\n      ')}
    </fieldset>
    <div class="lp-answer-with-confidence-stage" data-lp-stage hidden>
      <div class="lp-answer-with-confidence-submit" role="group" aria-label="${h(many ? format(strings.submitGroupTo, { number: n + 1 }) : strings.submitGroup)}" data-lp-submit>
        <span class="lp-answer-with-confidence-submit-label">${h(strings.submit)}</span>
        <div class="lp-answer-with-confidence-segments">
          <button class="lp-button lp-answer-with-confidence-segment" type="button" data-lp-certainty="${SURE}">${h(strings.sure)}</button>
          <button class="lp-button lp-answer-with-confidence-segment" type="button" data-lp-certainty="${UNSURE}">${h(strings.unsure)}</button>
          ${content.dontKnow ? `<button class="lp-button lp-answer-with-confidence-segment" type="button" data-lp-dont-know>${h(strings.dontKnow)}</button>` : ''}
        </div>
        <p class="lp-error-text" id="${html(`${base}-error`)}" data-lp-question-error hidden>${icons['alert-circle']}<span>${h(content.dontKnow ? strings.chooseOrDontKnow : strings.choose)}</span></p>
      </div>
      ${q.options.map(o => o === correct
        ? box(o.id, 'right', [[SURE, strings.verdictSureRight], [UNSURE, strings.verdictUnsureRight], ['unknown', strings.verdictRight]], o, correct)
        : box(o.id, 'wrong', [[SURE, strings.verdictSureWrong], [UNSURE, strings.verdictUnsureWrong], ['unknown', strings.verdictWrong]], o, correct)).join('\n      ')}
      ${content.dontKnow ? box(DONT_KNOW, 'unknown', [['unknown', strings.verdictDontKnow]], correct, correct) : ''}
    </div>
  </div>`;
  }).join('\n  ')}
  <div class="lp-section" data-lp-result hidden>
    <p class="lp-stem" data-lp-summary></p>
    <div class="lp-answer-with-confidence-review" data-lp-review="sureWrong" hidden><h3 class="lp-run-in">${h(strings.verdictSureWrong)}</h3><p class="lp-small" data-lp-review-hint></p></div>
    <div class="lp-answer-with-confidence-review" data-lp-review="unsureRight" hidden><h3 class="lp-run-in">${h(strings.verdictUnsureRight)}</h3><p class="lp-small" data-lp-review-hint></p></div>
    <div class="lp-actions"><button class="lp-button lp-button-quiet" type="button" data-lp-restart>${icons.refresh}${h(strings.restart)}</button></div>
  </div>
  <details class="lp-details lp-section" data-lp-fallback>
    <summary>${h(strings.answers)}</summary>
    <ul class="lp-answer-with-confidence-fallback-list">${content.questions.map(q => {
      const correct = /** @type {import('./logic.js').Option} */ (q.options.find(o => o.id === q.correct));
      return `<li><strong class="lp-run-in">${h(q.text)}</strong><p>${h(format(strings.correctAnswer, { option: correct.text }))}</p><p>${h(correct.feedback)}</p></li>`;
    }).join('')}</ul>
  </details>
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
