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
  const stepper = /** @type {HTMLElement} */ (required(root, '[data-lp-stepper]'));
  const outlinePanel = /** @type {HTMLElement} */ (required(root, '[data-lp-panel="outline"]'));
  const outlineHeading = /** @type {HTMLElement} */ (required(root, '[data-lp-outline-heading]'));
  const questionList = /** @type {HTMLElement} */ (required(root, '[data-lp-questions]'));
  const review = /** @type {HTMLDetailsElement} */ (required(root, '[data-lp-review]'));
  const intro = /** @type {HTMLElement} */ (required(root, '[data-lp-intro]'));
  const startActions = content.allowTestOut ? /** @type {HTMLElement} */ (required(root, '[data-lp-start-actions]')) : null;
  const start = content.allowTestOut ? /** @type {HTMLButtonElement} */ (required(root, '[data-lp-start]')) : null;
  const restartActions = /** @type {HTMLElement} */ (required(root, '[data-lp-restart-actions]'));
  const fallback = /** @type {HTMLElement} */ (required(root, '[data-lp-fallback]'));
  const result = /** @type {HTMLElement} */ (required(root, '[data-lp-result]'));
  const restart = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-restart]'));
  const status = /** @type {HTMLElement} */ (required(root, '[role="status"]'));
  const outline = [...root.querySelectorAll('[data-lp-section-status]')].map(el => /** @type {HTMLElement} */ (el));
  if (outline.length !== content.sections.length || outline.some((el, i) => el.dataset.lpSectionStatus !== String(content.sections[i].id))) throw new Error('Invalid test-out outline markup');
  const credits = [...root.querySelectorAll('[data-lp-credit]')].map(el => /** @type {HTMLElement} */ (el));
  if (credits.length !== content.sections.length) throw new Error('Invalid test-out credit markup');
  const fieldsets = [...root.querySelectorAll('fieldset')];
  if (fieldsets.length !== content.questions.length) throw new Error('Invalid test-out questions markup');
  const names = new Set();
  const questions = fieldsets.map(fieldset => {
    const q = content.questions.find(question => question.id === fieldset.dataset.lpQuestion);
    if (!q || !fieldset.id || fieldset.getAttribute('tabindex') !== '-1') throw new Error('Invalid test-out question markup');
    const radios = [...fieldset.querySelectorAll('input')];
    const message = /** @type {HTMLElement} */ (required(fieldset, '[data-lp-question-error]'));
    const explanation = /** @type {HTMLElement} */ (required(fieldset, '[data-lp-explanation]'));
    const panel = fieldset.parentElement;
    if (!panel || panel.dataset.lpPanel !== 'question') throw new Error('Invalid test-out panel markup');
    const heading = /** @type {HTMLElement} */ (required(panel, '[data-lp-panel-heading]'));
    const navigation = /** @type {HTMLElement} */ (required(panel, '[data-lp-navigation]'));
    const back = /** @type {HTMLButtonElement} */ (required(panel, '[data-lp-back]'));
    const next = /** @type {HTMLButtonElement} */ (required(panel, '[data-lp-next], [data-lp-check]'));
    const name = radios[0]?.name;
    if (radios.length !== q.options.length || !name || names.has(name) || !message.id || radios.some((radio, n) => radio.type !== 'radio' || radio.value !== q.options[n].id || radio.name !== name)) throw new Error('Invalid test-out options markup');
    const rows = radios.map(radio => {
      const row = radio.closest('label');
      if (!row || row.parentElement !== fieldset) throw new Error('Invalid test-out choice markup');
      return row;
    });
    names.add(name);
    return { q, fieldset, radios, rows, message, explanation, panel, heading, navigation, back, next };
  });
  if (new Set(questions.map(({ q }) => q.id)).size !== content.questions.length) throw new Error('Invalid test-out questions markup');
  let shown = false;
  let step = 0;
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
  const save = () => state?.write({ picks: picks(), shown, step });
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
    for (const question of questions) clearQuestionError(question);
  }
  /** Switch real panels; hidden panels have no focusable controls. Restore is silent.
   * @param {number} nextStep @param {boolean} notify
   */
  function move(nextStep, notify) {
    const previous = step;
    step = nextStep;
    outlinePanel.hidden = step > 0 && step <= questions.length;
    questionList.hidden = step === 0;
    for (const [index, { panel, navigation }] of questions.entries()) {
      panel.hidden = !shown && step !== index + 1;
      panel.classList.toggle('lp-section', shown);
      panel.classList.remove('lp-test-out-enter');
      navigation.hidden = shown;
    }
    outlinePanel.classList.remove('lp-test-out-enter');
    if (!notify) return;
    const panel = outlinePanel.hidden ? questions[step - 1].panel : outlinePanel;
    const heading = outlinePanel.hidden ? questions[step - 1].heading : outlineHeading;
    panel.style.setProperty('--lp-test-out-enter-x', step < previous ? '-16px' : '16px');
    // Reflow lets a revisited panel run the same entrance again.
    void panel.offsetWidth;
    panel.classList.add('lp-test-out-enter');
    heading.focus();
    announce(shown ? result.textContent ?? '' : heading.textContent ?? '');
  }
  /** @param {import('./logic.js').PlanRow[]} rows */
  function showOutline(rows) {
    rows.forEach((row, i) => {
      const by = content.sections.find(s => s.id === row.by);
      const word = row.action === 'passed' ? strings.passed : row.action === 'credited' ? strings.credited : strings.todo;
      outline[i].hidden = false;
      outline[i].classList.toggle('lp-met', row.action !== 'take');
      outline[i].classList.toggle('lp-neutral', row.action === 'take');
      outline[i].innerHTML = `${row.action === 'passed' ? icons.check : row.action === 'credited' ? icons['arrow-right'] : icons['circle-dashed']}<span>${html(word)}</span>`;
      credits[i].hidden = row.action !== 'credited';
      credits[i].textContent = row.action === 'credited' ? format(strings.creditFrom, { section: by?.title ?? '' }) : '';
    });
  }
  function clearResults() {
    result.textContent = ''; result.hidden = true; restart.hidden = true; shown = false;
    restartActions.hidden = true; review.hidden = true; review.open = false; intro.hidden = false;
    if (startActions) startActions.hidden = false;
    stepper.append(questionList);
    for (const el of outline) { el.hidden = true; el.textContent = ''; el.classList.remove('lp-met', 'lp-neutral'); }
    for (const el of credits) { el.hidden = true; el.textContent = ''; }
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
    intro.hidden = true; if (startActions) startActions.hidden = true;
    review.hidden = false; restartActions.hidden = false; review.append(questionList);
    move(questions.length + 1, notify);
  }
  const saved = validateState(content, state?.read());
  clearResults();
  if (saved) {
    for (const { q, radios } of questions) for (const radio of radios) radio.checked = Object.hasOwn(saved.picks, q.id) && saved.picks[q.id] === radio.value;
    if (saved.shown) show(false);
  }
  move(saved?.step ?? 0, false);
  if (start) listen(start, 'click', () => { move(1, true); save(); });
  for (const [index, question] of questions.entries()) {
    for (const radio of question.radios) listen(radio, 'change', () => {
      clearQuestionError(question); save();
    });
    listen(question.back, 'click', () => { move(index, true); save(); });
    listen(question.next, 'click', () => {
      if (shown) return;
      clearErrors();
      const { fieldset, radios, message } = question;
      if (!radios.some(radio => radio.checked)) {
        message.hidden = false; fieldset.setAttribute('aria-describedby', message.id);
        for (const radio of radios) { radio.setAttribute('aria-describedby', message.id); radio.setAttribute('aria-invalid', 'true'); }
        announce(strings.choose); save(); return;
      }
      if (index < questions.length - 1) move(index + 2, true);
      else {
        // A host may restore a later question with earlier answers missing.
        const unanswered = questions.findIndex(({ radios }) => !radios.some(radio => radio.checked));
        if (unanswered !== -1) { move(unanswered + 1, true); save(); return; }
        show(true);
      }
      save();
    });
  }
  listen(restart, 'click', () => {
    for (const { radios } of questions) for (const radio of radios) radio.checked = false;
    clearErrors(); clearResults(); move(0, true); save();
  });
  fallback.hidden = true;
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const remove of removals) remove();
      fallback.hidden = false; clearErrors(); clearResults();
      outlinePanel.hidden = false; questionList.hidden = false;
      if (startActions) startActions.hidden = true;
      for (const { panel, navigation } of questions) { panel.hidden = false; panel.classList.add('lp-section'); navigation.hidden = true; panel.classList.remove('lp-test-out-enter'); }
      outlinePanel.classList.remove('lp-test-out-enter');
      status.textContent = ''; instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
