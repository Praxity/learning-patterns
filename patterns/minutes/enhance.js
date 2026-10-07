import { COUNT_FIELDS, courseEstimate, estimateMinutes, overLimit, parseCount, validateContent, validateState } from './logic.js';
import { formatText, summaryText } from './strings.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').AuthorState): void } }} options
 */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  /** @template {Element} T @param {Element} parent @param {string} selector @returns {T} */
  function required(parent, selector) {
    const element = parent.querySelector(selector);
    if (!element) throw new Error(`Missing minutes markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  const status = /** @type {HTMLElement} */ (required(root, '[role="status"]'));
  const toggle = /** @type {HTMLButtonElement} */ (required(root, '[data-lp-toggle]'));
  const instruction = /** @type {HTMLElement} */ (required(root, '[data-lp-instruction]'));
  const summary = /** @type {HTMLElement} */ (required(root, '[data-lp-summary]'));
  const sections = [...root.querySelectorAll('[data-lp-section]')];
  if (sections.length !== content.sections.length) throw new Error('Invalid minutes markup: section count');
  // Check the complete server markup before revealing controls or attaching listeners.
  const blocks = sections.map((element, index) => {
    const section = content.sections[index];
    if (!section || element.getAttribute('data-lp-section') !== section.id) throw new Error('Invalid minutes markup: section identity');
    const inputs = /** @type {HTMLElement} */ (required(element, '[data-lp-inputs]'));
    const minutes = /** @type {HTMLElement} */ (required(element, '[data-lp-minutes]'));
    const breakdown = /** @type {HTMLElement} */ (required(element, '[data-lp-breakdown]'));
    const warning = /** @type {HTMLElement} */ (required(element, '[data-lp-warning]'));
    const controls = [...inputs.querySelectorAll('input')];
    if (controls.length !== COUNT_FIELDS.length) throw new Error('Invalid minutes markup: field count');
    const fields = COUNT_FIELDS.map((key, i) => {
      const input = controls[i];
      if (!input || input.dataset.lpField !== key || input.type !== 'number') throw new Error('Invalid minutes markup: field identity or type');
      const error = /** @type {HTMLElement} */ (required(inputs, `[data-lp-error="${key}"]`));
      const text = /** @type {HTMLElement} */ (required(error, 'span'));
      return { key, input, error, text };
    });
    return { section, inputs, minutes, breakdown, warning, fields };
  });
  let current = validateState(content, state?.read()) ?? {
    authorView: false,
    sections: Object.fromEntries(content.sections.map(({ id, words, questions, narrationSeconds }) => [id, { words, questions, narrationSeconds }]))
  };
  for (const block of blocks) for (const field of block.fields) field.input.value = String(current.sections[block.section.id]?.[field.key]);
  function showAuthorView() {
    toggle.setAttribute('aria-pressed', String(current.authorView));
    instruction.hidden = !current.authorView;
    for (const block of blocks) block.inputs.hidden = !current.authorView;
  }
  /** @param {{ input: HTMLInputElement, error: HTMLElement, text: HTMLElement }} field @param {string | null} message */
  function showError(field, message) {
    field.error.hidden = message === null;
    if (message === null) {
      field.input.removeAttribute('aria-invalid'); field.input.removeAttribute('aria-describedby');
    } else {
      field.text.textContent = message;
      field.input.setAttribute('aria-invalid', 'true'); field.input.setAttribute('aria-describedby', field.error.id);
    }
  }
  /** @param {boolean} announce @returns {boolean} */
  function update(announce) {
    let invalid = false;
    /** @type {Record<string, import('./logic.js').Counts>} */
    const counts = {};
    for (const block of blocks) {
      /** @type {Partial<import('./logic.js').Counts>} */
      const values = {};
      let rowInvalid = false;
      for (const field of block.fields) {
        const value = field.input.validity.badInput ? null : parseCount(field.input.value);
        showError(field, value !== null ? null : /^\d+$/.test(field.input.value.trim()) ? strings.tooLarge : strings.invalid);
        if (value === null) rowInvalid = true;
        else values[field.key] = value;
      }
      if (!rowInvalid) {
        const rowCounts = /** @type {import('./logic.js').Counts} */ (values);
        try {
          const minutes = estimateMinutes(rowCounts.words, rowCounts.questions, rowCounts.narrationSeconds, content.rates);
          block.minutes.textContent = formatText(strings.minutes, { n: minutes }, root.lang);
          block.breakdown.textContent = formatText(strings.breakdown, rowCounts, root.lang);
          block.warning.hidden = !overLimit(minutes);
          // Object.fromEntries handles authored ids such as __proto__ as ordinary keys.
          Object.defineProperty(counts, block.section.id, { value: rowCounts, enumerable: true });
        } catch {
          rowInvalid = true;
          for (const field of block.fields) showError(field, strings.estimateTooLarge);
        }
      }
      if (rowInvalid) {
        invalid = true; block.minutes.textContent = strings.noEstimate; block.warning.hidden = true;
      }
    }
    if (!invalid) {
      try {
        const estimate = courseEstimate({ ...content, sections: content.sections.map(section => ({ ...section, ...counts[section.id] })) });
        summary.textContent = summaryText(strings, estimate.total, estimate.sections.filter(row => row.overLimit).length, root.lang);
        current = { authorView: current.authorView, sections: counts };
      } catch {
        invalid = true;
        for (const block of blocks) for (const field of block.fields) showError(field, strings.estimateTooLarge);
      }
    }
    if (invalid) summary.textContent = strings.fix;
    if (announce) status.textContent = summary.textContent;
    return !invalid;
  }
  function save() {
    state?.write({ authorView: current.authorView, sections: Object.fromEntries(Object.entries(current.sections).map(([id, counts]) => [id, { ...counts }])) });
  }
  function onToggle() { current.authorView = !current.authorView; showAuthorView(); save(); }
  /** @param {Event} event */
  function onEdit(event) {
    if (!current.authorView || !blocks.some(block => block.fields.some(field => field.input === event.target))) return;
    const valid = update(event.type === 'change');
    if (event.type === 'change' && valid) save();
  }
  showAuthorView(); update(false); toggle.hidden = false;
  toggle.addEventListener('click', onToggle); root.addEventListener('input', onEdit); root.addEventListener('change', onEdit);
  let destroyed = false;
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      toggle.removeEventListener('click', onToggle); root.removeEventListener('input', onEdit); root.removeEventListener('change', onEdit);
      toggle.hidden = true; toggle.setAttribute('aria-pressed', 'false'); instruction.hidden = true;
      for (const block of blocks) block.inputs.hidden = true;
      status.textContent = ''; instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
