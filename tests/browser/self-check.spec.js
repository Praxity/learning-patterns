import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const english = JSON.parse(await readFile(new URL('../../blocks/self-check/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../blocks/self-check/examples/fr.json', import.meta.url)));

async function open(page, path = '/en.html') {
  await page.goto(path);
  await page.waitForFunction(() => window.lbReady);
}

async function ticks(page) {
  await page.getByRole('textbox').fill('My draft');
  await page.getByRole('button', { name: 'Check my answer', exact: true }).click();
}

async function observeStatus(page) {
  await page.evaluate(() => {
    window.lbAnnouncements = [];
    new MutationObserver(records => {
      for (const record of records) window.lbAnnouncements.push(record.target.textContent);
    }).observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}

test('keyboard-only journey, error association, focus and one mutation per announcement', async ({ page }) => {
  await open(page); await observeStatus(page);
  const answer = page.getByRole('textbox');
  await page.keyboard.press('Tab'); await expect(answer).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Check my answer', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(answer).toBeFocused(); await expect(answer).toHaveAttribute('aria-invalid', 'true');
  const errorId = await answer.getAttribute('aria-describedby');
  await expect(page.locator(`[id="${errorId}"]`)).toHaveText('Write an answer first.');
  await page.keyboard.type('A message to my manager.');
  await expect(answer).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[data-lb-error]')).toBeHidden();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  const boxes = page.getByRole('checkbox'); await expect(boxes.first()).toBeFocused();
  await page.keyboard.press('Space');
  for (let index = 0; index < 6; index++) await page.keyboard.press('Tab');
  const show = page.getByRole('button', { name: 'Show feedback' });
  await expect(show).toBeFocused(); await page.keyboard.press('Enter'); await expect(show).toBeFocused();
  await expect(page.locator('[data-lb-result]')).toContainText('You ticked 1 of 6 parts.');
  await expect(page.locator('[data-lb-result]')).toContainText('Included');
  await expect(page.locator('[data-lb-result]')).toContainText('Not included');
  await page.keyboard.press('Enter'); await expect(show).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Start again' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(answer).toBeFocused();
  await expect(answer).toHaveValue(''); await expect(page.locator('[data-lb-ticks]')).toBeHidden();
  await expect(page.locator('[data-lb-result]')).toBeHidden();
  await expect(page.locator('input:checked')).toHaveCount(0);
  expect(await page.evaluate(() => window.lbAnnouncements)).toEqual(['You ticked 1 of 6 parts.', 'You ticked 1 of 6 parts.', 'Cleared.']);
});

for (const path of ['/en.html', '/fr.html', '/two.html']) {
  test(`axe at load, checklist and feedback: ${path}`, async ({ page }) => {
    await open(page, path);
    const scan = async () => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await scan();
    for (const root of await page.locator('[data-lb-block]').all()) {
      await root.getByRole('textbox').fill('Draft'); await root.locator('[data-lb-check]').click();
    }
    await scan();
    for (const root of await page.locator('[data-lb-block]').all()) await root.locator('[data-lb-show]').click();
    await scan();
  });
}

test('editing answers or ticks preserves feedback, next submit replaces it and saves each change', async ({ page }) => {
  await open(page); await ticks(page);
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: 'Show feedback' }).click();
  const before = await page.locator('[data-lb-result]').innerHTML();
  await page.getByRole('textbox').fill('Edited draft');
  await page.getByRole('checkbox').nth(1).check();
  expect(await page.locator('[data-lb-result]').innerHTML()).toBe(before);
  expect(await page.evaluate(() => window.lbSaved)).toEqual({ answer: 'Edited draft', ticked: ['work_deadline', 'reason'], shown: true });
  await page.getByRole('button', { name: 'Show feedback' }).click();
  await expect(page.locator('[data-lb-result] > p').first()).toHaveText('You ticked 2 of 6 parts.');
  await expect(page.locator('[data-lb-result] > ul')).toHaveCount(1);
  await page.getByRole('button', { name: 'Start again' }).click();
  expect(await page.evaluate(() => window.lbSaved)).toEqual({ answer: '', ticked: [], shown: false });
});

