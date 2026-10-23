import { deal, shuffle, score, validateContent, validateState } from './logic.js';
import { frenchTypography } from '../../lib/html.js';
import { markChoice, clearChoice } from '../../lib/choice-mark.js';
import { lock } from '../../lib/lock.js';
import { reveal } from '../../lib/reveal.js';
import { focusAfterLayout } from '../../lib/focus-after-layout.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  /** @param {string} selector @returns {HTMLElement} */
  function required(selector) {
    const element = root.querySelector(selector);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing prolific-questions markup: ${selector}`);
    return element;
  }
  const practice = required('[data-lp-practice]');
  const question = required('[data-lp-question]');
  const check = required('[data-lp-check]');
  const again = required('[data-lp-try-again]');
  const next = required('[data-lp-next]');
  const nextActions = required('[data-lp-next-actions]');
  const fallback = required('[data-lp-fallback]');
  const result = required('[data-lp-result]');
  const error = required('[data-lp-error]');
  const errorText = required('[data-lp-error] > span');
  const status = required('[role="status"]');
  const facts = [...root.querySelectorAll('[data-lp-fact]')].map(element => /** @type {HTMLElement} */ (element));
  const legends = facts.map(fact => fact.querySelector('[data-lp-fact-text]'));
  const rows = facts.map(fact => [...fact.querySelectorAll('.lp-choice')].map(row => /** @type {HTMLElement} */ (row)));
  const inputs = facts.map(fact => [...fact.querySelectorAll('input')]);
  if (facts.length !== content.parts.length || legends.some(legend => !legend)
    || inputs.some(group => group.length !== content.parts.length || group.some((input, i) => input.type !== 'radio' || input.value !== String(i)))
    || rows.some(group => group.length !== content.parts.length)) throw new Error('Invalid prolific-questions facts markup');
  const initialFacts = legends.map(legend => legend?.textContent ?? '');
  const lifetime = new AbortController();
  let destroyed = false;
  let cancelFocus = () => {};
  let unlock = () => {};
  let learner = validateState(content, state?.read());
  if (!learner) learner = { ...deal(content.cases.length), order: shuffle(content.parts.map((_, i) => i)), picks: content.parts.map(() => null), checked: false, completed: 0, placed: 0 };
  // A valid state is assigned above; keeping one local object makes every host write a snapshot.
  let current = learner;
  const save = () => state?.write({ ...current, deck: [...current.deck], order: [...current.order], picks: [...current.picks] });
  /** @param {string} text */
  const display = text => frenchTypography(text, root.lang);
  function clearError() {
    error.hidden = true;
    facts.forEach(fact => fact.removeAttribute('aria-describedby'));
  }
  function clearResult() {
    cancelFocus(); unlock(); unlock = () => {};
    rows.flat().forEach(clearChoice);
    result.hidden = true; result.textContent = '';
    again.hidden = true; nextActions.hidden = true; check.hidden = false;
    clearError();
  }
  function paintFacts() {
    current.order.forEach((part, i) => {
      if (legends[i]) legends[i].textContent = display(content.cases[current.last][part]);
      inputs[i].forEach((input, slot) => { input.checked = current.picks[i] === slot; });
    });
  }
  function summary() {
    return (current.completed === 1 ? strings.summaryOne : strings.summaryMany)
      .replace('{sets}', String(current.completed)).replace('{placed}', String(current.placed))
      .replace('{facts}', String(current.completed * content.parts.length));
  }
  /** @param {boolean} announce */
  function showResult(announce) {
    const outcome = score(current.order, current.picks);
    current.order.forEach((part, i) => {
      // Mark only what the learner did; the right slot of a miss supplies the label reveal.
      inputs[i].forEach((input, slot) => {
        if (input.checked) markChoice(rows[i][slot], slot === part ? 'correct' : 'wrong', strings, root.lang);
        else if (slot === part) markChoice(rows[i][slot], 'missed', strings, root.lang);
      });
    });
    result.textContent = display(summary());
    again.hidden = false;
    nextActions.hidden = false;
    if (announce) {
      // Check disappears; move to New set before locking the answers, preserving keyboard position.
      cancelFocus = focusAfterLayout(next, () => { unlock = lock(question); reveal(result); }, lifetime.signal);
      status.textContent = display(strings.result.replace('{right}', String(outcome.right))
        .replace('{total}', String(outcome.total)).replace('{summary}', summary()));
    } else {
      unlock = lock(question);
      result.hidden = false;
    }
  }
  function onChange() {
    if (current.checked) return;
    current.picks = inputs.map(group => {
      const input = group.find(input => input.checked);
      return input ? Number(input.value) : null;
    });
    if (!score(current.order, current.picks).unanswered.length) clearError();
    save();
  }
  function onCheck() {
    if (current.checked) return;
    const outcome = score(current.order, current.picks);
    clearError();
    if (outcome.unanswered.length) {
      const count = outcome.unanswered.length;
      const message = count === outcome.total ? strings.empty : count === 1 ? strings.last : strings.remaining.replace('{count}', String(count));
      errorText.textContent = display(message); error.hidden = false;
      outcome.unanswered.forEach(i => facts[i].setAttribute('aria-describedby', error.id));
      status.textContent = display(message);
      return;
    }
    current.checked = true; current.completed++; current.placed += outcome.right;
    showResult(true); save();
  }
  function onAgain() {
    if (!current.checked) return;
    // Rechecking replaces this set's contribution instead of inflating the running count.
    current.completed--; current.placed -= score(current.order, current.picks).right;
    current.checked = false; current.picks = content.parts.map(() => null);
    clearResult(); paintFacts(); save();
    cancelFocus = focusAfterLayout(question, () => {}, lifetime.signal);
    status.textContent = display(strings.cleared);
  }
  function onNext() {
    if (!current.checked) return;
    clearResult();
    current = { ...current, ...deal(content.cases.length, current), order: shuffle(content.parts.map((_, i) => i)), picks: content.parts.map(() => null), checked: false };
    paintFacts(); save();
    // A new set replaces the old one; start the reader at the question.
    cancelFocus = focusAfterLayout(question, () => {}, lifetime.signal);
    status.textContent = '';
  }
  paintFacts(); practice.hidden = false; fallback.hidden = true;
  if (current.checked) showResult(false);
  save();
  question.addEventListener('change', onChange);
  check.addEventListener('click', onCheck);
  again.addEventListener('click', onAgain);
  next.addEventListener('click', onNext);
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true; lifetime.abort(); clearResult();
      question.removeEventListener('change', onChange);
      check.removeEventListener('click', onCheck);
      again.removeEventListener('click', onAgain);
      next.removeEventListener('click', onNext);
      inputs.flat().forEach(input => { input.checked = false; });
      legends.forEach((legend, i) => { if (legend) legend.textContent = initialFacts[i]; });
      practice.hidden = true; fallback.hidden = false; status.textContent = '';
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
