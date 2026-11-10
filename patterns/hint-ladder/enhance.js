import { format, openHelp, progress, start, summarize, tryFirst, tryFollowUp, validateContent, validateState } from './logic.js';
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
  validateContent(content);
  /** @param {ParentNode} parent @param {string} selector @returns {HTMLElement} */
  function required(parent, selector) {
    const element = parent.querySelector(selector);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing hint-ladder markup: ${selector}`);
    return element;
  }
  /** @param {string} selector @param {{ id: string }[]} options */
  function group(selector, options) {
    const section = required(root, selector), fieldset = required(section, 'fieldset');
    const radios = [...fieldset.querySelectorAll('input')];
    if (radios.length !== options.length || radios.some((radio, n) => radio.type !== 'radio' || radio.value !== options[n].id)) throw new Error('Invalid hint-ladder options markup');
    const rows = radios.map(radio => {
      const row = radio.closest('label');
      if (!row) throw new Error('Invalid hint-ladder choice markup');
      return row;
    });
    return { section, fieldset, radios, rows, error: required(fieldset, '[data-lp-error]'), check: required(section, '[data-lp-check]') };
  }
  const first = group('[data-lp-first]', content.options), followUp = group('[data-lp-follow-up]', content.followUp.options);
  const reasons = first.rows.map((row, n) => content.options[n].id === content.correct ? null : required(row, '[data-lp-reason]'));
  const steps = required(first.section, '[data-lp-steps]');
  const items = [...steps.children].map(item => /** @type {HTMLElement} */ (item));
  if (items.length !== content.hints.length + 1) throw new Error('Invalid hint-ladder steps markup');
  const worked = items[content.hints.length], workedVerdict = required(worked, '[data-lp-verdict]');
  const hint = required(first.section, '[data-lp-hint]'), hintLabel = required(hint, '[data-lp-hint-label]');
  const gate = required(first.section, '[data-lp-gate]');
  const feedback = required(followUp.fieldset, '[data-lp-feedback]'), verdict = required(feedback, '[data-lp-verdict]');
  const result = required(root, '[data-lp-result]'), total = required(result, '[data-lp-summary]');
  const restart = required(result, '[data-lp-restart]');
  const status = required(root, '[role="status"]');
  const fallbacks = [...root.querySelectorAll('[data-lp-fallback]')].map(element => /** @type {HTMLElement} */ (element));
  if (fallbacks.length !== 2) throw new Error('Missing hint-ladder markup: [data-lp-fallback]');
  const lifetime = new AbortController();
  let current = start();
  /** @type {(() => void) | null} */
  let unlockFirst = null;
  /** @type {(() => void) | null} */
  let unlockFollowUp = null;
  let destroyed = false;
  const text = (/** @type {string} */ value) => frenchTypography(value, root.lang);
  const save = () => state?.write({ ...current, tries: [...current.tries] });
  const optionText = (/** @type {{ id: string, text: string }[]} */ options, /** @type {string} */ id) => options.find(o => o.id === id)?.text ?? '';

  /** @param {HTMLElement} row @param {import('../../lib/choice-mark.js').ChoiceMark | null} kind */
  function mark(row, kind) {
    if ((row.dataset.lpMark ?? null) === kind) return;
    clearChoice(row);
    if (kind) markChoice(row, kind, strings, root.lang);
  }
  /** @param {ReturnType<typeof group>} part */
  function clearError({ fieldset, radios, error }) {
    error.hidden = true;
    fieldset.removeAttribute('aria-describedby');
    for (const radio of radios) radio.removeAttribute('aria-invalid');
  }
  /** Nothing chosen: name the problem in the group and put focus on the first option still open.
   * @param {ReturnType<typeof group>} part */
  function showError({ fieldset, radios, error }) {
    error.hidden = false;
    fieldset.setAttribute('aria-describedby', error.id);
    for (const radio of radios) if (!radio.disabled) radio.setAttribute('aria-invalid', 'true');
    status.textContent = '';
    radios.find(radio => !radio.disabled)?.focus();
  }

  /** Draw the whole card from the state. Handlers change the state, call this, then move focus or announce. */
  function paint() {
    const now = progress(content, current), open = now.first === 'open';
    first.radios.forEach((radio, n) => {
      const tried = current.tries.includes(radio.value), correct = radio.value === content.correct;
      // Mark only what the learner chose; a correct answer they did not choose is neutral.
      mark(first.rows[n], tried ? correct ? 'correct' : 'wrong' : !open && correct ? 'missed' : null);
      const reason = reasons[n];
      if (reason) reason.hidden = !tried;
      // A checked wrong option closes, so every try is a new answer. The other options stay open:
      // this is where the pattern leaves the library's one-attempt lock.
      if (open) { radio.disabled = tried; if (tried) radio.checked = false; }
      else radio.checked = tried && correct;
    });
    items.forEach((item, n) => { item.hidden = item === worked ? open : n >= current.opened; });
    steps.hidden = items.every(item => item.hidden);
    const lastTry = current.tries.at(-1) ?? '';
    // Screen readers get the result of the last check before the worked answer; the marks show it.
    // A learner who opened the worked answer checked nothing just before it, so it has no verdict.
    workedVerdict.textContent = now.first === 'solved' ? text(`${strings.markCorrect}. `)
      : now.first === 'shown' && current.opened <= content.hints.length
        ? text(`${strings.markWrong}. ${content.options.find(o => o.id === lastTry)?.feedback ?? ''} `) : '';
    if (open) hintLabel.textContent = text(now.next === 'worked' ? strings.showWorked : format(strings.showHint, { number: current.opened + 1, total: content.hints.length }));
    // aria-disabled keeps the waiting button focusable, with the reason as its description.
    if (now.gated) { hint.setAttribute('aria-disabled', 'true'); hint.setAttribute('aria-describedby', gate.id); }
    else { hint.removeAttribute('aria-disabled'); hint.removeAttribute('aria-describedby'); }
    gate.hidden = !now.gated;
    if (!open && !unlockFirst) unlockFirst = lock(first.section, { focus: false });
    followUp.section.hidden = open;
    followUp.radios.forEach((radio, n) => {
      const chosen = radio.value === current.followUp, correct = radio.value === content.followUp.correct;
      mark(followUp.rows[n], !now.done ? null : chosen ? correct ? 'correct' : 'wrong' : correct ? 'missed' : null);
      if (now.done) radio.checked = chosen;
    });
    verdict.textContent = !now.done ? '' : text(now.followUp === 'right' ? `${strings.markCorrect}. `
      : `${strings.markWrong}. ${format(strings.correct, { option: optionText(content.followUp.options, content.followUp.correct) })} `);
    feedback.hidden = !now.done;
    if (now.done && !unlockFollowUp) unlockFollowUp = lock(followUp.section, { focus: false });
    result.hidden = !now.done;
    total.textContent = now.done ? text(summarize(content, current, strings)) : '';
    return now;
  }
  /** The first question has just ended: focus reads the worked answer once and the next question opens. */
  function closeFirst() {
    worked.focus({ preventScroll: true });
    reveal(followUp.section);
    status.textContent = '';
  }
  function reset() {
    unlockFirst?.(); unlockFollowUp?.();
    unlockFirst = unlockFollowUp = null;
    current = start();
    for (const part of [first, followUp]) {
      clearError(part);
      for (const radio of part.radios) { radio.checked = false; radio.disabled = false; }
    }
    paint();
  }

  for (const part of [first, followUp]) for (const radio of part.radios) radio.addEventListener('change', () => clearError(part), { signal: lifetime.signal });
  first.check.addEventListener('click', () => {
    if (progress(content, current).first !== 'open') return;
    const chosen = first.radios.find(radio => radio.checked && !radio.disabled);
    if (!chosen) { showError(first); return; }
    // Safari does not focus a button on a pointer click, so focus may still be on the option this
    // check is about to close. Put it on the button first.
    first.check.focus({ preventScroll: true });
    current = tryFirst(content, current, chosen.value);
    const now = paint();
    if (now.first === 'open') {
      // Focus is on the button, so the status region carries this result.
      status.textContent = text(`${strings.markWrong}. ${content.options.find(o => o.id === chosen.value)?.feedback ?? ''}`);
      const reason = reasons[first.radios.indexOf(chosen)];
      if (reason) reveal(reason);
    } else closeFirst();
    save();
  }, { signal: lifetime.signal });
  hint.addEventListener('click', () => {
    const before = progress(content, current);
    if (!before.next || before.gated) return;
    current = openHelp(content, current);
    if (paint().first === 'open') {
      // Focus moves to the new hint, which reads it once and takes the pointer off the button.
      const opened = items[current.opened - 1];
      opened.focus({ preventScroll: true });
      reveal(opened);
      status.textContent = '';
    } else closeFirst();
    save();
  }, { signal: lifetime.signal });
  followUp.check.addEventListener('click', () => {
    const before = progress(content, current);
    if (before.first === 'open' || before.done) return;
    const chosen = followUp.radios.find(radio => radio.checked);
    if (!chosen) { showError(followUp); return; }
    current = tryFollowUp(content, current, chosen.value);
    paint();
    // Focus reads this answer's feedback once. The status region adds only the closing sentence.
    feedback.focus({ preventScroll: true });
    reveal(result);
    status.textContent = total.textContent;
    save();
  }, { signal: lifetime.signal });
  restart.addEventListener('click', () => {
    reset();
    // Back to the top of the card: the title and context frame the first question.
    reveal(root);
    first.radios[0].focus({ preventScroll: true });
    status.textContent = text(strings.cleared);
    save();
  }, { signal: lifetime.signal });

  for (const fallback of fallbacks) fallback.hidden = true;
  for (const button of [first.check, hint, followUp.check]) button.hidden = false;
  current = validateState(content, state?.read()) ?? start();
  paint();
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      lifetime.abort();
      reset();
      for (const button of [first.check, hint, followUp.check]) button.hidden = true;
      // Without JavaScript both questions and their disclosures are on the page.
      followUp.section.hidden = false;
      for (const fallback of fallbacks) fallback.hidden = false;
      status.textContent = '';
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
