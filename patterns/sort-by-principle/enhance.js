import { feedback, format, mixedPairs, principleName, quoteParts, score, validateContent, validateState } from './logic.js';
import { frenchTypography } from '../../lib/html.js';
import { clearChoice, markChoice } from '../../lib/choice-mark.js';
import { lock } from '../../lib/lock.js';
import { reveal } from '../../lib/reveal.js';
import { focusQuestion } from '../../lib/question-errors.js';

const ENTER = 'lp-sort-by-principle-enter';
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
    if (!(element instanceof HTMLElement)) throw new Error(`Missing sort-by-principle markup: ${selector}`);
    return element;
  }
  const result = required(root, '[data-lp-result]');
  const total = required(root, '[data-lp-score]');
  const pairs = required(root, '[data-lp-pairs]');
  const pairList = required(root, '[data-lp-pair-list]');
  const restart = required(root, '[data-lp-restart]');
  const status = required(root, '[role="status"]');
  const panels = [...root.querySelectorAll('[data-lp-case]')].map(panel => /** @type {HTMLElement} */ (panel));
  if (panels.length !== content.cases.length) throw new Error('Invalid sort-by-principle cases markup');
  const last = panels.length - 1;
  const cases = panels.map((panel, c) => {
    const fieldset = required(panel, 'fieldset');
    const radios = [...fieldset.querySelectorAll('input')];
    if (radios.length !== content.principles.length || radios.some((radio, n) => radio.type !== 'radio' || radio.value !== content.principles[n].id)) throw new Error('Invalid sort-by-principle options markup');
    const rows = radios.map(radio => {
      const row = radio.closest('label');
      if (!row) throw new Error('Invalid sort-by-principle choice markup');
      return row;
    });
    return {
      panel, fieldset, radios, rows, heading: required(panel, '[data-lp-case-heading]'), error: required(fieldset, '[data-lp-error]'),
      feedback: required(panel, '[data-lp-feedback]'), actions: required(panel, '[data-lp-actions]'), check: required(panel, '[data-lp-check]'),
      next: c < last ? required(panel, '[data-lp-next]') : null, fallback: required(panel, '[data-lp-fallback]')
    };
  });
  const lifetime = new AbortController();
  const document = root.ownerDocument;
  /** Checked cases, in order. The open case keeps its choice in the radios only.
   * @type {string[]} */
  let picks = [];
  /** @type {(() => void)[]} */
  let unlocks = [];
  let destroyed = false;
  const text = (/** @type {string} */ value) => frenchTypography(value, root.lang);
  const save = () => state?.write({ picks: [...picks] });
  /** @param {string} value */
  const em = value => { const node = document.createElement('em'); node.textContent = text(value); return node; };
  /** Text with each quoted principle name in italics. @param {string} value */
  const quoted = value => quoteParts(content, value).map(part => part.principle ? em(part.text) : text(part.text));

  /** @param {typeof cases[number]} part */
  function clearError({ fieldset, radios, error }) {
    error.hidden = true;
    fieldset.removeAttribute('aria-describedby');
    for (const radio of radios) radio.removeAttribute('aria-invalid');
  }
  /** Mark a checked case and write its feedback beside the rows. @param {number} c */
  function mark(c) {
    const { radios, rows, feedback: line, next } = cases[c];
    const outcome = feedback(content, c, picks[c]);
    radios.forEach((radio, n) => {
      radio.checked = radio.value === picks[c];
      if (radio.checked) markChoice(rows[n], outcome.right ? 'correct' : 'wrong', strings, root.lang);
      else if (radio.value === outcome.correct) markChoice(rows[n], 'missed', strings, root.lang);
    });
    // The rows show the verdict; focus reads this line, so it repeats the verdict for screen readers only.
    const verdict = document.createElement('span');
    verdict.className = 'lp-visually-hidden';
    verdict.textContent = `${text(outcome.right ? strings.feedbackCorrect : format(strings.feedbackWrong, { answer: principleName(content, outcome.correct) }))} `;
    line.replaceChildren(verdict, ...(outcome.looksLike ? [...quoted(outcome.looksLike), ' '] : []), ...quoted(outcome.decides));
    line.hidden = false;
    if (next) next.hidden = false;
  }
  /** The result sentence and the pairs of principles mixed up. Returns what the status region says. */
  function finish() {
    const outcome = score(content, picks);
    total.textContent = text(format(strings.result, { right: outcome.right, total: outcome.total }));
    const mixed = mixedPairs(content, picks);
    pairList.replaceChildren(...mixed.map(pair => {
      const item = document.createElement('li');
      const template = pair.count === 1 ? strings.pairOne : strings.pairMany;
      for (const piece of template.split(/(\{first\}|\{second\})/)) {
        if (piece === '{first}' || piece === '{second}') item.append(em(principleName(content, piece === '{first}' ? pair.first : pair.second)));
        else if (piece) item.append(text(format(piece, { count: pair.count })));
      }
      return item;
    }));
    pairs.hidden = mixed.length === 0;
    result.hidden = false;
    return [total.textContent, ...(mixed.length ? [text(`${strings.pairsLabel}:`), ...[...pairList.children].map(item => `${item.textContent}.`)] : [])].join(' ');
  }
  /** Show one case. A case change slides in; restore and Start over don't. @param {number} c @param {boolean} [slide] */
  function show(c, slide = false) {
    panels.forEach((panel, i) => { panel.hidden = i !== c; panel.classList.remove(ENTER); });
    if (!slide) return;
    // Reflow lets each case run the entrance.
    void panels[c].offsetWidth;
    panels[c].classList.add(ENTER);
  }
  function reset() {
    for (const unlock of unlocks.splice(0)) unlock();
    picks = [];
    for (const part of cases) {
      clearError(part);
      for (const radio of part.radios) radio.checked = false;
      part.rows.forEach(clearChoice);
      part.feedback.replaceChildren();
      part.feedback.hidden = true;
      if (part.next) part.next.hidden = true;
    }
    result.hidden = true;
    total.textContent = '';
    pairList.replaceChildren();
    pairs.hidden = true;
  }

  cases.forEach((part, c) => {
    const options = { signal: lifetime.signal };
    for (const radio of part.radios) radio.addEventListener('change', () => clearError(part), options);
    part.check.addEventListener('click', () => {
      if (picks.length !== c) return;
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
      mark(c);
      // Focus reads the feedback once, then the controls freeze. Only the final result uses the status region.
      // Before the last case, Next case comes into view with the feedback just above it; on a narrow
      // screen, revealing the feedback alone left the button below the fold.
      reveal(c === last ? part.feedback : part.actions);
      part.feedback.focus({ preventScroll: true });
      unlocks.push(lock(part.panel));
      if (c === last) {
        const said = finish();
        reveal(result);
        status.textContent = said;
      } else status.textContent = '';
      save();
    }, options);
    part.next?.addEventListener('click', () => {
      show(c + 1, true);
      // The heading holds the case number, so focus reads where the learner is.
      cases[c + 1].heading.focus();
      status.textContent = '';
    }, options);
    part.actions.hidden = false;
    part.fallback.hidden = true;
  });
  restart.addEventListener('click', () => {
    reset();
    show(0);
    reveal(root);
    cases[0].heading.focus({ preventScroll: true });
    status.textContent = text(strings.cleared);
    save();
  }, { signal: lifetime.signal });

  for (const pick of validateState(content, state?.read())?.picks ?? []) {
    picks.push(pick);
    mark(picks.length - 1);
    unlocks.push(lock(cases[picks.length - 1].panel, { focus: false }));
  }
  show(Math.min(picks.length, last));
  if (picks.length === panels.length) finish();

  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      lifetime.abort();
      reset();
      // Back to the server markup: every case open, answers in their disclosures.
      for (const part of cases) {
        part.panel.hidden = false;
        part.panel.classList.remove(ENTER);
        part.actions.hidden = true;
        part.fallback.hidden = false;
      }
      status.textContent = '';
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
