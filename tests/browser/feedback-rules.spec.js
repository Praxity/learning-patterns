import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { strings } from '../../patterns/feedback-rules/strings.js';

const examples = Object.fromEntries(await Promise.all(['en', 'fr'].map(async lang => [lang, JSON.parse(await readFile(new URL(`../../patterns/feedback-rules/examples/${lang}.json`, import.meta.url)))])));

async function open(page, lang = 'en', mode = 'saved') {
  await page.addInitScript(({ content, mode }) => {
    window.lpCalls = []; window.lpResolvers = []; window.lpActive = 0; window.lpMaximum = 0;
    if (mode === 'offline') window.lpAsk = null;
    else if (mode !== 'saved') window.lpAsk = async (block, fields, options) => {
      const fixture = content.fixtures.find(f => f.answer.en === fields.answer || f.answer.fr === fields.answer);
      const language = fixture.answer.en === fields.answer ? 'en' : 'fr';
      window.lpCalls.push({ block, fields, slot: !!options.challengeSlot, signal: !!options.signal });
      window.lpMaximum = Math.max(window.lpMaximum, ++window.lpActive);
      if (mode === 'pending') await new Promise(resolve => window.lpResolvers.push(resolve));
      window.lpActive--;
      if (mode === 'throws' || (mode === 'failed' && fixture.id === 'no_reason')) throw new Error('Unavailable');
      if (mode === 'invalid') return {};
      const answer = structuredClone(content.savedRun.answers[language][fixture.id]);
      if ((mode === 'disagree' || mode === 'pending') && fixture.id === 'perfect') { answer.reason.noul = 0; answer.new_date.noul = .5; }
      return answer;
    };
  }, { content: examples[lang], mode });
  await page.goto(`/feedback-rules/${lang}.html`); await page.waitForFunction(() => window.lpReady);
  if (mode !== 'offline') await expect(page.locator('[data-lp-run]')).toBeEnabled();
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
async function finish(page) {
  await expect(page.locator('[data-lp-run]')).not.toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('[role="status"]')).not.toBeEmpty();
}

