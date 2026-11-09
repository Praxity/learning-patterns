import { focusQuestion } from '../../lib/question-errors.js';
import { frenchTypography } from '../../lib/html.js';
import { clearChoice, markChoice } from '../../lib/choice-mark.js';
import { lock } from '../../lib/lock.js';
import { reveal } from '../../lib/reveal.js';
import { answer, emptyState, format, move, nextStep, result, validateContent, validateState } from './logic.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();
const ENTER = 'lp-finish-worked-example-enter';

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  /** @param {ParentNode} parent @param {string} selector @returns {HTMLElement} */
  function required(parent, selector) {
    const element = parent.querySelector(selector);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing finish-worked-example markup: ${selector}`);
    return element;
  }
  /** @param {ParentNode} parent @param {string} selector */
  const optional = (parent, selector) => /** @type {HTMLElement | null} */ (parent.querySelector(selector));
  /** @param {string} value */
  const display = value => frenchTypography(value, root.lang);
  const status = required(root, '[role="status"]');
  const last = content.cases.length - 1;
  const cases = [...root.querySelectorAll('[data-lp-case]')].map((panel, c) => {
    const steps = [...panel.querySelectorAll('[data-lp-step]')].map((item, s) => {
      if (content.cases[c]?.steps[s]?.worked) return { body: required(item, '[data-lp-body]'), question: null };
      const fieldset = required(item, 'fieldset');
      const radios = [...fieldset.querySelectorAll('input')];
      if (radios.length !== content.steps[s]?.options.length || radios.some((radio, n) => radio.type !== 'radio' || radio.value !== String(n))) throw new Error('Invalid finish-worked-example options markup');
      const rows = radios.map(radio => /** @type {HTMLElement} */ (radio.closest('label')));
      return { body: null, question: {
        item: /** @type {HTMLElement} */ (item), fieldset, radios, rows,
        message: required(fieldset, '[data-lp-question-error]'), feedback: required(item, '[data-lp-feedback]'),
        actions: required(item, '[data-lp-step-actions]'), check: required(item, '[data-lp-check]')
      } };
    });
    if (steps.length !== content.steps.length) throw new Error('Invalid finish-worked-example steps markup');
    return {
      panel: /** @type {HTMLElement} */ (panel), steps,
      heading: required(panel, '[data-lp-case-heading]'), nav: required(panel, '[data-lp-nav]'),
      next: optional(panel, '[data-lp-next]'), back: optional(panel, '[data-lp-back]'),
      restart: optional(panel, '[data-lp-restart]'), summary: optional(panel, '[data-lp-result]'),
      fallback: optional(panel, '[data-lp-fallback]')
    };
  });
  if (cases.length !== content.cases.length) throw new Error('Invalid finish-worked-example cases markup');
  const lifetime = new AbortController();
  /** @type {(() => void)[]} */
  const unlocks = [];
  let destroyed = false;
  let current = validateState(content, state?.read()) ?? emptyState(content);
  const save = () => state?.write({ at: current.at, picks: current.picks.map(row => [...row]) });

  /** @param {NonNullable<typeof cases[number]['steps'][number]['question']>} question */
  function clearError({ message, radios }) {
    message.hidden = true;
    for (const radio of radios) { radio.removeAttribute('aria-describedby'); radio.removeAttribute('aria-invalid'); }
  }
  /** Show which steps are open. A step waits for the learner's steps before it, so its answer
   * can still be their own; a waiting step shows its number and question only.
   * @param {number} c */
  function paint(c) {
    const { steps, next, restart, summary } = cases[c];
    const active = nextStep(content, current, c);
    steps.forEach(({ body, question }, s) => {
      if (body) body.hidden = active !== -1 && s > active;
      if (!question) return;
      const answered = current.picks[c][s] !== null;
      for (const row of question.rows) row.hidden = !answered && s !== active;
      question.actions.hidden = s !== active;
    });
    if (next) next.hidden = active !== -1;
    const outcome = result(content, current);
    if (restart) restart.hidden = !outcome.done;
    if (summary) {
      summary.hidden = !outcome.done;
      summary.textContent = outcome.done ? display(format(strings.result, { right: outcome.right, total: outcome.total })) : '';
    }
  }
  /** Mark the learner's checked step and put the reason beside it.
   * @param {number} c @param {number} s @param {boolean} restoring */
  function showAnswer(c, s, restoring) {
    const { question } = cases[c].steps[s];
    const pick = current.picks[c][s];
    if (!question || pick === null) return;
    const { answer: correct, reason } = content.cases[c].steps[s];
    question.radios[pick].checked = true;
    // Mark only what the learner chose; a missed correct answer is neutral.
    markChoice(question.rows[pick], pick === correct ? 'correct' : 'wrong', strings, root.lang);
    if (pick !== correct) markChoice(question.rows[correct], 'missed', strings, root.lang);
    // The rows already show the verdict. Focus reads this line, so it repeats the verdict for screen readers only.
    const verdict = root.ownerDocument.createElement('span');
    verdict.className = 'lp-visually-hidden';
    verdict.textContent = `${display(pick === correct ? strings.feedbackCorrect : format(strings.feedbackWrong, { answer: content.steps[s].options[correct] }))} `;
    question.feedback.replaceChildren(verdict, display(reason));
    question.feedback.hidden = false;
    if (restoring) unlocks.push(lock(question.item, { focus: false }));
  }
  function clearAnswers() {
    for (const unlock of unlocks.splice(0)) unlock();
    for (const { steps } of cases) for (const { question } of steps) {
      if (!question) continue;
      clearError(question);
      question.rows.forEach(clearChoice);
      for (const radio of question.radios) radio.checked = false;
      question.feedback.replaceChildren(); question.feedback.hidden = true;
    }
  }
  /** Switch cases. Hidden cases hold no focusable controls. Restore is silent.
   * @param {number} c @param {number} [from] The case the learner left; omit when restoring. */
  function show(c, from) {
    for (const [i, { panel }] of cases.entries()) { panel.hidden = i !== c; panel.classList.remove(ENTER); }
    paint(c);
    if (from === undefined) return;
    const { panel, heading } = cases[c];
    panel.style.setProperty('--lp-finish-worked-example-enter-x', c < from ? '-16px' : '16px');
    // Reflow lets a revisited case run the same entrance again.
    void panel.offsetWidth;
    panel.classList.add(ENTER);
    // The heading holds the case number and how many steps are the learner's, so focus reads both.
    heading.focus();
    status.replaceChildren();
  }
  /** @param {number} c */
  function go(c) {
    const from = current.at;
    current = move(content, current, c);
    show(c, from); save();
  }
  /** @param {number} c @param {number} s */
  function check(c, s) {
    const { question } = cases[c].steps[s];
    if (!question || current.picks[c][s] !== null) return;
    const pick = question.radios.findIndex(radio => radio.checked);
    if (pick === -1) {
      // Each radio carries the message, so focus on the first one reads it once.
      question.message.hidden = false;
      for (const radio of question.radios) { radio.setAttribute('aria-describedby', question.message.id); radio.setAttribute('aria-invalid', 'true'); }
      focusQuestion(question.fieldset);
      return;
    }
    current = answer(content, current, c, s, pick);
    showAnswer(c, s, false);
    paint(c);
    // Focus moves to the reason before the controls freeze, so it is read once and Tab continues to the next step.
    reveal(question.feedback);
    question.feedback.focus({ preventScroll: true });
    unlocks.push(lock(question.item));
    const outcome = result(content, current);
    if (outcome.done) status.textContent = display(format(strings.result, { right: outcome.right, total: outcome.total }));
    save();
  }

  for (const [c, { steps, nav, next, back, restart, fallback }] of cases.entries()) {
    nav.hidden = false;
    if (fallback) fallback.hidden = true;
    const options = { signal: lifetime.signal };
    next?.addEventListener('click', () => go(c + 1), options);
    back?.addEventListener('click', () => go(c - 1), options);
    restart?.addEventListener('click', () => {
      clearAnswers();
      current = emptyState(content);
      show(0, last); save();
    }, options);
    for (const [s, { question }] of steps.entries()) {
      if (!question) continue;
      question.check.addEventListener('click', () => check(c, s), options);
      for (const radio of question.radios) radio.addEventListener('change', () => clearError(question), options);
      showAnswer(c, s, true);
    }
  }
  show(current.at);

  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      lifetime.abort();
      clearAnswers();
      // Back to the server markup: every case open, answers in their disclosures.
      for (const [c, { panel, steps, nav, next, restart, summary, fallback }] of cases.entries()) {
        panel.hidden = false; panel.classList.remove(ENTER); panel.style.removeProperty('--lp-finish-worked-example-enter-x');
        nav.hidden = true;
        if (fallback) fallback.hidden = false;
        if (next) next.hidden = true;
        if (restart) restart.hidden = true;
        if (summary) { summary.hidden = true; summary.textContent = ''; }
        const first = content.cases[c].steps.findIndex(step => !step.worked);
        steps.forEach(({ body, question }, s) => {
          if (body) body.hidden = first !== -1 && s > first;
          if (!question) return;
          for (const row of question.rows) row.hidden = false;
          question.actions.hidden = true;
        });
      }
      status.textContent = '';
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
