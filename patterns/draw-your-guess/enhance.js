import { compare, format, snap, validateContent, validateState, x, y } from './logic.js';
import { frenchTypography } from '../../lib/html.js';
import { lock } from '../../lib/lock.js';
import { reveal } from '../../lib/reveal.js';
import { focusAfterLayout } from '../../lib/focus-after-layout.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  /** @template {Element} T @param {string} selector @returns {T} */
  function required(selector) {
    const element = root.querySelector(selector);
    if (!element) throw new Error(`Missing draw-your-guess markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  const chart = /** @type {HTMLElement} */ (required('[data-lp-chart]'));
  const fieldset = required('fieldset');
  const future = /** @type {HTMLElement} */ (required('[data-lp-future]'));
  const inputs = [...future.querySelectorAll('input')];
  if (inputs.length !== content.future.length) throw new Error('Invalid future markup');
  const real = required('[data-lp-real]'), guessLine = required('[data-lp-guess]');
  const marks = required('[data-lp-marks]');
  const fallback = /** @type {HTMLElement} */ (required('[data-lp-fallback]'));
  const result = /** @type {HTMLElement} */ (required('[data-lp-result]'));
  const comparison = /** @type {HTMLElement} */ (required('[data-lp-comparison]'));
  const summary = /** @type {HTMLElement} */ (required('[data-lp-summary]'));
  const check = /** @type {HTMLButtonElement} */ (required('[data-lp-check]'));
  const again = /** @type {HTMLButtonElement} */ (required('[data-lp-try-again]'));
  const error = /** @type {HTMLElement} */ (required('[data-lp-error]'));
  const status = required('[role=status]');
  const help = /** @type {HTMLElement} */ (required('[data-lp-help]'));
  const guessKey = /** @type {HTMLElement} */ (required('[data-lp-guess-key]'));
  const lifetime = new AbortController();
  const cls = 'lp-draw-your-guess-';
  const k = content.known.length, n = k + content.future.length;
  const initial = snap(content, content.known[content.known.length - 1].value);
  const saved = validateState(content, state?.read());
  let guesses = saved?.guesses ?? content.future.map(() => /** @type {number | null} */ (null));
  let shown = false, destroyed = false;
  let unlock = () => {};
  let cancelFocus = () => {};
  /** @type {number | null} */
  let pointer = null;
  const text = /** @param {string} value */ value => frenchTypography(value, root.lang);
  const numbers = new Intl.NumberFormat(/^fr(?:-|$)/i.test(root.lang) ? 'fr-CA' : 'en-CA', { maximumSignificantDigits: 21 });
  const save = () => state?.write({ guesses: [...guesses], shown });
  /** @param {[number, number][]} points */
  const points = points => points.map(([i, v]) => `${x(i, n) * 800},${y(v, content.top) * 300}`).join(' ');
  /** @param {string} kind @param {number} i @param {number} value @param {string} [label] */
  function mark(kind, i, value, label) {
    const node = root.ownerDocument.createElement('span');
    node.className = cls + kind;
    node.style.insetInlineStart = `${x(i, n) * 100}%`;
    node.style.insetBlockStart = `${y(value, content.top) * 100}%`;
    if (label !== undefined) node.textContent = label;
    return node;
  }
  function paint() {
    const realPoints = content.known.map((p, i) => /** @type {[number, number]} */ ([i, p.value]));
    if (shown) realPoints.push(...content.future.map((p, i) => /** @type {[number, number]} */ ([k + i, p.value])));
    real.setAttribute('points', points(realPoints));
    // The guess line starts at the last known point and stops at the first unset month.
    const line = [/** @type {[number, number]} */ ([k - 1, content.known[content.known.length - 1].value])];
    for (let i = 0; i < guesses.length && guesses[i] !== null; i++) line.push([k + i, /** @type {number} */ (guesses[i])]);
    guessLine.setAttribute('points', line.length > 1 ? points(line) : '');
    // Squares go last, so a real point stays visible inside a guess that matches it.
    marks.replaceChildren(...guesses.flatMap((v, i) => v === null ? [] : [mark('dot', k + i, v), mark('val', k + i, v, numbers.format(v))]), ...realPoints.map(([i, v]) => mark('sq', i, v)));
    inputs.forEach((input, i) => {
      input.value = String(guesses[i] ?? initial);
      const value = guesses[i] === null ? '' : numbers.format(guesses[i]);
      input.setAttribute('aria-valuetext', text(format(shown ? strings.compared : guesses[i] === null ? strings.notSet : strings.value, {
        name: content.future[i].name, value, guess: value, real: numbers.format(content.future[i].value), unit: content.unit
      })));
    });
    chart.classList.toggle(cls + 'done', shown);
  }
  function clearError() {
    error.hidden = true;
    for (const input of inputs) { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); }
  }
  /** @param {number} i @param {number} value */
  function set(i, value) {
    if (shown) return;
    const next = snap(content, value);
    if (guesses[i] === next) return;
    guesses[i] = next;
    clearError(); paint(); save();
    // Native range value changes announce themselves; the status region stays quiet here.
  }
  /** @param {boolean} announce */
  function show(announce) {
    const outcome = compare(content, /** @type {number[]} */ (guesses));
    shown = true; paint();
    comparison.replaceChildren(...content.future.map((p, i) => {
      const item = root.ownerDocument.createElement('li');
      item.textContent = text(format(strings.compared, { name: p.name, guess: numbers.format(/** @type {number} */ (guesses[i])), real: numbers.format(p.value), unit: content.unit }));
      return item;
    }));
    comparison.hidden = false;
    summary.textContent = text(outcome.summary); summary.hidden = false;
    again.hidden = false;
    // One check completes the interaction. Expose Try again before locking controls.
    unlock = lock(root, { focus: announce });
    if (announce) { reveal(result); status.textContent = text(outcome.summary); }
    else result.hidden = false;
  }
  inputs.forEach((input, i) => input.addEventListener('input', () => set(i, Number(input.value)), { signal: lifetime.signal }));
  /** A tap sets a point without dragging. Pointer focus lets arrow keys continue from it.
   * @param {PointerEvent} event */
  function at(event) {
    const rect = future.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const i = Math.min(inputs.length - 1, Math.max(0, Math.floor((event.clientX - rect.left) / rect.width * inputs.length)));
    set(i, (1 - (event.clientY - rect.top) / rect.height) * content.top);
    if (root.ownerDocument.activeElement !== inputs[i]) inputs[i].focus({ preventScroll: true });
  }
  future.addEventListener('pointerdown', event => {
    if (shown || event.button > 0 || pointer !== null) return;
    event.preventDefault(); pointer = event.pointerId; future.setPointerCapture(pointer);
    chart.classList.add(cls + 'pointer'); at(event);
  }, { signal: lifetime.signal });
  future.addEventListener('pointermove', event => { if (event.pointerId === pointer) at(event); }, { signal: lifetime.signal });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) future.addEventListener(type, () => { pointer = null; }, { signal: lifetime.signal });
  chart.addEventListener('keydown', () => chart.classList.remove(cls + 'pointer'), { signal: lifetime.signal });
  chart.addEventListener('focusin', () => { if (pointer === null) chart.classList.remove(cls + 'pointer'); }, { signal: lifetime.signal });
  check.addEventListener('click', () => {
    if (shown) return;
    const empty = content.future.filter((_, i) => guesses[i] === null).map(p => p.name);
    if (empty.length) {
      const names = empty.length < 2 ? empty.join('') : `${empty.slice(0, -1).join(', ')}${strings.and}${empty.at(-1)}`;
      const message = text(format(strings.missing, { names }));
      required('[data-lp-error] span').textContent = message; error.hidden = false;
      inputs.forEach((input, i) => {
        if (guesses[i] === null) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', error.id); }
      });
      status.textContent = message;
      return;
    }
    clearError(); show(true); save();
  }, { signal: lifetime.signal });
  again.addEventListener('click', () => {
    unlock(); cancelFocus();
    shown = false; guesses = content.future.map(() => null); pointer = null;
    comparison.hidden = true; comparison.replaceChildren();
    result.hidden = true; summary.hidden = true; summary.textContent = '';
    clearError(); chart.classList.remove(cls + 'pointer'); paint();
    cancelFocus = focusAfterLayout(inputs[0], () => { again.hidden = true; }, lifetime.signal);
    status.textContent = text(strings.cleared); save();
  }, { signal: lifetime.signal });
  fallback.hidden = true; future.hidden = false; help.hidden = false; guessKey.hidden = false; check.hidden = false;
  fieldset.setAttribute('aria-describedby', help.id);
  paint();
  if (saved?.shown) show(false);
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true; lifetime.abort(); cancelFocus(); unlock();
      if (pointer !== null && future.hasPointerCapture(pointer)) future.releasePointerCapture(pointer);
      pointer = null; shown = false; guesses = content.future.map(() => null); paint(); clearError();
      comparison.hidden = true; comparison.replaceChildren();
      chart.classList.remove(cls + 'pointer');
      fallback.hidden = false; future.hidden = true; help.hidden = true; guessKey.hidden = true; check.hidden = true;
      fieldset.removeAttribute('aria-describedby');
      result.hidden = true; summary.hidden = true; summary.textContent = ''; again.hidden = true; status.textContent = '';
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
