import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const english = JSON.parse(await readFile(new URL('../../patterns/review-prompts/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/review-prompts/examples/fr.json', import.meta.url)));

async function open(page, path = '/review-prompts/en.html') {
  await page.clock.install({ time: new Date(2026, 9, 6, 23, 45) });
  await page.goto(path); await page.waitForFunction(() => window.lpReady);
}
async function observe(page) {
  await page.evaluate(() => {
    window.lpObserver?.disconnect();
    window.lpAnnouncements = [];
    window.lpObserver = new MutationObserver(records => {
      for (const record of records) window.lpAnnouncements.push(record.target.textContent);
    });
    window.lpObserver.observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}
const part = page => page.locator('[data-lp-part]').first();
const scan = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);

test('keyboard journey keeps native details and focus, updates dates, saves state and announces once', async ({ page }) => {
  await open(page); await observe(page);
  const first = part(page), summary = first.locator('summary');
  const remembered = first.getByRole('button', { name: 'I remembered' });
  const forgot = first.getByRole('button', { name: 'I forgot' });
  await expect(first.locator('[data-lp-rating]')).toBeHidden();
  await page.keyboard.press('Tab'); await expect(summary).toBeFocused();
  await page.keyboard.press('Enter'); await expect(summary).toBeFocused();
  await expect(first.locator('details')).toHaveAttribute('open', '');
  await expect(first.locator('[data-lp-rating]')).toBeVisible();
  await page.keyboard.press('Tab'); await expect(remembered).toBeFocused();
  await page.keyboard.press('Enter'); await expect(remembered).toBeFocused();
  await expect(first.locator('time')).toHaveAttribute('datetime', '2026-10-09');
  await expect(first.locator('[data-lp-review]')).toHaveText('Next review: Friday, October 9, 2026');
  await expect(remembered).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab'); await expect(forgot).toBeFocused();
  await page.keyboard.press('Space'); await expect(forgot).toBeFocused();
  await expect(first.locator('time')).toHaveAttribute('datetime', '2026-10-07');
  await expect(remembered).toHaveAttribute('aria-pressed', 'false'); await expect(forgot).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ results: { stonewalling: { result: 'forgot', reviewOn: '2026-10-07' } } });
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Next review: Friday, October 9, 2026', 'Next review: Wednesday, October 7, 2026']);
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab'); await expect(summary).toBeFocused();
  await page.keyboard.press('Space'); await expect(first.locator('[data-lp-rating]')).toBeHidden();
  await page.keyboard.press('Enter'); await expect(first.locator('time')).toHaveAttribute('datetime', '2026-10-07');
  await expect(page.locator('h3')).toHaveCount(3); await expect(page.locator('h2, table')).toHaveCount(0);
});

test('each submitted choice announces once, including repeated choices and separate parts', async ({ page }) => {
  await open(page); await observe(page);
  await part(page).locator('summary').click();
  await part(page).getByRole('button', { name: 'I remembered' }).click();
  await part(page).getByRole('button', { name: 'I remembered' }).click();
  const second = page.locator('[data-lp-part]').nth(1);
  await second.locator('summary').click(); await second.getByRole('button', { name: 'I forgot' }).click();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Next review: Friday, October 9, 2026', 'Next review: Friday, October 9, 2026', 'Next review: Wednesday, October 7, 2026']);
  expect(await page.evaluate(() => window.lpSaved.results)).toEqual({ stonewalling: { result: 'remembered', reviewOn: '2026-10-09' }, time_out: { result: 'forgot', reviewOn: '2026-10-07' } });
});

test('closed answers ignore programmatic ratings and host writes cannot mutate earlier results', async ({ page }) => {
  await open(page); await observe(page);
  await part(page).locator('[data-lp-result="remembered"]').evaluate(button => button.click());
  await expect(page.locator('time')).toHaveCount(0);
  expect(await page.evaluate(() => window.lpSaved)).toBeUndefined();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  await part(page).locator('summary').click(); await part(page).getByRole('button', { name: 'I remembered' }).click();
  await page.evaluate(() => { window.lpSaved.results.stonewalling.reviewOn = '2020-01-01'; });
  const second = page.locator('[data-lp-part]').nth(1);
  await second.locator('summary').click(); await second.getByRole('button', { name: 'I forgot' }).click();
  expect(await page.evaluate(() => window.lpSaved.results.stonewalling.reviewOn)).toBe('2026-10-09');
});

