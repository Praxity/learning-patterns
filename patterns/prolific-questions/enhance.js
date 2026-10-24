import { deal, shuffle, score, feedback, validateContent, validateState } from './logic.js';
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
  const next = required('[data-lp-next]');
  const fallback = required('[data-lp-fallback]');
  const result = required('[data-lp-result]');
  const error = required('[data-lp-error]');
  const errorText = required('[data-lp-error] > span');
  const status = required('[role="status"]');
  const facts = [...root.querySelectorAll('[data-lp-fact]')].map(element => /** @type {HTMLElement} */ (element));
  const legends = facts.map(fact => {
    const legend = fact.querySelector('[data-lp-fact-text]');
    if (!legend) throw new Error('Invalid prolific-questions facts markup');
    return legend;
  });
  const rows = facts.map(fact => [...fact.querySelectorAll('.lp-choice')].map(row => /** @type {HTMLElement} */ (row)));
  const inputs = facts.map(fact => [...fact.querySelectorAll('input')]);
  if (facts.length !== content.parts.length
    || inputs.some(group => group.length !== content.parts.length || group.some((input, i) => input.type !== 'radio' || input.value !== String(i)))
    || rows.some(group => group.length !== content.parts.length)) throw new Error('Invalid prolific-questions facts markup');
  const initialFacts = legends.map(legend => legend.textContent);
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
    next.hidden = true; check.hidden = false;
    clearError();
  }
  function paintFacts() {
    current.order.forEach((part, i) => {
      legends[i].textContent = display(content.cases[current.last][part]);
      inputs[i].forEach((input, slot) => { input.checked = current.picks[i] === slot; });
    });
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
    const text = feedback(strings, { ...outcome, completed: current.completed, placed: current.placed });
    result.textContent = display(text.summary);
    next.hidden = false;
    if (announce) {
      unlock = lock(question);
      reveal(result);
      status.textContent = display(text.announcement);
    } else {
      unlock = lock(question, { focus: false });
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
  function onNext() {
    if (!current.checked) return;
    clearResult();
    current = { ...current, ...deal(content.cases.length, current), order: shuffle(content.parts.map((_, i) => i)), picks: content.parts.map(() => null), checked: false };
    paintFacts(); save();
    // A new set replaces the old one. Focus its first answer: focusing the whole question made NVDA read every
    // fact and option in one 1,000-character utterance. Then bring the first fact into view, since Firefox scrolls
    // a focused control only to the nearest edge and can leave the fact it belongs to above the viewport.
    cancelFocus = focusAfterLayout(inputs[0][0], () => legends[0].scrollIntoView({ block: 'nearest' }), lifetime.signal);
    status.textContent = '';
  }
  paintFacts(); practice.hidden = false; fallback.hidden = true;
  if (current.checked) showResult(false);
  save();
  question.addEventListener('change', onChange, { signal: lifetime.signal });
  check.addEventListener('click', onCheck, { signal: lifetime.signal });
  next.addEventListener('click', onNext, { signal: lifetime.signal });
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true; lifetime.abort(); clearResult();
      inputs.flat().forEach(input => { input.checked = false; });
      legends.forEach((legend, i) => { legend.textContent = initialFacts[i]; });
      practice.hidden = true; fallback.hidden = false; status.textContent = '';
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
