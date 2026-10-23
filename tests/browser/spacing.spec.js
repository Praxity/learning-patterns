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

  test(`self-check ticks share a row and keep the step rule at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'self-check');
    await page.locator('textarea').fill('My answer');
    await page.locator('[data-lp-check]').click();
    const ticks = page.locator('[data-lp-ticks]');
    await expect(ticks).toBeVisible();
    await expect(ticks).toHaveCSS('border-top-width', '1px');
    const choices = ticks.locator('.lp-choice');
    expect(await gap(ticks.locator('legend'), choices.first())).toBeCloseTo(12, 1);
    if (width === 1280) {
      const a = await choices.nth(0).boundingBox(), b = await choices.nth(1).boundingBox();
      expect(b.x).toBeGreaterThan(a.x);
      expect(b.y).toBeCloseTo(a.y, 1);
    }
  });

  test(`run-in fallback legends own their 12px gap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['live-feedback', 'explain-back']) {
      await open(page, name);
      await page.evaluate(() => window.lpInstances.forEach(instance => instance.destroy()));
      const fallback = page.locator('[data-lp-fallback]');
      expect(await gap(fallback.locator('legend'), fallback.locator('label').first()), name).toBeCloseTo(12, 1);
    }
  });

  test(`write-distractors legend and field groups keep equal 16px gaps at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'write-distractors');
    await page.locator('[data-lp-answer]').fill('Breaks help.');
    await page.locator('[data-lp-check]').click();
    await page.locator('[data-lp-had-it]').click();
    const option = page.locator('[data-lp-option]').first();
    expect(await gap(option.locator('legend'), option.locator('textarea'))).toBeCloseTo(16, 1);
    expect(await gap(option.locator(':scope > div').nth(0), option.locator(':scope > div').nth(1))).toBeCloseTo(16, 1);
    const icon = page.locator('[data-lp-right] > .lp-icon');
    expect(await icon.evaluate(el => parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(1.4, 2);
  });

  test(`first-answer headings stay 12px above field labels through completion and reset at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'first-answer');
    for (let attempt = 0; attempt < 2; attempt++) {
      const first = page.locator('[data-lp-first-step]');
      expect(await gap(first.locator('h3'), first.locator('.lp-label'))).toBeCloseTo(12, 1);
      expect(await gap(first.locator('.lp-label'), first.locator('textarea'))).toBeCloseTo(8, 1);
      await page.locator('[data-lp-first-input]').fill('Let me finish.');
      await page.locator('[data-lp-save-first]').click();
      await page.locator('[data-lp-skip]').click();
      const end = page.locator('[data-lp-end-step]');
      await expect(end.locator('[data-lp-missing]')).toBeHidden();
      expect(await gap(end.locator('h3'), end.locator('label'))).toBeCloseTo(12, 1);
      await page.locator('[data-lp-now-input]').fill('When you interrupt I lose my place.');
      await page.locator('[data-lp-compare]').click();
      await expect(end.locator('[data-lp-result]')).toBeVisible();
      expect(await gap(end.locator('h3'), end.locator('label'))).toBeCloseTo(12, 1);
      expect(await gap(end.locator('label'), end.locator('textarea'))).toBeCloseTo(8, 1);
      await page.locator('[data-lp-restart]').click();
    }
  });

  test(`test-out outline pairs stay 12px apart through completion and reset at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'test-out');
    const heading = page.locator('[data-lp-outline-heading]');
    const list = page.locator('.lp-test-out-outline-list');
    const result = page.locator('[data-lp-result]');
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(result).toBeHidden();
      expect(await gap(heading, list)).toBeCloseTo(12, 1);
      await page.locator('[data-lp-start]').click();
      for (const [index, value] of ['outcomes', 'invite', 'actions'].entries()) {
        await page.locator('fieldset').nth(index).locator(`input[value="${value}"]`).check();
        if (index < 2) await page.locator('[data-lp-next]:visible').click();
      }
      await page.locator('[data-lp-check]').click();
      await expect(result).toBeVisible();
      expect(await gap(heading, result)).toBeCloseTo(12, 1);
      expect(await gap(result, list)).toBeCloseTo(12, 1);
      await page.locator('[data-lp-restart]').click();
    }
    expect(await gap(heading, list)).toBeCloseTo(12, 1);
  });

  test(`hidden notices do not separate fields from errors at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['misconception', 'explain-back']) {
      await open(page, name);
      // Exercise the rendered field/error pair with its optional notice absent, then present.
      await page.evaluate(() => {
        window.lpInstances.forEach(instance => instance.destroy());
        document.querySelector('[data-lp-error]').hidden = false;
      });
      await expect(page.locator('[data-lp-notice]')).toBeHidden();
      await expect(page.locator('[data-lp-error]')).toBeVisible();
      expect(await gap(page.locator('textarea'), page.locator('[data-lp-error]')), name).toBeCloseTo(8, 1);
      await page.locator('[data-lp-notice]').evaluate(el => { el.textContent = 'Data notice'; el.hidden = false; });
      expect(await gap(page.locator('[data-lp-notice]'), page.locator('[data-lp-error]')), name).toBeCloseTo(16, 1);
    }
  });

  for (const role of ['stem', 'label']) test(`${role} to hint is 4px and hint to field is 8px at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, role === 'stem' ? 'journal' : 'first-answer');
    const label = page.locator(role === 'stem' ? '.lp-stem' : '[data-lp-first-editor] .lp-label');
    // Hosts can supply a hint in the rendered field group without pattern-specific CSS.
    await label.evaluate(el => el.insertAdjacentHTML('afterend', '<p class="lp-small" data-spacing-hint>Give one example.</p>'));
    const hint = page.locator('[data-spacing-hint]');
    const field = page.locator(role === 'stem' ? 'textarea' : '[data-lp-first-input]');
    expect(await gap(label, hint)).toBeCloseTo(4, 1);
    expect(await gap(hint, field)).toBeCloseTo(8, 1);
  });
}

test('pattern relationships scale with a 20px default font', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const enlarge = () => page.addStyleTag({ content: 'html { font-size: 20px; }' });

  await open(page, 'write-distractors');
  await enlarge();
  await page.locator('[data-lp-answer]').fill('Breaks help.');
  await page.locator('[data-lp-check]').click();
  await page.locator('[data-lp-had-it]').click();
  const option = page.locator('[data-lp-option]').first();
  expect(await gap(option.locator('legend'), option.locator('textarea'))).toBeCloseTo(20, 1);
  expect(await gap(option.locator(':scope > div').nth(0), option.locator(':scope > div').nth(1))).toBeCloseTo(20, 1);
  expect(await gap(option.locator('.lp-label').first(), option.locator('select'))).toBeCloseTo(10, 1);
  await expect(page.locator('[data-lp-retrieval]')).toHaveCSS('margin-top', '30px');

  await compareAnswers(page);
  await enlarge();
  const card = page.locator('[data-lp-panel-first-card]');
  expect(await gap(card.locator('h4'), card.locator('.lp-first-answer-date'))).toBeCloseTo(15, 1);
  expect(await gap(card, page.locator('.lp-choices'))).toBeCloseTo(30, 1);

  await open(page, 'test-out');
  await enlarge();
  await page.locator('[data-lp-start]').click();
  await expect(page.locator('[data-lp-questions]')).toHaveCSS('margin-top', '30px');

  await open(page, 'conversation');
  await enlarge();
  const flow = page.locator('[data-lp-flow]');
  await expect(flow.locator('[data-lp-choices]')).toHaveCSS('margin-top', '15px');
  await expect(page.locator('[data-lp-restart]').locator('..')).toHaveCSS('margin-top', '10px');

  await open(page, 'course-lookup');
  await enlarge();
  const bank = page.locator('[data-lp-kind="faq"] .lp-course-lookup-bank li').first();
  expect(await gap(bank.locator('.lp-small'), bank.locator('p').last())).toBeCloseTo(10, 1);
  await page.evaluate(() => window.lpInstances.forEach(instance => instance.destroy()));
  const outline = page.locator('.lp-course-lookup-outline');
  expect(await gap(outline.locator('li').nth(0), outline.locator('li').nth(1))).toBeCloseTo(30, 1);
  const heading = page.locator('[data-lp-kind="sections"] [data-lp-fallback] > h3');
  expect(await gap(heading, outline)).toBeCloseTo(15, 1);
});

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
