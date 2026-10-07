import { format, score, validateContent, validateState } from './logic.js';
import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';

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
    if (!element) throw new Error(`Missing test-out markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  const flow = /** @type {HTMLElement} */ (required(root, '[data-lp-flow]'));
  const fallback = /** @type {HTMLElement} */ (required(root, '[data-lp-fallback]'));
  const error = /** @type {HTMLElement} */ (required(root, '[data-lp-error]'));
  const result = /** @type {HTMLElement} */ (required(root, '[data-lp-result]'));
  const restart = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-restart]'));
  const check = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-check]'));
  const status = /** @type {HTMLElement} */ (required(root, '[role="status"]'));
  const outline = [...root.querySelectorAll('[data-lp-section-status]')].map(el => /** @type {HTMLElement} */ (el));
  if (outline.length !== content.sections.length || outline.some((el, i) => el.dataset.lpSectionStatus !== String(content.sections[i].id))) throw new Error('Invalid test-out outline markup');
  const fieldsets = [...root.querySelectorAll('fieldset')];
  if (fieldsets.length !== content.questions.length) throw new Error('Invalid test-out questions markup');
  const names = new Set();
  const questions = fieldsets.map(fieldset => {
    const q = content.questions.find(question => question.id === fieldset.dataset.lpQuestion);
    if (!q || !fieldset.id || fieldset.getAttribute('tabindex') !== '-1') throw new Error('Invalid test-out question markup');
    const radios = [...fieldset.querySelectorAll('input')];
    const message = /** @type {HTMLElement} */ (required(fieldset, '[data-lp-question-error]'));
    const explanation = /** @type {HTMLElement} */ (required(fieldset, '[data-lp-explanation]'));
    const name = radios[0]?.name;
    if (radios.length !== q.options.length || !name || names.has(name) || !message.id || radios.some((radio, n) => radio.type !== 'radio' || radio.value !== q.options[n].id || radio.name !== name)) throw new Error('Invalid test-out options markup');
    const rows = radios.map(radio => {
      const row = radio.closest('label');
      if (!row || row.parentElement !== fieldset) throw new Error('Invalid test-out choice markup');
      return row;
    });
    names.add(name);
    return { q, fieldset, radios, rows, message, explanation };
  });
  if (new Set(questions.map(({ q }) => q.id)).size !== content.questions.length) throw new Error('Invalid test-out questions markup');
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
  /** @param {string} message */
  function announce(message) {
    if (status.textContent !== message) status.textContent = message;
  }
  /** @param {typeof questions[number]} question */
  function clearQuestionError({ fieldset, radios, message }) {
    message.hidden = true; fieldset.removeAttribute('aria-describedby');
    for (const radio of radios) { radio.removeAttribute('aria-describedby'); radio.removeAttribute('aria-invalid'); }
  }
  function clearErrors() {
    error.hidden = true; error.textContent = '';
    for (const question of questions) clearQuestionError(question);
  }
  /** @param {import('./logic.js').PlanRow[]} rows */
  function showOutline(rows) {
    rows.forEach((row, i) => {
      const by = content.sections.find(s => s.id === row.by);
      const word = row.action === 'passed' ? strings.passed : row.action === 'credited' ? format(strings.credited, { section: by?.title ?? '' }) : strings.todo;
      outline[i].classList.toggle('lp-met', row.action !== 'take');
      outline[i].classList.toggle('lp-neutral', row.action === 'take');
      outline[i].innerHTML = `${row.action === 'passed' ? icons.check : row.action === 'credited' ? icons['arrow-right'] : icons['circle-dashed']}<span>${html(word)}</span>`;
    });
  }
  function clearResults() {
    result.textContent = ''; result.hidden = true; restart.hidden = true; shown = false;
    check.removeAttribute('aria-disabled');
    showOutline(content.sections.map(s => ({ id: s.id, title: s.title, action: 'take' })));
    for (const { radios, rows, explanation } of questions) {
      for (const radio of radios) radio.disabled = false;
      for (const row of rows) { row.removeAttribute('data-lp-mark'); row.querySelector('.lp-choice-mark')?.remove(); }
      explanation.hidden = true;
    }
  }
  /** @param {boolean} notify */
  function show(notify) {
    const outcome = score(content, picks());
    const summary = format(outcome.skip === 1 ? strings.summaryOne : strings.summary, { skip: outcome.skip, total: content.sections.length });
    for (const { q, radios, rows, explanation } of questions) {
      const right = outcome.right.includes(q.id);
      explanation.hidden = right;
      radios.forEach((radio, i) => {
        radio.disabled = true;
        if (!radio.checked && radio.value !== q.correct) return;
        const correct = radio.value === q.correct;
        rows[i].dataset.lpMark = correct ? 'correct' : 'wrong';
        const mark = root.ownerDocument.createElement('span');
        mark.className = `lp-choice-mark ${correct ? 'lp-met' : 'lp-missed'}`;
        mark.innerHTML = `${correct ? icons.check : icons.x}<span>${html(correct ? right ? strings.markCorrect : strings.markAnswer : strings.markWrong)}</span>`;
        rows[i].append(mark);
      });
    }
    showOutline(outcome.rows);
    result.textContent = summary; result.hidden = false; restart.hidden = false; shown = true;
    // aria-disabled keeps the submit button focused while preventing another submission.
    check.setAttribute('aria-disabled', 'true');
    if (notify) announce(summary);
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
    if (shown) return;
    clearErrors();
    const outcome = score(content, picks());
    if (outcome.unanswered.length) {
      const word = outcome.unanswered.length === 1 ? strings.unansweredOne : format(strings.unanswered, { count: outcome.unanswered.length });
      error.innerHTML = `${icons['alert-circle']}<span>${html(word)}</span>`; error.hidden = false;
      for (const { q, fieldset, radios, message } of questions) {
        if (!outcome.unanswered.includes(q.id)) continue;
        message.hidden = false; fieldset.setAttribute('aria-describedby', message.id);
        for (const radio of radios) { radio.setAttribute('aria-describedby', message.id); radio.setAttribute('aria-invalid', 'true'); }
      }
      announce(word); save(); return;
    }
    show(true); save();
  });
  listen(restart, 'click', () => {
    for (const { radios } of questions) for (const radio of radios) radio.checked = false;
    clearErrors(); clearResults(); questions[0]?.radios[0]?.focus(); announce(strings.cleared); save();
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
