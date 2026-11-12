import { NEITHER, answer, answerText, format, score, validateState } from './logic.js';
import { escapeHtml, frenchTypography } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { clearChoice, markChoice, renderChoiceMark } from '../../lib/choice-mark.js';
import { lock } from '../../lib/lock.js';
import { reveal } from '../../lib/reveal.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();
const words = /** @type {const} */ ({ correct: 'markCorrect', wrong: 'markWrong', missed: 'markAnswer' });

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
  const fallback = required('[data-lp-fallback]'), step = required('[data-lp-step]'), group = required('[data-lp-choices]');
  const question = required('[data-lp-question]'), progress = required('[data-lp-progress]'), questionText = required('[data-lp-question-text]');
  const error = required('[data-lp-error]'), feedback = required('[data-lp-feedback]'), verdict = required('[data-lp-verdict]'), reason = required('[data-lp-reason]');
  const check = required('[data-lp-check]'), next = required('[data-lp-next]');
  const end = required('[data-lp-summary]'), result = required('[data-lp-result]'), restart = required('[data-lp-restart]');
  const status = required('[role="status"]');
  // The body sentences of both emails in reading order, then the Neither row.
  const choices = [...group.querySelectorAll('[data-lp-pick]')].map(choice => /** @type {HTMLElement} */ (choice));
  const chunks = choices.filter(choice => !(choice instanceof HTMLButtonElement));
  if (chunks.length === 0 || choices.length !== chunks.length + 1 || !(choices.at(-1) instanceof HTMLButtonElement)) throw new Error('Missing which-is-better markup: [data-lp-pick]');
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
  const pressed = () => choices.find(choice => choice.getAttribute('aria-pressed') === 'true');
  /** Bring a line to the top of the view unless all of it is visible. On a phone the emails and the
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
    for (const choice of choices) choice.removeAttribute('aria-describedby');
  }
  /** A sentence's mark follows it in the text, so the sentence's name stays its own words.
   * @param {HTMLElement} choice @param {import('../../lib/choice-mark.js').ChoiceMark} kind */
  function mark(choice, kind) {
    if (choice instanceof HTMLButtonElement) { markChoice(choice, kind, strings, root.lang); return; }
    choice.dataset.lpMark = kind;
    choice.insertAdjacentHTML('afterend', renderChoiceMark(kind, strings[words[kind]], root.lang));
  }
  /** @param {HTMLElement} choice */
  function unmark(choice) {
    if (choice instanceof HTMLButtonElement) { clearChoice(choice); return; }
    choice.removeAttribute('data-lp-mark');
    if (choice.nextElementSibling?.matches('.lp-choice-mark')) choice.nextElementSibling.remove();
  }
  /** Show question i open, with nothing chosen. @param {number} i */
  function open(i) {
    unlock?.(); unlock = null;
    clearError();
    for (const choice of choices) { choice.setAttribute('aria-pressed', 'false'); unmark(choice); }
    for (const chunk of chunks) chunk.removeAttribute('aria-disabled');
    progress.textContent = text(format(strings.progress, { n: i + 1, total }));
    questionText.textContent = text(content.qualities[i].question);
    feedback.hidden = true; verdict.className = 'lp-which-is-better-verdict'; verdict.replaceChildren(); reason.textContent = '';
    check.hidden = false; next.hidden = true;
    step.hidden = false; end.hidden = true;
  }
  /** Mark question i's checked pick, lock its choices and offer the next step. @param {number} i */
  function marked(i) {
    const right = answer(content, i), pick = picks[i];
    for (const choice of choices) {
      const value = choice.dataset.lpPick;
      choice.setAttribute('aria-pressed', String(value === pick));
      // Mark only what the learner chose; a correct answer they missed is neutral.
      if (value === pick) mark(choice, pick === right ? 'correct' : 'wrong');
      else if (value === right) mark(choice, 'missed');
    }
    // Locked sentences stay in the tab order, as in Highlight the key passage, so the marks can be read.
    for (const chunk of chunks) chunk.setAttribute('aria-disabled', 'true');
    // The verdict opens the feedback, visibly too: on a phone the chosen sentence may be scrolled off
    // screen. Screen readers hear it once, with the right answer in words after a wrong one.
    const ok = pick === right, h = (/** @type {string} */ value) => escapeHtml(value, root.lang);
    // A correct Neither row already says "Correct" right above the feedback, so the verdict is for
    // screen readers only there.
    verdict.className = `lp-which-is-better-verdict ${ok ? 'lp-met' : 'lp-missed'}${ok && pick === NEITHER ? ' lp-visually-hidden' : ''}`;
    verdict.innerHTML = `${icons[ok ? 'check' : 'x']}<span>${h(ok ? strings.markCorrect : strings.markWrong)}</span><span class="lp-visually-hidden">${h(ok ? '. ' : `. ${answerText(content, strings, i)} `)}</span>`;
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

  /** @param {HTMLElement} choice */
  function toggle(choice) {
    // A checked question keeps its answer.
    if (picks.length !== at) return;
    const on = choice.getAttribute('aria-pressed') !== 'true';
    // One answer per question: pressing a choice releases the others, pressing it again releases it.
    for (const other of choices) other.setAttribute('aria-pressed', String(on && other === choice));
    clearError();
  }
  for (const choice of choices) choice.addEventListener('click', () => toggle(choice), { signal: lifetime.signal });
  // The sentence keys of Highlight the key passage: Space or Enter presses, arrows move through both
  // emails and wrap, Home and End jump to the first and last sentence.
  chunks.forEach((chunk, i) => chunk.addEventListener('keydown', event => {
    const key = /** @type {KeyboardEvent} */ (event).key;
    if (!['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Home', 'End', ' ', 'Enter'].includes(key)) return;
    event.preventDefault();
    // A held key repeats keydown; press once, as a native button does.
    if (key === ' ' || key === 'Enter') { if (!event.repeat) toggle(chunk); return; }
    const to = key === 'Home' ? 0 : key === 'End' ? chunks.length - 1 : i + (key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1);
    chunks[(to + chunks.length) % chunks.length].focus();
  }, { signal: lifetime.signal }));
  check.addEventListener('click', () => {
    if (picks.length !== at) return;
    const chosen = pressed();
    if (!chosen) {
      for (const choice of choices) choice.setAttribute('aria-describedby', error.id);
      status.textContent = '';
      // The error sits just above Check, where the learner is: keep both in view. The first sentence
      // reads it once.
      error.hidden = false;
      reveal(check);
      choices[0].focus({ preventScroll: true });
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
