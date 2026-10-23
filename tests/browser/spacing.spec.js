import { test, expect } from '@playwright/test';

const TEXT_SPACING = '.lp, .lp * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } .lp p { margin-bottom: 2em !important; }';

async function open(page, name, lang = 'en') {
  await page.goto(`/${name}/${lang}.html`);
  await page.waitForFunction(() => window.lpReady);
  await page.evaluate(() => document.fonts.ready);
}

async function gap(before, after) {
  const a = await before.boundingBox(), b = await after.boundingBox();
  expect(a).not.toBeNull();
  expect(b).not.toBeNull();
  return b.y - a.y - a.height;
}

async function compareAnswers(page, lang = 'en') {
  await open(page, 'first-answer', lang);
  await page.locator('[data-lp-first-input]').fill('Please let me finish this point.');
  await page.locator('[data-lp-save-first]').click();
  await page.locator('[data-lp-skip]').click();
  await page.locator('[data-lp-now-input]').fill('I lose my place when you interrupt. How do you see it?');
  await page.locator('[data-lp-compare]').click();
}

for (const width of [1280, 390]) {
  test(`question to textarea is 12px at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'journal');
    expect(await gap(page.locator('.lp-stem'), page.locator('textarea.lp-input'))).toBeCloseTo(12, 1);
    expect(await gap(page.locator('textarea.lp-input'), page.locator('.lp-actions'))).toBeCloseTo(24, 1);
  });

  test(`label to input and input to error are 8px at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'retrieval-sheet');
    await page.locator('input[value="custom"]').check();
    const input = page.locator('[data-lp-date]');
    await input.fill('');
    await input.dispatchEvent('change');
    await expect(page.locator('[data-lp-date-error]')).toBeVisible();
    expect(await gap(page.locator('.lp-retrieval-sheet-date-field .lp-label'), input)).toBeCloseTo(8, 1);
    expect(await gap(input, page.locator('[data-lp-date-error]'))).toBeCloseTo(8, 1);
  });

  test(`an unpatched field error stays with its field at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'first-answer');
    await page.locator('[data-lp-save-first]').click();
    await expect(page.locator('[data-lp-first-error]')).toBeVisible();
    expect(await gap(page.locator('[data-lp-first-input]'), page.locator('[data-lp-first-error]'))).toBeCloseTo(8, 1);
  });

  test(`answer and choice groups are 24px apart at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await compareAnswers(page);
    expect(await gap(page.locator('[data-lp-panel-first-card]'), page.locator('.lp-choices'))).toBeCloseTo(24, 1);
    expect(await page.locator('.lp-run-in:visible').first().evaluate(el => parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(1.4, 2);
  });

  test(`legends keep their own 12px gap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'dont-know');
    const groups = page.locator('.lp-choices');
    expect(await gap(groups.first().locator('legend'), groups.first().locator('.lp-choice').first())).toBeCloseTo(12, 1);
    expect(await groups.first().locator('.lp-choice').first().evaluate(el => parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(1.4, 2);
  });
}

// 320 CSS px represents reflow at 400% zoom from a 1280px viewport.
for (const lang of ['en', 'fr']) for (const textSpacing of [false, true]) {
  test(`400% reflow preserves fields and choices (${lang}, text spacing ${textSpacing})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    for (const name of ['journal', 'first-answer', 'retrieval-sheet', 'dont-know', 'write-distractors', 'self-check', 'test-out']) {
      await open(page, name, lang);
      if (textSpacing) await page.addStyleTag({ content: TEXT_SPACING });
      if (name === 'first-answer') await page.locator('[data-lp-save-first]').click();
      if (name === 'retrieval-sheet') {
        await page.locator('input[value="custom"]').check();
        await page.locator('[data-lp-date]').fill('');
        await page.locator('[data-lp-date]').dispatchEvent('change');
      }
      if (name === 'test-out') await page.locator('[data-lp-start]').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name).toBe(true);
      const clipped = await page.locator('.lp :is(label, legend, button, textarea, select, input, .lp-error-text):visible').evaluateAll(elements => elements.filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.left < 0 || rect.right > innerWidth + 1 || (!(el instanceof HTMLTextAreaElement) && el.scrollWidth > el.clientWidth + 2) || (!(el instanceof HTMLTextAreaElement) && el.scrollHeight > el.clientHeight + 2);
      }).map(el => el.outerHTML));
      expect(clipped, name).toEqual([]);
      if (name === 'journal') expect(await gap(page.locator('.lp-stem'), page.locator('textarea'))).toBeGreaterThanOrEqual(12);
      if (name === 'first-answer') expect(await gap(page.locator('[data-lp-first-input]'), page.locator('[data-lp-first-error]'))).toBeGreaterThanOrEqual(8);
      if (name === 'retrieval-sheet') expect(await gap(page.locator('.lp-retrieval-sheet-date-field .lp-label'), page.locator('[data-lp-date]'))).toBeGreaterThanOrEqual(8);
    }
    await compareAnswers(page, lang);
    if (textSpacing) await page.addStyleTag({ content: TEXT_SPACING });
    expect(await gap(page.locator('[data-lp-panel-first-card]'), page.locator('.lp-choices'))).toBeGreaterThanOrEqual(24);
  });
}

test('forced colours preserve proximity between choice groups', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Only Chromium emulates forced colours.');
  await page.emulateMedia({ forcedColors: 'active' });
  await compareAnswers(page, 'fr');
  expect(await gap(page.locator('[data-lp-panel-first-card]'), page.locator('.lp-choices'))).toBeCloseTo(24, 1);
});
