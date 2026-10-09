import { lookup, validateContent, validateState, AUTO_CHECK_LIMIT, BANK_LIMIT } from './logic.js';
import { typingPause } from '../../lib/typing-pause.js';
import { renderDataNotice } from '../../lib/data-notice.js';
import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { focusAfterLayout } from '../../lib/focus-after-layout.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();
/** @type {WeakMap<Document, { checks: number, notify: Set<() => void> }>} */
const sessions = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void }, ask?: import('../../lib/ask.js').Ask }} options
 */
export function enhance(root, { content, strings, state, ask }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  const initialMarkup = root.innerHTML;
  /** @param {string} selector @returns {HTMLElement} */
  function required(selector) {
    const element = root.querySelector(selector);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing course-lookup markup: ${selector}`);
    return element;
  }
  const input = /** @type {HTMLTextAreaElement} */ (required('textarea'));
  const controls = required('[data-lp-controls]'), notice = required('[data-lp-notice]');
  const result = required('[data-lp-result]'), checking = required('[data-lp-checking]');
  const paused = required('[data-lp-paused]'), add = /** @type {HTMLButtonElement} */ (required('[data-lp-add]'));
  const fallback = required('[data-lp-fallback]'), fallbackMessage = required('[data-lp-fallback-message]');
  const bank = required('[data-lp-bank]'), bankList = required('[data-lp-bank-list]');
  const bankMessage = required('[data-lp-bank-message]'), status = required('[role="status"]');
  const challengeSlot = required('[data-lp-challenge]');
  const session = sessions.get(root.ownerDocument) ?? { checks: 0, notify: new Set() };
  sessions.set(root.ownerDocument, session);
  const timing = typingPause();
  const storageKey = `lp:course-lookup:${root.lang}:${input.id}`;
  const storage = state ?? {
    read: () => JSON.parse(root.ownerDocument.defaultView?.localStorage.getItem(storageKey) ?? 'null'),
    /** @param {import('./logic.js').LearnerState} value */
    write: value => root.ownerDocument.defaultView?.localStorage.setItem(storageKey, JSON.stringify(value))
  };
  /** @type {string[]} */
  let questions = [];
  let destroyed = false, ready = false, composing = false, seq = 0, lastChecked = '', draft = '', unmatched = '', announced = '';
  const lifetime = new AbortController();
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let slowTimer;
  /** @type {AbortController | undefined} */
  let pending;
  /** @param {string} text */
  const message = text => { bankMessage.textContent = text; bankMessage.hidden = false; status.textContent = text; };
  try { questions = validateState(storage.read())?.questions ?? []; }
  catch { message(strings.storageError); }
  const updateBank = () => {
    bankList.innerHTML = content.seeds.map(seed => `<li><p class="lp-run-in lp-course-lookup-q">${icons['help-circle']}<span>${html(seed.question)}</span></p><p class="lp-small">${html(strings[seed.author])}</p><p>${html(seed.answer)}</p></li>`).join('') + questions.map((question, index) => `<li><p class="lp-run-in lp-course-lookup-q" tabindex="-1">${icons['help-circle']}<span>${html(question)}</span></p><p class="lp-small">${html(strings.waiting)}</p><button type="button" class="lp-button lp-button-quiet" data-lp-remove="${index}" aria-label="${html(`${strings.remove}: ${question}`)}">${icons.x}${html(strings.remove)}</button></li>`).join('');
    bank.hidden = false;
  };
  updateBank();
  const cancel = () => {
    clearTimeout(timer); clearTimeout(slowTimer); timer = slowTimer = undefined;
    seq++;
    if (pending) { pending.abort(); lastChecked = ''; }
    pending = undefined; checking.hidden = true;
  };
  const updateCap = () => {
    paused.hidden = session.checks < AUTO_CHECK_LIMIT;
    if (!paused.hidden) { clearTimeout(timer); timer = undefined; }
  };
  session.notify.add(updateCap);
  const hideAdd = () => {
    if (root.ownerDocument.activeElement === add) input.focus();
    add.hidden = true;
  };
  const useFallback = () => {
    const moveFocus = controls.contains(root.ownerDocument.activeElement);
    cancel(); ready = false; fallback.hidden = false;
    fallbackMessage.hidden = false; notice.hidden = true;
    input.removeAttribute('aria-describedby');
    if (moveFocus) focusAfterLayout(required('[data-lp-fallback] summary, [data-lp-fallback] a'), () => { controls.hidden = true; }, lifetime.signal);
    else controls.hidden = true;
  };
  /** @param {boolean} [manual] */
  const run = async (manual = false) => {
    if (!ready || !ask || destroyed || composing) return;
    clearTimeout(timer); timer = undefined;
    const question = input.value.trim();
    if (timing.delay(question, lastChecked, manual) === null || pending) return;
    if (!manual && session.checks >= AUTO_CHECK_LIMIT) { updateCap(); return; }
    const my = seq, controller = new AbortController();
    pending = controller; lastChecked = question;
    if (!manual) { session.checks++; for (const notify of session.notify) notify(); }
    slowTimer = setTimeout(() => { if (!destroyed && my === seq) checking.hidden = false; }, 300);
    try {
      const answers = await ask(content.kind === 'faq' ? '20-faq' : '21-sections', { question }, { challengeSlot, signal: controller.signal });
      if (destroyed || my !== seq) return;
      const entries = lookup(content, answers);
      const resultFocused = result.contains(root.ownerDocument.activeElement);
      result.innerHTML = entries.length ? entries.map(entry => `<article><h3 class="lp-run-in${content.kind === 'faq' ? ' lp-course-lookup-q' : ''}">${content.kind === 'faq' ? `${icons['help-circle']}<span>${html(entry.title)}</span>` : `<a href="#${html(input.id.replace(/-question$/, `-section-${entry.id}`))}">${html(entry.title)}</a>`}</h3><p>${html(content.kind === 'faq' ? entry.answer ?? '' : entry.summary ?? '')}</p></article>`).join('') : `<p class="lp-run-in">${html(strings.noMatch)}</p>`;
      result.hidden = false;
      if (resultFocused) {
        const focus = /** @type {HTMLElement} */ (result.querySelector('a') ?? input);
        focus.focus();
      }
      unmatched = entries.length ? '' : question;
      if (!unmatched || questions.includes(unmatched)) hideAdd();
      else add.hidden = false;
      if (unmatched && questions.includes(unmatched)) { bankMessage.textContent = strings.saved; bankMessage.hidden = false; }
      const signature = entries.map(entry => entry.id).join(',') || 'none';
      if (signature !== announced) {
        announced = signature;
        status.textContent = entries.length ? (content.kind === 'faq' ? strings.found : strings.sectionFound).replace('{title}', entries.map(entry => entry.title).join('; ')) : strings.noMatch;
      }
    } catch {
      if (!destroyed && my === seq) useFallback();
    } finally {
      if (!destroyed && my === seq) {
        clearTimeout(slowTimer); slowTimer = undefined; checking.hidden = true; pending = undefined;
      }
    }
  };
  const schedule = () => {
    if (!ready || session.checks >= AUTO_CHECK_LIMIT) return;
    const delay = timing.delay(input.value, lastChecked);
    if (delay === 0) void run();
    else if (delay !== null) timer = setTimeout(() => { void run(); }, delay);
  };
  const onInput = () => {
    if (composing) return;
    const next = input.value.trim();
    if (input.isConnected && next !== draft) {
      draft = next; cancel(); hideAdd(); unmatched = ''; bankMessage.hidden = true;
      schedule();
    }
  };
  const onCompositionStart = () => { composing = true; cancel(); };
  const onCompositionEnd = () => { composing = false; draft = ''; onInput(); };
  /** @param {KeyboardEvent} event */
  const onKey = event => {
    if (event.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void run(true); }
    else if (!event.ctrlKey && !event.metaKey && !event.altKey && (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete')) timing.key(performance.now());
  };
  /** @param {string[]} next @returns {boolean} */
  const persist = next => {
    try { storage.write({ questions: next }); questions = next; updateBank(); return true; }
    catch { message(strings.storageError); return false; }
  };
  const onAdd = () => {
    if (!unmatched || input.value.trim() !== unmatched || questions.includes(unmatched)) return;
    if (questions.length >= BANK_LIMIT) { message(strings.bankFull); return; }
    if (persist([...questions, unmatched])) {
      required('[data-lp-bank-list] li:last-child .lp-course-lookup-q').focus();
      add.hidden = true; message(strings.added);
    }
  };
  /** @param {MouseEvent} event */
  const onClick = event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('[data-lp-remove]');
    if (button instanceof HTMLElement && bankList.contains(button)) {
      const index = Number(button.dataset.lpRemove), next = questions.filter((_, i) => i !== index);
      if (persist(next)) {
        add.hidden = !unmatched || questions.includes(unmatched);
        message(strings.removed);
        const focus = bankList.querySelectorAll('button')[Math.min(index, next.length - 1)] ?? input;
        /** @type {HTMLElement} */ (focus).focus();
      }
    }
    if (target.closest('[data-lp-result] a')) fallback.hidden = false;
  };
  input.addEventListener('input', onInput); input.addEventListener('keydown', onKey);
  input.addEventListener('compositionstart', onCompositionStart); input.addEventListener('compositionend', onCompositionEnd);
  add.addEventListener('click', onAdd); root.addEventListener('click', onClick);
  if (ask) {
    Promise.resolve().then(() => ask.config()).then(config => {
      if (destroyed) return;
      if (config.provider !== 'perplexity' && config.provider !== 'mock') { useFallback(); return; }
      notice.innerHTML = renderDataNotice(config, root.lang, `${notice.id}-text`, 'question'); notice.hidden = false;
      input.setAttribute('aria-describedby', `${notice.id}-text`);
      controls.hidden = false; fallback.hidden = true; ready = true; updateCap();
    }).catch(() => { if (!destroyed) useFallback(); });
  } else useFallback();
  const instance = { destroy() {
    if (destroyed) return;
    destroyed = true; lifetime.abort(); cancel(); session.notify.delete(updateCap);
    input.removeEventListener('input', onInput); input.removeEventListener('keydown', onKey);
    input.removeEventListener('compositionstart', onCompositionStart); input.removeEventListener('compositionend', onCompositionEnd);
    add.removeEventListener('click', onAdd); root.removeEventListener('click', onClick);
    root.innerHTML = initialMarkup; instances.delete(root);
  } };
  instances.set(root, instance);
  return instance;
}