for (const [lang, content] of [['en', english], ['fr', french]]) {
  test(`no JavaScript: native details contains all hints and model (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`/${lang}.html`);
    await expect(page.getByRole('textbox')).toHaveAttribute('rows', '5');
    await page.locator('summary').click(); await expect(page.locator('details')).toHaveAttribute('open', '');
    for (const part of content.parts) await expect(page.locator('details')).toContainText(part.missed);
    await expect(page.locator('details')).toContainText(content.model);
    await expect(page.locator('[data-lb-flow]')).toBeHidden();
    await context.close();
  });

  test(`320px and WCAG text spacing without overflow or overlap (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await open(page, `/${lang}.html`);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    await page.getByRole('textbox').fill('Draft'); await page.locator('[data-lb-check]').click(); await page.locator('[data-lb-show]').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const problems = await page.evaluate(() => [...document.querySelectorAll('p, label, legend, button, li, h2')].filter(el => el.getClientRects().length).flatMap(el => {
      const failures = [];
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) failures.push(el.textContent);
      const children = [...el.children].filter(child => child.getClientRects().length);
      for (let i = 1; i < children.length; i++) {
        const a = children[i - 1].getBoundingClientRect(), b = children[i].getBoundingClientRect();
        if (Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1) failures.push('overlap: ' + el.textContent);
      }
      return failures;
    }));
    expect(problems).toEqual([]);
  });
}

test('French root has French language and translated feedback', async ({ page }) => {
  await open(page, '/fr.html'); await expect(page.locator('[data-lb-block]')).toHaveAttribute('lang', 'fr');
  await page.getByRole('textbox').fill('Mon message'); await page.locator('[data-lb-check]').click();
  await page.getByRole('checkbox').first().check(); await page.locator('[data-lb-show]').click();
  await expect(page.locator('[data-lb-result]')).toContainText('Vous avez coché 1 éléments sur 6.');
  await expect(page.locator('[data-lb-result]')).toContainText(french.model);
});

for (const shown of [false, true]) {
  test(`valid saved state restores checklist and shown=${shown} without announcements`, async ({ page }) => {
    await page.addInitScript(value => { window.lbSeed = value; }, { answer: 'Saved answer', ticked: ['reason'], shown });
    await open(page); await expect(page.getByRole('textbox')).toHaveValue('Saved answer');
    await expect(page.getByRole('checkbox').nth(1)).toBeChecked(); await expect(page.locator('[data-lb-ticks]')).toBeVisible();
    await expect(page.locator('[role="status"]')).toHaveText('');
    if (shown) await expect(page.locator('[data-lb-result]')).toContainText('You ticked 1 of 6 parts.');
    else await expect(page.locator('[data-lb-result]')).toBeHidden();
  });
}

test('invalid saved state is ignored', async ({ page }) => {
  await page.addInitScript(() => { window.lbSeed = { answer: 'Invalid', ticked: ['unknown'], shown: true }; });
  await open(page); await expect(page.getByRole('textbox')).toHaveValue('');
  await expect(page.locator('[data-lb-ticks]')).toBeHidden(); await expect(page.locator('[role="status"]')).toHaveText('');
});

test('enhance is idempotent and destroy removes listeners and restores fallback', async ({ page }) => {
  await open(page); expect(await page.evaluate(() => window.lbEnhance() === window.lbInstances[0])).toBe(true);
  await observeStatus(page); await ticks(page); await page.locator('[data-lb-show]').click();
  expect(await page.evaluate(() => window.lbAnnouncements)).toEqual(['You ticked 0 of 6 parts.']);
  await page.evaluate(() => window.lbInstances[0].destroy());
  await expect(page.locator('[data-lb-flow]')).toBeHidden(); await expect(page.locator('[data-lb-fallback]')).toBeVisible();
  await page.evaluate(() => window.lbEnhance()); await ticks(page); await page.locator('[data-lb-show]').click();
  await expect(page.locator('[data-lb-result] > ul')).toHaveCount(1);
});

test('two instances have unique IDs and independent controls', async ({ page }) => {
  await open(page, '/two.html');
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id));
  expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lb-block]');
  await roots.first().getByRole('textbox').fill('First draft'); await roots.first().locator('[data-lb-check]').click();
  await roots.first().getByRole('checkbox').first().check(); await roots.first().locator('[data-lb-show]').click();
  await expect(roots.nth(1).getByRole('textbox')).toHaveValue(''); await expect(roots.nth(1).locator('[data-lb-ticks]')).toBeHidden();
  await expect(roots.nth(1).locator('[role="status"]')).toHaveText('');
});

test('forced colours keeps a 2px focus outline on buttons and checkboxes', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page); await ticks(page);
  for (const locator of [page.getByRole('checkbox').first(), page.locator('[data-lb-show]')]) {
    await locator.focus();
    const outline = await locator.evaluate(el => { const css = getComputedStyle(el); return { width: css.outlineWidth, style: css.outlineStyle, offset: css.outlineOffset, color: css.outlineColor }; });
    expect(outline.width).toBe('2px'); expect(outline.style).toBe('solid'); expect(outline.offset).toBe('2px'); expect(outline.color).not.toBe('rgba(0, 0, 0, 0)');
  }
});
