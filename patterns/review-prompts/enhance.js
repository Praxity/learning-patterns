import { frenchTypography } from '../../lib/html.js';
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
  const progress = /** @type {HTMLElement} */ (required(root, '[data-lp-progress]'));
  const sections = [...root.querySelectorAll('[data-lp-part]')];
  if (sections.length !== content.parts.length) throw new Error('Invalid review-prompts markup: parts');
  // Validate every part before changing markup or attaching any listeners.
  const blocks = sections.map((section, index) => {
    const part = content.parts[index];
    if (!part || section.getAttribute('data-lp-part') !== part.id) throw new Error('Invalid review-prompts markup: part identity');
    const details = /** @type {HTMLDetailsElement} */ (required(section, 'details'));
    required(details, 'summary'); required(details, '[data-lp-fallback-answer]');
    const commit = /** @type {HTMLButtonElement} */ (required(section, '[data-lp-commit]'));
    const answer = /** @type {HTMLElement} */ (required(section, '[data-lp-answer]'));
    const rating = /** @type {HTMLElement} */ (required(section, '[data-lp-rating]'));
    const review = /** @type {HTMLElement} */ (required(rating, '[data-lp-review]'));
    const reviewText = /** @type {HTMLElement} */ (required(review, '[data-lp-review-text]'));
    const buttons = [...rating.querySelectorAll('button')];
    if (buttons.length !== 2 || buttons[0]?.dataset.lpResult !== 'remembered' || buttons[1]?.dataset.lpResult !== 'forgot') throw new Error('Invalid review-prompts markup: result buttons');
    return { part, details, commit, answer, rating, review, reviewText, buttons };
  });
  // Formatting the stored civil date in UTC avoids changing its day in another time zone.
  const format = new Intl.DateTimeFormat(root.lang.toLowerCase().startsWith('fr') ? 'fr-CA' : 'en-CA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  });
  let current = validateState(content, state?.read()) ?? { results: {} };
  function showProgress() {
    progress.textContent = frenchTypography(strings.progress.replaceAll('{count}', String(Object.keys(current.results).length)).replaceAll('{total}', String(content.parts.length)), root.lang);
  }
  showProgress(); progress.hidden = false;
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
    time.dateTime = record.reviewOn; time.textContent = frenchTypography(date, root.lang);
    // Keep the time element even if the host puts {date} first or repeats it.
    const chunks = strings.nextReview.split('{date}');
    block.reviewText.replaceChildren();
    chunks.forEach((text, index) => {
      if (index > 0) block.reviewText.append(time.cloneNode(true));
      block.reviewText.append(text);
    });
    block.review.hidden = false;
    for (const button of block.buttons) {
      const selected = button.dataset.lpResult === record.result;
      button.setAttribute('aria-pressed', String(selected));
    }
    return strings.nextReview.replaceAll('{date}', date);
  }
  for (const block of blocks) {
    const saved = Object.hasOwn(current.results, block.part.id) ? current.results[block.part.id] : undefined;
    const revealed = Boolean(saved) || block.details.open;
    block.details.hidden = true;
    block.commit.hidden = revealed;
    block.answer.hidden = !revealed;
    block.rating.hidden = !revealed;
    if (saved) show(block, saved);
    listen(block.commit, 'click', () => {
      block.answer.hidden = false;
      block.rating.hidden = false;
      block.commit.hidden = true;
      block.answer.focus();
    });
    for (const button of block.buttons) {
      const choice = /** @type {import('./logic.js').Result} */ (button.dataset.lpResult);
      listen(button, 'click', () => {
        if (block.answer.hidden) return;
        const record = { result: choice, reviewOn: isoDate(scheduleReview(new Date(), choice, content.reviewDays)) };
        current = { results: { ...current.results, [block.part.id]: record } };
        showProgress();
        status.textContent = frenchTypography(show(block, record), root.lang);
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
        block.details.open = !block.answer.hidden;
        block.details.hidden = false; block.commit.hidden = true; block.answer.hidden = true;
        block.rating.hidden = true; block.reviewText.replaceChildren(); block.review.hidden = true;
        for (const button of block.buttons) button.setAttribute('aria-pressed', 'false');
      }
      status.textContent = '';
      progress.hidden = true;
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
