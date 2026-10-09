/** @typedef {'offline' | 'refused' | 'busy' | 'budget' | 'invalid'} ErrorType */
/** @typedef {{ noul: number } | { choice: string, confidence: number, probabilities?: Record<string, number> }} Answer */
/** @typedef {Record<string, Answer>} Answers */
/** @typedef {import('./data-notice.js').NoticeConfig & { siteKey: string, provider: string, model?: string }} Config */
/** @typedef {{ challengeSlot?: HTMLElement, signal?: AbortSignal }} AskOptions */
/** @typedef {((block: string, fields: Record<string, string>, options?: AskOptions) => Promise<Answers>) & { config(): Promise<Config> }} Ask */
/** @typedef {{ render(slot: HTMLElement, options: Record<string, unknown>): string, remove(id: string): void }} Turnstile */

export class AskError extends Error {
  /** @param {ErrorType} type @param {import('./data-notice.js').CapReason} [reason] */
  constructor(type, reason) {
    super(`Pattern check ${type}`);
    this.name = 'AskError';
    this.type = type;
    this.reason = reason;
  }
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {unknown} value @returns {value is number} */
function probability(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1; }

/** @param {unknown} value @returns {Answers} */
function readAnswers(value) {
  if (!object(value) || Object.keys(value).length === 0) throw new AskError('invalid');
  return Object.fromEntries(Object.entries(value).map(([key, answer]) => {
    if (!object(answer)) throw new AskError('invalid');
    if (probability(answer.noul)) return [key, { noul: answer.noul }];
    if (typeof answer.choice === 'string' && answer.choice.length && probability(answer.confidence)) {
      if (answer.probabilities === undefined) return [key, { choice: answer.choice, confidence: answer.confidence }];
      const scores = answer.probabilities;
      if (!object(scores) || !Object.hasOwn(scores, answer.choice) || !Object.values(scores).every(probability) || Math.abs(Object.values(scores).reduce((sum, score) => sum + score, 0) - 1) >= .001 || scores[answer.choice] < Math.max(...Object.values(scores)) - 1e-12) throw new AskError('invalid');
      return [key, { choice: answer.choice, confidence: answer.confidence, probabilities: { ...scores } }];
    }
    throw new AskError('invalid');
  }));
}

/** Same-origin transport. No learner text is logged or kept by this client.
 * /config is read once, including failures. Create a new client to retry configuration.
 * @param {{ endpoint?: string, fetch?: typeof globalThis.fetch }} [options]
 * @returns {Ask}
 */
export function createAsk({ endpoint = '/api/patterns', fetch = globalThis.fetch } = {}) {
  const base = endpoint.replace(/\/$/, '');
  /** @type {Promise<Config> | undefined} */
  let cachedConfig;
  /** @param {string} path @param {RequestInit} [options] */
  async function request(path, options = {}) {
    let response;
    try { response = await fetch(`${base}/${path}`, { ...options, credentials: 'same-origin', signal: AbortSignal.any([AbortSignal.timeout(20_000), ...(options.signal ? [options.signal] : [])]) }); }
    catch { throw new AskError('offline'); }
    let data;
    try { data = await response.json(); }
    catch { throw new AskError(response.ok ? 'invalid' : errorType(response.status)); }
    return { response, data };
  }
  async function config() {
    cachedConfig ??= (async () => {
      const { response, data } = await request('config');
      if (!response.ok) throw new AskError(errorType(response.status));
      if (!object(data) || typeof data.siteKey !== 'string' || typeof data.provider !== 'string' || !data.provider || typeof data.providerName !== 'string' || !data.providerName || !object(data.dataNotice) || typeof data.dataNotice.en !== 'string' || !data.dataNotice.en || typeof data.dataNotice.fr !== 'string' || !data.dataNotice.fr) throw new AskError('invalid');
      return /** @type {Config} */ (data);
    })();
    return cachedConfig;
  }
  /** @param {string} block @param {Record<string, string>} fields @param {AskOptions} [options] */
  async function ask(block, fields, { challengeSlot, signal } = {}) {
    const settings = await config();
    /** @param {string} [token] */
    const post = token => request('ask', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'x-turnstile-token': token } : {}) }, body: JSON.stringify({ block, fields }), signal });
    let { response, data } = await post();
    if (response.status === 403 && data?.reason === 'turnstile') {
      if (!challengeSlot || !settings.siteKey) throw new AskError('refused');
      const token = await challenge(challengeSlot, settings.siteKey, signal);
      ({ response, data } = await post(token));
    }
    if (!response.ok) {
      const type = errorType(response.status, data?.reason);
      throw new AskError(type, type === 'budget' ? data.reason : undefined);
    }
    return readAnswers(data?.answers);
  }
  return Object.assign(ask, { config });
}

/** @param {number} status @param {unknown} [reason] @returns {ErrorType} */
function errorType(status, reason) {
  if (status === 429) return reason === 'budget' || reason === 'ip_daily' ? 'budget' : 'busy';
  if (status === 401 || status === 403) return 'refused';
  if (status >= 500) return 'offline';
  return 'invalid';
}

/** @type {WeakMap<Document, Promise<Turnstile>>} */
const scripts = new WeakMap();
/** @param {Document} document @returns {Promise<Turnstile>} */
function loadTurnstile(document) {
  const view = /** @type {Window & { turnstile?: Turnstile }} */ (document.defaultView);
  if (view?.turnstile) return Promise.resolve(view.turnstile);
  const existing = scripts.get(document);
  if (existing) return existing;
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const fail = () => { clearTimeout(timer); script.remove(); scripts.delete(document); reject(new AskError('offline')); };
    const timer = setTimeout(fail, 15_000);
    script.addEventListener('error', fail, { once: true });
    script.addEventListener('load', () => { clearTimeout(timer); if (view?.turnstile) resolve(view.turnstile); else fail(); }, { once: true });
    document.head.append(script);
  });
  scripts.set(document, promise);
  return promise;
}

/** @param {HTMLElement} slot @param {string} siteKey @param {AbortSignal} [signal] */
async function challenge(slot, siteKey, signal) {
  const turnstile = await loadTurnstile(slot.ownerDocument);
  if (signal?.aborted) throw new AskError('offline');
  slot.hidden = false;
  /** @type {string | undefined} */
  let widget;
  /** @type {() => void} */
  let abort = () => {};
  try {
    return await new Promise((resolve, reject) => {
      const fail = () => reject(new AskError('refused'));
      abort = () => reject(new AskError('offline'));
      signal?.addEventListener('abort', abort, { once: true });
      widget = turnstile.render(slot, { sitekey: siteKey, size: 'flexible', language: slot.closest?.('[lang]')?.getAttribute('lang') ?? 'auto',
        callback: (/** @type {string} */ token) => typeof token === 'string' && token.length ? resolve(token) : fail(),
        'error-callback': fail, 'expired-callback': fail, 'timeout-callback': fail, 'unsupported-callback': fail
      });
    });
  } catch (error) { throw error instanceof AskError ? error : new AskError('refused'); }
  finally {
    signal?.removeEventListener('abort', abort);
    if (widget !== undefined) turnstile.remove(widget);
    slot.replaceChildren(); slot.hidden = true;
  }
}
