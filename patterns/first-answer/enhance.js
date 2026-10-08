import { MAX_LENGTH, emptyState, validateAnswer, validateContent, validateState, withFirstAnswer, withAnswerNow, withChecks } from './logic.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void } }} options
 */
export function enhance(root, { content, strings, state }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  const stage = root.dataset.lpStage;
  if (!['first', 'end', 'both'].includes(stage ?? '')) throw new Error('Invalid first-answer stage markup');
  /** @template {HTMLElement} T @param {string} selector @returns {T} */
  function required(selector) {
    const element = root.querySelector(selector);
    if (!element) throw new Error(`Missing first-answer markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  const firstInput = /** @type {HTMLTextAreaElement} */ (required('[data-lp-first-input]'));
  const firstError = required('[data-lp-first-error]');
  const first = stage === 'end' ? null : {
    step: required('[data-lp-first-step]'), editor: required('[data-lp-first-editor]'),
    saved: required('[data-lp-first-saved]'), quote: required('[data-lp-first-quote]'), date: required('[data-lp-first-date]'),
    save: required('[data-lp-save-first]')
  };
  const end = stage === 'first' ? null : {
    step: required('[data-lp-end-step]'), heading: required('[data-lp-end-heading]'),
    input: /** @type {HTMLTextAreaElement} */ (required('[data-lp-now-input]')), error: required('[data-lp-now-error]'),
    compare: required('[data-lp-compare]'), missing: required('[data-lp-missing]'), result: required('[data-lp-result]'),
    resultHeading: required('[data-lp-result-heading]'),
    firstQuote: required('[data-lp-panel-first]'), firstDate: required('[data-lp-panel-first-date]'),
    retry: required('[data-lp-try-again]'), summary: required('[data-lp-summary]')
  };
  const course = stage === 'both' ? required('[data-lp-course]') : null;
  const skip = stage === 'both' ? required('[data-lp-skip]') : null;
  const endFallback = stage === 'end' ? required('[data-lp-end-fallback]') : null;
  const fallback = required('[data-lp-fallback]');
  const restart = required('[data-lp-restart]');
  const problem = required('[data-lp-storage-error]');
  const status = required('[role="status"]');
  const boxes = end ? [...end.result.querySelectorAll('input')] : [];
  if (end && (boxes.length !== content.checks.length || boxes.some((box, index) => box.type !== 'checkbox' || box.value !== content.checks[index].id))) throw new Error('Invalid first-answer checks markup');
  const format = new Intl.DateTimeFormat(root.lang, { dateStyle: 'medium', timeStyle: 'short' });
  /** @param {string} iso */
  const when = iso => format.format(new Date(iso));
  let record = emptyState(content);
  let blocked = false;
  let endOpen = stage === 'end';
  // Retrying edits a local draft; the saved now answer survives until Compare succeeds.
  let editing = false;
  let destroyed = false;
  /** @type {(() => void)[]} */
  const removals = [];
  /** @param {HTMLElement} target @param {string} event @param {() => void} handler */
  function listen(target, event, handler) {
    target.addEventListener(event, handler);
    removals.push(() => target.removeEventListener(event, handler));
  }
  /** @param {string} text */
  function showProblem(text) {
    problem.textContent = text; problem.hidden = !text;
  }
  /** @param {HTMLTextAreaElement} input @param {HTMLElement} error @param {string} text */
  function fieldError(input, error, text) {
    error.textContent = text; error.hidden = !text;
    if (text) {
      input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', error.id); input.focus();
    } else {
      input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby');
    }
  }
  /** @param {HTMLTextAreaElement} input @param {HTMLElement} error */
  function answer(input, error) {
    const result = validateAnswer(input.value);
    fieldError(input, error, result.ok ? '' : strings[result.error].replaceAll('{max}', String(MAX_LENGTH)));
    return result;
  }

  /** Preserve elements and drafts. Only submitted records update quotes and summary.
   * @param {boolean} [restoreDraft]
   */
  function paint(restoreDraft = false) {
    if (first) {
      first.step.hidden = (record.first === null && record.now !== null) || (stage === 'both' && endOpen);
      first.editor.hidden = record.first !== null;
      first.saved.hidden = record.first === null;
      first.save.hidden = record.first !== null;
      first.quote.textContent = record.first?.text ?? '';
      first.date.textContent = record.first ? strings.saved.replaceAll('{date}', when(record.first.savedAt)) : '';
    }
    if (course) course.hidden = !record.first || endOpen;
    if (end) {
      end.step.hidden = !endOpen;
      end.missing.hidden = record.first !== null;
      const locked = record.now !== null && !editing;
      end.result.hidden = !locked;
      end.input.readOnly = locked;
      end.compare.hidden = locked;
      end.retry.hidden = !locked;
      end.firstQuote.textContent = record.first?.text ?? strings.missing;
      end.firstDate.textContent = record.first ? strings.saved.replaceAll('{date}', when(record.first.savedAt)) : '';
      for (const box of boxes) box.checked = record.checks[box.value];
      end.summary.textContent = strings.summary.replaceAll('{count}', String(boxes.filter(box => box.checked).length)).replaceAll('{total}', String(content.checks.length));
      if (restoreDraft) end.input.value = record.now?.text ?? '';
    }
    restart.hidden = !record.first && !record.now && !blocked;
  }

  // Reread before writes so two course placements cannot overwrite a saved first.
  // Cross-tab/device races need an atomic adapter supplied by the host.
  function readHost() {
    if (blocked) return false;
    if (!state) return true;
    let raw;
    try { raw = state.read(); }
    catch { blocked = true; showProblem(strings.unreadable); paint(); return false; }
    const saved = raw === null || raw === undefined ? emptyState(content) : validateState(content, raw);
    if (!saved) { blocked = true; showProblem(strings.unreadable); paint(); return false; }
    record = saved;
    return true;
  }

  /** Commit before changing displayed state. A failed write leaves the old record.
   * @param {import('./logic.js').LearnerState} next @param {string | null} message
   */
  function persist(next, message) {
    const copy = validateState(content, next);
    if (!copy) throw new Error('Invalid next state');
    try { state?.write(copy); }
    catch { showProblem(strings.writeFailed); status.textContent = strings.writeFailed; paint(); return false; }
    record = next; showProblem('');
    if (message !== null) status.textContent = message;
    return true;
  }

  if (first) listen(first.save, 'click', () => {
    if (blocked || record.first) return;
    const result = answer(firstInput, firstError);
    if (!result.ok || !readHost()) return;
    if (record.first || record.now) {
      if (stage === 'both') endOpen = true;
      paint(true); return;
    }
    if (!persist(withFirstAnswer(content, record, result.text, new Date().toISOString()), strings.firstSaved)) return;
    paint();
    // The save button hides with its editor, so focus moves on: to Skip in the demo, else to the saved answer.
    if (skip && !skip.hidden) skip.focus();
    else { first.saved.tabIndex = -1; first.saved.focus(); }
  });
  if (skip && end) listen(skip, 'click', () => {
    endOpen = true; paint(); end.heading.focus();
  });
  if (end) {
    listen(end.compare, 'click', () => {
      if (blocked || (record.now && !editing)) return;
      const result = answer(end.input, end.error);
      if (!result.ok || !readHost()) return;
      if (persist(withAnswerNow(content, record, result.text, new Date().toISOString()), strings.compared)) {
        editing = false; paint(); end.resultHeading.focus();
      }
    });
    listen(end.retry, 'click', () => {
      if (!record.now || editing) return;
      editing = true; paint(); end.input.focus();
    });
    for (const box of boxes) listen(box, 'change', () => {
      const checked = box.checked;
      if (!readHost()) { paint(); return; }
      if (!record.now) { paint(); return; }
      persist(withChecks(content, record, { ...record.checks, [box.value]: checked }), null);
      paint();
    });
  }
  listen(restart, 'click', () => {
    if (!persist(emptyState(content), strings.cleared)) return;
    blocked = false; endOpen = stage === 'end'; editing = false;
    firstInput.value = ''; fieldError(firstInput, firstError, '');
    if (end) { end.input.value = ''; fieldError(end.input, end.error, ''); }
    paint();
    (stage === 'end' && end ? end.input : firstInput).focus();
  });

  readHost();
  if (record.first || record.now) endOpen = stage !== 'first';
  paint(true); fallback.hidden = true;
  if (endFallback) endFallback.hidden = true;
  const instance = {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const remove of removals) remove();
      fallback.hidden = false; if (endFallback) endFallback.hidden = false;
      if (first) {
        first.step.hidden = false; first.editor.hidden = false; first.saved.hidden = true;
        first.save.hidden = true; first.save.removeAttribute('aria-disabled');
      }
      if (end) { end.step.hidden = true; end.result.hidden = true; end.retry.hidden = true; end.input.readOnly = false; end.compare.hidden = false; fieldError(end.input, end.error, ''); }
      if (course) course.hidden = true;
      restart.hidden = true; showProblem(''); status.textContent = '';
      fieldError(firstInput, firstError, ''); instances.delete(root);
    }
  };
  instances.set(root, instance);
  return instance;
}
