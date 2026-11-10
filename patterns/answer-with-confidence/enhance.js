import { clearChoice, markChoice } from '../../lib/choice-mark.js';
import { frenchTypography } from '../../lib/html.js';
import { lock } from '../../lib/lock.js';
import { focusQuestion, questionLinks } from '../../lib/question-errors.js';
import { reveal } from '../../lib/reveal.js';
import { DONT_KNOW, feedback, format, summarize, validateContent, validateState } from './logic.js';

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
    if (!element) throw new Error(`Missing answer-with-confidence markup: ${selector}`);
    return /** @type {HTMLElement} */ (element);
  }
  const intro = required(root, '[data-lp-intro]');
  const result = required(root, '[data-lp-result]');
  const summary = required(result, '[data-lp-summary]');
  const restart = required(result, '[data-lp-restart]');
  const fallback = required(root, '[data-lp-fallback]');
  const status = required(root, '[role="status"]');
  const reviews = /** @type {const} */ ([
    { key: 'sureWrong', panel: required(result, '[data-lp-review="sureWrong"]'), heading: strings.verdictSureWrong, one: strings.sureWrongOne, many: strings.sureWrongMany },
    { key: 'unsureRight', panel: required(result, '[data-lp-review="unsureRight"]'), heading: strings.verdictUnsureRight, one: strings.unsureRightOne, many: strings.unsureRightMany }
  ]);
  const sections = [...root.querySelectorAll('[data-lp-question]')].map(n => /** @type {HTMLElement} */ (n));
  if (sections.length !== content.questions.length) throw new Error('Invalid answer-with-confidence questions markup');
  const questions = content.questions.map((q, index) => {
    const section = sections[index];
    const fieldset = required(section, 'fieldset');
    const stage = required(section, '[data-lp-stage]');
    const message = required(stage, '[data-lp-question-error]');
    const radios = [...fieldset.querySelectorAll('input')];
    const found = [...stage.querySelectorAll('[data-lp-feedback]')].map(n => /** @type {HTMLElement} */ (n));
    const expected = [...q.options.map(o => o.id), ...(content.dontKnow ? [DONT_KNOW] : [])];
    const rows = radios.map(radio => radio.closest('label'));
    if (section.dataset.lpQuestion !== q.id || !fieldset.id || fieldset.getAttribute('tabindex') !== '-1' || !message.id
      || radios.length !== q.options.length || radios.some((radio, n) => radio.type !== 'radio' || radio.value !== q.options[n].id)
      || rows.some(row => !row) || found.length !== expected.length || found.some((box, n) => box.dataset.lpFeedback !== expected[n])
      || !stage.querySelector('[data-lp-dont-know]') !== !content.dontKnow) throw new Error('Invalid answer-with-confidence options markup');
    return { q, section, fieldset, stage, message, radios, rows: /** @type {HTMLLabelElement[]} */ (rows), boxes: new Map(found.map(box => [box.dataset.lpFeedback, box])), unlock: () => {} };
  });
  const lifetime = new AbortController();
  let destroyed = false;
  // Prototype-free, so a question id such as "constructor" or "__proto__" is an ordinary key.
  /** @type {Record<string, string>} */
  let answers = Object.create(null);
  // Whether the learner was sure lives here only. It is never written through the state adapter.
  /** @type {Record<string, import('./logic.js').Certainty>} */
  let certainties = Object.create(null);
  const text = (/** @type {string} */ value) => frenchTypography(value, root.lang);
  const save = () => state?.write({ answers: { ...answers } });

  /** @param {typeof questions[number]} item */
  function clearError({ fieldset, radios, message }) {
    message.hidden = true;
    fieldset.removeAttribute('aria-describedby');
    for (const radio of radios) radio.removeAttribute('aria-invalid');
  }
  /** Mark the rows, swap the submit control for the chosen answer's feedback and lock the question.
   * @param {typeof questions[number]} item @param {boolean} focus
   */
  function show(item, focus) {
    const { q, section, stage, radios, rows, boxes } = item;
    const answer = answers[q.id];
    const outcome = feedback(content, q.id, answer, certainties[q.id]);
    radios.forEach((radio, n) => {
      // "Don't know" is a way to submit, not an option, so it leaves no option chosen.
      radio.checked = radio.value === answer;
      if (radio.checked) markChoice(rows[n], outcome.result === 'right' ? 'correct' : 'wrong', strings, root.lang);
      else if (radio.value === q.correct) markChoice(rows[n], 'missed', strings, root.lang);
    });
    const box = /** @type {HTMLElement} */ (boxes.get(answer));
    const verdict = answer === DONT_KNOW ? 'unknown' : certainties[q.id] ?? 'unknown';
    for (const part of box.querySelectorAll('[data-lp-verdict], [data-lp-right-when]')) {
      part.toggleAttribute('data-lp-shown', part.hasAttribute('data-lp-right-when') ? outcome.rightWhen !== null : part.getAttribute('data-lp-verdict') === verdict);
    }
    box.toggleAttribute('data-lp-shown', true);
    stage.toggleAttribute('data-lp-answered', true);
    clearError(item);
    // The pressed button is about to go, so focus moves to the feedback that replaced it, which reads it once.
    if (focus) box.focus();
    item.unlock = lock(section, { focus: false });
  }
  /** After the last answer: one sentence, then the questions where certainty and result disagreed.
   * @param {boolean} announce
   */
  function finish(announce) {
    const outcome = summarize(content, answers, certainties);
    if (outcome.unanswered.length) return;
    const single = new Intl.PluralRules(/^fr(?:-|$)/i.test(root.lang) ? 'fr' : 'en').select(outcome.right.length) === 'one';
    const spoken = [text(format(single ? strings.summaryOne : strings.summaryMany, { right: outcome.right.length, total: outcome.total }))];
    summary.textContent = spoken[0];
    // One question needs no summary: its feedback already says it all, so only Start over shows.
    const several = content.questions.length > 1;
    summary.hidden = !several;
    for (const { key, panel, heading, one, many } of reviews) {
      const listed = several ? questions.filter(({ q }) => outcome[key].includes(q.id)) : [];
      panel.hidden = listed.length === 0;
      if (!listed.length) continue;
      required(panel, '[data-lp-review-hint]').textContent = text(listed.length === 1 ? one : many);
      questionLinks(panel, listed.map(({ q, fieldset }) => ({ fieldset, text: text(q.text), focus: () => fieldset.focus() })));
      spoken.push(text(format(strings.listCount, { heading, count: listed.length })));
    }
    if (!announce) { result.hidden = false; return; }
    reveal(result);
    if (several) status.textContent = spoken.join(' ');
  }
  function reset() {
    for (const item of questions) {
      item.unlock();
      item.unlock = () => {};
      item.radios.forEach((radio, n) => { radio.checked = false; clearChoice(item.rows[n]); });
      for (const part of item.stage.querySelectorAll('[data-lp-shown]')) part.removeAttribute('data-lp-shown');
      item.stage.removeAttribute('data-lp-answered');
      clearError(item);
    }
    answers = Object.create(null);
    certainties = Object.create(null);
    result.hidden = true;
    summary.textContent = '';
    for (const { panel } of reviews) { panel.hidden = true; panel.querySelector('ul')?.remove(); }
  }

  for (const item of questions) {
    for (const radio of item.radios) radio.addEventListener('change', () => clearError(item), { signal: lifetime.signal });
    for (const button of item.stage.querySelectorAll('button')) button.addEventListener('click', () => {
      if (Object.hasOwn(answers, item.q.id)) return;
      const dontKnow = button.hasAttribute('data-lp-dont-know');
      const picked = item.radios.find(radio => radio.checked);
      if (!dontKnow && !picked) {
        item.message.hidden = false;
        item.fieldset.setAttribute('aria-describedby', item.message.id);
        for (const radio of item.radios) radio.setAttribute('aria-invalid', 'true');
        // Focus on the first option reads the linked message once, so the status region stays silent.
        focusQuestion(item.fieldset);
        return;
      }
      status.textContent = '';
      answers[item.q.id] = picked && !dontKnow ? picked.value : DONT_KNOW;
      if (!dontKnow) certainties[item.q.id] = /** @type {import('./logic.js').Certainty} */ (button.getAttribute('data-lp-certainty'));
      show(item, true);
      finish(true);
      save();
    }, { signal: lifetime.signal });
  }
  restart.addEventListener('click', () => {
    reset();
    focusQuestion(questions[0].fieldset);
    status.textContent = text(strings.cleared);
    save();
  }, { signal: lifetime.signal });

  const saved = validateState(content, state?.read());
  fallback.hidden = true;
  intro.hidden = false;
  for (const { stage } of questions) stage.hidden = false;
  if (saved) {
    // Restored answers come back without certainty, so they show the plain result and no summary lists.
    Object.assign(answers, saved.answers);
    for (const item of questions) if (Object.hasOwn(answers, item.q.id)) show(item, false);
    finish(false);
  }
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      lifetime.abort();
      reset();
      intro.hidden = true;
      for (const { stage } of questions) stage.hidden = true;
      fallback.hidden = false;
      status.textContent = '';
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
