import { feedback, validateContent, validateState } from './logic.js';
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
  /** @template {Element} T @param {string} selector @returns {T} */
  function required(selector) {
    const element = root.querySelector(selector);
    if (!element) throw new Error(`Missing self-check markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  const answer = /** @type {HTMLTextAreaElement} */ (required('textarea'));
  const error = /** @type {HTMLElement} */ (required('[data-lp-error]'));
  const fallback = /** @type {HTMLDetailsElement} */ (required('[data-lp-fallback]'));
  const flow = /** @type {HTMLElement} */ (required('[data-lp-flow]'));
  const fieldset = /** @type {HTMLFieldSetElement} */ (required('[data-lp-ticks]'));
  const result = /** @type {HTMLElement} */ (required('[data-lp-result]'));
  const status = /** @type {HTMLElement} */ (required('[role="status"]'));
  const boxes = [...fieldset.querySelectorAll('input')];
  if (boxes.length !== content.parts.length) throw new Error('Invalid self-check parts markup');
  let shown = false;
  let destroyed = false;
  /** @type {(() => void)[]} */
  const removals = [];
  /** @param {Element} target @param {string} event @param {() => void} handler */
  function listen(target, event, handler) {
    target.addEventListener(event, handler);
    removals.push(() => target.removeEventListener(event, handler));
  }
  const ticked = () => boxes.filter(box => box.checked).map(box => box.value);
  const save = () => state?.write({ answer: answer.value, ticked: ticked(), shown });
  function clearError() {
    error.hidden = true;
    answer.removeAttribute('aria-invalid');
    answer.removeAttribute('aria-describedby');
  }
  function hasAnswer() {
    if (answer.value.trim()) return true;
    error.hidden = false;
    answer.setAttribute('aria-invalid', 'true');
    answer.setAttribute('aria-describedby', error.id);
    answer.focus();
    return false;
  }
  /** @param {boolean} announce */
  function show(announce) {
    const outcome = feedback(content, ticked());
    const summary = strings.summary.replaceAll('{count}', String(outcome.count)).replaceAll('{total}', String(outcome.total));
    result.innerHTML = `<p class="lp-self-check-summary">${html(summary)}</p>
      <ul class="lp-self-check-feedback">${outcome.items.map(item => `<li><span class="lp-self-check-mark" aria-hidden="true">${item.included ? '✓' : '○'}</span><div><strong>${html(item.included ? strings.included : strings.notIncluded)}</strong><p>${html(item.text)}</p></div></li>`).join('')}</ul>
      <h2 class="lp-self-check-model-label">${html(strings.model)}</h2><p>${html(content.model)}</p>`;
    result.hidden = false;
    shown = true;
    // One replacement also announces a repeated submission with the same count.
    if (announce) status.textContent = summary;
  }
  const saved = validateState(content, state?.read());
  if (saved) {
    answer.value = saved.answer;
    for (const box of boxes) box.checked = saved.ticked.includes(box.value);
    fieldset.hidden = !(saved.answer.trim() || saved.ticked.length || saved.shown);
    if (saved.shown) show(false);
  }
  listen(answer, 'input', () => { clearError(); save(); });
  for (const box of boxes) listen(box, 'change', save);
  listen(required('[data-lp-check]'), 'click', () => {
    if (!hasAnswer()) return;
    fieldset.hidden = false;
    boxes[0]?.focus();
    save();
  });
  listen(required('[data-lp-show]'), 'click', () => {
    if (!hasAnswer()) return;
    show(true);
    save();
  });
  listen(required('[data-lp-restart]'), 'click', () => {
    answer.value = '';
    for (const box of boxes) box.checked = false;
    result.replaceChildren(); result.hidden = true;
    shown = false; fieldset.hidden = true;
    clearError();
    answer.focus();
    status.textContent = strings.cleared;
    save();
  });
  fallback.hidden = true;
  flow.hidden = false;
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const remove of removals) remove();
      flow.hidden = true;
      fallback.hidden = false;
      fieldset.hidden = true;
      result.replaceChildren(); result.hidden = true;
      status.textContent = '';
      clearError();
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
