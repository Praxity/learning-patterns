import { validateContent, validateOptions, validateState, coverage, coverageMessage, targetOf, OTHER, MAX_OPTION, MAX_CUSTOM } from './logic.js';
import { escapeHtml as html } from '../../lib/html.js';

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
  const flow = /** @type {HTMLElement} */ (required(root, '[data-lp-flow]'));
  const result = /** @type {HTMLElement} */ (required(root, '[data-lp-result]'));
  const clear = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-clear]'));
  const compare = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-compare]'));
  const status = /** @type {HTMLElement} */ (required(root, '[role="status"]'));
  const rows = [...root.querySelectorAll('[data-lp-option]')];
  if (rows.length !== content.count) throw new Error('Invalid write-distractors option count');
  const fields = rows.map(row => ({
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
    customWrap: /** @type {HTMLElement} */ (required(row, '[data-lp-custom-wrap]')),
    selected: /** @type {HTMLElement} */ (required(row, '[data-lp-selected]'))
  }));
  // A throwing host read must not leave partially registered listeners.
  const saved = validateState(content, state?.read());
  let shown = false;
  let destroyed = false;
  /** @type {(() => void)[]} */
  const removals = [];
  /** @param {Element} element @param {string} event @param {() => void} handler */
  function listen(element, event, handler) {
    element.addEventListener(event, handler);
    removals.push(() => element.removeEventListener(event, handler));
  }
  const options = () => fields.map(field => ({ text: field.inputs.text.value, misconception: field.inputs.misconception.value, custom: field.inputs.custom.value }));
  const save = () => state?.write({ options: options(), shown });
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
    field.selected.hidden = value === '' || value === OTHER;
    field.selected.textContent = field.selected.hidden ? '' : strings.targets.replaceAll('{target}', targetOf(content, { text: '', misconception: value }));
  }
  function hideResult() {
    shown = false;
    result.replaceChildren(); result.hidden = true;
    clear.hidden = true;
  }
  /** @param {import('./logic.js').LearnerOption[]} values @param {boolean} announce */
  function show(values, announce) {
    const outcome = coverage(content, values);
    const message = coverageMessage(content, values, strings);
    /** @param {import('./logic.js').AuthorOption | import('./logic.js').LearnerOption} item */
    const targetLine = item => html(strings.targets.replaceAll('{target}', targetOf(content, item)));
    result.innerHTML = `<p class="lp-write-distractors-coverage" data-lp-coverage>${html(message)}</p>
      <h2>${html(strings.author)}</h2>
      <ul data-lp-author>${content.authorOptions.map(item => `<li><p>${html(item.text)}</p><p>${targetLine(item)}</p></li>`).join('')}</ul>
      <h2>${html(strings.yours)}</h2>
      <ul data-lp-yours>${values.map((item, index) => `<li><p>${html(item.text)}</p><p>${targetLine(item)}</p><p><span class="lp-write-distractors-mark" aria-hidden="true">${outcome.matches[index] ? '✓' : '○'}</span>${html(outcome.matches[index] ? strings.match : strings.noMatch)}</p></li>`).join('')}</ul>
      <p class="lp-write-distractors-summary" data-lp-summary>${html(strings.summary.replaceAll('{count}', String(values.length)))}</p>`;
    result.hidden = false; clear.hidden = false; shown = true;
    // A single replacement announces each submit, including an identical comparison.
    if (announce) status.textContent = message;
  }
  if (saved) {
    saved.options.forEach((option, index) => {
      const field = fields[index];
      for (const name of /** @type {const} */ (['text', 'misconception', 'custom'])) field.inputs[name].value = option[name];
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
    clearErrors();
    const checked = validateOptions(content, options());
    if (!checked.ok) {
      hideResult();
      for (const error of checked.errors) {
        const field = fields[error.option];
        field.errors[error.field].textContent = strings[error.code]
          .replaceAll('{n}', String(error.option + 1))
          .replaceAll('{max}', String(error.field === 'text' ? MAX_OPTION : MAX_CUSTOM));
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
    fields.forEach((field, index) => {
      for (const input of Object.values(field.inputs)) input.value = '';
      selection(index);
    });
    clearErrors(); hideResult();
    fields[0].inputs.text.focus();
    status.textContent = strings.cleared; save();
  });
  if (saved?.shown) show(saved.options, false);
  fallback.hidden = true; flow.hidden = false;
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const remove of removals) remove();
      clearErrors(); hideResult(); status.textContent = '';
      flow.hidden = true; fallback.hidden = false;
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
