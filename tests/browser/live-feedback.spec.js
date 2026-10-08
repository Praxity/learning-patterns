import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { strings } from '../../patterns/live-feedback/strings.js';

const examples = Object.fromEntries(await Promise.all(['en', 'fr'].map(async lang => [lang, JSON.parse(await readFile(new URL(`../../patterns/live-feedback/examples/${lang}.json`, import.meta.url)))])));
const draft = 'I will speak at the next meeting.';

async function open(page, { lang = 'en', mode = 'ok', two = false } = {}) {
  await page.addInitScript(({ mode }) => {
    window.lpTestCalls = [];
    window.lpValues = [1, 0, .5, 1];
    window.lpAnnouncements = [];
    if (mode === 'missing') window.lpAsk = null;
    else window.lpAsk = async (block, fields, options) => {
      const call = { block, fields, signal: options.signal, slot: !!options.challengeSlot };
      window.lpTestCalls.push(call);
      if (mode === 'throws') throw new Error('Offline');
      if (mode === 'invalid') return {};
      if (mode === 'pending') return new Promise((resolve, reject) => { call.resolve = resolve; call.reject = reject; });
      return Object.fromEntries(['three_actions', 'observable', 'when', 'commitments'].map((id, index) => [id, { noul: window.lpValues[index] }]));
    };
  }, { mode });
  await page.goto(`/live-feedback/${two ? 'two' : lang}.html`);
  await page.waitForFunction(() => window.lpReady);
  if (mode !== 'missing') await expect(page.locator('[data-lp-check]').first()).toBeEnabled();
  await page.evaluate(() => {
    new MutationObserver(records => {
      for (const record of records) if (record.target.textContent) window.lpAnnouncements.push(record.target.textContent);
    }).observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
}
const calls = page => page.evaluate(() => window.lpTestCalls.length);
const auto = async (page, text = draft, root = page) => {
  await root.getByRole('textbox').fill(text);
  await page.clock.runFor(700);
};
async function axe(page) {
  await page.clock.resume();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
}

test('700 ms debounce resets on typing; short and unchanged trimmed text skip', async ({ page }) => {
  await open(page);
  await auto(page, 'x'.repeat(19));
  expect(await calls(page)).toBe(0);
  await page.getByRole('textbox').fill('x'.repeat(20));
  await page.clock.runFor(699);
  expect(await calls(page)).toBe(0);
  await page.getByRole('textbox').fill(draft);
  await page.clock.runFor(699);
  expect(await calls(page)).toBe(0);
  await page.clock.runFor(1);
  expect(await calls(page)).toBe(1);
  await auto(page, `  ${draft}  `);
  expect(await calls(page)).toBe(1);
  expect(await page.evaluate(() => window.lpTestCalls[0].fields)).toEqual({ answer: draft });
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
});

test('unfinished final sentences retain found items until punctuation or newline', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { window.lpValues = [1, 1, 1, 1]; });
  await auto(page);
  await expect(page.locator('[data-lp-mark="correct"]')).toHaveCount(4);
  await page.evaluate(() => { window.lpValues = [0, 0, 0, 0]; });
  await auto(page, 'I will speak at the next meeting and');
  await expect(page.locator('[data-lp-mark="correct"]')).toHaveCount(4);
  await auto(page, 'I will speak at the next meeting and ask for a turn.');
  await expect(page.locator('[data-lp-mark="missing"]')).toHaveCount(4);
  await page.evaluate(() => { window.lpValues = [1, 1, 1, 1]; });
  await auto(page, 'I will make another commitment.');
  await page.evaluate(() => { window.lpValues = [0, 0, 0, 0]; });
  await auto(page, 'I will describe another action\n');
  await expect(page.locator('[data-lp-mark="missing"]')).toHaveCount(4);
});

test('20 automatic checks are shared across instances and re-enhancement; manual checks still work', async ({ page }) => {
  await open(page, { two: true });
  const roots = page.locator('[data-lp-pattern]');
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id));
  expect(new Set(ids).size).toBe(ids.length);
  for (let index = 0; index < 20; index++) await auto(page, `${draft} ${index}.`, roots.nth(index % 2));
  expect(await calls(page)).toBe(20);
  await expect(roots.nth(1).locator('[data-lp-paused]')).toHaveText(strings.en.paused);
  await auto(page, `${draft} Over the cap.`, roots.first());
  await expect(roots.first().locator('[data-lp-paused]')).toBeVisible();
  expect(await calls(page)).toBe(20);
  await page.evaluate(() => { window.lpInstances[0].destroy(); window.lpEnhance(); });
  await expect(roots.first().locator('[data-lp-check]')).toBeEnabled();
  await auto(page, `${draft} Re-enhanced.`, roots.first());
  expect(await calls(page)).toBe(20);
  await roots.first().locator('[data-lp-check]').click();
  expect(await calls(page)).toBe(21);
  await expect(roots.first().locator('[role="status"]')).toContainText('2 of 4 done so far.');
});

