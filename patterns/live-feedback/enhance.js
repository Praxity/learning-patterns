import { feedback, validateContent, validateState, MIN_CHARS, PAUSE_MS, AUTO_CHECK_LIMIT } from './logic.js';
import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { renderDataNotice } from '../../lib/data-notice.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();
// All instances, including re-enhancement, share the page's in-memory allowance.
/** @type {WeakMap<Document, { checks: number }>} */
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
  const check = /** @type {HTMLButtonElement} */ (required('[data-lp-check]'));
  const notice = required('[data-lp-notice]'), error = required('[data-lp-error]');
  const list = required('[data-lp-list]');
  const summary = required('[data-lp-summary]'), items = required('[data-lp-items]');
  const fallback = required('[data-lp-fallback]'), fallbackText = required('[data-lp-fallback-text]');
  const checking = required('[data-lp-checking]'), paused = required('[data-lp-paused]');
  const challengeSlot = required('[data-lp-challenge]'), status = required('[role="status"]');
  const initialItems = items.innerHTML;
  const boxes = [...fallback.querySelectorAll('input')];
  if (boxes.length !== content.criteria.length) throw new Error('Invalid live-feedback criteria markup');
  const session = sessions.get(root.ownerDocument) ?? { checks: 0 };
  sessions.set(root.ownerDocument, session);
  let destroyed = false, ready = false, seq = 0, lastChecked = '';
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
    cancel(); ready = false; check.hidden = true; check.disabled = false;
    list.hidden = true; fallback.hidden = false; fallbackText.textContent = strings.fallback;
    paused.hidden = true; notice.hidden = true; error.hidden = true;
    answer.removeAttribute('aria-invalid'); answer.removeAttribute('aria-describedby');
  };
  const updatePaused = () => { paused.hidden = session.checks < AUTO_CHECK_LIMIT; };
  /** @param {import('./logic.js').FeedbackItem[]} result @returns {string} */
  const announcement = result => {
    let text = strings.summary.replaceAll('{count}', String(result.filter(item => item.mark === 'met').length)).replaceAll('{total}', String(result.length));
    for (const [mark, template] of [['missed', strings.missingSummary], ['unsure', strings.unsureSummary]]) {
      const names = result.filter(item => item.mark === mark).map(item => item.short);
      if (names.length) text += ` ${template.replaceAll('{items}', names.join(', '))}`;
    }
    return text;
  };
  /** @param {boolean} manual */
  const run = async manual => {
    if (!ready || !ask || destroyed) return;
    clearTimeout(timer); timer = undefined;
    const raw = answer.value, draft = raw.trim();
    if (draft.length < MIN_CHARS) {
      if (manual) {
        error.hidden = false; answer.setAttribute('aria-invalid', 'true');
        answer.setAttribute('aria-describedby', `${error.id} ${notice.id}-text`);
        answer.focus(); status.textContent = strings.empty;
      }
      return;
    }
    if (!manual && (draft === lastChecked || session.checks >= AUTO_CHECK_LIMIT)) { updatePaused(); return; }
    cancel();
    const my = seq, controller = new AbortController();
    pending = controller; lastChecked = draft;
    if (!manual) session.checks++;
    updatePaused(); checking.hidden = false;
    try {
      const answers = await ask('02-live', { answer: draft }, { challengeSlot, signal: controller.signal });
      if (destroyed || my !== seq) return;
      const outcome = feedback(content, answers, raw, previous);
      previous = outcome.items;
      summary.textContent = strings.summary.replaceAll('{count}', String(outcome.count)).replaceAll('{total}', String(outcome.total));
      items.innerHTML = outcome.items.map((item, index) => {
        const found = item.mark === 'met', missed = item.mark === 'missed';
        const word = found ? strings.found : missed ? strings.missed : strings.unsure;
        const icon = found ? icons.check : missed ? icons['circle-plus'] : icons['question-mark'];
        return `<li class="lp-choice" data-lp-mark="${found ? 'correct' : missed ? 'missing' : 'unsure'}"><span class="lp-choice-key" aria-hidden="true">${index + 1}</span><span>${html(item.text)}</span><span class="lp-choice-mark ${found ? 'lp-met' : missed ? 'lp-live-feedback-to-add' : 'lp-neutral'}">${icon}${html(word)}</span></li>`;
      }).join('');
      if (manual) status.textContent = announcement(outcome.items);
    } catch {
      if (!destroyed && my === seq) { useFallback(); if (manual) status.textContent = strings.fallback; }
    } finally {
      if (!destroyed && my === seq) { pending = undefined; checking.hidden = true; }
    }
  };
  const schedule = () => {
    if (!ready) return;
    updatePaused();
    if (session.checks < AUTO_CHECK_LIMIT && answer.value.trim().length >= MIN_CHARS && answer.value.trim() !== lastChecked) timer = setTimeout(() => { void run(false); }, PAUSE_MS);
  };
  const onInput = () => {
    cancel(); error.hidden = true; answer.removeAttribute('aria-invalid');
    if (!notice.hidden) answer.setAttribute('aria-describedby', `${notice.id}-text`);
    else answer.removeAttribute('aria-describedby');
    if (status.textContent) status.textContent = '';
    save(); schedule();
  };
  const onCheck = () => { void run(true); };
  if (ask) {
    check.hidden = false; check.disabled = true;
    Promise.resolve().then(() => ask.config()).then(config => {
      if (destroyed) return;
      if (config.provider !== 'perplexity' && config.provider !== 'mock') { useFallback(); return; }
      notice.innerHTML = renderDataNotice(config, root.lang, `${notice.id}-text`);
      notice.hidden = false; answer.setAttribute('aria-describedby', `${notice.id}-text`);
      check.disabled = false; fallback.hidden = true; list.hidden = false;
      ready = true; schedule();
    }).catch(() => { if (!destroyed) useFallback(); });
  } else useFallback();
  answer.addEventListener('input', onInput); check.addEventListener('click', onCheck); fallback.addEventListener('change', save);
  const instance = { destroy() {
    if (destroyed) return;
    destroyed = true; cancel();
    answer.removeEventListener('input', onInput); check.removeEventListener('click', onCheck); fallback.removeEventListener('change', save);
    useFallback(); fallbackText.textContent = strings.selfCheck; status.textContent = '';
    items.innerHTML = initialItems; summary.textContent = strings.checklist; notice.replaceChildren();
    challengeSlot.replaceChildren(); challengeSlot.hidden = true; instances.delete(root);
  } };
  instances.set(root, instance);
  return instance;
}
