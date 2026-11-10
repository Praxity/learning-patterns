import { escapeHtml as html, frenchTypography } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';
import { reveal } from '../../lib/reveal.js';
import { calendarFile, choose, emptyState, format, sentence, startError, validateContent, validateState } from './logic.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();
const NAMES = /** @type {const} */ (['when', 'will']);

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
    if (!element) throw new Error(`Missing if-then-plan markup: ${selector}`);
    return /** @type {HTMLElement} */ (element);
  }
  const t = (/** @type {string} */ text) => frenchTypography(text, root.lang);
  /** @param {import('./logic.js').StepName} name */
  function stepParts(name) {
    const fieldset = required(root, `[data-lp-step="${name}"]`);
    const radios = /** @type {HTMLInputElement[]} */ ([...fieldset.querySelectorAll('input[type="radio"]')]);
    const options = content[name].options;
    if (radios.length !== options.length || radios.some((radio, index) => radio.value !== options[index].id)) throw new Error('Invalid if-then-plan options markup');
    return { fieldset, radios, stem: required(fieldset, '[data-lp-stem]'), error: required(fieldset, '[data-lp-error]'), described: fieldset.getAttribute('aria-describedby') ?? '' };
  }
  const steps = { when: stepParts('when'), will: stepParts('will') };
  const stepsBox = required(root, '[data-lp-steps]');
  const add = required(root, '[data-lp-add]');
  const result = required(root, '[data-lp-result]');
  const plan = required(root, '[data-lp-plan]');
  const planText = required(root, '[data-lp-plan-text]');
  const start = /** @type {HTMLInputElement} */ (required(root, '[data-lp-start]'));
  const startProblem = required(root, '[data-lp-start-error]');
  const startDescribed = start.getAttribute('aria-describedby') ?? '';
  const calendar = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-calendar]'));
  const downloaded = required(root, '[data-lp-downloaded]');
  const fallback = required(root, '[data-lp-fallback]');
  const restart = required(root, '[data-lp-restart]');
  const status = required(root, '[role="status"]');
  let record = validateState(content, state?.read()) ?? emptyState();
  let destroyed = false;
  /** @type {string | null} */
  let fileUrl = null;
  /** @type {(() => void)[]} */
  const removals = [];
  /** @param {HTMLElement} target @param {string} event @param {() => void} handler */
  function listen(target, event, handler) {
    target.addEventListener(event, handler);
    removals.push(() => target.removeEventListener(event, handler));
  }
  const stage = () => record.when === null ? 'when' : record.will === null ? 'will' : 'done';
  const save = () => state?.write({ ...record });
  const startTime = () => start.value ? new Date(start.value).getTime() : NaN;
  const startPast = () => start.value !== '' && startError(startTime(), Date.now()) === 'past';

  /** @param {import('./logic.js').StepName} name @param {boolean} shown */
  function stepError(name, shown) {
    const { fieldset, radios, error, described } = steps[name];
    error.hidden = !shown;
    fieldset.setAttribute('aria-describedby', shown ? `${described} ${error.id}` : described);
    for (const radio of radios) shown ? radio.setAttribute('aria-invalid', 'true') : radio.removeAttribute('aria-invalid');
  }
  /** @param {boolean} shown */
  function showPast(shown) {
    startProblem.hidden = !shown;
    start.setAttribute('aria-describedby', shown ? `${startDescribed} ${startProblem.id}` : startDescribed);
    shown ? start.setAttribute('aria-invalid', 'true') : start.removeAttribute('aria-invalid');
  }
  function clearVague() {
    for (const row of root.querySelectorAll('.lp-choice[data-lp-vague]')) {
      row.removeAttribute('data-lp-vague');
      for (const added of row.querySelectorAll('[data-lp-reason], .lp-choice-mark')) added.remove();
      const radio = row.querySelector('input');
      if (radio) radio.disabled = false;
    }
  }
  function paint() {
    const now = stage();
    for (const name of NAMES) steps[name].fieldset.hidden = now !== name;
    // The second step's legend carries the plan so far, so the sentence grows in one place.
    steps.will.stem.textContent = t(now === 'will' ? sentence(content, strings, record) : strings.willStem);
    stepsBox.hidden = now === 'done';
    add.hidden = now === 'done';
    result.hidden = now !== 'done';
    planText.textContent = now === 'done' ? t(sentence(content, strings, record)) : '';
    restart.hidden = now === 'when';
    calendar.disabled = startError(startTime(), Date.now()) !== null;
  }

  for (const name of NAMES) for (const radio of steps[name].radios) listen(radio, 'change', () => stepError(name, false));
  listen(add, 'click', () => {
    const name = stage();
    if (name === 'done') return;
    const picked = steps[name].radios.find(radio => radio.checked);
    if (!picked) {
      stepError(name, true);
      status.textContent = t(strings[name === 'when' ? 'chooseWhen' : 'chooseWill']);
      return;
    }
    const outcome = choose(content, name, picked.value);
    if (!outcome.ok) {
      // A vague option stays in view with its reason and can't be chosen again; the others stay open.
      const row = /** @type {HTMLElement} */ (picked.closest('.lp-choice'));
      picked.checked = false; picked.disabled = true;
      row.dataset.lpVague = '';
      row.insertAdjacentHTML('beforeend', `<span class="lp-if-then-plan-reason" data-lp-reason>${html(outcome.reason, root.lang)}</span><span class="lp-choice-mark lp-if-then-plan-mark">${icons['info-circle']}<span>${html(strings.markVague, root.lang)}</span></span>`);
      status.textContent = t(format(strings.vagueStatus, { reason: outcome.reason }));
      return;
    }
    record = { ...record, [name]: picked.value };
    save();
    // Focus reads the next step or the finished plan, so the status region stays quiet.
    status.textContent = '';
    paint();
    if (name === 'when') (steps.will.radios.find(radio => !radio.disabled) ?? steps.will.fieldset).focus();
    else { reveal(result); plan.focus({ preventScroll: true }); }
  });
  listen(start, 'input', () => {
    record = { ...record, start: start.value };
    downloaded.hidden = true;
    const problem = startError(startTime(), Date.now());
    if (problem !== 'past') showPast(false);
    calendar.disabled = problem !== null;
    save();
  });
  // A past time is reported when the learner leaves the field, not on each keystroke.
  listen(start, 'change', () => {
    const past = startPast();
    showPast(past);
    if (past) status.textContent = t(strings.past);
  });
  listen(calendar, 'click', () => {
    const time = startTime(), now = Date.now();
    if (startError(time, now)) {
      // The time passed while the page was open.
      showPast(true); status.textContent = t(strings.past); start.focus(); calendar.disabled = true;
      return;
    }
    const file = calendarFile({
      plan: t(sentence(content, strings, record)), note: t(format(strings.eventNote, { title: content.title })),
      start: time, now, uid: `${now}-${Math.random().toString(36).slice(2)}@if-then-plan`
    });
    // The file is built in the browser; the plan is not sent anywhere.
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    fileUrl = URL.createObjectURL(new Blob([file], { type: 'text/calendar;charset=utf-8' }));
    const link = Object.assign(root.ownerDocument.createElement('a'), { href: fileUrl, download: strings.fileName, hidden: true });
    root.append(link); link.click(); link.remove();
    downloaded.hidden = false;
    status.textContent = t(strings.downloaded);
  });
  listen(restart, 'click', () => {
    record = emptyState();
    for (const name of NAMES) {
      stepError(name, false);
      for (const radio of steps[name].radios) radio.checked = false;
    }
    clearVague();
    start.value = ''; showPast(false); downloaded.hidden = true;
    save(); paint();
    steps.when.radios[0].focus();
    status.textContent = t(strings.cleared);
  });

  for (const name of NAMES) for (const radio of steps[name].radios) radio.checked = radio.value === record[name];
  start.value = record.start;
  fallback.hidden = true;
  paint();
  // A restored past time explains the disabled button at once; leaving the unchanged field fires no change event.
  showPast(startPast());
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const remove of removals) remove();
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      clearVague();
      for (const name of NAMES) {
        stepError(name, false); steps[name].fieldset.hidden = false;
        for (const radio of steps[name].radios) radio.checked = false;
      }
      steps.will.stem.textContent = t(strings.willStem);
      planText.textContent = ''; start.value = ''; calendar.disabled = true;
      stepsBox.hidden = false; add.hidden = true; result.hidden = true; restart.hidden = true; downloaded.hidden = true;
      showPast(false); fallback.hidden = false; status.textContent = '';
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
