import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { strings } from '../../patterns/journal/strings.js';

const examples = Object.fromEntries(await Promise.all(['en', 'fr'].map(async lang => [lang, JSON.parse(await readFile(new URL(`../../patterns/journal/examples/${lang}.json`, import.meta.url)))])));
const keys = ['situation', 'action', 'next_step', 'when', 'distress'];

async function open(page, lang = 'en', values = [1, 1, 0, 0, 0], mode = 'ok') {
  await page.addInitScript(() => {
    const params = new URLSearchParams(location.search);
    const values = JSON.parse(params.get('values') ?? '[1,1,0,0,0]');
    const mode = params.get('mode');
    window.lpTestCalls = [];
    if (mode === 'missing') window.lpAsk = null;
    else window.lpAsk = async (block, fields, options) => {
      window.lpTestCalls.push({ block, fields, slot: !!options.challengeSlot });
      if (mode === 'pending' || mode === 'pending-throws') await new Promise(resolve => { window.lpResolve = resolve; });
      if (mode === 'throws' || mode === 'pending-throws') throw new Error('Offline');
      if (mode === 'invalid') return { distress: { noul: 1 } };
      return Object.fromEntries(['situation', 'action', 'next_step', 'when', 'distress'].map((id, index) => [id, { noul: values[index] }]));
    };
  });
  await page.goto(`/journal/${lang}.html?values=${encodeURIComponent(JSON.stringify(values))}&mode=${mode}`);
  await page.waitForFunction(() => window.lpReady);
  await expect(page.locator('[data-lp-suggest]')).toBeEnabled();
}
async function submit(page, text = 'My reflection') {
  await page.getByRole('textbox').fill(text); await page.locator('[data-lp-suggest]').click();
}
async function axe(page) {
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
}
async function observe(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    new MutationObserver(records => { for (const record of records) if (record.target.textContent) window.lpAnnouncements.push(record.target.textContent); })
      .observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}
async function remount(page, { stateMode = 'normal', askMode = 'normal', support = null } = {}) {
  await page.evaluate(async ({ content, stateMode, askMode, support }) => {
    window.lpInstances[0].destroy();
    const { enhance } = await import('/patterns/journal/enhance.js');
    const { render } = await import('/patterns/journal/render.js');
    const { strings } = await import('/patterns/journal/strings.js');
    const { noticeConfig } = await import('/lib/data-notice.js');
    if (support) { content.support = support; content.supportNote = support; }
    document.querySelector('main').innerHTML = '<h1>Journal with one nudge</h1>' + render(content, strings.en, { id: 'host', lang: 'en' });
    window.lpWriteCount = 0; window.lpHostSaved = null; window.lpAborted = false;
    const state = {
      read() { if (stateMode === 'read') throw new Error('Blocked'); return window.lpHostSaved; },
      write(value) { window.lpWriteCount++; if (stateMode === 'write') throw new Error('Quota'); window.lpHostSaved = value; }
    };
    const ask = Object.assign(async (_block, _fields, options) => {
      if (askMode === 'pending') { options.signal.addEventListener('abort', () => { window.lpAborted = true; }); await new Promise(resolve => { window.lpResolve = resolve; }); }
      return { situation: { noul: 0 }, action: { noul: 0 }, next_step: { noul: 0 }, when: { noul: 0 }, distress: { noul: 1 } };
    }, { config: async () => { if (askMode === 'config') throw new Error('No configuration'); return { provider: 'clef', siteKey: '', ...noticeConfig('clef') }; } });
    const options = { content, strings: strings.en, ...(stateMode === 'none' ? {} : { state }), ask };
    window.lpInstances[0] = enhance(document.querySelector('[data-lp-pattern]'), options);
    window.lpEnhance = () => enhance(document.querySelector('[data-lp-pattern]'), options);
  }, { content: examples.en, stateMode, askMode, support });
}