test('slow requests keep typing available, abort on edit and discard stale successes and failures', async ({ page }) => {
  await open(page, { mode: 'pending' });
  await auto(page);
  await expect(page.locator('[data-lp-checking]')).toHaveText(strings.en.checking);
  await expect(page.getByRole('textbox')).toBeEnabled();
  await page.clock.runFor(9000);
  await expect(page.locator('[data-lp-checking]')).toBeVisible();
  await auto(page, 'I will ask for a turn at the next meeting.');
  expect(await page.evaluate(() => window.lpTestCalls.map(call => call.signal.aborted))).toEqual([true, false]);
  await page.evaluate(() => {
    const all = value => Object.fromEntries(['three_actions', 'observable', 'when', 'commitments'].map(key => [key, { noul: value }]));
    window.lpTestCalls[1].resolve(all(1));
    window.lpTestCalls[0].resolve(all(0));
  });
  await expect(page.locator('[data-lp-mark="correct"]')).toHaveCount(4);
  await auto(page, 'I will name a different workplace action.');
  await auto(page, 'I will name the latest workplace action.');
  await page.evaluate(() => { window.lpTestCalls[2].reject(new Error('Old refusal')); });
  await expect(page.locator('[data-lp-fallback]')).toBeHidden();
  await expect(page.locator('[data-lp-checking]')).toBeVisible();
  await page.evaluate(() => { window.lpTestCalls[3].resolve(Object.fromEntries(['three_actions', 'observable', 'when', 'commitments'].map(key => [key, { noul: 0 }]))); });
  await expect(page.locator('[data-lp-mark="missing"]')).toHaveCount(4);
  await expect(page.locator('[data-lp-checking]')).toBeHidden();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
});

