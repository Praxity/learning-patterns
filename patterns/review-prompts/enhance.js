import { isoDate, scheduleReview, validateContent, validateState } from './logic.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options
 */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  /** @template {Element} T @param {Element} parent @param {string} selector @returns {T} */
  function required(parent, selector) {
    const element = parent.querySelector(selector);
    if (!element) throw new Error(`Missing review-prompts markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  const status = /** @type {HTMLElement} */ (required(root, '[role="status"]'));
  const sections = [...root.querySelectorAll('[data-lp-part]')];
  if (sections.length !== content.parts.length) throw new Error('Invalid review-prompts markup: parts');
  // Validate every part before changing markup or attaching any listeners.
  const blocks = sections.map((section, index) => {
    const part = content.parts[index];
    if (!part || section.getAttribute('data-lp-part') !== part.id) throw new Error('Invalid review-prompts markup: part identity');
    const details = /** @type {HTMLDetailsElement} */ (required(section, 'details'));
    required(details, 'summary'); required(details, '[data-lp-answer]');
    const rating = /** @type {HTMLElement} */ (required(details, '[data-lp-rating]'));
    const review = /** @type {HTMLElement} */ (required(rating, '[data-lp-review]'));
    const buttons = [...rating.querySelectorAll('button')];
    if (buttons.length !== 2 || buttons[0]?.dataset.lpResult !== 'remembered' || buttons[1]?.dataset.lpResult !== 'forgot') throw new Error('Invalid review-prompts markup: result buttons');
    return { part, details, rating, review, buttons };
  });
  // Formatting the stored civil date in UTC avoids changing its day in another time zone.
  const format = new Intl.DateTimeFormat(root.lang.toLowerCase().startsWith('fr') ? 'fr-CA' : 'en-CA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  });
  let current = validateState(content, state?.read()) ?? { results: {} };
  let destroyed = false;
  /** @type {(() => void)[]} */
  const removals = [];
  /** @param {Element} target @param {string} event @param {() => void} handler */
  function listen(target, event, handler) {
    target.addEventListener(event, handler);
    removals.push(() => target.removeEventListener(event, handler));
  }
  /** @param {typeof blocks[number]} block @param {import('./logic.js').Review} record @returns {string} */
  function show(block, record) {
    const date = format.format(new Date(`${record.reviewOn}T00:00:00Z`));
    const time = root.ownerDocument.createElement('time');
    time.dateTime = record.reviewOn; time.textContent = date;
    // Keep the time element even if the host puts {date} first or repeats it.
    const chunks = strings.nextReview.split('{date}');
    block.review.replaceChildren();
    chunks.forEach((text, index) => {
      if (index > 0) block.review.append(time.cloneNode(true));
      block.review.append(text);
    });
    block.review.hidden = false;
    for (const button of block.buttons) {
      const selected = button.dataset.lpResult === record.result;
      button.setAttribute('aria-pressed', String(selected));
      button.querySelector('[data-lp-mark]')?.remove();
      if (selected) {
        const mark = root.ownerDocument.createElement('span');
        mark.dataset.lpMark = ''; mark.className = 'lp-review-prompts-mark';
        mark.setAttribute('aria-hidden', 'true'); mark.textContent = '✓ ';
        button.prepend(mark);
      }
    }
    return strings.nextReview.replaceAll('{date}', date);
  }
  for (const block of blocks) {
    const saved = Object.hasOwn(current.results, block.part.id) ? current.results[block.part.id] : undefined;
    if (saved) { block.details.open = true; show(block, saved); }
    block.rating.hidden = !block.details.open;
    listen(block.details, 'toggle', () => { block.rating.hidden = !block.details.open; });
    for (const button of block.buttons) {
      const choice = /** @type {import('./logic.js').Result} */ (button.dataset.lpResult);
      listen(button, 'click', () => {
        if (!block.details.open) return;
        const record = { result: choice, reviewOn: isoDate(scheduleReview(new Date(), choice, content.reviewDays)) };
        current = { results: { ...current.results, [block.part.id]: record } };
        status.textContent = show(block, record);
        // A host receives its own copy so it cannot mutate the current interaction.
        state?.write({ results: Object.fromEntries(Object.entries(current.results).map(([id, row]) => [id, { ...row }])) });
      });
    }
  }
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const remove of removals) remove();
      for (const block of blocks) {
        block.rating.hidden = true; block.review.replaceChildren(); block.review.hidden = true;
        for (const button of block.buttons) { button.setAttribute('aria-pressed', 'false'); button.querySelector('[data-lp-mark]')?.remove(); }
      }
      status.textContent = '';
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
