import { DONT_KNOW, displayPoints, format, score, validateContent, validateState } from './logic.js';
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
    const explanation = /** @type {HTMLElement} */ (required(fieldset, '[data-lp-explanation]'));
    const name = radios[0]?.name;
    if (fieldset.dataset.lpQuestion !== q.id || !fieldset.id || fieldset.getAttribute('tabindex') !== '-1' || radios.length !== expected.length || !name || names.has(name) || !message.id || radios.some((radio, n) => radio.type !== 'radio' || radio.value !== expected[n] || radio.name !== name)) throw new Error('Invalid dont-know options markup');
    const rows = radios.map(radio => {
      const row = radio.closest('label');
      if (!row || row.parentElement !== fieldset) throw new Error('Invalid dont-know choice markup');
      return row;
    });
    names.add(name);
    return { q, fieldset, radios, rows, message, explanation };
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
    check.hidden = false;
    for (const { radios, rows, explanation } of questions) {
      for (const radio of radios) radio.disabled = false;
      for (const row of rows) {
        row.removeAttribute('data-lp-mark');
        row.classList.remove('lp-dont-know-unknown');
        row.querySelector('.lp-choice-mark')?.remove();
      }
      explanation.hidden = true;
    }
  }
  /** @param {boolean} announce */
  function show(announce) {
    const selected = picks();
    const outcome = score(content, selected);
    const summary = format(strings.summary, { points: displayPoints(outcome.points), total: displayPoints(outcome.total) });
    for (const { q, radios, rows, explanation } of questions) {
      const right = outcome.right.includes(q.id);
      explanation.hidden = right;
      radios.forEach((radio, index) => {
        radio.disabled = true;
        if (!radio.checked && radio.value !== q.correct) return;
        const row = rows[index];
        const correct = radio.value === q.correct;
        const unknown = radio.value === DONT_KNOW;
        if (unknown) row.classList.add('lp-dont-know-unknown');
        else row.dataset.lpMark = correct ? 'correct' : 'wrong';
        const mark = root.ownerDocument.createElement('span');
        mark.className = `lp-choice-mark ${correct ? 'lp-met' : unknown ? 'lp-neutral' : 'lp-missed'}`;
        const word = correct ? right ? strings.markCorrect : strings.markAnswer : unknown ? strings.markUnknown : strings.markWrong;
        mark.innerHTML = `${correct ? icons.check : unknown ? icons['question-mark'] : icons.x}<span>${html(word)}</span>`;
        row.append(mark);
      });
    }
    const counts = [
      { ids: outcome.right, one: strings.countRightOne, many: strings.countRightMany },
      { ids: outcome.wrong, one: strings.countWrongOne, many: strings.countWrongMany },
      { ids: outcome.unknown, one: strings.countUnknownOne, many: strings.countUnknownMany }
    ].filter(({ ids }) => ids.length).map(({ ids, one, many }) => format(ids.length === 1 ? one : many, { count: ids.length })).join(', ');
    const review = questions.filter(({ q }) => !outcome.right.includes(q.id));
    // Negative scores have an empty ring. Text preserves every authored score and total.
    const progress = outcome.total > 0 ? Math.max(0, Math.min(1, outcome.points / outcome.total)) : 0;
    // Explicit tabindex includes review links in WebKit's keyboard navigation on Windows.
    result.innerHTML = `<div class="lp-dont-know-result-head">
      <svg class="lp-dont-know-score-ring" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <circle class="lp-dont-know-ring-track" cx="32" cy="32" r="29"/>
        <circle class="lp-dont-know-ring-fill" cx="32" cy="32" r="29" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${100 * (1 - progress)}" transform="rotate(-90 32 32)"/>
      </svg>
      <div><p class="lp-stem" data-lp-score tabindex="-1">${html(summary)}</p>
        <p class="lp-small" data-lp-counts>${html(counts)}</p></div>
      </div>
      ${review.length ? `<div class="lp-dont-know-review" data-lp-review><h3 class="lp-run-in">${html(strings.review)}</h3>
        <ul>${review.map(({ q, fieldset }) => `<li><a href="#${html(fieldset.id)}" tabindex="0">${icons['arrow-right']}<span>${html(q.text)}</span></a></li>`).join('')}</ul></div>` : ''}`;
    // A result replaces any earlier status, such as "Cleared." after Start over.
    status.replaceChildren();
    result.hidden = false; restart.hidden = false; check.hidden = true; shown = true;
    if (announce) {
      // Focus already reads the score; repeating it in status would speak it twice.
      /** @type {HTMLElement} */ (required(result, '[data-lp-score]')).focus();
    }
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
      clearResults();
      const message = outcome.unanswered.length === 1 ? strings.unansweredOne : format(strings.unanswered, { count: outcome.unanswered.length });
      error.innerHTML = `${icons['alert-circle']}<span>${html(message)}</span>`; error.hidden = false;
      const missing = questions.filter(({ q }) => outcome.unanswered.includes(q.id));
      for (const { fieldset, radios, message } of missing) {
        message.hidden = false; fieldset.setAttribute('aria-describedby', message.id);
        for (const radio of radios) radio.setAttribute('aria-invalid', 'true');
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