for (const lang of ['en', 'fr']) {
  test(`run every sample once, real saved values, one summary, focus and axe (${lang})`, async ({ page }) => {
    await open(page, lang); await observe(page);
    await expect(page.locator('[data-lp-summary]')).toContainText('72');
    await expect(page.locator('[data-lp-outcome="notRun"]')).toHaveCount(72);
    await expect(page.locator('[role="status"]')).toBeEmpty();
    await axe(page); await page.locator('[data-lp-language]').focus(); await page.keyboard.press('Tab');
    await expect(page.locator('[data-lp-run]')).toBeFocused(); await page.keyboard.press('Enter'); await finish(page);
    const calls = await page.evaluate(() => window.lpCalls);
    // The default fake ask is injected by the demo build and does not use this test recorder.
    expect(calls).toEqual([]);
    await expect(page.locator('[data-lp-outcome="agree"]')).toHaveCount(72);
    await expect(page.locator('[data-lp-outcome="notRun"]')).toHaveCount(0);
    await expect(page.locator('[data-lp-run]')).toBeFocused();
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([await page.locator('[data-lp-summary]').textContent()]);
    await axe(page);
  });

  test(`progressive rows, first clearance, four in flight, no duplicate or intermediate announcement (${lang})`, async ({ page }) => {
    await open(page, lang, 'pending'); await observe(page); await page.locator('[data-lp-run]').click();
    await expect.poll(() => page.evaluate(() => window.lpCalls.length)).toBe(1);
    await expect(page.locator('[data-lp-outcome="notRun"]')).toHaveCount(72);
    await expect(page.locator('[data-lp-language]')).toBeDisabled();
    await page.evaluate(() => window.lpResolvers.splice(0).forEach(resolve => resolve()));
    await expect(page.locator('[data-lp-outcome="notRun"]')).toHaveCount(66);
    await expect.poll(() => page.evaluate(() => window.lpCalls.length)).toBe(5);
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
    await expect(page.locator('[data-lp-progress]')).toContainText('1'); await axe(page);
    while (await page.locator('[data-lp-run]').getAttribute('aria-disabled') === 'true') {
      await page.evaluate(() => window.lpResolvers.splice(0).forEach(resolve => resolve()));
      await page.waitForTimeout(25);
    }
    await finish(page);
    const calls = await page.evaluate(() => window.lpCalls);
    expect(calls).toHaveLength(12); expect(new Set(calls.map(c => c.fields.answer)).size).toBe(12);
    expect(calls.every(c => c.block === '16-fixtures' && c.slot && c.signal)).toBe(true);
    expect(await page.evaluate(() => window.lpMaximum)).toBe(4);
    expect(await page.evaluate(() => window.lpAnnouncements.length)).toBe(1);
    await expect(page.locator('[data-lp-outcome="agree"]')).toHaveCount(70);
    await expect(page.locator('[data-lp-outcome="disagree"]')).toHaveCount(1);
    await expect(page.locator('[data-lp-outcome="unsure"]')).toHaveCount(1);
  });

  test(`failed sample stays not run and does not stop the rest (${lang})`, async ({ page }) => {
    await open(page, lang, 'failed'); await page.locator('[data-lp-run]').click(); await finish(page);
    await expect(page.locator('[data-lp-outcome="agree"]')).toHaveCount(66);
    await expect(page.locator('[data-lp-outcome="notRun"]')).toHaveCount(6);
    await expect(page.locator('[data-lp-outcome="unsure"]')).toHaveCount(0);
    await expect(page.locator('[data-lp-row="no_reason"]')).toContainText(strings[lang].failed);
    await expect(page.locator('[data-lp-errors]')).toBeVisible(); await axe(page);
    expect(await page.evaluate(() => window.lpCalls.length)).toBe(12);
  });

  test(`expand a disagreement with both labels and answer; native keyboard disclosure (${lang})`, async ({ page }) => {
    await open(page, lang, 'disagree'); await page.locator('[data-lp-run]').click(); await finish(page);
    const disclosure = page.locator('[data-lp-review]').first();
    await disclosure.locator('summary').focus(); await page.keyboard.press('Enter');
    await expect(disclosure).toHaveAttribute('open', '');
    await expect(disclosure.locator('.lp-quote')).toHaveText(examples[lang].fixtures[0].answer[lang]);
    await expect(disclosure.locator('dd').nth(1)).toHaveText(`${strings[lang].author}: ${strings[lang].met}. ${strings[lang].model}: ${strings[lang].missed}.`);
    await expect(disclosure.locator('summary')).toBeFocused(); await axe(page);
  });

  for (const mode of ['offline', 'throws', 'invalid']) test(`saved run and date with ${mode} model (${lang})`, async ({ page }) => {
    await open(page, lang, mode);
    if (mode !== 'offline') { await page.locator('[data-lp-run]').click(); await finish(page); }
    await expect(page.locator('[data-lp-run]')).toBeHidden();
    await expect(page.locator('[data-lp-offline]')).toHaveText(strings[lang].unavailable);
    await expect(page.locator('[data-lp-run-info]')).toContainText('2026-10-07');
    await expect(page.locator('[data-lp-run-info]')).toContainText('Clef 27B');
    await expect(page.locator('[data-lp-outcome="agree"]')).toHaveCount(72);
    await page.locator('[data-lp-language]').selectOption(lang === 'en' ? 'fr' : 'en');
    await page.locator('[data-lp-row="perfect"] summary').click();
    await expect(page.locator('[data-lp-row="perfect"] .lp-quote')).toHaveAttribute('lang', lang === 'en' ? 'fr' : 'en');
    await axe(page);
  });

  test(`sample language switch changes requests; lifecycle is repeatable (${lang})`, async ({ page }) => {
    await open(page, lang, 'disagree');
    expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
    const selected = lang === 'en' ? 'fr' : 'en';
    await page.locator('[data-lp-language]').selectOption(selected);
    await page.locator('[data-lp-run]').click(); await finish(page);
    const calls = await page.evaluate(() => window.lpCalls);
    expect(calls.map(c => c.fields.answer)).toEqual(examples[lang].fixtures.map(f => f.answer[selected]));
    await page.evaluate(() => window.lpInstances[0].destroy());
    await expect(page.locator('[data-lp-controls]')).toBeHidden();
    await expect(page.locator('[data-lp-outcome="agree"]')).toHaveCount(72);
    await expect(page.locator('[role="status"]')).toBeEmpty();
    await page.evaluate(() => window.lpInstances[0] = window.lpEnhance());
    await expect(page.locator('[data-lp-controls]')).toBeVisible();
  });

  test(`320 px, text spacing, scroll focus, reduced motion and table axe (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, lang, 'disagree'); await page.locator('[data-lp-run]').click(); await finish(page);
    await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const region = page.getByRole('region', { name: strings[lang].samples }); await region.focus();
    await expect(region).toBeFocused();
    expect(await region.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    expect(await page.locator('[data-lp-run]').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
    await axe(page);
  });

  test(`no JavaScript shows the recorded plain table and answers (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage();
    await page.goto(`/feedback-rules/${lang}.html`);
    await expect(page.getByRole('table')).toBeVisible(); await expect(page.locator('[data-lp-controls]')).toBeHidden();
    await expect(page.locator('[data-lp-outcome="agree"]')).toHaveCount(72);
    await expect(page.locator('[data-lp-run-info]')).toContainText('Clef 27B');
    await page.locator('[data-lp-row="perfect"] summary').click();
    await expect(page.locator('[data-lp-row="perfect"] .lp-quote')).toHaveText(examples[lang].fixtures[0].answer[lang]);
    await context.close();
  });
}

