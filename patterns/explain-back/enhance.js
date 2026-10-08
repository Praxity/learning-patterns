import { feedback, validateContent, validateState } from './logic.js';
import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { renderDataNotice } from '../../lib/data-notice.js';

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
    if (!element) throw new Error(`Missing explain-back markup: ${selector}`);
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
  const headings = content.ideas.map(idea => required(`#${CSS.escape(answer.id.replace(/-answer$/, `-lesson-${idea.id}`))}`));
  if (boxes.length !== content.ideas.length) throw new Error('Invalid explain-back ideas markup');
  const lesson = /** @type {HTMLElement} */ (required('.lp-explain-back-lesson'));
  const explaining = /** @type {HTMLElement} */ (required('.lp-box'));
  const taskHeading = /** @type {HTMLElement} */ (required(`#${CSS.escape(answer.getAttribute('aria-labelledby') ?? '')}`));
  const originalAttributes = [answer, check, error, notice, challengeSlot, result, fallback, model, status, lesson, explaining, taskHeading]
    .map(element => ({ element, attributes: [...element.attributes].map(attribute => [attribute.name, attribute.value]) }));
  const originalContents = [check, notice, challengeSlot, result, status].map(element => ({ element, markup: element.innerHTML }));
  const ready = root.ownerDocument.createElement('button');
  ready.type = 'button'; ready.className = 'lp-button'; ready.textContent = strings.ready;
  const readAgain = root.ownerDocument.createElement('button');
  readAgain.type = 'button'; readAgain.className = 'lp-button lp-button-secondary'; readAgain.textContent = strings.readAgain;
  // Both primary buttons sit in .lp-actions rows, so each goes full width on narrow screens.
  const checkRow = required('.lp-actions');
  const readyRow = root.ownerDocument.createElement('div');
  readyRow.className = 'lp-actions'; readyRow.append(ready);
  lesson.append(readyRow); checkRow.append(readAgain);
  taskHeading.setAttribute('tabindex', '-1');
  /** @param {boolean} explain @param {HTMLElement | null} heading */
  const showStep = (explain, heading = null) => {
    lesson.hidden = explain; explaining.hidden = !explain;
    heading?.focus();
  };
  const onReady = () => showStep(true, taskHeading);
  const onReadAgain = () => showStep(false, /** @type {HTMLElement} */ (headings[0]));
  const lifetime = new AbortController();
  let destroyed = false;
  const saved = state ? validateState(state.read()) : null;
  if (saved) { answer.value = saved.answer; for (const box of boxes) box.checked = saved.ticked.includes(box.value); }
  showStep(Boolean(answer.value || saved?.ticked.length));
  const save = () => state?.write({ answer: answer.value, ticked: boxes.filter(box => box.checked).map(box => box.value) });
  const useFallback = () => {
    check.hidden = true; result.hidden = true; result.replaceChildren(); fallback.hidden = false;
    model.hidden = false; model.open = true; notice.hidden = true;
    answer.removeAttribute('aria-describedby');
  };
  if (ask) {
    fallback.hidden = true; model.hidden = true; model.open = false;
    check.hidden = false; check.disabled = true;
    Promise.resolve().then(() => ask.config()).then(config => {
      if (destroyed) return;
      notice.innerHTML = renderDataNotice(config, root.lang, `${notice.id}-text`);
      notice.hidden = false; answer.setAttribute('aria-describedby', `${notice.id}-text`);
      check.disabled = false;
    }).catch(() => { if (!destroyed) useFallback(); });
  }
  const onInput = () => {
    error.hidden = true; answer.removeAttribute('aria-invalid');
    if (!notice.hidden) answer.setAttribute('aria-describedby', `${notice.id}-text`);
    else answer.removeAttribute('aria-describedby');
    save();
  };
  const onCheck = async () => {
    if (!ask || check.disabled || check.hidden || check.getAttribute('aria-disabled') === 'true') return;
    const draft = answer.value.trim();
    if (!draft) {
      error.hidden = false; answer.setAttribute('aria-invalid', 'true');
      answer.setAttribute('aria-describedby', `${error.id}${notice.hidden ? '' : ` ${notice.id}-text`}`);
      answer.focus(); status.textContent = strings.empty; return;
    }
    // Native disabling drops keyboard focus in WebKit. Guard repeated submissions instead.
    check.setAttribute('aria-disabled', 'true'); check.textContent = strings.checking;
    try {
      const answers = await ask('07-explain-back', { answer: draft }, { challengeSlot, signal: lifetime.signal });
      if (destroyed) return;
      // A judgment belongs to the submitted draft. Discard it if the learner has edited.
      if (answer.value.trim() !== draft) return;
      const outcome = feedback(content, answers);
      const summary = strings.summary.replaceAll('{count}', String(outcome.count)).replaceAll('{total}', String(outcome.total));
      result.innerHTML = `<p class="lp-run-in">${html(summary)}</p><ol class="lp-choices lp-explain-back-results">${outcome.items.map((item, index) => {
        const found = item.mark === 'met', missed = item.mark === 'missed';
        const word = found ? strings.found : missed ? strings.missed : strings.unsure;
        const icon = found ? icons.check : missed ? icons['circle-plus'] : icons['question-mark'];
        return `<li class="lp-choice" data-lp-mark="${found ? 'correct' : missed ? 'missing' : 'unsure'}"><span class="lp-choice-key" aria-hidden="true">${index + 1}</span><span>${html(item.text)}</span><span class="lp-choice-mark ${found ? 'lp-met' : missed ? 'lp-explain-back-to-add' : 'lp-neutral'}">${icon}${html(word)}</span>${found ? '' : `<a href="#${html(headings[index].id)}" tabindex="0" data-lp-reread="${index}">${html(strings.reread.replaceAll('{heading}', item.heading))}</a>`}</li>`;
      }).join('')}</ol>`;
      result.hidden = false; model.hidden = !outcome.allFound; model.open = outcome.allFound;
      status.textContent = summary;
    } catch {
      if (!destroyed) { useFallback(); status.textContent = strings.fallback; }
    } finally {
      if (!destroyed) { check.removeAttribute('aria-disabled'); check.textContent = strings.check; }
    }
  };
  /** @param {MouseEvent} event */
  const onReread = event => {
    const link = event.target instanceof Element ? event.target.closest('[data-lp-reread]') : null;
    if (!link) return;
    event.preventDefault();
    const heading = /** @type {HTMLElement} */ (headings[Number(link.getAttribute('data-lp-reread'))]);
    showStep(false, heading);
  };
  answer.addEventListener('input', onInput); check.addEventListener('click', onCheck);
  fallback.addEventListener('change', save); result.addEventListener('click', onReread);
  ready.addEventListener('click', onReady); readAgain.addEventListener('click', onReadAgain);
  const instance = { destroy() {
    if (destroyed) return;
    destroyed = true; lifetime.abort();
    answer.removeEventListener('input', onInput); check.removeEventListener('click', onCheck);
    fallback.removeEventListener('change', save); result.removeEventListener('click', onReread);
    ready.removeEventListener('click', onReady); readAgain.removeEventListener('click', onReadAgain);
    readyRow.remove(); readAgain.remove();
    for (const { element, attributes } of originalAttributes) {
      for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
      for (const [name, value] of attributes) element.setAttribute(name, value);
    }
    for (const { element, markup } of originalContents) element.innerHTML = markup;
    instances.delete(root);
  } };
  instances.set(root, instance);
  return instance;
}
