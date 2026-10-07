import { icons } from '../../lib/icons.js';
import { FORMATS, checkQuizAnswer, movePlace, switchFormat, validateContent, validateState } from './logic.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();
/** @typedef {{ element: HTMLElement, fieldset: HTMLFieldSetElement, check: HTMLButtonElement, error: HTMLElement, rows: { input: HTMLInputElement, row: HTMLLabelElement, word: HTMLElement, feedback: HTMLElement }[] }} QuestionBlock */

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options
 */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  /** @template {Element} T @param {Element} parent @param {string} selector @returns {T} */
  function required(parent, selector) {
    const element = parent.querySelector(selector);
    if (!element) throw new Error(`Missing formats markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  /** @param {boolean} valid @param {string} field */
  function markup(valid, field) { if (!valid) throw new Error(`Invalid formats markup: ${field}`); }

  // Check every block before revealing controls or attaching listeners.
  const status = /** @type {HTMLElement} */ (required(root, '[role="status"]'));
  const switcher = /** @type {HTMLElement} */ (required(root, '[data-lp-formats]'));
  const lesson = /** @type {HTMLElement} */ (required(root, '.lp-formats-lesson'));
  const buttons = [...switcher.querySelectorAll('button')];
  markup(buttons.length === FORMATS.length && buttons.every((button, i) => button.dataset.lpFormat === FORMATS[i]), 'formats');
  const place = /** @type {HTMLElement} */ (required(root, '[data-lp-place]'));
  const navigation = /** @type {HTMLElement} */ (required(root, '[data-lp-navigation]'));
  const previous = /** @type {HTMLButtonElement} */ (required(navigation, '[data-lp-previous]'));
  const next = /** @type {HTMLButtonElement} */ (required(navigation, '[data-lp-next]'));
  const summary = /** @type {HTMLElement} */ (required(root, '[data-lp-summary]'));
  const quizSummary = /** @type {HTMLElement} */ (required(summary, '[data-lp-quiz-summary]'));
  const sections = [...root.querySelectorAll('[data-lp-point]')];
  markup(sections.length === content.points.length, 'section count');
  const blocks = sections.map((section, i) => {
    markup(section.getAttribute('data-lp-point') === content.points[i]?.id, 'section identity');
    const views = [...section.querySelectorAll('[data-lp-view]')];
    markup(views.length === FORMATS.length && views.every((view, j) => view.getAttribute('data-lp-view') === FORMATS[j]), 'views');
    return { section: /** @type {HTMLElement} */ (section), views: /** @type {HTMLElement[]} */ (views) };
  });
  const questionElements = [...root.querySelectorAll('[data-lp-question]')];
  markup(questionElements.length === content.quiz.length, 'question count');
  /** @type {QuestionBlock[]} */
  const questions = questionElements.map((element, q) => {
    const question = content.quiz[q];
    markup(element.getAttribute('data-lp-question') === String(q) && element.closest('[data-lp-point]')?.getAttribute('data-lp-point') === question?.section, 'question identity');
    const fieldset = /** @type {HTMLFieldSetElement} */ (required(element, 'fieldset'));
    const check = /** @type {HTMLButtonElement} */ (required(element, '[data-lp-check]'));
    const error = /** @type {HTMLElement} */ (required(element, '[data-lp-error]'));
    const inputs = /** @type {HTMLInputElement[]} */ ([...fieldset.querySelectorAll('input[type="radio"]')]);
    markup(inputs.length === question.options.length && inputs.every((input, o) => input.value === String(o)), 'options');
    const rows = inputs.map(input => {
      const row = input.closest('label');
      if (!row) throw new Error('Missing formats markup: choice row');
      const word = /** @type {HTMLElement} */ (required(row, '[data-lp-mark-word]'));
      const feedback = /** @type {HTMLElement} */ (required(row, '[data-lp-feedback]'));
      return { input, row, word, feedback };
    });
    return { element: /** @type {HTMLElement} */ (element), fieldset, check, error, rows };
  });

  let current = validateState(content, state?.read()) ?? { format: 'text', section: 0 };
  let destroyed = false;
  const checked = new Set();
  /** @type {(() => void)[]} */
  const removals = [];
  /** @param {EventTarget} target @param {string} event @param {() => void} handler */
  function listen(target, event, handler) {
    target.addEventListener(event, handler);
    removals.push(() => target.removeEventListener(event, handler));
  }
  /** @param {string} template @param {Record<string, string | number>} values @returns {string} */
  function fill(template, values) {
    return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
  }
  function showSummary() {
    summary.hidden = current.section !== content.points.length - 1;
    quizSummary.hidden = current.format !== 'quiz';
    quizSummary.textContent = fill(strings.quizSummary, { count: checked.size, total: content.quiz.length });
  }
  /** @type {{ view: HTMLElement, animations: Animation[] } | undefined} */
  let fading;
  function stopFade() {
    if (!fading) return;
    fading.animations.forEach(animation => animation.cancel());
    fading.view.hidden = true;
    fading.view.inert = false;
    fading.view.removeAttribute('aria-hidden');
    fading.view.classList.remove('lp-formats-exiting');
    fading = undefined;
  }
  const motion = root.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion) listen(motion, 'change', stopFade);
  /** @param {HTMLElement} outgoing */
  function crossFade(outgoing) {
    if (motion?.matches) return;
    const incoming = blocks[current.section].views[FORMATS.indexOf(current.format)];
    const duration = parseFloat(getComputedStyle(lesson).getPropertyValue('--lp-formats-fade-duration'));
    // Keep the outgoing view only for the visual overlap; it is inert and unannounced.
    outgoing.hidden = false; outgoing.inert = true; outgoing.setAttribute('aria-hidden', 'true');
    outgoing.classList.add('lp-formats-exiting');
    const leaving = outgoing.animate({ opacity: [1, 0] }, { duration, easing: 'ease-in-out' });
    const entering = incoming.animate({ opacity: [0, 1] }, { duration, easing: 'ease-in-out' });
    fading = { view: outgoing, animations: [leaving, entering] };
    leaving.onfinish = stopFade;
  }
  function show() {
    stopFade();
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(FORMATS[i] === current.format)));
    blocks.forEach((block, i) => {
      block.section.hidden = i !== current.section;
      block.views.forEach((view, j) => { view.hidden = FORMATS[j] !== current.format; });
    });
    place.textContent = fill(strings.place, { n: current.section + 1, total: content.points.length });
    navigation.setAttribute('aria-label', place.textContent);
    previous.hidden = current.section === 0;
    next.hidden = current.section === content.points.length - 1;
    showSummary();
  }
  function changed() {
    show(); state?.write({ ...current });
    status.textContent = fill(strings.showing, { format: strings[current.format], n: current.section + 1 });
  }
  /** @param {QuestionBlock} block */
  function clearFeedback(block) {
    block.error.hidden = true; block.fieldset.removeAttribute('aria-invalid');
    block.rows.forEach(({ row, word, feedback }) => {
      row.removeAttribute('data-lp-mark'); word.hidden = true; word.replaceChildren(); feedback.hidden = true;
    });
  }
  /** @param {QuestionBlock} block @returns {boolean} */
  function activeQuestion(block) {
    return current.format === 'quiz' && block.element.closest('[data-lp-point]')?.getAttribute('data-lp-point') === content.points[current.section]?.id;
  }
  buttons.forEach((button, i) => listen(button, 'click', () => {
    const format = FORMATS[i];
    if (switcher.hidden || format === current.format) return;
    const outgoing = blocks[current.section].views[FORMATS.indexOf(current.format)];
    current = switchFormat(current, format); changed();
    crossFade(outgoing);
  }));
  for (const [button, action] of /** @type {const} */ ([[previous, 'previous'], [next, 'next']])) {
    listen(button, 'click', () => {
      if (navigation.hidden) return;
      const section = movePlace(current.section, action, content.points.length);
      if (section === current.section) return;
      current = { ...current, section }; changed();
    });
  }
  questions.forEach((question, q) => {
    question.rows.forEach(({ input }) => listen(input, 'change', () => {
      if (!activeQuestion(question)) return;
      clearFeedback(question); checked.delete(q); showSummary();
    }));
    listen(question.check, 'click', () => {
      if (!activeQuestion(question)) return;
      const selected = question.rows.findIndex(({ input }) => input.checked);
      if (selected < 0) {
        question.error.hidden = false; question.fieldset.setAttribute('aria-invalid', 'true');
        status.textContent = strings.choose; return;
      }
      const result = checkQuizAnswer(q, selected, content.quiz);
      const row = question.rows[selected];
      if (!row) throw new Error('Invalid formats markup: selected option');
      clearFeedback(question); checked.add(q);
      row.row.dataset.lpMark = result.correct ? 'correct' : 'wrong';
      row.word.className = `lp-choice-mark ${result.correct ? 'lp-met' : 'lp-missed'}`;
      // Icons are trusted shared assets; authored strings always enter as text nodes.
      row.word.innerHTML = result.correct ? icons.check : icons.x;
      row.word.append(root.ownerDocument.createTextNode(result.correct ? strings.correct : strings.wrong));
      row.word.hidden = false; row.feedback.hidden = false;
      showSummary(); status.textContent = `${result.correct ? strings.correct : strings.wrong}. ${result.feedback}`;
    });
  });
  show(); switcher.hidden = false; navigation.hidden = false; place.hidden = false;
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true; stopFade(); removals.forEach(remove => remove());
      switcher.hidden = true; navigation.hidden = true; place.hidden = true; summary.hidden = false; quizSummary.hidden = true;
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === 0)));
      blocks.forEach(block => { block.section.hidden = false; block.views.forEach((view, i) => { view.hidden = i !== 0; }); });
      questions.forEach(question => { clearFeedback(question); question.rows.forEach(({ input }) => { input.checked = false; }); });
      status.replaceChildren(); instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
