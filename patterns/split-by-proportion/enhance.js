import { compare, format, initialDividers, moveDivider, quantity, shares, validateContent, validateState } from './logic.js';
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
  /** @template {HTMLElement} T @param {string} selector @returns {T} */
  function required(selector) {
    const node = root.querySelector(selector);
    if (!node) throw new Error(`Missing split-by-proportion markup: ${selector}`);
    return /** @type {T} */ (node);
  }
  const split = required('[data-lp-split]');
  const bar = required('[data-lp-bar]');
  const inputs = [...split.querySelectorAll('input')];
  const grips = [...bar.querySelectorAll('.lp-split-by-proportion-grip')].map(n => /** @type {HTMLElement} */ (n));
  const segments = [...bar.querySelectorAll('.lp-split-by-proportion-seg')].map(n => /** @type {HTMLElement} */ (n));
  const keyShares = [...root.querySelectorAll('[data-lp-share]')];
  const interaction = required('[data-lp-interaction]');
  const help = required('[data-lp-help]');
  const check = required('[data-lp-check]');
  const again = required('[data-lp-try-again]');
  const fallback = required('[data-lp-fallback]');
  const result = required('[data-lp-result]');
  const summary = required('[data-lp-summary]');
  const note = required('[data-lp-error]');
  const status = required('[role=status]');
  const lifetime = new AbortController();
  let cancelFocus = () => {};
  let unlock = () => {};
  let dividers = initialDividers(content);
  let touched = false;
  let shown = false;
  let destroyed = false;
  /** @type {{ i: number | null, near: number[], x: number, pointer: number } | null} */
  let drag = null;
  const text = (/** @type {string} */ value) => frenchTypography(value, root.lang);
  const q = (/** @type {number} */ value) => text(quantity(value, content, root.lang));
  const save = () => state?.write({ dividers: [...dividers], touched, shown });

  // Value text widens to every option a push changed, so each new value is heard once through the slider.
  /** @param {number | null} [moved] @param {number[]} [changed] */
  function paint(moved = null, changed = []) {
    const values = shares(content, dividers);
    segments.forEach((segment, i) => {
      segment.hidden = values[i] === 0;
      segment.style.inlineSize = `${values[i] / content.total * 100}%`;
      const value = segment.querySelector('[data-lp-segment-value]');
      if (value) value.textContent = q(values[i]);
    });
    inputs.forEach((input, i) => {
      input.value = String(dividers[i]);
      input.style.insetInlineStart = `${dividers[i] / content.total * 100}%`;
      grips[i].style.insetInlineStart = input.style.insetInlineStart;
      const span = i === moved ? [i, i + 1, ...changed] : [i, i + 1];
      input.setAttribute('aria-valuetext', content.options.map((option, j) => j >= Math.min(...span) && j <= Math.max(...span)
        ? `${text(option.label)} ${q(values[j])}` : null).filter(Boolean).join(', '));
    });
    keyShares.forEach((node, i) => { node.textContent = q(values[i]); });
  }
  /** @param {number} index @param {number} value */
  function set(index, value) {
    if (shown) return;
    const next = moveDivider(content, dividers, index, value);
    if (next.every((v, i) => v === dividers[i])) return;
    const before = shares(content, dividers);
    dividers = next;
    const after = shares(content, dividers);
    touched = true;
    note.hidden = true;
    status.textContent = '';
    paint(index, after.flatMap((v, i) => v !== before[i] ? [i] : []));
    save();
  }
  /** @param {boolean} announce */
  function show(announce) {
    cancelFocus();
    const outcome = compare(content, dividers);
    const message = text(outcome.exact ? strings.exact : format(outcome.close ? strings.close : strings.apart, {
      label: content.options[outcome.biggest].label.toLocaleLowerCase(/^fr(?:-|$)/i.test(root.lang) ? 'fr-CA' : 'en'),
      mine: quantity(outcome.mine[outcome.biggest], content, root.lang),
      real: quantity(outcome.real[outcome.biggest], content, root.lang)
    }));
    root.querySelectorAll('[data-lp-mine]').forEach((node, i) => { node.textContent = q(outcome.mine[i]); });
    result.querySelectorAll('.lp-split-by-proportion-vbar').forEach((node, column) => {
      const values = column === 0 ? outcome.mine : outcome.real;
      node.querySelectorAll('.lp-split-by-proportion-seg').forEach((node, i) => {
        const segment = /** @type {HTMLElement} */ (node);
        segment.hidden = values[i] === 0;
        segment.style.setProperty('--s', String(values[i]));
        // Labels fit at 8% of the 240px chart height. The table holds every number.
        for (const child of segment.children) /** @type {HTMLElement} */ (child).hidden = values[i] / content.total < .08;
        const value = segment.querySelector('[data-lp-chart-value]');
        if (value) value.textContent = q(values[i]);
      });
    });
    summary.textContent = message;
    summary.hidden = false;
    shown = true;
    again.hidden = false;
    unlock = lock(root);
    if (announce) {
      reveal(result);
      status.textContent = message;
    } else result.hidden = false;
  }

  inputs.forEach((input, i) => input.addEventListener('input', () => set(i, Number(input.value)), { signal: lifetime.signal }));
  split.addEventListener('keydown', () => split.classList.remove('lp-split-by-proportion-pointer'), { signal: lifetime.signal });
  const at = (/** @type {number} */ x) => {
    const rect = bar.getBoundingClientRect();
    return Math.min(content.total, Math.max(0, (x - rect.left) / rect.width * content.total));
  };
  const start = (/** @type {number} */ i) => {
    if (!drag) return;
    drag.i = i;
    split.classList.add('lp-split-by-proportion-pointer');
    inputs[i].focus({ preventScroll: true });
  };
  // Tapping moves the nearest divider. At coincident dividers the tap side or drag direction chooses one.
  bar.addEventListener('pointerdown', event => {
    if (shown || inputs[0].disabled || event.button > 0 || drag) return;
    event.preventDefault();
    const position = at(event.clientX);
    const gaps = dividers.map(v => Math.abs(v - position));
    const near = gaps.flatMap((gap, i) => gap === Math.min(...gaps) ? [i] : []);
    bar.setPointerCapture(event.pointerId);
    drag = { i: null, near, x: event.clientX, pointer: event.pointerId };
    if (near.length === 1) start(near[0]);
    else if (Math.abs(position - dividers[near[0]]) >= content.step / 2) start(position < dividers[near[0]] ? near[0] : near[near.length - 1]);
    if (drag.i !== null) set(drag.i, position);
  }, { signal: lifetime.signal });
  bar.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (drag.i === null) {
      if (Math.abs(event.clientX - drag.x) < 3) return;
      start(event.clientX < drag.x ? drag.near[0] : drag.near[drag.near.length - 1]);
    }
    if (drag.i !== null) set(drag.i, at(event.clientX));
  }, { signal: lifetime.signal });
  function endDrag() {
    if (drag && bar.hasPointerCapture(drag.pointer)) bar.releasePointerCapture(drag.pointer);
    drag = null;
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) bar.addEventListener(type, endDrag, { signal: lifetime.signal });
  check.addEventListener('click', () => {
    if (shown) return;
    endDrag();
    if (!touched) {
      note.hidden = false;
      status.textContent = text(strings.untouched);
      return;
    }
    show(true);
    save();
  }, { signal: lifetime.signal });
  again.addEventListener('click', () => {
    cancelFocus();
    endDrag();
    unlock();
    dividers = initialDividers(content);
    touched = false;
    shown = false;
    note.hidden = true;
    result.hidden = true;
    summary.hidden = true;
    summary.textContent = '';
    root.querySelectorAll('[data-lp-mine], [data-lp-chart-value]').forEach(node => { node.textContent = ''; });
    split.classList.remove('lp-split-by-proportion-pointer');
    paint();
    // Keep the focused action visible until the newly unlocked slider can receive focus.
    cancelFocus = focusAfterLayout(inputs[0], () => { again.hidden = true; }, lifetime.signal);
    status.textContent = text(strings.cleared);
    save();
  }, { signal: lifetime.signal });

  const saved = validateState(content, state?.read());
  if (saved) ({ dividers, touched } = saved);
  paint();
  fallback.hidden = true;
  interaction.hidden = false;
  help.hidden = false;
  check.hidden = false;
  if (saved?.shown) show(false);
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      endDrag();
      lifetime.abort();
      cancelFocus();
      unlock();
      interaction.hidden = true;
      help.hidden = true;
      check.hidden = true;
      again.hidden = true;
      fallback.hidden = false;
      result.hidden = true;
      summary.hidden = true;
      summary.textContent = '';
      note.hidden = true;
      status.textContent = '';
      dividers = initialDividers(content);
      split.classList.remove('lp-split-by-proportion-pointer');
      paint();
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