test('a later choice schedules from that day rather than the opening day', async ({ page }) => {
  await open(page); await part(page).locator('summary').click();
  await part(page).getByRole('button', { name: 'I remembered' }).click();
  await page.clock.setSystemTime(new Date(2026, 9, 30, 23, 45));
  await part(page).getByRole('button', { name: 'I remembered' }).click();
  await expect(part(page).locator('time')).toHaveAttribute('datetime', '2026-11-02');
});

for (const path of ['/review-prompts/en.html', '/review-prompts/fr.html', '/review-prompts/two.html']) {
  test(`axe at load, answer, rating and changed choice: ${path}`, async ({ page }) => {
    await open(page, path); await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('summary').first().click();
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-result="remembered"]').first().click();
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-result="forgot"]').first().click();
    await scan(page);
  });
}

for (const [lang, content] of [['en', english], ['fr', french]]) {
  test(`no JavaScript keeps all readings and native answers usable (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage(); await page.goto(`/review-prompts/${lang}.html`);
    await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', lang);
    for (const [index, authored] of content.parts.entries()) {
      const block = page.locator('[data-lp-part]').nth(index);
      await expect(block.getByRole('heading', { level: 3 })).toHaveText(authored.heading);
      await block.locator('summary').click(); await expect(block.locator('[data-lp-answer]')).toHaveText(authored.answer);
      await expect(block.locator('[data-lp-rating]')).toBeHidden();
    }
    await expect(page.getByRole('status')).toHaveText(''); await context.close();
    // Axe needs script execution. Scan the same native HTML with the enhancer blocked.
    const auditContext = await browser.newContext();
    await auditContext.route('**/patterns/review-prompts/enhance.js', route => route.abort());
    const auditPage = await auditContext.newPage(); await auditPage.goto(`/review-prompts/${lang}.html`);
    await scan(auditPage);
    for (const summary of await auditPage.locator('summary').all()) await summary.click();
    await expect(auditPage.getByRole('button', { includeHidden: false })).toHaveCount(0);
    await scan(auditPage); await auditContext.close();
  });

  test(`320 CSS px with text spacing has no overflow or clipping (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await open(page, `/review-prompts/${lang}.html`);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    for (const block of await page.locator('[data-lp-part]').all()) {
      await block.locator('summary').click(); await block.locator('[data-lp-result="remembered"]').click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => [...document.querySelectorAll('p, button, summary, h3')].filter(el => el.getClientRects().length && !el.matches('[role="status"]')).filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map(el => el.textContent))).toEqual([]);
    expect(await page.locator('.lp-review-prompts-actions').evaluateAll(groups => groups.flatMap(group => {
      const [first, second] = [...group.children].map(el => el.getBoundingClientRect());
      return Math.min(first.right, second.right) > Math.max(first.left, second.left) + 1 && Math.min(first.bottom, second.bottom) > Math.max(first.top, second.top) + 1 ? ['overlapping buttons'] : [];
    }))).toEqual([]);
  });
}

test('French root, answer and date use French strings and fr-CA formatting', async ({ page }) => {
  await open(page, '/review-prompts/fr.html'); await observe(page);
  await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', 'fr');
  await part(page).getByText('Afficher la réponse', { exact: true }).click();
  await expect(part(page).locator('[data-lp-answer]')).toHaveText(french.parts[0].answer);
  await part(page).getByRole('button', { name: "Je m'en suis souvenu" }).click();
  await expect(part(page).locator('[data-lp-review]')).toHaveText('Prochaine révision : vendredi 9 octobre 2026');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Prochaine révision : vendredi 9 octobre 2026']);
});

test('valid saved dates restore exactly, open rated parts, and do not announce', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { results: { stonewalling: { result: 'forgot', reviewOn: '2025-01-02' }, return: { result: 'remembered', reviewOn: '2028-02-29' } } }; });
  await open(page);
  await expect(part(page).locator('details')).toHaveAttribute('open', '');
  await expect(part(page).locator('time')).toHaveAttribute('datetime', '2025-01-02');
  await expect(part(page).getByRole('button', { name: 'I forgot' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-lp-part]').nth(1).locator('[data-lp-rating]')).toBeHidden();
  await expect(page.locator('[data-lp-part]').nth(2).locator('time')).toHaveAttribute('datetime', '2028-02-29');
  await expect(page.getByRole('status')).toHaveText('');
});

test('invalid saved state is ignored without opening details or announcing', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { results: { stonewalling: { result: 'forgot', reviewOn: '2026-02-29' } } }; });
  await open(page); await expect(page.locator('details[open]')).toHaveCount(0);
  await expect(page.locator('time')).toHaveCount(0); await expect(page.getByRole('status')).toHaveText('');
});

