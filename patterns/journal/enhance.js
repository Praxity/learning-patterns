import { feedback, validateAnswer, validateContent, validateState, savedEntry, ANSWER_LIMIT } from './logic.js';
import { renderDataNotice, showCapNotice } from '../../lib/notice-ui.js';
import { escapeHtml as html, frenchTypography } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { focusAfterLayout } from '../../lib/focus-after-layout.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void }, ask?: import('../../lib/ask.js').Ask }} options
 */
export function enhance(root, { content, strings, state, ask }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  /** @template {HTMLElement} T @param {string} selector @returns {T} */
  function required(selector) {
    const element = root.querySelector(selector);
    if (!element) throw new Error(`Missing journal markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  const entry = /** @type {HTMLTextAreaElement} */ (required('textarea'));
  const save = required('[data-lp-save]');
  const suggest = /** @type {HTMLButtonElement} */ (required('[data-lp-suggest]'));
  const error = required('[data-lp-error]');
  const savedMessage = required('[data-lp-saved]');
  const actions = required('[data-lp-actions]');
  const notice = required('[data-lp-notice]');
  const challengeSlot = required('[data-lp-challenge]');
  const result = required('[data-lp-result]');
  const changed = required('[data-lp-changed]');
  const questions = /** @type {HTMLDetailsElement} */ (required('[data-lp-questions]'));
  const support = required('[data-lp-support]');
  const offline = required('[data-lp-offline]');
  const noScript = required('[data-lp-no-script]');
  const status = required('[role="status"]');
  const date = required('[data-lp-date]');
  /** @param {Date} value */
  function showDate(value) {
    date.setAttribute('datetime', `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`);
    date.textContent = frenchTypography(new Intl.DateTimeFormat(root.lang === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'long' }).format(value), root.lang);
  }
  showDate(new Date());
  const lifetime = new AbortController();
  let destroyed = false, automatic = Boolean(ask), capped = false, readFailed = false, revision = 0;
  /** @param {string} message */
  function storageMessage(message) { savedMessage.textContent = frenchTypography(message, root.lang); savedMessage.hidden = !message; }
  entry.value = '';
  if (state) {
    try {
      const saved = validateState(state.read());
      if (saved) { entry.value = saved.text; showDate(new Date(saved.savedAt)); storageMessage(content.saved); }
    } catch { readFailed = true; storageMessage(strings.unreadable); }
  }
  const useFallback = () => {
    // Without the decision model the questions show at once; a button that only opened them would repeat the disclosure.
    automatic = false;
    notice.hidden = true; suggest.removeAttribute('aria-describedby');
    support.hidden = false; offline.hidden = false; showQuestions();
    if (capped) suggest.setAttribute('aria-disabled', 'true');
    else if (root.ownerDocument.activeElement === suggest) {
      focusAfterLayout(required('[data-lp-questions] summary'), () => { suggest.hidden = true; }, lifetime.signal);
    } else suggest.hidden = true;
  };
  function showQuestions() { result.hidden = true; result.textContent = ''; result.classList.remove('lp-met'); questions.hidden = false; questions.open = true; }
  actions.hidden = false; noScript.hidden = true; questions.hidden = true; questions.open = false; support.hidden = true;
  if (ask) {
    suggest.disabled = true;
    Promise.resolve().then(() => ask.config()).then(config => {
      if (destroyed) return;
      notice.innerHTML = renderDataNotice(config, root.lang, `${notice.id}-text`);
      notice.hidden = false; suggest.setAttribute('aria-describedby', `${notice.id}-text`); suggest.disabled = false;
    }).catch(() => { if (!destroyed) useFallback(); });
  } else useFallback();
  const clearError = () => { error.hidden = true; entry.removeAttribute('aria-invalid'); entry.removeAttribute('aria-describedby'); };
  const readEntry = () => {
    const answer = validateAnswer(entry.value);
    if (!answer.ok) {
      const text = strings[answer.error].replaceAll('{max}', String(ANSWER_LIMIT));
      error.textContent = frenchTypography(text, root.lang); error.hidden = false; entry.setAttribute('aria-invalid', 'true');
      entry.setAttribute('aria-describedby', error.id); entry.focus(); status.textContent = frenchTypography(text, root.lang);
    }
    return answer;
  };
  const onInput = () => { revision++; clearError(); };
  const onSave = () => {
    const answer = readEntry();
    if (!answer.ok) return;
    let message = content.saved;
    if (!state) message = strings.noStorage;
    else if (readFailed) message = strings.unreadable;
    else {
      try {
        const saved = savedEntry(answer.text, new Date().toISOString());
        state.write(saved); showDate(new Date(saved.savedAt));
      }
      catch { message = strings.writeFailed; }
    }
    storageMessage(message); status.textContent = frenchTypography(message, root.lang);
  };
  const onSuggest = async () => {
    if (suggest.disabled || suggest.hidden || suggest.getAttribute('aria-disabled') === 'true') return;
    changed.hidden = true;
    if (!automatic || !ask) { showQuestions(); status.textContent = frenchTypography(content.questions.map(question => question.text).join(' '), root.lang); return; }
    const answer = readEntry();
    if (!answer.ok) return;
    const submittedRevision = revision;
    result.hidden = true; result.textContent = ''; result.classList.remove('lp-met');
    // An aria-disabled guard retains the triggering button's keyboard focus in WebKit.
    suggest.setAttribute('aria-disabled', 'true'); suggest.textContent = frenchTypography(strings.reading, root.lang);
    const edited = () => revision !== submittedRevision || entry.value !== answer.text;
    const discard = () => { changed.textContent = frenchTypography(content.changed, root.lang); changed.hidden = false; status.textContent = frenchTypography(content.changed, root.lang); };
    try {
      const answers = await ask('13-journal', { answer: answer.text.trim() }, { challengeSlot, signal: lifetime.signal });
      if (destroyed) return;
      if (edited()) { discard(); return; }
      const outcome = feedback(content, answers);
      result.classList.toggle('lp-met', outcome.kind === 'complete');
      result.innerHTML = `${outcome.kind === 'complete' ? icons.check : ''}<span>${html(outcome.text, root.lang)}</span>`;
      result.hidden = false; status.textContent = frenchTypography(outcome.text, root.lang);
    } catch (error) {
      if (!destroyed) {
        capped = showCapNotice(error, root, offline, status);
        useFallback();
        if (capped) return;
        if (edited()) discard();
        else { showQuestions(); status.textContent = frenchTypography(strings.fallback, root.lang); }
      }
    } finally {
      if (!destroyed) { if (!capped) suggest.removeAttribute('aria-disabled'); suggest.textContent = frenchTypography(strings.suggest, root.lang); }
    }
  };
  entry.addEventListener('input', onInput); save.addEventListener('click', onSave); suggest.addEventListener('click', onSuggest);
  const instance = { destroy() {
    if (destroyed) return;
    destroyed = true; lifetime.abort();
    entry.removeEventListener('input', onInput); save.removeEventListener('click', onSave); suggest.removeEventListener('click', onSuggest);
    root.querySelector('[data-lp-cap]')?.remove();
    actions.hidden = true; noScript.hidden = false; notice.hidden = true; offline.hidden = true;
    showQuestions(); support.hidden = false; changed.hidden = true; clearError(); status.textContent = '';
    suggest.hidden = false; suggest.disabled = false; suggest.removeAttribute('aria-disabled'); suggest.removeAttribute('aria-describedby'); suggest.textContent = frenchTypography(strings.suggest, root.lang);
    instances.delete(root);
  } };
  instances.set(root, instance);
  return instance;
}
