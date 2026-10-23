import { positionOf, scaleFor, score, validateState } from './logic.js';
import { format, numberText } from './render.js';
import { escapeHtml as html, frenchTypography } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { lock } from '../../lib/lock.js';
import { reveal } from '../../lib/reveal.js';
import { focusAfterLayout } from '../../lib/focus-after-layout.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} marker @param {HTMLElement} label @param {HTMLElement} line */
function alignLabel(marker, label, line) {
  marker.dataset.edge = '';
  label.style.maxInlineSize = '';
  const track = line.getBoundingClientRect();
  const bounds = label.getBoundingClientRect();
  marker.dataset.edge = bounds.right > track.right ? 'end' : bounds.left < track.left ? 'start' : '';
  if (marker !== label && marker.dataset.edge) {
    // Wide band labels may need another line to fit on the chosen side of the marker.
    const aligned = label.getBoundingClientRect();
    label.style.maxInlineSize = `${Math.min(aligned.right, track.right) - Math.max(aligned.left, track.left)}px`;
  }
}

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options
 */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  const { stops, bands, start } = scaleFor(content);
  const lifetime = new AbortController();
  const { signal } = lifetime;
  /** @template {Element} T @param {ParentNode} scope @param {string} selector @returns {T} */
  function required(scope, selector) {
    const element = scope.querySelector(selector);
    if (!element) throw new Error(`Missing estimate-magnitude markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  const instructions = /** @type {HTMLElement} */ (required(root, '[data-lp-instructions]'));
  const scales = [...root.querySelectorAll('.lp-estimate-magnitude-scale')].map(element => /** @type {HTMLElement} */ (element));
  const fallback = /** @type {HTMLDetailsElement} */ (required(root, '[data-lp-fallback]'));
  const check = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-check]'));
  const again = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-try-again]'));
  const result = /** @type {HTMLElement} */ (required(root, '[data-lp-result]'));
  const status = /** @type {HTMLElement} */ (required(root, '[role="status"]'));
  const fieldsets = [...root.querySelectorAll('[data-lp-question]')];
  if (fieldsets.length !== content.questions.length) throw new Error('Invalid estimate-magnitude questions markup');
  const saved = validateState(content, state?.read());
  let ranges = saved?.ranges ?? content.questions.map(() => start);
  let touched = saved?.touched ?? content.questions.map(() => false);
  let shown = false;
  let unlock = () => {};
  let cancelFocus = () => {};
  const save = () => state?.write({ ranges: [...ranges], touched: [...touched], shown });
  /** @param {string} message */
  const announce = message => { status.textContent = frenchTypography(message, root.lang); };
  const rows = fieldsets.map((fieldset, index) => {
    const input = /** @type {HTMLButtonElement} */ (required(fieldset, '[data-lp-band]'));
    const line = /** @type {HTMLElement} */ (required(fieldset, '[data-lp-line]'));
    const value = /** @type {HTMLElement} */ (required(fieldset, '[data-lp-value]'));
    const error = /** @type {HTMLElement} */ (required(fieldset, '[data-lp-error]'));
    const feedback = /** @type {HTMLElement} */ (required(fieldset, '[data-lp-feedback]'));
    const answer = /** @type {HTMLElement} */ (required(fieldset, '[data-lp-answer]'));
    const question = content.questions[index];
    function clearError() {
      error.hidden = true;
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }
    function paint() {
      const [low, high] = bands[ranges[index]];
      const left = positionOf(low, stops);
      const label = format(strings.range, { low: numberText(low, root.lang), high: numberText(high, root.lang) });
      input.value = String(ranges[index]);
      input.style.insetInlineStart = `${left}%`;
      input.style.inlineSize = `${positionOf(high, stops) - left}%`;
      input.setAttribute('aria-valuenow', input.value);
      input.setAttribute('aria-valuetext', frenchTypography(`${label} ${question.unit}`, root.lang));
      value.textContent = frenchTypography(label, root.lang);
      alignLabel(input, value, line);
    }
    /** @param {number} next */
    function set(next) {
      if (shown || input.disabled) return;
      ranges[index] = Math.max(0, Math.min(bands.length - 1, next));
      touched[index] = true;
      clearError();
      paint();
      save();
    }
    input.addEventListener('keydown', event => {
      const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
      if (delta === undefined && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      set(event.key === 'Home' ? 0 : event.key === 'End' ? bands.length - 1 : ranges[index] + (delta ?? 0));
    }, { signal });
    // A button with slider semantics participates in the shared lock helper.
    // Tapping the track moves the band too, so dragging is optional.
    let dragging = false, offset = 0;
    /** @param {PointerEvent} event */
    function at(event) {
      const rect = line.getBoundingClientRect();
      if (!rect.width) return;
      const percent = (event.clientX - rect.left - offset) / rect.width * 100;
      const nearest = bands.reduce((best, [low], k) => Math.abs(positionOf(low, stops) - percent) < Math.abs(positionOf(bands[best][0], stops) - percent) ? k : best, 0);
      set(nearest);
    }
    line.addEventListener('pointerdown', event => {
      if (shown || input.disabled || event.button > 0) return;
      event.preventDefault();
      offset = input.contains(/** @type {Node} */ (event.target)) ? event.clientX - input.getBoundingClientRect().left : input.getBoundingClientRect().width / 2;
      dragging = true;
      line.setPointerCapture(event.pointerId);
      input.focus({ preventScroll: true });
      at(event);
    }, { signal });
    line.addEventListener('pointermove', event => { if (dragging) at(event); }, { signal });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) line.addEventListener(type, () => { dragging = false; }, { signal });
    return { input, line, error, feedback, answer, paint, clearError };
  });

  /** @param {boolean} shouldAnnounce */
  function show(shouldAnnounce) {
    const outcome = score(content, ranges);
    outcome.items.forEach((item, index) => {
      const row = rows[index];
      const question = content.questions[index];
      const inside = item.relation === 'inside';
      const message = format(inside ? strings.caught : item.relation === 'below' ? strings.below : strings.above, { answer: numberText(item.answer, root.lang), unit: question.unit });
      const kind = inside ? 'lp-met' : 'lp-missed';
      row.feedback.innerHTML = `<p class="lp-estimate-magnitude-feedback ${kind}">${inside ? icons.check : icons.x}<span>${html(message, root.lang)}</span></p><p class="lp-small">${html(strings.source, root.lang)} ${html(question.source, root.lang)}</p>`;
      row.feedback.hidden = false;
      row.answer.textContent = numberText(item.answer, root.lang);
      row.answer.className = `lp-estimate-magnitude-answer ${kind}`;
      row.answer.style.insetInlineStart = `${positionOf(item.answer, stops)}%`;
      row.answer.hidden = false;
      alignLabel(row.answer, row.answer, row.line);
      row.input.setAttribute('aria-valuetext', `${row.input.getAttribute('aria-valuetext')}. ${frenchTypography(message, root.lang)}`);
    });
    const summary = format(strings.summary, { count: outcome.count, total: outcome.total });
    result.textContent = frenchTypography(summary, root.lang);
    shown = true;
    // One check completes the interaction. Expose Try again before locking and revealing.
    again.hidden = false;
    unlock = shouldAnnounce ? lock(root) : lock(root, { focus: false });
    if (shouldAnnounce) { reveal(result); announce(summary); }
    else result.hidden = false;
  }

  check.addEventListener('click', () => {
    if (shown) return;
    const missing = rows.flatMap((row, index) => {
      if (touched[index]) return [];
      row.error.hidden = false;
      row.input.setAttribute('aria-invalid', 'true');
      row.input.setAttribute('aria-describedby', row.error.id);
      return [index + 1];
    });
    if (missing.length) {
      const questions = new Intl.ListFormat(/^fr(?:-|$)/i.test(root.lang) ? 'fr-CA' : 'en-GB', { type: 'conjunction' }).format(missing.map(String));
      announce(format(missing.length === 1 ? strings.missingOne : strings.missingMany, { questions }));
      return;
    }
    show(true);
    save();
  }, { signal });

  function clearRows() {
    rows.forEach(row => {
      row.clearError(); row.paint();
      row.feedback.replaceChildren(); row.feedback.hidden = true;
      row.answer.hidden = true; row.answer.textContent = '';
    });
    result.textContent = ''; result.hidden = true;
  }
  again.addEventListener('click', () => {
    if (!shown) return;
    unlock();
    shown = false;
    ranges = content.questions.map(() => start);
    touched = content.questions.map(() => false);
    clearRows();
    cancelFocus();
    cancelFocus = focusAfterLayout(rows[0].input, () => { again.hidden = true; }, signal);
    announce(strings.cleared);
    save();
  }, { signal });

  fallback.hidden = true;
  instructions.hidden = false;
  scales.forEach(scale => { scale.hidden = false; });
  rows.forEach(row => { row.paint(); });
  check.hidden = false;
  if (saved?.shown) show(false);
  const instance = {
    destroy() {
      if (signal.aborted) return;
      lifetime.abort(); cancelFocus(); unlock();
      ranges = content.questions.map(() => start);
      touched = content.questions.map(() => false);
      clearRows();
      instructions.hidden = true;
      scales.forEach(scale => { scale.hidden = true; });
      check.hidden = true; again.hidden = true; fallback.hidden = false;
      status.textContent = '';
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
