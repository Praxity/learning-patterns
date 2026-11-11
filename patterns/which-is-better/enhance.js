import { answer, answerText, format, score, validateState } from './logic.js';
import { frenchTypography } from '../../lib/html.js';
import { clearChoice, markChoice } from '../../lib/choice-mark.js';
import { lock } from '../../lib/lock.js';
import { reveal } from '../../lib/reveal.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options
 */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  score(content, []);
  /** @param {string} selector @returns {HTMLElement} */
  function required(selector) {
    const element = root.querySelector(selector);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing which-is-better markup: ${selector}`);
    return element;
  }
  const fallback = required('[data-lp-fallback]'), step = required('[data-lp-step]'), group = required('[role="group"]');
  const question = required('[data-lp-question]'), progress = required('[data-lp-progress]'), questionText = required('[data-lp-question-text]');
  const error = required('[data-lp-error]'), feedback = required('[data-lp-feedback]'), verdict = required('[data-lp-verdict]'), reason = required('[data-lp-reason]');
  const check = required('[data-lp-check]'), next = required('[data-lp-next]');
  const end = required('[data-lp-summary]'), result = required('[data-lp-result]'), restart = required('[data-lp-restart]');
  const status = required('[role="status"]');
  const rows = [...group.querySelectorAll('button[data-lp-pick]')].map(row => /** @type {HTMLButtonElement} */ (row));
  const total = content.qualities.length;
  const lifetime = new AbortController();
  let at = 0;
  /** Checked picks, in question order. The open question's choice lives in the pressed button only.
   * @type {string[]} */
  let picks = [];
  /** @type {(() => void) | null} */
  let unlock = null;
  let destroyed = false;
  const text = (/** @type {string} */ value) => frenchTypography(value, root.lang);
  const save = () => state?.write({ at, picks: [...picks] });
  const pressed = () => rows.find(row => row.getAttribute('aria-pressed') === 'true');
  /** Bring a line to the top of the view unless all of it is visible. On a phone the rows and the
   * button sit a screen below the question, so a new question or an error would open out of sight.
   * @param {HTMLElement} element */
  function toTop(element) {
    const view = root.ownerDocument.defaultView, box = element.getBoundingClientRect();
    if (!view) return;
    const top = parseFloat(view.getComputedStyle(root.ownerDocument.documentElement).scrollPaddingTop) || 0;
    if (box.top < top - 1 || box.bottom > view.innerHeight + 1) element.scrollIntoView({ block: 'start' });
  }

  function clearError() {
    error.hidden = true;
    for (const row of rows) row.removeAttribute('aria-describedby');
  }
  /** Show question i open, with nothing chosen. @param {number} i */
  function open(i) {
    unlock?.(); unlock = null;
    clearError();
    for (const row of rows) { row.setAttribute('aria-pressed', 'false'); clearChoice(row); }
    progress.textContent = text(format(strings.progress, { n: i + 1, total }));
    questionText.textContent = text(content.qualities[i].question);
    feedback.hidden = true; verdict.textContent = ''; reason.textContent = '';
    check.hidden = false; next.hidden = true;
    step.hidden = false; end.hidden = true;
  }
  /** Mark question i's checked pick, lock its rows and offer the next step. @param {number} i */
  function marked(i) {
    const right = answer(content, i), pick = picks[i];
    for (const row of rows) {
      const value = row.dataset.lpPick;
      row.setAttribute('aria-pressed', String(value === pick));
      // Mark only what the learner chose; a correct answer they missed is neutral.
      if (value === pick) markChoice(row, pick === right ? 'correct' : 'wrong', strings, root.lang);
      else if (value === right) markChoice(row, 'missed', strings, root.lang);
    }
    // The marks sit on the rows; screen readers get the same result at the start of the feedback.
    verdict.textContent = text(pick === right ? `${strings.markCorrect}. ` : `${strings.markWrong}. ${format(strings.correct, { answer: answerText(content, strings, i) })} `);
    reason.textContent = text(content.qualities[i].reason);
    feedback.hidden = false;
    check.hidden = true;
    next.textContent = text(i === total - 1 ? strings.finish : strings.next);
    next.hidden = false;
    unlock = lock(group, { focus: false });
  }
  function finish() {
    const { right } = score(content, picks);
    result.textContent = text(format(strings.result, { right, total }));
    step.hidden = true;
    end.hidden = false;
  }

  for (const row of rows) row.addEventListener('click', () => {
    // A checked question keeps its answer.
    if (picks.length !== at) return;
    const on = row.getAttribute('aria-pressed') !== 'true';
    // One answer per question: pressing a row releases the others, pressing it again releases it.
    for (const other of rows) other.setAttribute('aria-pressed', String(on && other === row));
    clearError();
  }, { signal: lifetime.signal });
  check.addEventListener('click', () => {
    if (picks.length !== at) return;
    const chosen = pressed();
    if (!chosen) {
      error.hidden = false;
      for (const row of rows) row.setAttribute('aria-describedby', error.id);
      status.textContent = '';
      // The error sits under the question; the first row reads it once.
      toTop(question);
      rows[0].focus({ preventScroll: true });
      return;
    }
    picks.push(/** @type {string} */ (chosen.dataset.lpPick));
    marked(at);
    // Focus reads the result and the reason once; the status region stays empty.
    feedback.focus({ preventScroll: true });
    reveal(next);
    save();
  }, { signal: lifetime.signal });
  next.addEventListener('click', () => {
    if (picks.length !== at + 1) return;
    at += 1;
    if (at === total) {
      finish();
      toTop(end);
      result.focus({ preventScroll: true });
    } else {
      open(at);
      toTop(question);
      question.focus({ preventScroll: true });
    }
    save();
  }, { signal: lifetime.signal });
  restart.addEventListener('click', () => {
    at = 0; picks = [];
    open(0);
    // Back to the top of the card: the title and context frame the first question.
    reveal(root);
    question.focus({ preventScroll: true });
    status.textContent = text(strings.cleared);
    save();
  }, { signal: lifetime.signal });

  fallback.hidden = true;
  open(0);
  const saved = validateState(content, state?.read());
  if (saved) {
    ({ at, picks } = saved);
    if (at === total) finish();
    else {
      open(at);
      if (picks.length > at) marked(at);
    }
  }
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      lifetime.abort();
      open(0);
      step.hidden = true;
      result.textContent = '';
      fallback.hidden = false;
      status.textContent = '';
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
