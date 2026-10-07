import { DONT_KNOW, displayPoints, format, score, validateContent, validateState } from './logic.js';
import { escapeHtml as html } from '../../lib/html.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options
 */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  /** @template {Element} T @param {ParentNode} parent @param {string} selector @returns {T} */
  function required(parent, selector) {
    const element = parent.querySelector(selector);
    if (!element) throw new Error(`Missing dont-know markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  const flow = /** @type {HTMLElement} */ (required(root, '[data-lp-flow]'));
  const fallback = /** @type {HTMLElement} */ (required(root, '[data-lp-fallback]'));
  const error = /** @type {HTMLElement} */ (required(root, '[data-lp-error]'));
  const result = /** @type {HTMLElement} */ (required(root, '[data-lp-result]'));
  const restart = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-restart]'));
  const check = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-check]'));
  const status = /** @type {HTMLElement} */ (required(root, '[role="status"]'));
  const fieldsets = [...root.querySelectorAll('fieldset')];
  if (fieldsets.length !== content.questions.length) throw new Error('Invalid dont-know questions markup');
  const names = new Set();
  const questions = content.questions.map((q, index) => {
    const fieldset = fieldsets[index];
    const radios = [...fieldset.querySelectorAll('input')];
    const expected = [...q.options.map(o => o.id), DONT_KNOW];
    const message = /** @type {HTMLElement} */ (required(fieldset, '[data-lp-question-error]'));
    const name = radios[0]?.name;
    if (fieldset.dataset.lpQuestion !== q.id || radios.length !== expected.length || !name || names.has(name) || !message.id || radios.some((radio, n) => radio.type !== 'radio' || radio.value !== expected[n] || radio.name !== name)) throw new Error('Invalid dont-know options markup');
    names.add(name);
    return { q, fieldset, radios, message };
  });
  let shown = false;
  let destroyed = false;
  /** @type {(() => void)[]} */
  const removals = [];
  /** @param {Element} target @param {string} event @param {() => void} handler */
  function listen(target, event, handler) {
    target.addEventListener(event, handler);
    removals.push(() => target.removeEventListener(event, handler));
  }
  const picks = () => Object.fromEntries(questions.flatMap(({ q, radios }) => {
    const checked = radios.find(radio => radio.checked);
    return checked ? [[q.id, checked.value]] : [];
  }));
  const save = () => state?.write({ picks: picks(), shown });
  /** @param {typeof questions[number]} question */
  function clearQuestionError({ fieldset, radios, message }) {
    message.hidden = true;
    fieldset.removeAttribute('aria-describedby');
    for (const radio of radios) {
      radio.removeAttribute('aria-describedby'); radio.removeAttribute('aria-invalid');
    }
  }
  function clearErrors() {
    error.hidden = true; error.textContent = '';
    for (const question of questions) clearQuestionError(question);
  }
  function clearResults() {
    result.replaceChildren(); result.hidden = true; restart.hidden = true; shown = false;
  }
  /** @param {boolean} announce */
  function show(announce) {
    const selected = picks();
    const outcome = score(content, selected);
    const summary = format(strings.summary, { points: displayPoints(outcome.points), total: displayPoints(outcome.total) });
    /** @param {string} title @param {string[]} ids @param {'wrong' | 'unknown' | 'right'} kind */
    function group(title, ids, kind) {
      const mark = kind === 'wrong' ? '×' : kind === 'unknown' ? '?' : '✓';
      return `<div data-lp-group="${kind}"><h3 class="lp-dont-know-heading"><span aria-hidden="true">${mark}</span> ${html(title)}</h3>${ids.length ? `<ul>${content.questions.filter(q => ids.includes(q.id)).map(q => `<li><strong>${html(q.text)}</strong>${kind === 'wrong' ? `<p>${html(format(strings.chosen, { option: q.options.find(o => o.id === selected[q.id])?.text ?? '' }))}</p>` : ''}${kind === 'right' ? '' : `<p>${html(q.explanation)}</p>`}</li>`).join('')}</ul>` : `<p>${html(strings.none)}</p>`}</div>`;
    }
    result.innerHTML = `<p class="lp-dont-know-summary">${html(summary)}</p>
      <p>${html(format(strings.counts, { right: outcome.right.length, wrong: outcome.wrong.length, unknown: outcome.unknown.length }))}</p>
      ${group(strings.wrong, outcome.wrong, 'wrong')}${group(strings.gaps, outcome.unknown, 'unknown')}${group(strings.right, outcome.right, 'right')}`;
    result.hidden = false; restart.hidden = false; shown = true;
    // One replacement also announces a repeated submission with the same score.
    if (announce) status.textContent = summary;
  }
  const saved = validateState(content, state?.read());
  if (saved) {
    for (const { q, radios } of questions) for (const radio of radios) radio.checked = Object.hasOwn(saved.picks, q.id) && saved.picks[q.id] === radio.value;
    if (saved.shown) show(false);
  }
  for (const question of questions) for (const radio of question.radios) listen(radio, 'change', () => {
    clearQuestionError(question); error.hidden = true; clearResults(); save();
  });
  listen(check, 'click', () => {
    clearErrors();
    const outcome = score(content, picks());
    if (outcome.unanswered.length) {
      clearResults();
      error.textContent = outcome.unanswered.length === 1 ? strings.unansweredOne : format(strings.unanswered, { count: outcome.unanswered.length }); error.hidden = false;
      const missing = questions.filter(({ q }) => outcome.unanswered.includes(q.id));
      for (const { fieldset, radios, message } of missing) {
        message.hidden = false; fieldset.setAttribute('aria-describedby', message.id);
        for (const radio of radios) { radio.setAttribute('aria-describedby', message.id); radio.setAttribute('aria-invalid', 'true'); }
      }
      missing[0]?.radios[0]?.focus(); save(); return;
    }
    show(true); save();
  });
  listen(restart, 'click', () => {
    for (const { radios } of questions) for (const radio of radios) radio.checked = false;
    clearErrors(); clearResults(); questions[0]?.radios[0]?.focus();
    status.textContent = strings.cleared; save();
  });
  fallback.hidden = true; flow.hidden = false;
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const remove of removals) remove();
      flow.hidden = true; fallback.hidden = false; clearErrors(); clearResults();
      status.textContent = ''; instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
