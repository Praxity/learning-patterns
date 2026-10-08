import { check, markLimit, validateContent, validateState } from './logic.js';
import { escapeHtml as html } from '../../lib/html.js';
import { icons } from '../../lib/icons.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options
 */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  /** @param {string} selector @returns {HTMLElement} */
  function required(selector) {
    const element = root.querySelector(selector);
    if (!element) throw new Error(`Missing highlight markup: ${selector}`);
    return /** @type {HTMLElement} */ (element);
  }
  const passage = required('[data-lp-passage]');
  const instructions = required('[data-lp-instructions]');
  const fallback = required('[data-lp-fallback]');
  const flow = required('[data-lp-flow]');
  const count = required('[data-lp-count]');
  const limit = required('[data-lp-limit]');
  const max = markLimit(content);
  const summary = required('[data-lp-summary]');
  const submit = required('[data-lp-check]');
  const restart = required('[data-lp-restart]');
  const status = required('[role="status"]');
  const chunks = [...passage.querySelectorAll('span[data-lp-chunk]')].map(element => /** @type {HTMLElement} */ (element));
  const authored = content.paragraphs.flat();
  const feedback = [...passage.querySelectorAll('span[data-lp-feedback]')].map(element => /** @type {HTMLElement} */ (element));
  if (!instructions.id || chunks.length !== authored.length || feedback.length !== authored.length || chunks.some((chunk, i) => chunk.getAttribute('data-lp-chunk') !== authored[i]?.id || chunk.textContent !== authored[i]?.text || chunk.nextElementSibling !== feedback[i] || !feedback[i]?.id)) {
    throw new Error('Invalid highlight passage markup');
  }
  // Read host state before changing the DOM; adapter errors propagate to the host.
  const saved = validateState(content, state?.read());
  const marked = new Set(saved?.marked ?? []);
  let shown = false;
  let destroyed = false;
  const controller = new AbortController();
  const markedIds = () => authored.filter(chunk => marked.has(chunk.id)).map(chunk => chunk.id);
  const save = () => state?.write({ marked: markedIds(), shown });

  /** @param {number} index */
  function move(index) {
    chunks[(index + chunks.length) % chunks.length].focus();
  }

  function paintMarks() {
    for (let i = 0; i < chunks.length; i++) chunks[i].setAttribute('aria-pressed', String(marked.has(authored[i].id)));
    count.textContent = strings.count.replaceAll('{n}', String(marked.size)).replaceAll('{max}', String(max));
    restart.hidden = marked.size === 0 && !shown;
  }

  function clearLimit() {
    if (limit.hidden) return;
    limit.replaceChildren(); limit.hidden = true;
    status.replaceChildren();
  }

  /** @param {number} index */
  function toggle(index) {
    if (shown) return;
    const id = authored[index].id;
    if (marked.has(id)) {
      marked.delete(id); clearLimit();
    } else if (marked.size >= max) {
      if (limit.hidden) {
        const message = (max === 1 ? strings.limitOne : strings.limitMany).replaceAll('{n}', String(max));
        limit.textContent = message; limit.hidden = false;
        status.textContent = message;
      }
      return;
    } else marked.add(id);
    paintMarks(); save();
  }

  /** @param {boolean} announce */
  function show(announce) {
    if (shown) return;
    clearLimit();
    const result = check(content, markedIds());
    const message = (content.mode === 'key' ? strings.keySummary : strings.evidenceSummary).replaceAll('{n}', String(result.found)).replaceAll('{total}', String(result.total));
    result.items.forEach((item, i) => {
      const chunk = chunks[i]; const mark = feedback[i];
      chunk.setAttribute('aria-disabled', 'true');
      if (item.outcome === 'unmarked') return;
      chunk.setAttribute('data-lp-outcome', item.outcome);
      mark.setAttribute('data-lp-outcome', item.outcome);
      let label; let icon;
      if (item.outcome === 'correct') {
        label = content.mode === 'key' ? strings.correctKey : strings.correctEvidence; icon = icons.check;
      } else if (item.outcome === 'missed') {
        label = strings.missed; icon = icons['circle-plus'];
      } else {
        label = content.mode === 'key' ? `${strings.wrongKey}${item.note ? ` ${item.note}` : ''}` : (item.note ?? strings.wrongEvidence);
        icon = icons['info-circle'];
      }
      mark.innerHTML = `${icon}${html(label)}`;
      mark.hidden = false;
      chunk.setAttribute('aria-describedby', `${instructions.id} ${mark.id}`);
    });
    shown = true;
    summary.textContent = message; summary.hidden = false;
    // Check has done its job; Start over takes focus so it isn't lost with the hidden button.
    const hadFocus = root.contains(document.activeElement) && document.activeElement === submit;
    submit.hidden = true;
    restart.hidden = false;
    if (hadFocus) restart.focus();
    if (announce) status.textContent = message;
  }

  function clearResult() {
    clearLimit();
    for (let i = 0; i < chunks.length; i++) {
      chunks[i].removeAttribute('aria-disabled');
      chunks[i].removeAttribute('data-lp-outcome');
      chunks[i].setAttribute('aria-describedby', instructions.id);
      feedback[i].replaceChildren(); feedback[i].hidden = true;
      feedback[i].removeAttribute('data-lp-outcome');
    }
    summary.replaceChildren(); summary.hidden = true;
    submit.hidden = false;
  }

  chunks.forEach((chunk, i) => {
    // Inline spans preserve prose flow; every chunk needs a Tab stop in browse mode.
    chunk.setAttribute('role', 'button');
    chunk.tabIndex = 0;
    chunk.setAttribute('aria-describedby', instructions.id);
    chunk.addEventListener('click', () => toggle(i), { signal: controller.signal });
    chunk.addEventListener('keydown', event => {
      const key = /** @type {KeyboardEvent} */ (event).key;
      if (!['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Home', 'End', ' ', 'Enter'].includes(key)) return;
      event.preventDefault();
      // A held key repeats keydown; toggle once per press, as a native button does.
      if (key === ' ' || key === 'Enter') { if (!event.repeat) toggle(i); }
      else move(key === 'Home' ? 0 : key === 'End' ? chunks.length - 1 : i + (key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1));
    }, { signal: controller.signal });
  });
  submit.addEventListener('click', () => { if (!shown) { show(true); save(); } }, { signal: controller.signal });
  restart.addEventListener('click', () => {
    marked.clear(); shown = false;
    clearResult(); paintMarks(); move(0); save();
  }, { signal: controller.signal });
  paintMarks();
  if (saved?.shown) show(false);
  passage.setAttribute('aria-describedby', instructions.id);
  fallback.hidden = true; instructions.hidden = false; flow.hidden = false;
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true; controller.abort();
      clearResult();
      for (const chunk of chunks) {
        for (const attribute of ['role', 'tabindex', 'aria-pressed', 'aria-describedby']) chunk.removeAttribute(attribute);
      }
      flow.hidden = true; instructions.hidden = true; fallback.hidden = false;
      passage.removeAttribute('aria-describedby');
      status.replaceChildren();
      instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