for (const lang of ['en', 'fr']) {
  test(`silent automatic results and one keyboard button summary (${lang})`, async ({ page }) => {
    await open(page, { lang });
    await expect(page.locator('h2')).toHaveText(examples[lang].prompt);
    await expect(page.locator('[data-lp-notice]')).toBeVisible();
    await expect(page.locator('[data-lp-challenge]')).toBeHidden();
    await auto(page);
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
    await page.locator('[data-lp-check]').focus();
    await page.keyboard.press('Enter');
    const summary = strings[lang].summary.replace('{count}', '2').replace('{total}', '4');
    const missing = strings[lang].missingSummary.replace('{items}', examples[lang].criteria[1].short);
    const unsure = strings[lang].unsureSummary.replace('{items}', examples[lang].criteria[2].short);
    await expect(page.locator('[role="status"]')).toHaveText(`${summary} ${missing} ${unsure}`);
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([`${summary} ${missing} ${unsure}`]);
    await expect(page.locator('[data-lp-check]')).toBeFocused();
    await axe(page);
  });

  for (const mode of ['missing', 'throws', 'invalid']) test(`native checklist fallback for ${mode} (${lang})`, async ({ page }) => {
    await open(page, { lang, mode });
    if (mode !== 'missing') await auto(page);
    await expect(page.locator('[data-lp-fallback]')).toBeVisible();
    await expect(page.locator('[data-lp-fallback-text]')).toHaveText(strings[lang].fallback);
    await expect(page.locator('[data-lp-list]')).toBeHidden();
    await expect(page.locator('[data-lp-check]')).toBeHidden();
    await page.getByRole('checkbox').first().focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('checkbox').first()).toBeChecked();
    expect(await page.evaluate(() => window.lpSaved.ticked)).toEqual(['three_actions']);
    await axe(page);
  });

  test(`320 px reflow, text spacing and reduced motion (${lang})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, { lang }); await auto(page);
    await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('.lp-choice, .lp-button, .lp-input').evaluateAll(elements => elements.filter(el => el.clientWidth + 1 < el.scrollWidth).map(el => el.className))).toEqual([]);
      await expect(page.locator('[data-lp-check]')).toHaveCSS('transition-duration', '0s');
    }
    await axe(page);
  });
}

test('manual minimum length errors and repeated checks each announce once', async ({ page }) => {
  await open(page);
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[role="status"]')).toHaveText(strings.en.empty);
  await expect(page.getByRole('textbox')).toBeFocused();
  expect(await calls(page)).toBe(0);
  await page.getByRole('textbox').fill(draft);
  await page.locator('[data-lp-check]').click();
  await page.locator('[data-lp-check]').click();
  expect(await calls(page)).toBe(2);
  expect(await page.evaluate(() => window.lpAnnouncements.filter(text => text.startsWith('2 of 4')))).toHaveLength(2);
});

test('configured Perplexity notice comes from the shared ask client; refused calls fall back', async ({ page }) => {
  await open(page);
  await page.evaluate(async content => {
    window.lpInstances[0].destroy();
    const { enhance } = await import('/patterns/live-feedback/enhance.js');
    const { strings } = await import('/patterns/live-feedback/strings.js');
    const { createAsk } = await import('/lib/ask.js');
    const { noticeConfig } = await import('/lib/data-notice.js');
    window.lpNetwork = [];
    const ask = createAsk({ fetch: async (url, options) => {
      window.lpNetwork.push({ url, body: options.body });
      if (url.endsWith('/config')) return Response.json({ provider: 'perplexity', siteKey: '', model: 'pplx-decider-v1.1-27b', ...noticeConfig('perplexity') });
      return Response.json({ reason: 'budget' }, { status: 429 });
    } });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, ask });
  }, examples.en);
  await expect(page.locator('[data-lp-check]')).toBeEnabled();
  await expect(page.locator('[data-lp-notice]')).toContainText('Perplexity (US)');
  await auto(page);
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  expect(await page.evaluate(() => window.lpNetwork.map(call => call.url))).toEqual(['/api/patterns/config', '/api/patterns/ask']);
  expect(await page.evaluate(() => JSON.parse(window.lpNetwork[1].body))).toEqual({ block: '02-live', fields: { answer: draft } });
});

for (const mode of ['config-failure', 'clef']) test(`configuration ${mode} uses self-check`, async ({ page }) => {
  await open(page);
  await page.evaluate(async ({ content, mode }) => {
    window.lpInstances[0].destroy();
    const { enhance } = await import('/patterns/live-feedback/enhance.js');
    const { strings } = await import('/patterns/live-feedback/strings.js');
    const ask = Object.assign(async () => { throw new Error('Must not call'); }, { config: async () => {
      if (mode === 'config-failure') throw new Error('Unavailable');
      return { provider: 'clef' };
    } });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, ask });
  }, { content: examples.en, mode });
  await expect(page.locator('[data-lp-fallback-text]')).toHaveText(strings.en.fallback);
  await expect(page.locator('[data-lp-check]')).toBeHidden();
});

test('idempotent enhancement; destroy restores server DOM and ignores pending work', async ({ page }) => {
  await open(page, { mode: 'pending' });
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await auto(page);
  await page.evaluate(() => {
    window.lpInstances[0].destroy(); window.lpInstances[0].destroy();
    window.lpTestCalls[0].resolve({});
  });
  expect(await page.evaluate(() => window.lpTestCalls[0].signal.aborted)).toBe(true);
  const markup = await page.evaluate(async content => {
    const { render } = await import('/patterns/live-feedback/render.js');
    const { strings } = await import('/patterns/live-feedback/strings.js');
    const expected = document.createElement('div');
    expected.innerHTML = render(content, strings.en, { id: 'example', lang: 'en' });
    return { actual: document.querySelector('[data-lp-pattern]').outerHTML, expected: expected.firstElementChild.outerHTML };
  }, examples.en);
  expect(markup.actual).toBe(markup.expected);
  await expect(page.getByRole('textbox')).toHaveValue(draft);
  await page.getByRole('textbox').fill('After destroy');
  expect(await page.evaluate(() => window.lpSaved.answer)).toBe(draft);
  await page.clock.runFor(700);
  expect(await calls(page)).toBe(1);
});

test('saved drafts and self-check ticks restore', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { answer: 'Saved plan', ticked: ['when'] }; });
  await open(page, { mode: 'missing' });
  await expect(page.getByRole('textbox')).toHaveValue('Saved plan');
  await expect(page.getByRole('checkbox').nth(2)).toBeChecked();
});

test('invalid saved state is ignored', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { answer: 'Invalid', ticked: ['unknown'] }; });
  await open(page, { mode: 'missing' });
  await page.waitForFunction(() => window.lpReady);
  await expect(page.getByRole('textbox')).toHaveValue('');
  for (const box of await page.getByRole('checkbox').all()) await expect(box).not.toBeChecked();
});

test('no JavaScript keeps prompt, textarea and four native self-checks in both languages', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const lang of ['en', 'fr']) {
    await page.goto(`${baseURL}/live-feedback/${lang}.html`);
    await expect(page.locator('h2')).toHaveText(examples[lang].prompt);
    await expect(page.getByRole('textbox')).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(4);
    await expect(page.locator('[data-lp-check]')).toBeHidden();
    await page.getByRole('checkbox').first().check();
    await expect(page.getByRole('checkbox').first()).toBeChecked();
  }
  await context.close();
});

test('forced colours keep marks and visible keyboard focus', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' });
  await open(page); await auto(page);
  for (const mark of ['correct', 'missing']) await expect(page.locator(`[data-lp-mark="${mark}"]`).first()).toHaveCSS('border-style', 'double');
  await page.locator('[data-lp-check]').focus();
  await expect(page.locator('[data-lp-check]')).toHaveCSS('outline-style', 'solid');
  await expect(page.locator('[data-lp-check]')).toHaveCSS('outline-width', '2px');
});
