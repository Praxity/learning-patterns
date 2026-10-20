import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browserState } from './browser-state.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key), data };
}

test('keeps state per pattern, language and instance, and survives a new adapter (a reload)', () => {
  const storage = memoryStorage();
  const en = browserState({ pattern: 'journal', lang: 'en', id: 'demo', storage });
  assert.equal(en.read(), null);
  en.write({ text: 'Saved entry' });
  assert.deepEqual(browserState({ pattern: 'journal', lang: 'en', id: 'demo', storage }).read(), { text: 'Saved entry' });
  assert.equal(browserState({ pattern: 'journal', lang: 'fr', id: 'demo', storage }).read(), null);
  assert.equal(browserState({ pattern: 'journal', lang: 'en', id: 'demo2', storage }).read(), null);
  assert.equal(browserState({ pattern: 'first-answer', lang: 'en', id: 'demo', storage }).read(), null);
  assert.deepEqual([...storage.data.keys()], ['lp:journal:en:demo']);
  en.clear();
  assert.equal(en.read(), null);
});

test('denied or broken storage throws from read and write, so the pattern can say so', () => {
  const denied = { getItem() { throw new DOMException('denied', 'SecurityError'); }, setItem() { throw new DOMException('full', 'QuotaExceededError'); }, removeItem() {} };
  const state = browserState({ pattern: 'journal', lang: 'en', id: 'demo', storage: denied });
  assert.throws(() => state.read(), /denied/);
  assert.throws(() => state.write({ text: 'x' }), /full/);
  const corrupt = memoryStorage(); corrupt.setItem('lp:journal:en:demo', '{not json');
  assert.throws(() => browserState({ pattern: 'journal', lang: 'en', id: 'demo', storage: corrupt }).read(), SyntaxError);
});

test('defaults to sessionStorage, keeps a reload and clears without touching localStorage', () => {
  const session = memoryStorage(), local = memoryStorage();
  const descriptors = Object.fromEntries(['sessionStorage', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  try {
    const state = browserState({ pattern: 'journal', lang: 'en', id: 'demo' });
    state.write({ text: 'Saved entry' });
    assert.deepEqual(JSON.parse(session.getItem('lp:journal:en:demo')), { text: 'Saved entry' });
    assert.deepEqual(browserState({ pattern: 'journal', lang: 'en', id: 'demo' }).read(), { text: 'Saved entry' });
    state.clear();
    assert.equal(session.getItem('lp:journal:en:demo'), null);
    assert.equal(local.getItem('lp:journal:en:demo'), null);
  } finally {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
});

test('reaching sessionStorage itself can throw; the adapter is still created and fails on use', () => {
  const realDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
  try {
    const state = browserState({ pattern: 'journal', lang: 'en', id: 'demo' });
    assert.throws(() => state.read(), /blocked/);
    assert.throws(() => state.write({ text: 'x' }), /blocked/);
    assert.throws(() => state.clear(), /blocked/);
    const injected = browserState({ pattern: 'journal', lang: 'en', id: 'demo', storage: memoryStorage() });
    injected.write({ text: 'Injected storage works' });
    assert.deepEqual(injected.read(), { text: 'Injected storage works' });
  } finally {
    if (realDescriptor) Object.defineProperty(globalThis, 'sessionStorage', realDescriptor); else delete globalThis.sessionStorage;
  }
});

test('rejects ids that would make keys collide', () => {
  for (const bad of [{ pattern: '', lang: 'en', id: 'a' }, { pattern: 'journal', lang: 'en:x', id: 'a' }, { pattern: 'journal', lang: 'en', id: '' }]) {
    assert.throws(() => browserState({ ...bad, storage: memoryStorage() }), /browserState/);
  }
});
