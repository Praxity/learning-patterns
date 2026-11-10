import { MAX_LENGTH, format, result, validateContent, validateFeedback, validateState } from './logic.js';
import { issueItem } from './render.js';
import { frenchTypography } from '../../lib/html.js';
import { lock } from '../../lib/lock.js';
import { reveal } from '../../lib/reveal.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();
const RESULT = /** @type {const} */ ({ all: 'resultAll', some: 'resultSome', none: 'resultNone' });

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options
 */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  /** @template {HTMLElement} T @param {string} selector @returns {T} */
  function required(selector) {
    const element = root.querySelector(selector);
    if (!element) throw new Error(`Missing mark-colleague markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  const t = (/** @type {string} */ text) => frenchTypography(text, root.lang);
  const field = /** @type {HTMLTextAreaElement} */ (required('textarea'));
  const error = required('[data-lp-error]');
  const errorText = required('[data-lp-error-text]');
  const check = /** @type {HTMLButtonElement} */ (required('[data-lp-check]'));
  const fallback = required('[data-lp-fallback]');
  const flow = required('[data-lp-flow]');
  const ticks = required('[data-lp-ticks]');
  const show = required('[data-lp-show]');
  const resultBox = required('[data-lp-result]');
  const summary = required('[data-lp-summary]');
  const list = required('[data-lp-issues]');
  const restart = required('[data-lp-restart]');
  const status = required('[role="status"]');
  const boxes = /** @type {HTMLInputElement[]} */ ([...ticks.querySelectorAll('input[type="checkbox"]')]);
  if (boxes.length !== content.issues.length || boxes.some((box, index) => box.value !== content.issues[index].id)) throw new Error('Invalid mark-colleague issues markup');

  /** @type {import('./logic.js').Stage} */
  let stage = 'write';
  /** @type {(() => void) | null} */
  let unlock = null;
  let destroyed = false;
  /** @type {(() => void)[]} */
  const removals = [];
  /** @param {HTMLElement} target @param {string} event @param {() => void} handler */
  function listen(target, event, handler) {
    target.addEventListener(event, handler);
    removals.push(() => target.removeEventListener(event, handler));
  }
  const ticked = () => boxes.filter(box => box.checked).map(box => box.value);
  const save = () => state?.write({ feedback: field.value, ticked: ticked(), stage });

  function clearError() {
    error.hidden = true;
    errorText.textContent = '';
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
  }
  /** The field's linked error is read when focus returns to it, so nothing is announced. */
  function feedbackOk() {
    const checked = validateFeedback(field.value);
    if (checked.ok) return true;
    errorText.textContent = t(checked.error === 'empty' ? strings.empty : format(strings.tooLong, { max: MAX_LENGTH.toLocaleString(root.lang === 'fr' ? 'fr-CA' : 'en-CA') }));
    error.hidden = false;
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', error.id);
    field.focus();
    return false;
  }
  function paint() {
    ticks.hidden = stage !== 'compare';
    check.hidden = stage !== 'write';
    restart.hidden = stage === 'write';
    resultBox.hidden = stage !== 'done';
    if (stage !== 'done') { summary.textContent = ''; list.replaceChildren(); return; }
    const outcome = result(content, ticked());
    summary.textContent = t(format(strings[RESULT[outcome.key]], { count: outcome.count, total: outcome.total }));
    list.innerHTML = outcome.items.map(item => issueItem(item, strings, root.lang, item.raised)).join('');
  }

  listen(field, 'input', () => { clearError(); save(); });
  for (const box of boxes) listen(box, 'change', save);
  listen(check, 'click', () => {
    if (!feedbackOk()) return;
    stage = 'compare';
    paint(); save();
    reveal(ticks);
    // Focus reads the legend and the first issue, so the status region stays quiet.
    boxes[0].focus();
  });
  listen(show, 'click', () => {
    if (!feedbackOk()) return;
    stage = 'done';
    clearError();
    paint(); save();
    reveal(resultBox);
    // The result sentence is read through focus, before lock() could pick the field or Start over.
    summary.focus({ preventScroll: true });
    unlock = lock(root);
  });
  listen(restart, 'click', () => {
    unlock?.(); unlock = null;
    field.value = '';
    for (const box of boxes) box.checked = false;
    stage = 'write';
    clearError(); paint(); save();
    field.focus();
    status.textContent = t(strings.cleared);
  });

  const saved = validateState(content, state?.read());
  if (saved) {
    field.value = saved.feedback;
    for (const box of boxes) box.checked = saved.ticked.includes(box.value);
    stage = saved.stage;
  }
  fallback.hidden = true;
  flow.hidden = false;
  paint();
  if (stage === 'done') unlock = lock(root, { focus: false });

  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const remove of removals) remove();
      unlock?.();
      field.value = '';
      for (const box of boxes) box.checked = false;
      stage = 'write';
      clearError(); paint();
      check.hidden = true;
      ticks.hidden = true;
      flow.hidden = true;
      fallback.hidden = false;
      status.textContent = '';
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