test('two instances have unique ids and independent results', async ({ page }) => {
  await open(page, '/review-prompts/two.html');
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]'); await roots.first().locator('summary').first().click();
  await roots.first().getByRole('button', { name: 'I remembered' }).first().click();
  await expect(roots.nth(1).locator('details[open]')).toHaveCount(0); await expect(roots.nth(1).locator('time')).toHaveCount(0);
  await expect(roots.nth(1).getByRole('status')).toHaveText('');
});

test('enhance is idempotent, destroy restores native details and old destroy is harmless', async ({ page }) => {
  await open(page); await observe(page);
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await part(page).locator('summary').click(); await part(page).getByRole('button', { name: 'I remembered' }).click();
  expect(await page.evaluate(() => window.lpAnnouncements.length)).toBe(1);
  await page.evaluate(() => { window.lpOld = window.lpInstances[0]; window.lpOld.destroy(); window.lpOld.destroy(); });
  await expect(part(page).locator('[data-lp-rating]')).toBeHidden(); await expect(part(page).locator('[data-lp-answer]')).toBeVisible();
  await expect(page.locator('time')).toHaveCount(0); await expect(page.getByRole('status')).toHaveText('');
  await part(page).locator('summary').click(); await part(page).locator('summary').click();
  await expect(part(page).locator('[data-lp-rating]')).toBeHidden();
  await page.evaluate(() => { window.lpEnhance(); window.lpOld.destroy(); });
  await expect(part(page).locator('[data-lp-rating]')).toBeVisible();
  await observe(page); await part(page).getByRole('button', { name: 'I forgot' }).click();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Next review: Wednesday, October 7, 2026']);
});

test('missing and mismatched markup fail loudly before attaching listeners', async ({ page }) => {
  await open(page);
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/review-prompts/enhance.js');
    const { strings } = await import('/patterns/review-prompts/strings.js');
    enhance(document.createElement('section'), { content, strings: strings.en });
  }, english)).rejects.toThrow('Missing review-prompts markup');
  for (const change of ['part', 'button', 'part count', 'button count', 'details', 'summary', '[data-lp-answer]', '[data-lp-rating]', '[data-lp-review]', '[role="status"]']) {
    await page.evaluate(kind => {
      window.lpInstances[0].destroy();
      if (kind === 'part') document.querySelector('[data-lp-part]').dataset.lpPart = 'unknown';
      if (kind === 'button') document.querySelector('[data-lp-result]').dataset.lpResult = 'invalid';
      if (kind === 'part count') document.querySelector('[data-lp-part]').remove();
      if (kind === 'button count') document.querySelector('[data-lp-result]').remove();
      if (!['part', 'button', 'part count', 'button count'].includes(kind)) document.querySelector(kind).remove();
    }, change);
    await expect(page.evaluate(() => window.lpEnhance())).rejects.toThrow(/review-prompts markup/);
    await page.goto('/review-prompts/en.html'); await page.waitForFunction(() => window.lpReady);
  }
});

test('configured intervals reach the enhancer through content', async ({ page }) => {
  await open(page);
  await page.evaluate(async content => {
    window.lpInstances[0].destroy();
    const { enhance } = await import('/patterns/review-prompts/enhance.js');
    const { strings } = await import('/patterns/review-prompts/strings.js');
    enhance(document.querySelector('[data-lp-pattern]'), { content: { ...content, reviewDays: { remembered: 7, forgot: 2 } }, strings: strings.en });
  }, english);
  await part(page).locator('summary').click(); await part(page).getByRole('button', { name: 'I remembered' }).click();
  await expect(part(page).locator('time')).toHaveAttribute('datetime', '2026-10-13');
});

test('forced colours preserves focus outlines and a visible pressed state', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page); await part(page).locator('summary').click();
  await part(page).getByRole('button', { name: 'I remembered' }).click();
  for (const target of [part(page).locator('summary'), ...await part(page).getByRole('button').all()]) {
    await target.focus();
    expect(await target.evaluate(el => { const css = getComputedStyle(el); return [css.outlineWidth, css.outlineStyle, css.outlineOffset]; })).toEqual(['2px', 'solid', '2px']);
    expect(await target.evaluate(el => getComputedStyle(el).outlineColor)).not.toBe('rgba(0, 0, 0, 0)');
  }
  expect(await part(page).getByRole('button', { name: 'I remembered' }).evaluate(el => getComputedStyle(el).borderStyle)).toBe('double');
  expect(await part(page).getByRole('button', { name: 'I forgot' }).evaluate(el => getComputedStyle(el).borderStyle)).toBe('solid');
  await expect(part(page).locator('[aria-hidden="true"]')).toHaveCount(1);
});
