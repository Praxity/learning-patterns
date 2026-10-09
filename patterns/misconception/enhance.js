import { feedback, validateContent, validateState } from './logic.js';
import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { renderDataNotice, showCapNotice } from '../../lib/data-notice.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void }, ask?: import('../../lib/ask.js').Ask }} options
 */
export function enhance(root, { content, strings, state, ask }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  /** @template {Element} T @param {string} selector @returns {T} */
  function required(selector) {
    const element = root.querySelector(selector);
    if (!element) throw new Error(`Missing misconception markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  const answer = /** @type {HTMLTextAreaElement} */ (required('textarea'));
  const check = /** @type {HTMLButtonElement} */ (required('[data-lp-check]'));
  const error = /** @type {HTMLElement} */ (required('[data-lp-error]'));
  const notice = /** @type {HTMLElement} */ (required('[data-lp-notice]'));
  const challengeSlot = /** @type {HTMLElement} */ (required('[data-lp-challenge]'));
  const result = /** @type {HTMLElement} */ (required('[data-lp-result]'));
  const fallback = /** @type {HTMLElement} */ (required('[data-lp-fallback]'));
  const model = /** @type {HTMLDetailsElement} */ (required('[data-lp-model]'));
  const status = /** @type {HTMLElement} */ (required('[role="status"]'));
  const boxes = [...fallback.querySelectorAll('input')];
  if (boxes.length !== content.misconceptions.length) throw new Error('Invalid misconception catalogue markup');
  const lifetime = new AbortController();
  let destroyed = false, automatic = Boolean(ask), modelId = '';
  const saved = state ? validateState(state.read()) : null;
  if (saved) { answer.value = saved.answer; for (const box of boxes) box.checked = saved.ticked.includes(box.value); }
  const save = () => state?.write({ answer: answer.value, ticked: boxes.filter(box => box.checked).map(box => box.value) });
  const offline = () => {
    automatic = false; notice.hidden = true;
    answer.removeAttribute('aria-describedby');
  };
  const showFallback = () => {
    offline(); result.hidden = true; result.replaceChildren(); fallback.hidden = false;
    model.hidden = false; model.open = true;
  };
  fallback.hidden = true; model.hidden = true; model.open = false; check.hidden = false;
  if (ask) {
    check.disabled = true;
    Promise.resolve().then(() => ask.config()).then(config => {
      if (destroyed) return;
      // Choice gates are model-specific; older host clients may provide only the provider.
      modelId = config.model ?? (config.provider === 'clef' ? '@cf/cloudflare/clef' : config.provider);
      notice.innerHTML = renderDataNotice(config, root.lang, `${notice.id}-text`);
      notice.hidden = false; answer.setAttribute('aria-describedby', `${notice.id}-text`);
      check.disabled = false;
    }).catch(() => { if (!destroyed) { offline(); check.disabled = false; } });
  }
  const onInput = () => {
    error.hidden = true; answer.removeAttribute('aria-invalid');
    if (!notice.hidden) answer.setAttribute('aria-describedby', `${notice.id}-text`);
    else answer.removeAttribute('aria-describedby');
    save();
  };
  const onCheck = async () => {
    if (check.disabled || check.hidden || check.getAttribute('aria-disabled') === 'true') return;
    const draft = answer.value.trim();
    if (!draft) {
      error.hidden = false; answer.setAttribute('aria-invalid', 'true');
      answer.setAttribute('aria-describedby', `${error.id}${notice.hidden ? '' : ` ${notice.id}-text`}`);
      answer.focus(); status.textContent = strings.empty; return;
    }
    if (!automatic || !ask) { showFallback(); status.textContent = strings.fallback; return; }
    // Guard repeated submissions without dropping keyboard focus in WebKit.
    check.setAttribute('aria-disabled', 'true'); check.textContent = strings.checking;
    try {
      const answers = await ask('06-misconceptions', { answer: draft }, { challengeSlot, signal: lifetime.signal });
      if (destroyed || answer.value.trim() !== draft) return;
      const outcome = feedback(content, answers, modelId);
      const found = outcome.kind === 'correct', known = outcome.kind === 'misconception';
      const word = found ? strings.found : known ? strings.misconception : outcome.kind === 'none' ? strings.noMatch : strings.unsure;
      result.innerHTML = known
        ? `<h3 class="lp-run-in lp-misconception-heading">${icons['alert-circle']}${html(outcome.heading)}</h3><p>${html(outcome.text)}</p>`
        : `<p class="lp-misconception-feedback ${found ? 'lp-met' : 'lp-neutral'}">${found ? icons.check : icons['question-mark']}<span>${html(outcome.text)}</span></p>`;
      result.hidden = false; fallback.hidden = true; model.hidden = false; model.open = true;
      status.textContent = known ? `${word}: ${outcome.heading}. ${outcome.text}` : `${word}. ${outcome.text}`;
    } catch (error) {
      if (!destroyed) {
        const capped = showCapNotice(error, root, fallback, status);
        showFallback();
        if (!capped) status.textContent = strings.fallback;
      }
    } finally {
      if (!destroyed) { check.removeAttribute('aria-disabled'); check.textContent = strings.check; }
    }
  };
  answer.addEventListener('input', onInput); check.addEventListener('click', onCheck);
  fallback.addEventListener('change', save);
  const instance = { destroy() {
    if (destroyed) return;
    destroyed = true; lifetime.abort();
    answer.removeEventListener('input', onInput); check.removeEventListener('click', onCheck);
    fallback.removeEventListener('change', save);
    root.querySelector('[data-lp-cap]')?.remove();
    showFallback(); check.hidden = true; check.disabled = false;
    error.hidden = true; answer.removeAttribute('aria-invalid'); status.textContent = '';
    check.removeAttribute('aria-disabled'); check.textContent = strings.check; instances.delete(root);
  } };
  instances.set(root, instance);
  return instance;
}
