import { summarize, runSamples, validateContent } from './logic.js';
import { labelAnswers } from '../../proxy/logic/rubric.js';
import { renderRow, summaryText, format } from './render.js';
import { renderDataNotice } from '../../lib/data-notice.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();
/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: unknown): void }, ask?: import('../../lib/ask.js').Ask }} options
 */
export function enhance(root, { content, strings, ask }) {
  const existing = instances.get(root); if (existing) return existing;
  validateContent(content); const original = root.innerHTML;
  /** @template {HTMLElement} T @param {string} selector @returns {T} */
  function required(selector) {
    const element = root.querySelector(selector); if (!element) throw new Error(`Missing feedback-rules markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  const controls = required('[data-lp-controls]'), notice = required('[data-lp-notice]'), challengeSlot = required('[data-lp-challenge]');
  const run = /** @type {HTMLButtonElement} */ (required('[data-lp-run]'));
  const language = /** @type {HTMLSelectElement} */ (required('[data-lp-language]'));
  const instanceId = language.id.slice(0, -'-language'.length);
  const body = required('tbody'), summary = required('[data-lp-summary]'), info = required('[data-lp-run-info]');
  const offline = required('[data-lp-offline]'), progress = required('[data-lp-progress]'), errors = required('[data-lp-errors]'), status = required('[role="status"]');
  const lifetime = new AbortController(); let destroyed = false, pending = false, model = '', modelName = '';
  /** @returns {'en' | 'fr'} */ const lang = () => language.value === 'fr' ? 'fr' : 'en';
  /** @type {import('./logic.js').Results} */ let results = Object.create(null);
  const saved = () => {
    const value = summarize(content, content.savedRun.answers[lang()], content.savedRun.model);
    body.innerHTML = value.rows.map(row => renderRow(content, strings, row, lang(), instanceId, true)).join('');
    summary.textContent = summaryText(value, strings);
    info.textContent = format(strings.saved, { date: content.savedRun.date, model: content.savedRun.modelName });
    errors.hidden = true; progress.hidden = true;
  };
  const fresh = () => {
    const value = summarize(content, {}, model);
    body.innerHTML = value.rows.map(row => renderRow(content, strings, row, lang(), instanceId, true)).join('');
    summary.textContent = summaryText(value, strings); info.textContent = format(strings.ready, { model: modelName });
    errors.hidden = true; progress.hidden = true;
  };
  const fallback = () => { run.hidden = true; offline.hidden = false; notice.hidden = true; saved(); };
  controls.hidden = false;
  if (ask) {
    run.disabled = true;
    Promise.resolve().then(() => ask.config()).then(config => {
      if (destroyed) return;
      if (!config.model) throw new Error('Missing configured model');
      model = config.model; modelName = config.model === content.savedRun.model ? content.savedRun.modelName : config.model;
      notice.innerHTML = renderDataNotice(config, root.lang, `${notice.id}-text`);
      notice.hidden = false; offline.hidden = true; run.disabled = false; run.setAttribute('aria-describedby', `${notice.id}-text`);
      fresh();
    }).catch(() => { if (!destroyed) fallback(); });
  } else fallback();
  const onLanguage = () => { if (!pending) { status.textContent = ''; if (run.hidden) saved(); else fresh(); } };
  const onRun = async () => {
    if (pending || run.disabled || run.hidden || !ask) return;
    pending = true; results = Object.create(null); status.textContent = ''; errors.hidden = true;
    run.setAttribute('aria-disabled', 'true'); run.textContent = strings.running; language.disabled = true;
    info.textContent = format(strings.live, { model: modelName }); progress.hidden = false;
    const value = summarize(content, results, model);
    body.innerHTML = value.rows.map(row => renderRow(content, strings, row, lang(), instanceId, true)).join(''); summary.textContent = summaryText(value, strings);
    progress.textContent = format(strings.progress, { done: 0, total: content.fixtures.length });
    try {
      // The first sample obtains clearance alone, so concurrent requests never compete for one widget.
      /** @type {Promise<import('./logic.js').Answers> | undefined} */ let clearance;
      await runSamples(content.fixtures, async fixture => {
        if (clearance) { try { await clearance; } catch { lifetime.signal.throwIfAborted(); } }
        const request = (async () => {
          const answers = await ask('16-fixtures', { answer: fixture.answer[lang()] }, { challengeSlot, signal: lifetime.signal });
          labelAnswers(answers, model); return /** @type {import('./logic.js').Answers} */ (answers);
        })();
        clearance ??= request; return request;
      }, (id, answer) => {
        results[id] = answer; const value = summarize(content, results, model);
        const row = /** @type {typeof value.rows[number]} */ (value.rows.find(row => row.id === id));
        const previous = required(`[data-lp-row="${id}"]`);
        previous.nextElementSibling?.remove();
        previous.outerHTML = renderRow(content, strings, row, lang(), instanceId, true);
        summary.textContent = summaryText(value, strings); progress.textContent = format(strings.progress, { done: Object.keys(results).length, total: content.fixtures.length });
      }, lifetime.signal);
      if (destroyed) return;
      const value = summarize(content, results, model); errors.hidden = !value.failed;
      if (value.failed === content.fixtures.length) { fallback(); status.textContent = strings.unavailable; }
      else status.textContent = summaryText(value, strings);
    } catch (error) {
      // destroy() cancels the run and restores the saved table.
      if (!destroyed) throw error;
    } finally {
      if (!destroyed) { pending = false; run.removeAttribute('aria-disabled'); run.textContent = strings.run; language.disabled = false; }
    }
  };
  /** @param {Event} event */
  const onToggle = event => {
    if (event.target instanceof HTMLDetailsElement) event.target.querySelector('summary')?.setAttribute('aria-expanded', String(event.target.open));
  };
  root.addEventListener('toggle', onToggle, true);
  language.addEventListener('change', onLanguage); run.addEventListener('click', onRun);
  const instance = { destroy() {
    if (destroyed) return; destroyed = true; lifetime.abort();
    language.removeEventListener('change', onLanguage); run.removeEventListener('click', onRun);
    root.removeEventListener('toggle', onToggle, true);
    root.innerHTML = original; instances.delete(root);
  } };
  instances.set(root, instance); return instance;
}