for (const lang of ['en', 'fr']) {
  test(`dated journal, title label, suggestion-only notice and no typing feedback (${lang})`, async ({ page }) => {
    const requests = []; page.on('request', request => requests.push(request.url()));
    await open(page, lang); await observe(page);
    await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', lang);
    await expect(page.getByRole('textbox')).toHaveAccessibleName(examples[lang].prompt);
    await expect(page.getByRole('textbox')).toHaveAttribute('maxlength', '1500');
    await expect(page.getByRole('textbox')).toHaveAttribute('placeholder', strings[lang].placeholder);
    await expect(page.locator('.lp-scene-label, label')).toHaveCount(0);
    const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    await expect(page.locator('[data-lp-date]')).toHaveAttribute('datetime', today);
    await expect(page.locator('[data-lp-notice]')).toContainText(lang === 'fr' ? 'Enregistrer garde votre entrée' : 'Save keeps your entry');
    expect(await page.locator('[data-lp-notice]').evaluate(el => el.previousElementSibling.matches('[data-lp-suggest]'))).toBe(true);
    await expect(page.getByRole('textbox')).not.toHaveAttribute('aria-describedby');
    await expect(page.locator('[data-lp-save]')).not.toHaveAttribute('aria-describedby');
    await expect(page.locator('[data-lp-suggest]')).toHaveAttribute('aria-describedby', 'example-notice-text');
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    await expect(page.locator('[data-lp-support]')).toBeHidden();
    await page.getByRole('textbox').fill('An unfinished entry');
    expect(await page.evaluate(() => window.lpTestCalls)).toEqual([]);
    expect(await page.evaluate(() => window.lpSaved)).toBeUndefined();
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
    expect(requests.filter(url => /api\/patterns|challenges.cloudflare/.test(url))).toEqual([]);
    await axe(page);
  });

  for (const [index, key] of keys.slice(0, 4).entries()) {
    test(`one authored ${key} nudge, including not-sure, and one announcement (${lang})`, async ({ page }) => {
      await open(page, lang, [...Array.from({ length: 4 }, (_, i) => i < index ? 1 : .5), .49]); await observe(page); await submit(page);
      await expect(page.locator('[data-lp-result]')).toHaveText(examples[lang].questions[index].text);
      await expect(page.locator('[data-lp-result]')).toBeVisible();
      await expect(page.locator('[data-lp-questions]')).toBeHidden();
      await expect(page.getByRole('checkbox')).toHaveCount(0);
      expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([examples[lang].questions[index].text]);
      expect(await page.evaluate(() => window.lpTestCalls)).toEqual([{ block: '13-journal', fields: { answer: 'My reflection' }, slot: true }]);
      expect(await page.evaluate(() => window.lpSaved)).toBeUndefined();
      await axe(page);
    });
  }

  for (const [kind, values, field] of [['complete', [.65, .65, .65, .65, .4999], 'complete'], ['support', [0, 0, 0, 0, .5], 'support']]) {
    test(`${kind} shows one authored line and announces once (${lang})`, async ({ page }) => {
      await open(page, lang, values); await observe(page); await submit(page);
      await expect(page.locator('[data-lp-result]')).toHaveText(examples[lang][field]);
      await expect(page.locator('[data-lp-result] .lp-icon')).toHaveCount(kind === 'complete' ? 1 : 0);
      if (kind === 'complete') {
        await expect(page.locator('[data-lp-result] .lp-icon')).toHaveAttribute('aria-hidden', 'true');
        await expect(page.locator('[data-lp-result]')).toHaveClass(/lp-met/);
        await expect(page.locator('[data-lp-result]')).toHaveText(lang === 'fr'
          ? "Très bien. Vous avez nommé un moment, ce que vous avez fait et une prochaine étape en précisant quand vous l'essaierez."
          : "Great. You've named a moment, what you did, and a next step with a when.");
      }
      await expect(page.locator('[data-lp-questions]')).toBeHidden();
      await expect(page.locator('[data-lp-support]')).toBeHidden();
      expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([examples[lang][field]]);
      await axe(page);
    });
  }

  test(`Save persists exact text and date, restores on reload, and never asks (${lang})`, async ({ page }) => {
    await open(page, lang); await observe(page);
    const text = '  My reflection\nAs written.  ';
    await page.getByRole('textbox').fill(text); await page.locator('[data-lp-save]').click();
    await expect(page.locator('[data-lp-saved]')).toHaveText(examples[lang].saved);
    const saved = await page.evaluate(() => window.lpSaved);
    expect(saved.text).toBe(text); expect(new Date(saved.savedAt).toISOString()).toBe(saved.savedAt);
    expect(Object.keys(saved)).toEqual(['text', 'savedAt']);
    expect(await page.evaluate(() => window.lpTestCalls)).toEqual([]);
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([examples[lang].saved]);
    await page.getByRole('textbox').fill('Unsaved changes');
    await page.reload(); await page.waitForFunction(() => window.lpReady);
    await expect(page.getByRole('textbox')).toHaveValue(text);
    await expect(page.locator('[role="status"]')).toBeEmpty();
    await axe(page);
  });

  for (const mode of ['missing', 'throws', 'invalid']) {
    test(`all questions and visible support when ask ${mode} (${lang})`, async ({ page }) => {
      await open(page, lang, [1, 1, 1, 1, 0], mode); await observe(page);
      if (mode !== 'missing') await submit(page);
      // One way to the questions: the suggestion button hides and the disclosure opens.
      await expect(page.locator('[data-lp-suggest]')).toBeHidden();
      await expect(page.locator('[data-lp-questions]')).toHaveAttribute('open', '');
      await expect(page.locator('[data-lp-questions] li')).toHaveText(examples[lang].questions.map(q => q.text));
      await expect(page.locator('[data-lp-support]')).toHaveText(examples[lang].supportNote);
      await expect(page.locator('[data-lp-support]')).toBeVisible();
      await expect(page.locator('[data-lp-notice]')).toBeHidden();
      await expect(page.locator('[data-lp-offline]')).toHaveText(lang === 'fr'
        ? 'Sans le modèle de décision, vous pouvez utiliser les questions pour réfléchir à votre entrée.'
        : 'Without the decision model, you can use the questions to reflect on your entry.');
      await expect(page.locator('[data-lp-result]')).toBeHidden();
      // Without ask the questions are simply shown; a failed request announces the fallback once.
      expect(await page.evaluate(() => window.lpAnnouncements)).toHaveLength(mode === 'missing' ? 0 : 1);
      expect(await page.evaluate(() => window.lpTestCalls.length)).toBe(mode === 'missing' ? 0 : 1);
      await axe(page);
    });
  }

  test(`320 px reflow, text spacing and reduced motion for support and fallback (${lang})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const mode of ['ok', 'missing']) {
      await open(page, lang, [0, 0, 0, 0, 1], mode); if (mode === 'ok') await submit(page);
      await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await page.locator('.lp-button, [data-lp-result], [data-lp-questions] li').evaluateAll(els => els.filter(el => el.clientWidth + 1 < el.scrollWidth).map(el => el.className))).toEqual([]);
        expect(await page.locator('[data-lp-suggest]').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
      }
      await axe(page);
    }
  });
}

for (const mode of ['pending', 'pending-throws']) {
  test(`pending edits suppress old results and explain why, even after reverting (${mode})`, async ({ page }) => {
    await open(page, 'en', [0, 0, 0, 0, 1], mode); await observe(page); await submit(page);
    await page.getByRole('textbox').fill('A revision'); await page.getByRole('textbox').fill('My reflection');
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
    await page.evaluate(() => window.lpResolve());
    await expect(page.locator('[data-lp-suggest]')).not.toHaveAttribute('aria-disabled');
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    // A failed request switches to the questions; a pending edit still hides the stale result.
    if (mode === 'pending') await expect(page.locator('[data-lp-questions]')).toBeHidden();
    else await expect(page.locator('[data-lp-questions]')).toBeVisible();
    await expect(page.locator('[data-lp-changed]')).toHaveText(examples.en.changed);
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([examples.en.changed]);
    if (mode === 'pending') {
      await page.locator('[data-lp-suggest]').click(); await page.evaluate(() => window.lpResolve());
      await expect(page.locator('[data-lp-result]')).toHaveText(examples.en.support);
      await expect(page.locator('[data-lp-changed]')).toBeHidden();
    }
  });
}

test('pending button keeps keyboard focus, rejects duplicate suggestions and still allows Save', async ({ page }) => {
  await open(page, 'en', [1, 1, 1, 1, 0], 'pending');
  await page.getByRole('textbox').fill('My reflection');
  await page.locator('[data-lp-suggest]').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-suggest]')).toBeFocused();
  expect(await page.evaluate(() => window.lpTestCalls.length)).toBe(1);
  await page.locator('[data-lp-save]').click(); await expect(page.locator('[data-lp-saved]')).toHaveText(examples.en.saved);
  await page.evaluate(() => window.lpResolve()); await expect(page.locator('[data-lp-result]')).toHaveText(examples.en.complete);
});

test('keyboard validates empty text, saves, suggests and opens native questions instantly', async ({ page }) => {
  await open(page); await observe(page);
  await page.getByRole('textbox').focus(); await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-save]')).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox')).toBeFocused(); await expect(page.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.type('My reflection'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-save]')).toBeFocused(); await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-suggest]')).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-result]')).toBeVisible(); await expect(page.locator('[data-lp-suggest]')).toBeFocused();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([strings.en.empty, examples.en.saved, examples.en.questions[2].text]);
  await open(page, 'en', [1, 1, 1, 1, 0], 'missing');
  // Without ask there is no suggestion button; Tab goes from Save to the open questions.
  await page.locator('[data-lp-save]').focus(); await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-questions] summary')).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-questions]')).not.toHaveAttribute('open'); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-questions] li').last()).toBeVisible();
  expect(await page.locator('[data-lp-questions] summary').evaluate(el => getComputedStyle(el, '::before').transitionDuration)).toBe('0s');
});

for (const method of ['getItem', 'setItem']) {
  test(`blocked browser storage ${method} preserves entry, reports failure and permits suggestions`, async ({ page }) => {
    await page.addInitScript(method => { Storage.prototype[method] = () => { throw new Error('Blocked'); }; }, method);
    await open(page); await page.getByRole('textbox').fill('My reflection'); await observe(page);
    await page.locator('[data-lp-save]').click();
    await expect(page.locator('[data-lp-saved]')).toHaveText(method === 'getItem' ? strings.en.unreadable : strings.en.writeFailed);
    await expect(page.getByRole('textbox')).toHaveValue('My reflection');
    expect(await page.evaluate(() => window.lpSaved)).toBeUndefined();
    expect(await page.evaluate(() => window.lpTestCalls)).toEqual([]);
    expect(await page.evaluate(() => window.lpAnnouncements)).toHaveLength(1);
    await page.locator('[data-lp-suggest]').click(); await expect(page.locator('[data-lp-result]')).toBeVisible();
    await axe(page);
  });
}

test('invalid saved state is ignored and a host without storage never claims a save', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { text: 'Invalid', savedAt: '2026-02-30T12:00:00.000Z' }; });
  await open(page); await expect(page.getByRole('textbox')).toHaveValue('');
  await remount(page, { stateMode: 'none' }); await observe(page);
  await page.getByRole('textbox').fill('My reflection'); await page.locator('[data-lp-save]').click();
  await expect(page.locator('[data-lp-saved]')).toHaveText(strings.en.noStorage);
  expect(await page.evaluate(() => window.lpWriteCount)).toBe(0);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([strings.en.noStorage]);
});

test('a failed overwrite preserves the previous saved entry and the current draft', async ({ page }) => {
  await open(page);
  await page.getByRole('textbox').fill('Previously saved entry'); await page.locator('[data-lp-save]').click();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Full'); }; });
  await page.getByRole('textbox').fill('Unsaved revision'); await page.locator('[data-lp-save]').click();
  await expect(page.locator('[data-lp-saved]')).toHaveText(strings.en.writeFailed);
  await expect(page.getByRole('textbox')).toHaveValue('Unsaved revision');
  await page.reload(); await page.waitForFunction(() => window.lpReady);
  await expect(page.getByRole('textbox')).toHaveValue('Previously saved entry');
});

test('failed configuration opens authored fallback; host support text replaces the sample', async ({ page }) => {
  await open(page); await remount(page, { askMode: 'config', support: 'Contact the course support team.' });
  await expect(page.locator('[data-lp-suggest]')).toBeHidden();
  await expect(page.locator('[data-lp-support]')).toHaveText('Contact the course support team.');
  await expect(page.locator('[role="status"]')).toBeEmpty();
  await expect(page.locator('[data-lp-questions] li')).toHaveCount(4);
  await remount(page, { support: 'Contact the course support team.' }); await submit(page);
  await expect(page.locator('[data-lp-result]')).toHaveText('Contact the course support team.');
});

test('authored suggestion text stays plain text when feedback includes markup characters', async ({ page }) => {
  const text = '<img src=x onerror="window.lpInjected=true"> & Contact support.';
  await open(page); await remount(page, { support: text }); await submit(page);
  await expect(page.locator('[data-lp-result]')).toHaveText(text);
  await expect(page.locator('[data-lp-result] img')).toHaveCount(0);
  expect(await page.evaluate(() => window.lpInjected)).toBeUndefined();
});

test('typing after a result leaves feedback and saved entry unchanged until the next action', async ({ page }) => {
  await open(page); await submit(page); await observe(page);
  await page.getByRole('textbox').fill('Another reflection');
  await expect(page.locator('[data-lp-result]')).toHaveText(examples.en.questions[2].text);
  expect(await page.evaluate(() => window.lpTestCalls.length)).toBe(1);
  expect(await page.evaluate(() => window.lpSaved)).toBeUndefined();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
});

test('enhance is idempotent; destroy cancels requests, removes actions and restores native content', async ({ page }) => {
  await open(page); await remount(page, { askMode: 'pending' });
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await submit(page);
  await page.evaluate(() => { window.lpInstances[0].destroy(); window.lpInstances[0].destroy(); window.lpResolve(); });
  expect(await page.evaluate(() => window.lpAborted)).toBe(true);
  await expect(page.locator('[data-lp-result]')).toBeEmpty(); await expect(page.locator('[data-lp-actions]')).toBeHidden();
  await expect(page.locator('[data-lp-questions]')).toHaveAttribute('open', ''); await expect(page.locator('[data-lp-support]')).toBeVisible();
  await page.locator('[data-lp-save]').evaluate(el => el.click()); expect(await page.evaluate(() => window.lpWriteCount)).toBe(0);
  await page.evaluate(() => window.lpInstances[0] = window.lpEnhance()); await expect(page.locator('[data-lp-suggest]')).toBeEnabled();
});

test('configured data notice and shared client clearance belong only to suggestion submission', async ({ page }) => {
  await open(page);
  await page.evaluate(async content => {
    window.lpInstances[0].destroy();
    const { enhance } = await import('/patterns/journal/enhance.js');
    const { strings } = await import('/patterns/journal/strings.js');
    const { createAsk } = await import('/lib/ask.js');
    const { noticeConfig } = await import('/lib/data-notice.js');
    window.lpNetworkCalls = []; window.lpWidget = null;
    window.turnstile = { render(slot, options) { slot.textContent = 'Verification'; window.lpWidget = { slot, options }; return 'test'; }, remove() {} };
    const ask = createAsk({ fetch: async (url, options) => {
      window.lpNetworkCalls.push(url);
      if (url.endsWith('/config')) return Response.json({ siteKey: 'test', provider: 'clef', ...noticeConfig('clef') });
      if (!options.headers['x-turnstile-token']) return Response.json({ reason: 'turnstile' }, { status: 403 });
      return Response.json({ answers: { situation: { noul: 1 }, action: { noul: 1 }, next_step: { noul: 1 }, when: { noul: 1 }, distress: { noul: 0 } } });
    } });
    const state = { read: () => null, write: value => { window.lpSaved = value; } };
    window.lpInstances[0] = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, state, ask });
  }, examples.en);
  await expect(page.locator('[data-lp-suggest]')).toBeEnabled();
  await expect(page.locator('[data-lp-notice]')).toHaveText('Your answer is sent to a decision model; it is not stored and not used for training.');
  await expect(page.locator('[data-lp-challenge]')).toBeHidden();
  await page.getByRole('textbox').fill('My reflection'); await page.locator('[data-lp-save]').click();
  expect(await page.evaluate(() => window.lpNetworkCalls)).toEqual(['/api/patterns/config']);
  await page.locator('[data-lp-suggest]').click(); await expect(page.locator('[data-lp-challenge]')).toBeVisible();
  expect(await page.evaluate(() => window.lpWidget.slot === document.querySelector('[data-lp-challenge]'))).toBe(true);
  await page.evaluate(() => window.lpWidget.options.callback('test-token'));
  await expect(page.locator('[data-lp-challenge]')).toBeHidden(); await expect(page.locator('[data-lp-result]')).toHaveText(examples.en.complete);
  expect(await page.evaluate(() => window.lpNetworkCalls)).toEqual(['/api/patterns/config', '/api/patterns/ask', '/api/patterns/ask']);
});

test('forced colours preserve the soft card, controls and focus', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page); await submit(page);
  await expect(page.locator('[data-lp-result]')).toHaveCSS('border-style', 'solid');
  for (const target of [page.getByRole('textbox'), page.locator('[data-lp-save]'), page.locator('[data-lp-suggest]')]) {
    await target.focus(); await expect(target).toHaveCSS('outline-width', '2px'); await expect(target).toHaveCSS('outline-style', 'solid');
  }
});

test('two instances have unique prefixed IDs and independent results and stored entries', async ({ page }) => {
  await page.goto('/journal/two.html'); await page.waitForFunction(() => window.lpReady);
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  await roots.first().getByRole('textbox').fill('First entry'); await roots.first().locator('[data-lp-save]').click();
  await roots.first().locator('[data-lp-suggest]').click(); await expect(roots.first().locator('[data-lp-result]')).toBeVisible();
  await expect(roots.nth(1).locator('[data-lp-result]')).toBeHidden(); await expect(roots.nth(1).getByRole('textbox')).toHaveValue('');
  await roots.nth(1).getByRole('textbox').fill('Second entry'); await roots.nth(1).locator('[data-lp-save]').click();
  await page.reload(); await page.waitForFunction(() => window.lpReady);
  await expect(roots.first().getByRole('textbox')).toHaveValue('First entry'); await expect(roots.nth(1).getByRole('textbox')).toHaveValue('Second entry');
});

test('index preview uses the authored journal prompt and correct placeholder', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('.lp-journal .lp-stem')).toHaveText(examples.en.prompt);
  await expect(page.locator('.lp-journal textarea')).toHaveAttribute('placeholder', 'This week, I…');
});

test('without JavaScript the dated writing page, questions and authored support stay available', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage();
  for (const lang of ['en', 'fr']) {
    await page.goto(`${baseURL}/journal/${lang}.html`);
    await expect(page.getByRole('textbox')).toHaveAccessibleName(examples[lang].prompt); await page.getByRole('textbox').fill('A reflection');
    await expect(page.locator('[data-lp-actions]')).toBeHidden(); await expect(page.locator('[data-lp-questions] li')).toHaveCount(4);
    await expect(page.locator('[data-lp-support]')).toHaveText(examples[lang].supportNote); await expect(page.locator('[data-lp-support]')).toBeVisible();
    await page.locator('[data-lp-questions] summary').click(); await expect(page.locator('[data-lp-questions]')).not.toHaveAttribute('open');
    await page.locator('[data-lp-questions] summary').click(); await expect(page.locator('[data-lp-questions] li').last()).toBeVisible();
  }
  await context.close();
});

test('capture requested English and French states', async ({ page, browserName }) => {
  test.skip(!process.env.LP_SHOTS || browserName !== 'chromium', 'Screenshots run once in Chromium when requested.');
  await mkdir(process.env.LP_SHOTS, { recursive: true });
  const drafts = {
    en: 'In yesterday’s meeting, a colleague blamed me for a late report. I listened and accepted that I had missed one update.',
    fr: 'À la réunion d’hier, un collègue m’a reproché un rapport en retard. J’ai écouté et reconnu que j’avais oublié une mise à jour.'
  };
  for (const lang of ['en', 'fr']) for (const width of [1280, 390]) for (const stage of ['empty', 'nudge', 'all-there', 'support', 'without-model']) {
    await page.setViewportSize({ width, height: 1000 });
    const values = stage === 'support' ? [0, 0, 0, 0, .5] : stage === 'all-there' ? [1, 1, 1, 1, 0] : [1, 1, 0, 0, 0];
    await open(page, lang, values, stage === 'without-model' ? 'missing' : 'ok');
    if (stage !== 'empty') {
      const text = stage === 'support' ? (lang === 'fr' ? 'Je n’arrive plus à faire face et j’ai besoin de soutien.' : 'I cannot cope any more and need support.') : drafts[lang] + (stage === 'all-there' ? (lang === 'fr' ? ' À la rencontre de demain, je proposerai une échéance claire.' : ' At tomorrow’s check-in, I will ask for a clear deadline.') : '');
      await submit(page, text);
    }
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(process.env.LP_SHOTS, `${lang}-${width}-${stage}.png`), fullPage: true });
  }
});
