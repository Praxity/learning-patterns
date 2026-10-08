import { dateAfterDays, defaultDate, formatDate, formatShortDate, isDate, presetDays, validateContent, validateState } from './logic.js';

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
    label: required(`[data-lp-spacing] label:has(input[value="${days}"]) [data-lp-choice-date]`)
  }));
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
    for (const time of times) { time.setAttribute('datetime', current.date); time.textContent = label; }
  }
  function clearError() {
    input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); error.hidden = true; print.disabled = false;
  }
  /** @param {string} date */
  function changeDate(date) {
    if (current.date === date) {
      if (status.textContent === strings.dateError) status.textContent = '';
      return;
    }
    current = { ...current, date }; showDate();
    status.textContent = strings.dateChanged.replaceAll('{date}', formatDate(current.date, root.lang));
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
  choices.forEach(({ radio, label }, index) => {
    radio.checked = index === (selected === -1 ? presetDays.length : selected);
    label.textContent = index < dates.length ? formatShortDate(dates[index], root.lang) : selected === -1 ? formatShortDate(current.date, root.lang) : '';
  });
  customField.hidden = selected !== -1;
  const customLabel = choices[presetDays.length].label;
  listen(spacing, 'change', () => {
    const selected = choices.find(choice => choice.radio.checked);
    if (!selected) return;
    customField.hidden = selected.days !== 'custom';
    clearError();
    input.value = current.date;
    if (selected.days === 'custom') {
      customLabel.textContent = formatShortDate(current.date, root.lang);
      changeDate(current.date);
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
  listen(input, 'change', () => {
    if (customField.hidden) return;
    if (!isDate(input.value)) {
      customLabel.textContent = '';
      // Native date segments can emit several changes while the field stays invalid.
      if (!error.hidden) return;
      input.setAttribute('aria-invalid', 'true'); error.hidden = false;
      input.setAttribute('aria-describedby', error.id); print.disabled = true;
      // The focused field's new description supplies the error; a live update repeats it.
      status.textContent = root.ownerDocument.activeElement === input ? '' : strings.dateError;
      return;
    }
    clearError();
    customLabel.textContent = formatShortDate(input.value, root.lang);
    // Native date controls may emit more than one change for the same value.
    changeDate(input.value);
  });
  listen(print, 'click', () => {
    root.setAttribute('data-lp-printing', '');
    status.textContent = strings.printing;
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
          time.textContent = original.text;
          if (original.date === null) time.removeAttribute('datetime'); else time.setAttribute('datetime', original.date);
        }
      });
      root.removeAttribute('data-lp-printing'); status.textContent = ''; instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
