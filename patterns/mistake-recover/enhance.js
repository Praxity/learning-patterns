import { decide, progress, recover, start, summarize, validateContent, validateState } from './logic.js';
import { frenchTypography } from '../../lib/html.js';
import { clearChoice, markChoice } from '../../lib/choice-mark.js';
import { lock } from '../../lib/lock.js';
import { reveal } from '../../lib/reveal.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options
 */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  /** @param {ParentNode} parent @param {string} selector @returns {HTMLElement} */
  function required(parent, selector) {
    const element = parent.querySelector(selector);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing mistake-recover markup: ${selector}`);
    return element;
  }
  const records = [...content.requests, content.colleague];
  const items = records.map((record, n) => {
    const section = required(root, `[data-lp-item="${n}"]`);
    const recovery = required(section, '[data-lp-recover]'), fieldset = required(recovery, 'fieldset');
    const boxes = [...fieldset.querySelectorAll('input')];
    if (boxes.length !== record.steps.length || boxes.some((box, s) => box.type !== 'checkbox' || box.value !== record.steps[s].id)) throw new Error('Invalid mistake-recover steps markup');
    const rows = boxes.map(box => {
      const row = box.closest('label');
      if (!row) throw new Error('Invalid mistake-recover choice markup');
      return row;
    });
    const status = required(section, '[data-lp-status]');
    const decision = n < 2 ? required(section, '[data-lp-decide]') : null;
    const fallbacks = [...section.querySelectorAll('[data-lp-fallback]')].map(element => /** @type {HTMLElement} */ (element));
    if (fallbacks.length !== (n < 2 ? 2 : 0)) throw new Error('Missing mistake-recover markup: [data-lp-fallback]');
    return {
      section, recovery, fieldset, boxes, rows, status, decision, fallbacks,
      text: required(status, '[data-lp-status-text]'),
      reasons: rows.map(row => required(row, '[data-lp-reason]')),
      hint: required(fieldset, '.lp-small[id]'),
      error: required(fieldset, '[data-lp-error]'),
      check: required(recovery, '[data-lp-check]'),
      approve: decision && required(decision, '[data-lp-approve]'),
      hold: decision && required(decision, '[data-lp-hold]'),
      /** @type {(() => void) | null} */ unlock: null
    };
  });
  const result = required(root, '[data-lp-result]'), total = required(result, '[data-lp-summary]');
  const restart = required(result, '[data-lp-restart]');
  const status = required(root, '[role="status"]');
  const lifetime = new AbortController();
  let current = start();
  let destroyed = false;
  const text = (/** @type {string} */ value) => frenchTypography(value, root.lang);
  const save = () => state?.write({ decisions: [...current.decisions], steps: current.steps.map(ids => ids && [...ids]) });

  /** @param {HTMLElement} row @param {import('../../lib/choice-mark.js').ChoiceMark | null} kind */
  function mark(row, kind) {
    if ((row.dataset.lpMark ?? null) === kind) return;
    clearChoice(row);
    if (kind) markChoice(row, kind, strings, root.lang);
  }
  /** @param {typeof items[number]} item */
  function clearError({ fieldset, boxes, error, hint }) {
    error.hidden = true;
    fieldset.setAttribute('aria-describedby', hint.id);
    for (const box of boxes) box.removeAttribute('aria-invalid');
  }

  /** Draw the whole card from the state. Handlers change the state, call this, then move focus or announce. */
  function paint() {
    const now = progress(content, current);
    items.forEach((item, n) => {
      const shown = now.statuses[n];
      // Request 1 is always on screen; the next payment appears when the one before it is settled.
      item.section.hidden = n > 0 && shown === null;
      item.status.hidden = shown === null;
      const record = records[n];
      item.text.textContent = shown === null ? '' : text(shown === 'pending' ? strings.pending : shown === 'held' ? /** @type {import('./logic.js').Request} */ (record).held : record[shown]);
      if (item.decision) item.decision.hidden = !(now.stage === 'decide' && now.item === n);
      const checked = current.steps[n];
      item.recovery.hidden = !(now.stage === 'recover' && now.item === n) && checked === null;
      item.boxes.forEach((box, s) => {
        const step = record.steps[s], chosen = checked?.includes(step.id) ?? false;
        // Mark what the learner chose, and each correct step they left out.
        const kind = checked === null ? null : chosen ? step.correct ? 'correct' : 'wrong' : step.correct ? 'missed' : null;
        mark(item.rows[s], kind);
        item.reasons[s].hidden = kind === null;
        if (checked !== null) box.checked = chosen;
      });
      if (checked !== null && !item.unlock) item.unlock = lock(item.recovery, { focus: false });
    });
    result.hidden = now.stage !== 'done';
    total.textContent = now.stage === 'done' ? text(summarize(content, current, strings)) : '';
    return now;
  }
  /** A payment's status line changed. Focus reads that line once; the decision buttons or the check
   * that held focus are gone. The region speaks only the closing sentence, after the focus move.
   * @param {number} n @param {boolean} decided */
  function settled(n, decided) {
    const now = paint(), line = items[n].status, view = root.ownerDocument.defaultView;
    line.focus({ preventScroll: true });
    // Keep the line and its marked steps in view; the next payment appears below without scrolling.
    // When the marked steps run past the bottom, the line goes to the top so as many as fit show under it.
    const marked = items[n].rows.filter(row => row.dataset.lpMark).at(-1);
    if (view && marked && marked.getBoundingClientRect().bottom > view.innerHeight) {
      line.scrollIntoView({ block: 'start', behavior: view.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    } else reveal(line);
    if (now.stage === 'done' && decided) reveal(result);
    status.textContent = now.stage === 'done' ? total.textContent : '';
    save();
  }
  function reset() {
    current = start();
    for (const item of items) {
      item.unlock?.(); item.unlock = null;
      clearError(item);
      for (const box of item.boxes) box.checked = false;
    }
    paint();
  }

  items.forEach((item, n) => {
    for (const box of item.boxes) box.addEventListener('change', () => clearError(item), { signal: lifetime.signal });
    for (const [button, choice] of /** @type {const} */ ([[item.approve, 'approve'], [item.hold, 'hold']])) button?.addEventListener('click', () => {
      const now = progress(content, current);
      if (now.stage !== 'decide' || now.item !== n) return;
      current = decide(content, current, /** @type {0 | 1} */ (n), choice);
      settled(n, true);
    }, { signal: lifetime.signal });
    item.check.addEventListener('click', () => {
      const now = progress(content, current);
      if (now.stage !== 'recover' || now.item !== n) return;
      const chosen = item.boxes.filter(box => box.checked).map(box => box.value);
      if (!chosen.length) {
        item.error.hidden = false;
        item.fieldset.setAttribute('aria-describedby', `${item.hint.id} ${item.error.id}`);
        for (const box of item.boxes) box.setAttribute('aria-invalid', 'true');
        status.textContent = '';
        item.boxes[0].focus();
        return;
      }
      current = recover(content, current, /** @type {0 | 1 | 2} */ (n), chosen);
      settled(n, false);
    }, { signal: lifetime.signal });
  });
  restart.addEventListener('click', () => {
    reset();
    // Back to the top of the card: the title and context frame request 1.
    reveal(root);
    items[0].approve?.focus({ preventScroll: true });
    status.textContent = text(strings.cleared);
    save();
  }, { signal: lifetime.signal });

  for (const item of items) for (const fallback of item.fallbacks) fallback.hidden = true;
  current = validateState(content, state?.read()) ?? start();
  paint();
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      lifetime.abort();
      reset();
      // Without JavaScript both requests are on the page with their disclosures, and nothing else.
      for (const item of items) {
        item.section.hidden = item === items[2];
        item.status.hidden = true;
        item.text.textContent = '';
        if (item.decision) item.decision.hidden = true;
        item.recovery.hidden = true;
        for (const fallback of item.fallbacks) fallback.hidden = false;
      }
      result.hidden = true;
      status.textContent = '';
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
