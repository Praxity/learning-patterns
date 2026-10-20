import { start, turn, feedback, validateContent, validateState } from './logic.js';
import { renderMichel, renderChoices, renderDebrief } from './render.js';
import { escapeHtml as html, frenchTypography } from '../../lib/html.js';
import { renderDataNotice, showCapNotice } from '../../lib/notice-ui.js';
import { focusAfterLayout } from '../../lib/focus-after-layout.js';
import { pendingCheck } from '../../lib/pending-check.js';

/** @type {WeakMap<HTMLElement, { destroy(): void }>} */
const instances = new WeakMap();

/** @param {HTMLElement} root
 * @param {{ content: import('./logic.js').Content, strings: import('./strings.js').Strings, state?: { read(): unknown, write(value: import('./logic.js').LearnerState): void }, ask?: import('../../lib/ask.js').Ask }} options
 */
export function enhance(root, { content, strings, state, ask }) {
  const existing = instances.get(root);
  if (existing) return existing;
  validateContent(content);
  const serverMarkup = root.innerHTML;
  /** @template {Element} T @param {string} selector @returns {T} */
  function required(selector) {
    const element = root.querySelector(selector);
    if (!element) throw new Error(`Missing conversation markup: ${selector}`);
    return /** @type {T} */ (element);
  }
  const chat = /** @type {HTMLElement} */ (required('[data-lp-chat]'));
  const flow = /** @type {HTMLElement} */ (required('[data-lp-flow]'));
  const composer = /** @type {HTMLElement} */ (required('[data-lp-composer]'));
  const input = /** @type {HTMLTextAreaElement} */ (required('textarea'));
  const send = /** @type {HTMLButtonElement} */ (required('[data-lp-send]'));
  const choices = /** @type {HTMLDetailsElement} */ (required('[data-lp-choices]'));
  const summary = /** @type {HTMLElement} */ (required('[data-lp-choices] summary'));
  const replies = /** @type {HTMLElement} */ (required('[data-lp-replies]'));
  const hint = /** @type {HTMLElement} */ (required('[data-lp-hint]'));
  const offline = /** @type {HTMLElement} */ (required('[data-lp-offline]'));
  const notice = /** @type {HTMLElement} */ (required('[data-lp-notice]'));
  const error = /** @type {HTMLElement} */ (required('[data-lp-error]'));
  const challengeSlot = /** @type {HTMLElement} */ (required('[data-lp-challenge]'));
  const debrief = /** @type {HTMLElement} */ (required('[data-lp-debrief]'));
  const restart = /** @type {HTMLButtonElement} */ (required('[data-lp-restart]'));
  const status = /** @type {HTMLElement} */ (required('[role="status"]'));
  const script = /** @type {HTMLElement} */ (required('[data-lp-script]'));
  const prefix = input.id.replace(/-reply$/, '');
  const lifetime = new AbortController();
  let request = new AbortController();
  let destroyed = false, automatic = Boolean(ask), capped = false, model = '', generation = 0, shownRound = 0;
  let conversation = start();
  let cancelFocus = () => {};
  const pending = pendingCheck(send, status, frenchTypography(strings.sending, root.lang));
  const save = () => state?.write({ conversation, draft: input.value });

  const refresh = () => {
    flow.hidden = conversation.end;
    composer.hidden = (!automatic && !capped) || conversation.end;
    choices.open = !automatic;
    summary.hidden = !automatic;
    offline.hidden = automatic;
    hint.hidden = true;
    replies.innerHTML = renderChoices(content, conversation.node, root.lang); shownRound = conversation.round;
    debrief.hidden = !conversation.end;
    debrief.innerHTML = conversation.end ? renderDebrief(content, strings, conversation, root.lang) : '';
  };
  /** @param {string} reply @param {string} line @param {string} note */
  const append = (reply, line, note) => {
    chat.insertAdjacentHTML('beforeend', `<li class="lp-conversation-turn lp-conversation-turn-you"><p class="lp-conversation-bubble" data-lp-you><span class="lp-conversation-speaker">${html(strings.you, root.lang)}</span>${html(reply, root.lang)}</p></li>${renderMichel(content, line, `${prefix}-line-${conversation.round}`, root.lang)}${note ? `<li class="lp-conversation-note" data-lp-note><em>${html(note, root.lang)}</em></li>` : ''}`);
  };
  /** Focus is the one announcement for a completed turn; never repeat it in status.
   * Controls update after focus moves: focus on the body makes Chrome with NVDA read the whole activity. */
  const focusMichel = () => {
    cancelFocus();
    cancelFocus = focusAfterLayout(/** @type {HTMLElement} */ (chat.querySelectorAll('[data-lp-michel]')[conversation.round]), refresh, lifetime.signal);
  };
  /** @returns {boolean} Focus moved to the message, so status stays empty. */
  const useFallback = () => {
    const moveFocus = !capped && composer.contains(root.ownerDocument.activeElement);
    automatic = false;
    notice.hidden = true; input.removeAttribute('aria-describedby');
    refresh();
    if (moveFocus) {
      composer.hidden = false; offline.tabIndex = -1;
      cancelFocus();
      cancelFocus = focusAfterLayout(offline, () => { composer.hidden = true; }, lifetime.signal);
    }
    return moveFocus;
  };
  /** @param {import('./logic.js').Branch | 'unsure' | 'off_script'} branch @param {string} reply */
  const take = (branch, reply) => {
    const result = turn(content, conversation, branch, reply);
    if (!result.line) {
      hint.textContent = frenchTypography(result.note, root.lang); hint.hidden = false; choices.open = true;
      status.textContent = frenchTypography(result.note, root.lang);
      return;
    }
    conversation = result.state;
    append(reply, result.line, result.note);
    input.value = ''; error.hidden = true; input.removeAttribute('aria-invalid');
    status.textContent = '';
    save(); focusMichel();
  };
  script.hidden = true; flow.hidden = false; restart.hidden = false;
  const saved = state ? validateState(state.read()) : null;
  if (saved) {
    for (const move of saved.conversation.history) {
      const result = turn(content, conversation, move.branch, move.reply);
      conversation = result.state; append(move.reply, result.line, result.note);
    }
  }
  // Firefox may restore a form value after reload; only the validated host draft wins.
  input.value = saved?.draft ?? '';
  refresh();
  if (ask) {
    send.disabled = true;
    Promise.resolve().then(() => ask.config()).then(config => {
      if (destroyed) return;
      model = config.model ?? (config.provider === 'clef' ? '@cf/cloudflare/clef' : config.provider);
      notice.innerHTML = renderDataNotice(config, root.lang, `${notice.id}-text`);
      notice.hidden = false; input.setAttribute('aria-describedby', `${notice.id}-text`);
      send.disabled = false;
    }).catch(() => { if (!destroyed) { useFallback(); send.disabled = false; } });
  }
  const onInput = () => {
    error.hidden = true; input.removeAttribute('aria-invalid');
    if (!notice.hidden) input.setAttribute('aria-describedby', `${notice.id}-text`);
    else input.removeAttribute('aria-describedby');
    save();
  };
  const onSend = async () => {
    if (!ask || !automatic || pending.active || send.disabled || conversation.end) return;
    const draft = input.value.trim();
    if (!draft) {
      error.hidden = false; input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', `${error.id}${notice.hidden ? '' : ` ${notice.id}-text`}`);
      // Focus and description announce the error once.
      input.focus(); return;
    }
    const mine = generation;
    pending.start();
    try {
      const answers = await ask('03-branch', { node: conversation.node, reply: draft }, { challengeSlot, signal: AbortSignal.any([lifetime.signal, request.signal]) });
      if (destroyed || mine !== generation || input.value.trim() !== draft) return;
      take(feedback(answers, model), draft);
    } catch (error) {
      if (!destroyed && mine === generation) {
        capped = showCapNotice(error, root, offline, status);
        if (capped) send.setAttribute('aria-disabled', 'true');
        if (!useFallback() && !capped) status.textContent = frenchTypography(strings.fallback, root.lang);
      }
    } finally {
      if (!destroyed && mine === generation) pending.stop();
    }
  };
  /** @param {MouseEvent} event */
  const onChoose = event => {
    const button = event.target instanceof Element ? event.target.closest('[data-lp-branch]') : null;
    // Last round's replies stay until focus moves; they take no turn.
    if (!button || pending.active || conversation.end || shownRound !== conversation.round) return;
    const branch = /** @type {import('./logic.js').Branch} */ (button.getAttribute('data-lp-branch'));
    take(branch, content.examples[conversation.node][branch]);
  };
  const onRestart = () => {
    generation++; request.abort(); request = new AbortController();
    conversation = start(); pending.stop();
    chat.innerHTML = renderMichel(content, content.opening, `${prefix}-line-0`, root.lang);
    input.value = ''; error.hidden = true; input.removeAttribute('aria-invalid'); status.textContent = '';
    if (!notice.hidden) input.setAttribute('aria-describedby', `${notice.id}-text`);
    refresh(); save(); focusMichel();
  };
  input.addEventListener('input', onInput); send.addEventListener('click', onSend);
  replies.addEventListener('click', onChoose); restart.addEventListener('click', onRestart);
  const instance = { destroy() {
    if (destroyed) return;
    destroyed = true; generation++; lifetime.abort(); cancelFocus(); request.abort(); pending.stop();
    input.removeEventListener('input', onInput); send.removeEventListener('click', onSend);
    replies.removeEventListener('click', onChoose); restart.removeEventListener('click', onRestart);
    root.innerHTML = serverMarkup; instances.delete(root);
  } };
  instances.set(root, instance);
  return instance;
}
