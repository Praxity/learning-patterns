import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { format, learnerSteps, validateContent } from './logic.js';

/** Every case in full, usable without JavaScript: the learner's steps are radio groups and each
 * case's answers sit in a disclosure. `enhance` shows one case at a time and checks each step.
 * @param {import('./logic.js').Content} content
 * @param {import('./strings.js').Strings} strings
 * @param {{ id: string, lang: string }} options */
export function render(content, strings, { id, lang }) {
  validateContent(content);
  const total = content.steps.length, last = content.cases.length - 1;
  /** @param {string} template @param {Record<string, string | number>} [values] */
  const t = (template, values = {}) => html(format(template, values), lang);
  /** @param {string} tag @param {string} label @param {boolean} yours */
  const head = (tag, label, yours) => `<${tag} class="lp-finish-worked-example-head"><span class="lp-label">${label}</span><span class="lp-visually-hidden">, </span><span class="lp-finish-worked-example-tag"${yours ? ' data-lp-yours' : ''}>${yours ? icons.pencil : ''}<span>${t(yours ? strings.tagYours : strings.tagWorked)}</span></span></${tag}>`;
  return `<section class="lp lp-finish-worked-example" data-lp-pattern="finish-worked-example" lang="${html(lang)}">
  <h2 class="lp-heading">${html(content.title, lang)}</h2>
  <p class="lp-context">${html(content.context, lang)}</p>
  ${content.cases.map((item, c) => {
    const yours = learnerSteps(content, c);
    const share = !yours.length ? strings.shareNone : yours.length === total ? strings.shareAll : strings.shareSome;
    return `<div class="lp-section lp-finish-worked-example-case" data-lp-case>
    <h3 class="lp-stem" id="${html(`${id}-case-${c}`)}" tabindex="-1" data-lp-case-heading>${t(strings.case, { number: c + 1, total: content.cases.length })}<span class="lp-visually-hidden">. </span><span class="lp-small lp-finish-worked-example-share">${t(share, { count: yours.length, total })}</span></h3>
    <dl class="lp-finish-worked-example-facts">${item.facts.map(fact => `<div><dt>${html(fact.label, lang)}</dt><dd>${html(fact.text, lang)}</dd></div>`).join('')}</dl>
    <ol class="lp-section lp-finish-worked-example-steps" role="list">${item.steps.map((step, s) => {
      const label = t(strings.step, { number: s + 1 });
      const question = html(content.steps[s].question, lang);
      const group = html(`${id}-case-${c}-step-${s}`);
      // A worked step after one of the learner's would give that answer away, so it starts hidden.
      if (step.worked) return `
      <li class="lp-finish-worked-example-step" data-lp-step>
        ${head('p', label, false)}
        <p class="lp-run-in">${question}</p>
        <div data-lp-body${yours.length && s > yours[0] ? ' hidden' : ''}>
          <p class="lp-finish-worked-example-answer">${html(content.steps[s].options[step.answer], lang)}</p>
          <p>${html(step.reason, lang)}</p>
        </div>
      </li>`;
      return `
      <li class="lp-finish-worked-example-step" data-lp-step>
        <fieldset class="lp-choices" id="${group}" data-lp-question>
          <legend>${head('span', label, true)}<span class="lp-visually-hidden">, </span><span class="lp-run-in">${question}</span></legend>
          ${content.steps[s].options.map((option, n) => `<label class="lp-choice" for="${group}-option-${n}"><input type="radio" id="${group}-option-${n}" name="${group}" value="${n}"><span>${html(option, lang)}</span></label>`).join('\n          ')}
          <p class="lp-error-text" id="${group}-error" data-lp-question-error hidden>${icons['alert-circle']}<span>${t(strings.choose)}</span></p>
        </fieldset>
        <p tabindex="-1" data-lp-feedback hidden></p>
        <div class="lp-actions" data-lp-step-actions hidden><button class="lp-button" type="button" data-lp-check>${t(strings.check, { number: s + 1 })}</button></div>
      </li>`;
    }).join('')}
    </ol>${yours.length ? `
    <details class="lp-details" data-lp-fallback>
      <summary>${t(strings.answers, { number: c + 1 })}</summary>
      <ul class="lp-finish-worked-example-fallback-list">${item.steps.map((step, s) => s < yours[0] ? '' : `<li><strong class="lp-run-in">${t(strings.answerStep, { number: s + 1, answer: content.steps[s].options[step.answer] })}</strong><p>${html(step.reason, lang)}</p></li>`).join('')}</ul>
    </details>` : ''}${c === last ? `
    <p class="lp-run-in" data-lp-result hidden></p>` : ''}
    <div class="lp-actions" data-lp-nav hidden>
      ${c < last ? `<button class="lp-button" type="button" data-lp-next hidden>${t(strings.next)}</button>` : `<button class="lp-button lp-button-quiet" type="button" data-lp-restart hidden>${icons.refresh}${t(strings.restart)}</button>`}
      ${c ? `<button class="lp-button lp-button-quiet" type="button" data-lp-back>${icons['arrow-back-up']}${t(strings.back)}</button>` : ''}
    </div>
  </div>`;
  }).join('\n  ')}
  <p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
</section>`;
}
