import { frenchTypography } from '../../lib/html.js';
import { dateAfterDays, defaultDate, formatDate, formatShortDate, isDate, presetDays, validateContent, validateState, isPartialYear } from './logic.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options
 */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  /** @template {Element} T @param {string} selector @returns {T} */
  function required(selector) {
    const element = root.querySelector(selector);
    if (!element) throw new Error(`Missing retrieval-sheet markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  const controls = /** @type {HTMLElement} */ (required('[data-lp-controls]'));
  const tablist = /** @type {HTMLElement} */ (required('[data-lp-tabs]'));
  const customField = /** @type {HTMLElement} */ (required('[data-lp-custom-date]'));
  const spacing = required('[data-lp-spacing]');
  const choices = [...presetDays, 'custom'].map(days => ({
    days,
    radio: /** @type {HTMLInputElement} */ (required(`[data-lp-spacing] input[value="${days}"]`)),
    box: /** @type {HTMLElement} */ (required(`[data-lp-spacing] label:has(input[value="${days}"]) [data-lp-choice-date]`)),
    text: required(`[data-lp-spacing] label:has(input[value="${days}"]) [data-lp-choice-date-text]`)
  }));
  /** @param {{ box: HTMLElement, text: Element }} choice @param {string} value */
  function setChoiceDate({ box, text }, value) { text.textContent = frenchTypography(value, root.lang); box.hidden = value === ''; }
  const input = /** @type {HTMLInputElement} */ (required('[data-lp-date]'));
  const error = /** @type {HTMLElement} */ (required('[data-lp-date-error]'));
  const printControls = /** @type {HTMLElement} */ (required('[data-lp-print-controls]'));
  const print = /** @type {HTMLButtonElement} */ (required('[data-lp-print]'));
  const status = required('[role="status"]');
  /** @type {import('./logic.js').Side[]} */
  const sides = ['front', 'back'];
  const panels = sides.map(side => {
    const tab = /** @type {HTMLButtonElement} */ (required(`[data-lp-tab="${side}"]`));
    const page = /** @type {HTMLElement} */ (required(`[data-lp-side="${side}"]`));
    return { side, tab, page, label: page.getAttribute('aria-labelledby') };
  });
  const times = [...root.querySelectorAll('time[data-lp-print-date]')];
  if (times.length !== 2) throw new Error('Invalid retrieval-sheet markup: printed dates');
  const view = root.ownerDocument.defaultView;
  if (!view) throw new Error('Invalid retrieval-sheet markup: document window');
  // Validate all required markup and read host state before changing the server sheet.
  const today = new Date();
  let current = validateState(state?.read()) ?? { date: defaultDate(today), side: 'front' };
  const dates = presetDays.map(days => dateAfterDays(today, days));
  const originalTimes = times.map(time => ({ text: time.textContent, date: time.getAttribute('datetime') }));
  let destroyed = false;
  /** @type {(() => void)[]} */
  const removals = [];
  /** @param {EventTarget} target @param {string} event @param {(event: Event) => void} handler */
  function listen(target, event, handler) {
    target.addEventListener(event, handler);
    removals.push(() => target.removeEventListener(event, handler));
  }
  function showDate() {
    const label = formatDate(current.date, root.lang);
    for (const time of times) { time.setAttribute('datetime', current.date); time.textContent = frenchTypography(label, root.lang); }
  }
  function clearError() {
    input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); error.hidden = true; print.disabled = false;
  }
  /** Announce a date change; `announce` also speaks an unchanged date, for leaving the error state or opening the Date field. @param {string} date @param {boolean} [announce] */
  function changeDate(date, announce = false) {
    const message = strings.dateChanged.replaceAll('{date}', formatDate(date, root.lang));
    if (current.date === date) {
      if (announce) status.textContent = frenchTypography(message, root.lang);
      else if (status.textContent === strings.dateError) status.textContent = '';
      return;
    }
    current = { ...current, date }; showDate();
    status.textContent = frenchTypography(message, root.lang);
    state?.write({ ...current });
  }
  function showSide() {
    for (const { side, tab, page } of panels) {
      const selected = current.side === side;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
      page.hidden = !selected;
    }
  }
  /** @param {import('./logic.js').Side} side */
  function select(side) {
    if (current.side === side) return;
    current = { ...current, side }; showSide(); state?.write({ ...current });
  }
  input.value = current.date; showDate(); showSide();
  const selected = dates.indexOf(current.date);
  choices.forEach((choice, index) => {
    choice.radio.checked = index === (selected === -1 ? presetDays.length : selected);
    setChoiceDate(choice, index < dates.length ? formatShortDate(dates[index], root.lang) : selected === -1 ? formatShortDate(current.date, root.lang) : '');
  });
  customField.hidden = selected !== -1;
  const custom = choices[presetDays.length];
  listen(spacing, 'change', () => {
    const selected = choices.find(choice => choice.radio.checked);
    if (!selected) return;
    customField.hidden = selected.days !== 'custom';
    clearError();
    input.value = current.date;
    if (selected.days === 'custom') {
      setChoiceDate(custom, formatShortDate(current.date, root.lang));
      changeDate(current.date, true);
      return;
    }
    const date = dateAfterDays(today, Number(selected.days));
    input.value = date; changeDate(date);
  });
  tablist.setAttribute('role', 'tablist');
  for (const { side, tab, page } of panels) {
    tab.setAttribute('role', 'tab');
    page.setAttribute('role', 'tabpanel'); page.setAttribute('aria-labelledby', tab.id); page.tabIndex = 0;
    listen(tab, 'click', () => select(side));
    listen(tab, 'keydown', event => {
      const key = /** @type {KeyboardEvent} */ (event).key;
      let target;
      if (key === 'ArrowLeft' || key === 'ArrowRight') target = panels.find(panel => panel.side !== side);
      else if (key === 'Home') target = panels[0];
      else if (key === 'End') target = panels[1];
      else return;
      event.preventDefault();
      // The destination must already be selected when assistive technology sees focus.
      if (target) { select(target.side); target.tab.focus(); }
    });
  }
  function checkInput() {
    if (customField.hidden) return;
    if (!isDate(input.value) || isPartialYear(input.value)) {
      setChoiceDate(custom, '');
      // Native date segments can emit several changes while the field stays invalid.
      if (!error.hidden) return;
      input.setAttribute('aria-invalid', 'true'); error.hidden = false; print.disabled = true;
      // The status region speaks the error once in every browser. Firefox with NVDA ignores a new description on the
      // focused field and Chrome speaks it as well, so the description is added only once focus leaves.
      if (root.ownerDocument.activeElement !== input) input.setAttribute('aria-describedby', error.id);
      status.textContent = frenchTypography(strings.dateError, root.lang);
      return;
    }
    const recovered = !error.hidden;
    clearError();
    setChoiceDate(custom, formatShortDate(input.value, root.lang));
    // Native date controls may emit more than one change for the same value; leaving the error always speaks the date.
    changeDate(input.value, recovered);
  }
  // While a year is being typed, nothing changes; leaving the field with a partial year shows the error.
  listen(input, 'change', () => { if (!(isPartialYear(input.value) && root.ownerDocument.activeElement === input)) checkInput(); });
  listen(input, 'blur', () => {
    if (isPartialYear(input.value)) checkInput();
    if (!error.hidden) input.setAttribute('aria-describedby', error.id);
  });
  listen(print, 'click', () => {
    root.setAttribute('data-lp-printing', '');
    status.textContent = frenchTypography(strings.printing, root.lang);
    view.print();
  });
  listen(view, 'afterprint', () => root.removeAttribute('data-lp-printing'));
  controls.hidden = false; tablist.hidden = false; printControls.hidden = false;
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const remove of removals) remove();
      controls.hidden = true; tablist.hidden = true; customField.hidden = true; printControls.hidden = true;
      for (const { radio } of choices) radio.checked = radio.defaultChecked;
      tablist.removeAttribute('role'); input.value = input.defaultValue;
      input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); error.hidden = true; print.disabled = false;
      for (const { tab, page, label } of panels) {
        tab.removeAttribute('role'); tab.removeAttribute('aria-selected'); tab.removeAttribute('tabindex');
        page.hidden = false; page.removeAttribute('role'); page.removeAttribute('tabindex');
        if (label === null) page.removeAttribute('aria-labelledby'); else page.setAttribute('aria-labelledby', label);
      }
      times.forEach((time, index) => {
        const original = originalTimes[index];
        if (original) {
          time.textContent = frenchTypography(original.text, root.lang);
          if (original.date === null) time.removeAttribute('datetime'); else time.setAttribute('datetime', original.date);
        }
      });
      root.removeAttribute('data-lp-printing'); status.textContent = ''; instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
