import { validateContent, validateOptions, validateState, coverage, coverageMessage, targetOf, optionKey, OTHER, MAX_OPTION, MAX_CUSTOM } from './logic.js';
import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options
 */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  /** @template {Element} T @param {Element} container @param {string} selector @returns {T} */
  function required(container, selector) {
    const element = container.querySelector(selector);
    if (!element) throw new Error(`Missing write-distractors markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  const fallback = /** @type {HTMLDetailsElement} */ (required(root, '[data-lp-fallback]'));
  const answerFallback = /** @type {HTMLDetailsElement} */ (required(root, '[data-lp-answer-fallback]'));
  const answer = /** @type {HTMLTextAreaElement} */ (required(root, '[data-lp-answer]'));
  const answerError = /** @type {HTMLElement} */ (required(root, '[data-lp-answer-error]'));
  const check = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-check]'));
  const retrieval = /** @type {HTMLElement} */ (required(root, '[data-lp-retrieval]'));
  const yes = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-had-it]'));
  const notQuite = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-not-quite]'));
  const writeHeading = /** @type {HTMLElement} */ (required(root, '[data-lp-write-heading]'));
  const flow = /** @type {HTMLElement} */ (required(root, '[data-lp-flow]'));
  const result = /** @type {HTMLElement} */ (required(root, '[data-lp-result]'));
  const clear = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-clear]'));
  const compare = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-compare]'));
  const status = /** @type {HTMLElement} */ (required(root, '[role="status"]'));
  const rows = [...root.querySelectorAll('[data-lp-option]')];
  if (rows.length !== content.count) throw new Error('Invalid write-distractors option count');
  const fields = rows.map((row, index) => ({
    editor: /** @type {HTMLElement} */ (row),
    summary: /** @type {HTMLElement} */ (required(root, `[data-lp-option-summary="${index}"]`)),
    inputs: {
      text: /** @type {HTMLTextAreaElement} */ (required(row, '[data-lp-text]')),
      misconception: /** @type {HTMLSelectElement} */ (required(row, '[data-lp-misconception]')),
      custom: /** @type {HTMLInputElement} */ (required(row, '[data-lp-custom]'))
    },
    errors: {
      text: /** @type {HTMLElement} */ (required(row, '[data-lp-text-error]')),
      misconception: /** @type {HTMLElement} */ (required(row, '[data-lp-misconception-error]')),
      custom: /** @type {HTMLElement} */ (required(row, '[data-lp-custom-error]'))
    },
    customWrap: /** @type {HTMLElement} */ (required(row, '[data-lp-custom-wrap]'))
  }));
  // A throwing host read must not leave partially registered listeners.
  const saved = validateState(content, state?.read());
  let shown = false;
  let checkedAnswer = false;
  /** @type {boolean | null} */
  let hadIt = null;
  let destroyed = false;
  /** @type {(() => void)[]} */
  const removals = [];
  /** @param {Element} element @param {string} event @param {() => void} handler */
  function listen(element, event, handler) {
    element.addEventListener(event, handler);
    removals.push(() => element.removeEventListener(event, handler));
  }
  const options = () => fields.map(field => ({ text: field.inputs.text.value, misconception: field.inputs.misconception.value, custom: field.inputs.custom.value }));
  const save = () => state?.write({ answer: answer.value, hadIt, options: options(), shown });
  function clearAnswerError() {
    answerError.hidden = true;
    answer.removeAttribute('aria-invalid');
  }
  function showAnswer() {
    checkedAnswer = true;
    answer.readOnly = true;
    check.setAttribute('aria-disabled', 'true');
    retrieval.hidden = false;
    clear.hidden = false;
  }
  function paintChoice() {
    yes.setAttribute('aria-pressed', String(hadIt === true));
    notQuite.setAttribute('aria-pressed', String(hadIt === false));
    flow.hidden = hadIt === null;
  }
  /** @param {number} index @param {import('./logic.js').Field} name */
  function clearError(index, name) {
    const field = fields[index];
    field.errors[name].textContent = '';
    field.errors[name].hidden = true;
    field.inputs[name].removeAttribute('aria-invalid');
  }
  function clearErrors() {
    fields.forEach((_, index) => {
      for (const name of /** @type {const} */ (['text', 'misconception', 'custom'])) clearError(index, name);
    });
  }
  /** @param {number} index */
  function selection(index) {
    const field = fields[index];
    const value = field.inputs.misconception.value;
    field.customWrap.hidden = value !== OTHER;
  }
  function hideResult() {
    shown = false;
    result.replaceChildren(); result.hidden = true;
    for (const field of fields) { field.editor.hidden = false; field.summary.hidden = true; field.summary.replaceChildren(); }
  }
  /** @param {import('./logic.js').LearnerOption[]} values @param {boolean} announce */
  function show(values, announce) {
    const outcome = coverage(content, values);
    const counts = coverageMessage(content, values);
    const message = (counts.authorTotal === 1 ? strings.coverageOne : strings.coverageMany)
      .replaceAll('{authorTargeted}', String(counts.authorTargeted))
      .replaceAll('{authorTotal}', String(counts.authorTotal))
      .replaceAll('{ownExtra}', String(counts.ownExtra));
    /** @param {import('./logic.js').AuthorOption | import('./logic.js').LearnerOption} item */
    const targetLine = item => html(strings.targets.replaceAll('{target}', targetOf(content, item)));
    fields.forEach((field, index) => {
      field.summary.innerHTML = `<span>${html(values[index].text)}</span><span class="lp-small">${targetLine(values[index])}</span>`;
      field.editor.hidden = true; field.summary.hidden = false;
    });
    result.innerHTML = `<div class="lp-stack" data-lp-preview>
      <h3 class="lp-label">${html(strings.yourQuestion)}</h3>
      <p class="lp-run-in">${html(content.question)}</p>
      <ol class="lp-write-distractors-preview">
        ${[content.rightAnswer, ...values.map(item => item.text)].map((text, index) => `<li class="lp-choice lp-write-distractors-preview-row"${index === 0 ? ' data-lp-mark="correct"' : ''}><span class="lp-write-distractors-key" data-lp-preview-key>${html(optionKey(index))}</span><span>${html(text)}${index === 0 ? `<span class="lp-choice-mark lp-met">${icons.check}${html(strings.correctAnswer)}</span>` : ''}</span></li>`).join('')}
      </ol>
      </div>
      <p class="lp-run-in" data-lp-summary data-lp-coverage>${html(message)}</p>
      <p class="lp-small">${html(strings.comparisonNote)}</p>
      <h3 class="lp-run-in">${html(strings.author)}</h3>
      <ul class="lp-write-distractors-list" data-lp-author>${content.authorOptions.map(item => `<li><p>${html(item.text)}</p><p class="lp-small">${targetLine(item)}</p></li>`).join('')}</ul>
      <h3 class="lp-run-in">${html(strings.untargeted)}</h3>
      <ul class="lp-write-distractors-list" data-lp-untargeted>${(counts.untargeted.length ? counts.untargeted : [strings.none]).map(label => `<li>${html(label)}</li>`).join('')}</ul>
      <h3 class="lp-run-in">${html(strings.yours)}</h3>
      <ul class="lp-write-distractors-list" data-lp-yours>${values.map((item, index) => `<li><p>${html(item.text)}</p><p class="lp-write-distractors-match ${outcome.matches[index] ? 'lp-met' : 'lp-neutral'}">${outcome.matches[index] ? icons.check : icons['circle-dashed']}<span>${html(outcome.matches[index] ? strings.match : strings.noMatch)}</span></p><p class="lp-small">${targetLine(item)}</p></li>`).join('')}</ul>`;
    result.hidden = false; clear.hidden = false; shown = true;
    // A single replacement announces each submit, including an identical comparison.
    if (announce) status.textContent = message;
  }
  if (saved) {
    answer.value = saved.answer;
    hadIt = saved.hadIt;
    if (hadIt !== null) showAnswer();
    saved.options.forEach((option, index) => {
      const field = fields[index];
      for (const name of /** @type {const} */ (['text', 'misconception', 'custom'])) field.inputs[name].value = option[name];
    });
  }
  paintChoice();
  listen(answer, 'input', () => { clearAnswerError(); save(); });
  listen(check, 'click', () => {
    if (checkedAnswer) return;
    if (!answer.value.trim()) {
      answerError.hidden = false;
      answer.setAttribute('aria-invalid', 'true');
      answer.focus();
      status.textContent = strings.errorsOne;
      return;
    }
    clearAnswerError(); showAnswer(); save();
    status.textContent = content.rightAnswer;
  });
  for (const [button, value] of /** @type {[HTMLButtonElement, boolean][]} */ ([[yes, true], [notQuite, false]])) {
    listen(button, 'click', () => {
      if (!checkedAnswer || hadIt === value) return;
      hadIt = value;
      paintChoice(); save();
      status.textContent = strings.noted;
      writeHeading.focus();
    });
  }
  fields.forEach((field, index) => {
    selection(index);
    for (const name of /** @type {const} */ (['text', 'misconception', 'custom'])) {
      listen(field.inputs[name], name === 'misconception' ? 'change' : 'input', () => {
        clearError(index, name);
        if (name === 'misconception') { selection(index); clearError(index, 'custom'); }
        hideResult(); save();
      });
    }
  });
  listen(compare, 'click', () => {
    if (hadIt === null) return;
    clearErrors();
    const checked = validateOptions(content, options());
    if (!checked.ok) {
      hideResult();
      for (const error of checked.errors) {
        const field = fields[error.option];
        const message = strings[error.code]
          .replaceAll('{n}', String(error.option + 1))
          .replaceAll('{max}', String(error.field === 'text' ? MAX_OPTION : MAX_CUSTOM));
        field.errors[error.field].innerHTML = `${icons['alert-circle']}<span>${html(message)}</span>`;
        field.errors[error.field].hidden = false;
        field.inputs[error.field].setAttribute('aria-invalid', 'true');
      }
      const first = checked.errors[0];
      fields[first.option].inputs[first.field].focus();
      status.textContent = (checked.errors.length === 1 ? strings.errorsOne : strings.errorsMany).replaceAll('{count}', String(checked.errors.length));
      save(); return;
    }
    checked.options.forEach((option, index) => {
      for (const name of /** @type {const} */ (['text', 'misconception', 'custom'])) fields[index].inputs[name].value = option[name];
    });
    show(checked.options, true); save();
  });
  listen(clear, 'click', () => {
    answer.value = ''; answer.readOnly = false;
    checkedAnswer = false; hadIt = null;
    clearAnswerError(); paintChoice();
    retrieval.hidden = true; check.removeAttribute('aria-disabled'); clear.hidden = true;
    fields.forEach((field, index) => {
      for (const input of Object.values(field.inputs)) input.value = '';
      selection(index);
    });
    clearErrors(); hideResult();
    answer.focus();
    status.textContent = strings.cleared; save();
  });
  if (saved?.shown) show(saved.options, false);
  fallback.hidden = true; answerFallback.hidden = true; check.hidden = false;
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const remove of removals) remove();
      clearErrors(); clearAnswerError(); hideResult(); status.textContent = '';
      answer.readOnly = false; check.hidden = true; check.removeAttribute('aria-disabled'); retrieval.hidden = true; clear.hidden = true;
      flow.hidden = true; fallback.hidden = false; answerFallback.hidden = false;
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
