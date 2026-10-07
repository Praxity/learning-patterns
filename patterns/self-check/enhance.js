import { annotate, feedback, validateContent, validateState } from './logic.js';
import { ring } from './render.js';
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
  const check = /** @type {HTMLButtonElement} */ (required('[data-lp-check]'));
  const meter = /** @type {HTMLElement} */ (required('[data-lp-meter]'));
  const initialMeter = meter.innerHTML;
  const fieldset = /** @type {HTMLFieldSetElement} */ (required('[data-lp-ticks]'));
  const result = /** @type {HTMLElement} */ (required('[data-lp-result]'));
  const restart = /** @type {HTMLButtonElement} */ (required('[data-lp-restart]'));
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
  function paintMeter() {
    meter.innerHTML = `${ring(ticked().length, content.parts.length)}<span>${html(strings.meter.replaceAll('{count}', String(ticked().length)).replaceAll('{total}', String(content.parts.length)))}</span>`;
  }
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
    const missing = outcome.items.filter(item => !item.included);
    const [firstMissing] = missing;
    const sub = !firstMissing ? strings.resultAll : missing.length === 1
      ? strings.resultOne.replaceAll('{label}', firstMissing.label)
      : strings.resultMany;
    const model = annotate(content.model, content.parts, ticked()).map(segment => segment.partIndex === null ? html(segment.text)
      : `<mark class="lp-self-check-ann" data-lp-included="${segment.included}"><span class="lp-self-check-ann-n" aria-hidden="true">${segment.partIndex + 1}</span>${html(segment.text)}</mark>`).join('');
    result.innerHTML = `<div class="lp-self-check-result-head">${ring(outcome.count, outcome.total, 64)}<div><h3 class="lp-stem">${html(summary)}</h3><p class="lp-small">${html(sub)}</p></div></div>
      <div class="lp-self-check-compare">
        <figure class="lp-self-check-pane"><figcaption>${html(strings.mine)}</figcaption><p class="lp-self-check-pane-body">${html(answer.value.trim())}</p></figure>
        <figure class="lp-self-check-pane lp-self-check-pane-model"><figcaption>${html(strings.model)}</figcaption><p class="lp-self-check-pane-body">${model}</p></figure>
      </div>
      <h4 class="lp-visually-hidden">${html(strings.legend)}</h4>
      <ol class="lp-self-check-legend">${outcome.items.map((item, index) => `<li class="lp-self-check-legend-item" data-lp-included="${item.included}"><span class="lp-self-check-ann-n" aria-hidden="true">${index + 1}</span><div><p class="lp-self-check-legend-line"><span class="lp-self-check-legend-label">${html(item.label)}${content.parts[index]?.evidence === null ? `<span class="lp-self-check-legend-where">${html(strings.whole)}</span>` : ''}</span><span class="lp-self-check-legend-status">${item.included ? icons.check : icons['circle-plus']}${html(item.included ? strings.included : strings.notIncluded)}</span></p>${item.hint === null ? '' : `<p class="lp-self-check-legend-hint">${html(item.hint)}</p>`}</div></li>`).join('')}</ol>`;
    result.hidden = false;
    shown = true;
    // One replacement also announces a repeated submission with the same count.
    if (announce) {
      status.textContent = summary;
      result.classList.remove('lp-reveal');
      void result.offsetWidth;
      result.classList.add('lp-reveal');
    }
  }
  const saved = validateState(content, state?.read());
  if (saved) {
    answer.value = saved.answer;
    for (const box of boxes) box.checked = saved.ticked.includes(box.value);
    fieldset.hidden = !(saved.answer.trim() || saved.ticked.length || saved.shown);
    if (saved.shown) show(false);
  }
  paintMeter();
  restart.hidden = fieldset.hidden;
  listen(answer, 'input', () => { clearError(); save(); });
  for (const box of boxes) listen(box, 'change', () => { paintMeter(); save(); });
  listen(check, 'click', () => {
    if (!hasAnswer()) return;
    fieldset.hidden = false;
    restart.hidden = false;
    boxes[0]?.focus();
    save();
  });
  listen(required('[data-lp-show]'), 'click', () => {
    if (!hasAnswer()) return;
    show(true);
    save();
  });
  listen(restart, 'click', () => {
    answer.value = '';
    for (const box of boxes) box.checked = false;
    result.replaceChildren(); result.hidden = true;
    shown = false; fieldset.hidden = true;
    result.classList.remove('lp-reveal');
    paintMeter();
    restart.hidden = true;
    clearError();
    answer.focus();
    status.textContent = strings.cleared;
    save();
  });
  fallback.hidden = true;
  flow.hidden = false;
  check.hidden = false;
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const remove of removals) remove();
      flow.hidden = true;
      check.hidden = true;
      fallback.hidden = false;
      fieldset.hidden = true;
      restart.hidden = true;
      result.replaceChildren(); result.hidden = true;
      result.classList.remove('lp-reveal');
      meter.innerHTML = initialMeter;
      status.textContent = '';
      clearError();
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
