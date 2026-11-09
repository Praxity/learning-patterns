import { format, rounds, score, validateState } from './logic.js';
import { frenchTypography } from '../../lib/html.js';
import { clearChoice, markChoice } from '../../lib/choice-mark.js';
import { lock } from '../../lib/lock.js';
import { reveal } from '../../lib/reveal.js';
import { focusQuestion } from '../../lib/question-errors.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options
 */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  const all = rounds(content);
  /** @param {ParentNode} parent @param {string} selector @returns {HTMLElement} */
  function required(parent, selector) {
    const element = parent.querySelector(selector);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing change-one-detail markup: ${selector}`);
    return element;
  }
  const fallback = required(root, '[data-lp-fallback]');
  const result = required(root, '[data-lp-result]');
  const total = required(root, '[data-lp-score]');
  const restart = required(root, '[data-lp-restart]');
  const status = required(root, '[role="status"]');
  const sections = [...root.querySelectorAll('[data-lp-round]')].map(section => /** @type {HTMLElement} */ (section));
  if (sections.length !== all.length) throw new Error('Invalid change-one-detail rounds markup');
  const parts = sections.map(section => {
    const fieldset = required(section, 'fieldset');
    const radios = [...fieldset.querySelectorAll('input')];
    if (radios.length !== content.options.length || radios.some((radio, n) => radio.type !== 'radio' || radio.value !== content.options[n].id)) throw new Error('Invalid change-one-detail options markup');
    const rows = radios.map(radio => {
      const row = radio.closest('label');
      if (!row) throw new Error('Invalid change-one-detail choice markup');
      return row;
    });
    return {
      section, fieldset, radios, rows, error: required(fieldset, '[data-lp-error]'), feedback: required(fieldset, '[data-lp-feedback]'),
      verdict: required(fieldset, '[data-lp-verdict]'), check: required(section, '[data-lp-check]')
    };
  });
  const lifetime = new AbortController();
  /** Checked decisions, in round order. The round being answered keeps its choice in the radios only.
   * @type {string[]} */
  let picks = [];
  /** @type {(() => void)[]} */
  let unlocks = [];
  let destroyed = false;
  const text = (/** @type {string} */ value) => frenchTypography(value, root.lang);
  const save = () => state?.write({ picks: [...picks] });

  /** @param {typeof parts[number]} part */
  function clearError({ fieldset, radios, error }) {
    error.hidden = true;
    fieldset.removeAttribute('aria-describedby');
    for (const radio of radios) radio.removeAttribute('aria-invalid');
  }
  /** Mark the checked round, lock it and open what follows: the next round, or the summary.
   * @param {number} i @param {boolean} announce */
  function show(i, announce) {
    const { section, radios, rows, feedback, verdict } = parts[i];
    const right = picks[i] === all[i].correct;
    radios.forEach((radio, n) => {
      radio.checked = radio.value === picks[i];
      // Mark only what the learner chose; a correct answer they missed is neutral.
      if (radio.checked) markChoice(rows[n], right ? 'correct' : 'wrong', strings, root.lang);
      else if (radio.value === all[i].correct) markChoice(rows[n], 'missed', strings, root.lang);
    });
    // The marks sit on the rows; screen readers get the same result at the start of the feedback.
    verdict.textContent = text(right ? `${strings.markCorrect}. ` : `${strings.markWrong}. ${format(strings.correct, { option: content.options.find(o => o.id === all[i].correct)?.text ?? '' })} `);
    feedback.hidden = false;
    unlocks.push(lock(section, { focus: false }));
    const last = i === all.length - 1;
    if (last) {
      const outcome = score(content, picks);
      total.textContent = text(format(strings.summary, { right: outcome.right, total: outcome.total }));
    }
    const next = last ? result : parts[i + 1].section;
    if (!announce) { next.hidden = false; return; }
    // Focus reads this decision's feedback once. The status region adds only the closing summary.
    feedback.focus({ preventScroll: true });
    reveal(next);
    status.textContent = last ? `${total.textContent} ${text(content.rule)}` : '';
  }
  function reset() {
    for (const unlock of unlocks) unlock();
    unlocks = [];
    picks = [];
    parts.forEach((part, i) => {
      clearError(part);
      for (const radio of part.radios) radio.checked = false;
      for (const row of part.rows) clearChoice(row);
      part.feedback.hidden = true;
      part.verdict.textContent = '';
      if (i) part.section.hidden = true;
    });
    result.hidden = true;
    total.textContent = '';
  }

  parts.forEach((part, i) => {
    for (const radio of part.radios) radio.addEventListener('change', () => clearError(part), { signal: lifetime.signal });
    part.check.addEventListener('click', () => {
      if (picks.length !== i) return;
      const chosen = part.radios.find(radio => radio.checked);
      if (!chosen) {
        part.error.hidden = false;
        part.fieldset.setAttribute('aria-describedby', part.error.id);
        for (const radio of part.radios) radio.setAttribute('aria-invalid', 'true');
        status.textContent = '';
        focusQuestion(part.fieldset);
        return;
      }
      picks.push(chosen.value);
      show(i, true);
      save();
    }, { signal: lifetime.signal });
    part.check.hidden = false;
  });
  restart.addEventListener('click', () => {
    reset();
    reveal(parts[0].section);
    parts[0].radios[0].focus({ preventScroll: true });
    status.textContent = text(strings.cleared);
    save();
  }, { signal: lifetime.signal });

  fallback.hidden = true;
  for (const pick of validateState(content, state?.read())?.picks ?? []) {
    picks.push(pick);
    show(picks.length - 1, false);
  }
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      lifetime.abort();
      reset();
      for (const part of parts) part.check.hidden = true;
      fallback.hidden = false;
      status.textContent = '';
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
