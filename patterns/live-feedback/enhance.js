import { feedback, validateContent, validateState, MIN_CHARS, PAUSE_MS, AUTO_CHECK_LIMIT } from './logic.js';
import { icons } from '../../lib/icons.js';
import { renderDataNotice } from '../../lib/data-notice.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();
// All instances, including re-enhancement, share the page's in-memory allowance.
/** @type {WeakMap<Document, { checks: number, stop: Set<() => void> }>} */
const sessions = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void }, ask?: import('../../lib/ask.js').Ask }} options
 */
export function enhance(root, { content, strings, state, ask }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  /** @param {string} selector @returns {HTMLElement} */
  function required(selector) {
    const element = root.querySelector(selector);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing live-feedback markup: ${selector}`);
    return element;
  }
  const answer = /** @type {HTMLTextAreaElement} */ (required('textarea'));
  const notice = required('[data-lp-notice]'), list = required('[data-lp-list]');
  const items = required('[data-lp-items]');
  const fallback = required('[data-lp-fallback]'), fallbackText = required('[data-lp-fallback-text]');
  const checking = required('[data-lp-checking]'), paused = required('[data-lp-paused]');
  const challengeSlot = required('[data-lp-challenge]'), status = required('[role="status"]');
  const initialItems = items.innerHTML;
  const rows = [...items.querySelectorAll('li')];
  const boxes = [...fallback.querySelectorAll('input')];
  if (boxes.length !== content.criteria.length || rows.length !== content.criteria.length) throw new Error('Invalid live-feedback criteria markup');
  const session = sessions.get(root.ownerDocument) ?? { checks: 0, stop: new Set() };
  sessions.set(root.ownerDocument, session);
  let destroyed = false, ready = false, seq = 0, lastChecked = '', count = 0;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  /** @type {AbortController | undefined} */
  let pending;
  /** @type {import('./logic.js').FeedbackItem[]} */
  let previous = [];
  const saved = state ? validateState(state.read()) : null;
  if (saved) { answer.value = saved.answer; for (const box of boxes) box.checked = saved.ticked.includes(box.value); }
  const save = () => state?.write({ answer: answer.value, ticked: boxes.filter(box => box.checked).map(box => box.value) });
  const cancel = () => { clearTimeout(timer); timer = undefined; seq++; pending?.abort(); pending = undefined; checking.hidden = true; };
  const useFallback = () => {
    cancel(); ready = false;
    list.hidden = true; fallback.hidden = false; fallbackText.textContent = strings.fallback;
    paused.hidden = true; notice.hidden = true;
    answer.removeAttribute('aria-describedby');
  };
  const useLimit = () => {
    useFallback(); paused.hidden = false; fallbackText.textContent = strings.selfCheck;
  };
  const stopAtLimit = () => { for (const stop of session.stop) stop(); };
  session.stop.add(useLimit);
  /** @param {import('./logic.js').FeedbackItem[]} result */
  const updateItems = result => {
    const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const first = rows.map(row => row.getBoundingClientRect().top);
    for (const item of result) {
      const row = /** @type {HTMLLIElement} */ (rows.find(row => row.dataset.lpCriterion === item.id));
      const bullet = /** @type {HTMLElement} */ (row.querySelector('.lp-live-feedback-bullet'));
      const text = /** @type {HTMLElement} */ (row.querySelector('[data-lp-item-text]'));
      if (row.dataset.lpMark !== item.mark) {
        row.dataset.lpMark = item.mark;
        bullet.innerHTML = item.mark === 'done' ? icons.check : '';
      }
      text.textContent = item.text;
      items.append(row);
    }
    // FLIP preserves each row's old position while the DOM takes its new order.
    const shifts = rows.map((row, index) => first[index] - row.getBoundingClientRect().top);
    if (motion) {
      rows.forEach((row, index) => {
        row.style.transition = 'none';
        row.style.transform = `translateY(${shifts[index]}px)`;
      });
      void items.offsetHeight;
      rows.forEach(row => { row.style.removeProperty('transition'); row.style.removeProperty('transform'); });
    }
  };
  const run = async () => {
    if (!ready || !ask || destroyed || pending) return;
    clearTimeout(timer); timer = undefined;
    const raw = answer.value, draft = raw.trim();
    if (draft.length < MIN_CHARS || draft === lastChecked) return;
    if (session.checks >= AUTO_CHECK_LIMIT) { stopAtLimit(); return; }
    const my = seq, controller = new AbortController();
    pending = controller; lastChecked = draft; session.checks++;
    checking.hidden = false;
    try {
      const answers = await ask('02-live', { answer: draft }, { challengeSlot, signal: controller.signal });
      if (destroyed || my !== seq) return;
      const outcome = feedback(content, answers, raw, previous);
      previous = outcome.items;
      updateItems(outcome.items);
      if (outcome.count !== count) {
        count = outcome.count;
        status.textContent = strings.summary.replaceAll('{count}', String(count)).replaceAll('{total}', String(outcome.total));
      }
    } catch {
      if (!destroyed && my === seq) {
        if (session.checks >= AUTO_CHECK_LIMIT) stopAtLimit();
        else useFallback();
      }
    } finally {
      if (!destroyed && my === seq) {
        pending = undefined; checking.hidden = true;
        if (session.checks >= AUTO_CHECK_LIMIT) stopAtLimit();
      }
    }
  };
  const schedule = () => {
    if (!ready) return;
    if (session.checks >= AUTO_CHECK_LIMIT) { stopAtLimit(); return; }
    if (answer.value.trim().length >= MIN_CHARS && answer.value.trim() !== lastChecked) timer = setTimeout(() => { void run(); }, PAUSE_MS);
  };
  const onInput = () => { cancel(); save(); schedule(); };
  if (ask) {
    Promise.resolve().then(() => ask.config()).then(config => {
      if (destroyed) return;
      if (session.checks >= AUTO_CHECK_LIMIT) { useLimit(); return; }
      if (config.provider !== 'perplexity' && config.provider !== 'mock') { useFallback(); return; }
      notice.innerHTML = renderDataNotice(config, root.lang, `${notice.id}-text`);
      notice.hidden = false; answer.setAttribute('aria-describedby', `${notice.id}-text`);
      fallback.hidden = true; list.hidden = false;
      ready = true; schedule();
    }).catch(() => { if (!destroyed) useFallback(); });
  } else useFallback();
  answer.addEventListener('input', onInput); fallback.addEventListener('change', save);
  const instance = { destroy() {
    if (destroyed) return;
    destroyed = true; cancel(); session.stop.delete(useLimit);
    answer.removeEventListener('input', onInput); fallback.removeEventListener('change', save);
    useFallback(); fallbackText.textContent = strings.selfCheck; status.textContent = '';
    items.innerHTML = initialItems; notice.replaceChildren();
    challengeSlot.replaceChildren(); challengeSlot.hidden = true; instances.delete(root);
  } };
  instances.set(root, instance);
  return instance;
}