test('configured data notice, configuration failure and incomplete saved recordings', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    window.lpInstances[0].destroy();
    const { enhance } = await import('/patterns/feedback-rules/enhance.js');
    const { strings } = await import('/patterns/feedback-rules/strings.js');
    const { noticeConfig } = await import('/lib/data-notice.js');
    window.lpRemount = async (content, broken) => enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en,
      ask: Object.assign(async () => { throw new Error('Offline'); }, { config: async () => { if (broken) throw new Error('Config'); return { provider: 'clef', siteKey: '', model: '@cf/cloudflare/clef', ...noticeConfig('clef') }; } }) });
  });
  await page.evaluate(content => { window.lpInstances[0] = window.lpRemount(content, false); }, examples.en);
  await expect(page.locator('[data-lp-notice]')).toContainText('Cloudflare Workers AI');
  await expect(page.locator('[data-lp-run]')).toHaveAttribute('aria-describedby', 'example-notice-text');
  await page.evaluate(async content => {
    (await window.lpInstances[0]).destroy();
    delete content.savedRun.answers.en.perfect;
    window.lpInstances[0] = await window.lpRemount(content, true);
  }, structuredClone(examples.en));
  await expect(page.locator('[data-lp-run]')).toBeHidden();
  await expect(page.locator('[data-lp-outcome="notRun"]')).toHaveCount(6);
  await expect(page.locator('[data-lp-summary]')).toContainText('6 labels not run');
});

test('destroy cancels pending requests and leaves the saved table', async ({ page }) => {
  await open(page, 'en', 'pending'); await page.locator('[data-lp-run]').click();
  await page.evaluate(() => window.lpInstances[0].destroy());
  await page.evaluate(() => window.lpResolvers.splice(0).forEach(resolve => resolve()));
  await expect(page.locator('[data-lp-outcome="agree"]')).toHaveCount(72);
  await expect(page.locator('[role="status"]')).toBeEmpty();
});

test('two instances isolate ids and announcements', async ({ page }) => {
  await page.goto('/feedback-rules/two.html'); await page.waitForFunction(() => window.lpReady);
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  await expect(page.locator('[data-lp-run]').first()).toBeEnabled();
  await page.locator('[data-lp-run]').first().click();
  await expect(page.locator('[role="status"]').first()).not.toBeEmpty();
  await expect(page.locator('[role="status"]').last()).toBeEmpty();
  await axe(page);
});

test('forced colours preserve outcome words and visible focus', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Chromium implements forced colour emulation.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page, 'en', 'disagree');
  await page.locator('[data-lp-run]').click(); await finish(page);
  await expect(page.locator('[data-lp-outcome="disagree"]')).toHaveText('disagrees');
  const region = page.getByRole('region'); await region.focus();
  expect(await region.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none'); await axe(page);
});

for (const lang of ['en', 'fr']) for (const width of [1280, 390]) test(`screenshots ${lang} ${width}`, async ({ page, browserName }) => {
  test.skip(!process.env.LP_SHOTS_DIR || browserName !== 'chromium', 'Optional Chromium evidence capture.');
  const folder = process.env.LP_SHOTS_DIR; await mkdir(folder, { recursive: true });
  await page.setViewportSize({ width, height: 960 });
  const shot = async state => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: join(folder, `${lang}-${width}-${state}.png`), fullPage: true }); };
  await open(page, lang); await shot('before');
  await open(page, lang, 'offline'); await shot('saved');
  await open(page, lang, 'disagree'); await page.locator('[data-lp-run]').click(); await finish(page);
  await page.locator('[data-lp-review] summary').first().click(); await shot('disagreement');
  await open(page, lang, 'pending'); await page.locator('[data-lp-run]').click();
  await page.evaluate(() => window.lpResolvers.splice(0).forEach(resolve => resolve()));
  await expect(page.locator('[data-lp-outcome="notRun"]')).toHaveCount(66); await shot('progress');
});
