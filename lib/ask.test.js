import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAsk, AskError } from './ask.js';
import { noticeConfig, renderDataNotice } from './data-notice.js';

const config = { siteKey: 'test-key', provider: 'clef', ...noticeConfig('clef') };
const result = { answers: { stonewalling: { noul: 1 }, pause: { noul: 0 }, return: { noul: .5 } } };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
function client(replies) {
  const calls = [];
  return { calls, ask: createAsk({ endpoint: '/custom', fetch: async (url, options) => {
    calls.push({ url, options });
    const reply = replies.shift(); if (reply instanceof Error) throw reply; return reply;
  } }) };
}

test('config is cached for concurrent callers and cookies work without Turnstile', async () => {
  const { ask, calls } = client([json(config), json(result), json(result)]);
  assert.equal(await ask.config(), await ask.config());
  const responses = await Promise.all([ask('07-explain-back', { answer: 'One' }), ask('07-explain-back', { answer: 'Two' })]);
  assert.deepEqual(responses, [result.answers, result.answers]);
  assert.deepEqual(calls.map(call => call.url), ['/custom/config', '/custom/ask', '/custom/ask']);
  assert.equal(calls[1].options.credentials, 'same-origin');
  assert.deepEqual(JSON.parse(calls[1].options.body), { block: '07-explain-back', fields: { answer: 'One' } });
  assert.equal(calls[1].options.headers['x-turnstile-token'], undefined);
});

test('an accepted cookie never loads or renders Turnstile even when a slot is supplied', async () => {
  const target = slot({ loaded: false });
  const { ask } = client([json(config), json(result)]);
  await ask('07-explain-back', { answer: 'Draft' }, { challengeSlot: target });
  assert.deepEqual(target.scripts, []); assert.deepEqual(target.rendered, []);
});

function slot({ loaded = true, token = 'solved', error = false } = {}) {
  const rendered = [], removed = [], scripts = [];
  const turnstile = {
    render(target, options) { rendered.push({ target, options }); queueMicrotask(() => error ? options['error-callback']() : options.callback(token)); return 'widget'; },
    remove(id) { removed.push(id); }
  };
  const view = { turnstile: loaded ? turnstile : undefined };
  const document = { defaultView: view, createElement() { return { remove() {}, addEventListener(event, fn) { this[event] = fn; } }; },
    head: { append(script) { scripts.push(script); view.turnstile = turnstile; queueMicrotask(() => script.load()); } } };
  return { ownerDocument: document, rendered, removed, scripts, replaceChildren() {}, hidden: true };
}

test('missing clearance loads the script on demand, solves inline and retries once', async () => {
  const target = slot({ loaded: false });
  const { ask, calls } = client([json(config), json({ reason: 'turnstile' }, 403), json(result)]);
  assert.equal(target.scripts.length, 0);
  assert.deepEqual(await ask('07-explain-back', { answer: 'Draft' }, { challengeSlot: target }), result.answers);
  assert.equal(target.scripts.length, 1);
  assert.match(target.scripts[0].src, /render=explicit/);
  assert.equal(target.rendered[0].target, target);
  assert.equal(target.rendered[0].options.sitekey, 'test-key');
  assert.equal(calls[2].options.headers['x-turnstile-token'], 'solved');
  assert.deepEqual(target.removed, ['widget']);
  assert.equal(target.hidden, true);
});

test('second refusal does not start a second challenge or third POST', async () => {
  const target = slot();
  const { ask, calls } = client([json(config), json({ reason: 'turnstile' }, 403), json({ reason: 'turnstile' }, 403)]);
  await assert.rejects(ask('07-explain-back', {}, { challengeSlot: target }), error => error instanceof AskError && error.type === 'refused');
  assert.equal(target.rendered.length, 1); assert.equal(calls.length, 3);
});

test('clearance without a slot or with a widget error gives a typed refusal', async () => {
  for (const target of [undefined, slot({ error: true }), slot({ token: '' })]) {
    const { ask } = client([json(config), json({ reason: 'turnstile' }, 403)]);
    await assert.rejects(ask('07-explain-back', {}, { challengeSlot: target }), error => error.type === 'refused');
  }
});

test('cancelling a pending challenge removes its widget and sends no retry', async () => {
  const target = slot();
  const controller = new AbortController();
  target.ownerDocument.defaultView.turnstile.render = () => { queueMicrotask(() => controller.abort()); return 'pending'; };
  const { ask, calls } = client([json(config), json({ reason: 'turnstile' }, 403)]);
  await assert.rejects(ask('07-explain-back', {}, { challengeSlot: target, signal: controller.signal }), error => error.type === 'offline');
  assert.deepEqual(target.removed, ['pending']); assert.equal(target.hidden, true); assert.equal(calls.length, 2);
});

test('a blocked Turnstile script gives an offline error without posting again', async () => {
  const target = slot({ loaded: false });
  target.ownerDocument.head.append = script => { queueMicrotask(() => script.error()); };
  const { ask, calls } = client([json(config), json({ reason: 'turnstile' }, 403)]);
  await assert.rejects(ask('07-explain-back', {}, { challengeSlot: target }), error => error.type === 'offline');
  assert.equal(calls.length, 2);
});

test('each proxy failure and malformed response has a typed error', async () => {
  for (const [reply, type] of [[new Error('network'), 'offline'], [json({}, 503), 'offline'], [json({}, 502), 'offline'], [json({}, 403), 'refused'], [json({}, 429), 'busy'], [json({ reason: 'ip_daily' }, 429), 'budget'], [json({ reason: 'budget' }, 429), 'budget'], [json({}, 400), 'invalid'], [json({}, 413), 'invalid'], [json({ answers: {} }), 'invalid'], [json({ answers: { a: { noul: 'text' } } }), 'invalid'], [new Response('bad JSON'), 'invalid']]) {
    const { ask } = client([json(config), reply]);
    await assert.rejects(ask('07-explain-back', {}), error => error instanceof AskError && error.type === type, type);
  }
});

test('typed answers discard arbitrary provider text and validate choices', async () => {
  const { ask } = client([json(config), json({ answers: { a: { noul: .7, text: '<bad>' }, b: { choice: 'pause', confidence: .6, text: '<bad>' } } })]);
  assert.deepEqual(await ask('any', {}), { a: { noul: .7 }, b: { choice: 'pause', confidence: .6 } });
});

test('config failures are cached too and never send an answer', async () => {
  const { ask, calls } = client([json({ siteKey: '' })]);
  await assert.rejects(ask.config(), error => error.type === 'invalid');
  await assert.rejects(ask('07-explain-back', {}), error => error.type === 'invalid');
  assert.equal(calls.length, 1);
});

test('config owns English and French notices and rendering escapes provider text', () => {
  assert.equal(noticeConfig('perplexity').providerName, 'Perplexity (US)');
  for (const provider of ['perplexity', 'clef', 'jev']) {
    assert.deepEqual(noticeConfig(provider).dataNotice, {
      en: 'Your answer is sent to a decision model; it is not stored and not used for training.',
      fr: "Votre réponse est envoyée à un modèle décisionnel. Elle n'est ni conservée ni utilisée pour l'entraînement."
    });
  }
  assert.throws(() => noticeConfig('unknown'), /provider/);
  const markup = renderDataNotice({ ...config, dataNotice: { en: '<provider>', fr: 'Français' } }, 'en', 'notice');
  assert.match(markup, /id="notice"/); assert.match(markup, /&lt;provider&gt;/);
  assert.match(renderDataNotice(config, 'fr', 'n'), /modèle décisionnel/);
});
