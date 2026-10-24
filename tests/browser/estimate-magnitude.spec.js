import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { strings } from '../../patterns/estimate-magnitude/strings.js';
import { format, numberText, render } from '../../patterns/estimate-magnitude/render.js';
import { frenchTypography } from '../../lib/html.js';

const examples = Object.fromEntries(await Promise.all(['en', 'fr'].map(async lang => [lang, JSON.parse(await readFile(new URL(`../../patterns/estimate-magnitude/examples/${lang}.json`, import.meta.url), 'utf8'))])));

async function open(page, lang = 'en') {
  await page.goto(`/estimate-magnitude/${lang}.html`);
  await expect(page.locator('[data-lp-check]')).toBeVisible();
}

async function openContent(page, content, lang = 'en') {
  await page.route('**/estimate-magnitude/fixture.html', route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Estimate magnitude</title><link rel="stylesheet" href="/lib/base.css"><link rel="stylesheet" href="/patterns/estimate-magnitude/pattern.css"></head><body>
      ${render(content, strings[lang], { id: 'fixture', lang })}
      <script type="module">
        import { enhance } from '/patterns/estimate-magnitude/enhance.js';
        import { strings } from '/patterns/estimate-magnitude/strings.js';
        enhance(document.querySelector('[data-lp-pattern]'), { content: ${JSON.stringify(content)}, strings: strings.${lang} });
      </script></body></html>`
  }));
  await page.goto('/estimate-magnitude/fixture.html');
  await expect(page.locator('[data-lp-check]')).toBeVisible();
}

async function setByKeyboard(page) {
  const bands = page.getByRole('slider');
  await bands.nth(0).focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Tab');
  await expect(bands.nth(1)).toBeFocused();
  await page.keyboard.press('Home');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  await expect(bands.nth(2)).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-check]')).toBeFocused();
}

for (const lang of ['en', 'fr']) {
  const instructions = lang === 'en' ? {
    10: 'Slide each range to hold your estimate. Each range is limited to ten times its low end.',
    100: 'Slide each range to hold your estimate. Each range is limited to 100 times its low end.',
    1000: 'Slide each range to hold your estimate. Each range is limited to 1,000 times its low end.'
  } : {
    10: 'Faites glisser chaque plage pour y inclure votre estimation. Chaque plage est limitée à dix fois sa borne inférieure.',
    100: 'Faites glisser chaque plage pour y inclure votre estimation. Chaque plage est limitée à 100 fois sa borne inférieure.',
    1000: /^Faites glisser chaque plage pour y inclure votre estimation\. Chaque plage est limitée à 1[\u00a0\u202f]000 fois sa borne inférieure\.$/
  };

  test(`keyboard, validation, checked ranges, one announcement and Try again (${lang})`, async ({ page }) => {
    await open(page, lang);
    await expect(page.locator('[data-lp-instructions]')).toHaveText(instructions[10]);
    const bands = page.getByRole('slider');
    const status = page.getByRole('status');
    await expect(status).toHaveText('');
    await expect(page.locator('[data-lp-fallback]')).toBeHidden();
    for (const [index, question] of examples[lang].questions.entries()) {
      await expect(bands.nth(index)).toHaveAccessibleName(format(strings[lang].band, { number: index + 1 }));
      await expect(page.getByRole('group', { name: frenchTypography(question.question, lang) })).toHaveCount(1);
      await expect(bands.nth(index)).toHaveAttribute('aria-valuetext', new RegExp(question.unit));
    }
    await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-check]')).toBeFocused();
    await expect(page.locator('[data-lp-error]:visible')).toHaveCount(3);
    await expect(bands.first()).toHaveAttribute('aria-invalid', 'true');
    await expect(status).toHaveText(frenchTypography(format(strings[lang].missingMany, { questions: lang === 'fr' ? '1, 2 et 3' : '1, 2 and 3' }), lang));
    await setByKeyboard(page);
    await expect(page.locator('[data-lp-error]:visible')).toHaveCount(0);
    await expect(bands.first()).not.toHaveAttribute('aria-invalid');
    await page.evaluate(() => {
      window.rangeAnnouncements = 0;
      window.rangeObserver = new MutationObserver(records => { window.rangeAnnouncements += records.length; });
      window.rangeObserver.observe(document.querySelector('[role="status"]'), { childList: true });
    });
    await page.keyboard.press('Enter');
    const summary = frenchTypography(format(strings[lang].summary, { count: 3, total: 3 }), lang);
    await expect(page.locator('[data-lp-result]')).toHaveText(summary);
    await expect(status).toHaveText(summary);
    await expect.poll(() => page.evaluate(() => window.rangeAnnouncements)).toBe(1);
    await expect(page.locator('[data-lp-try-again]')).toBeFocused();
    await expect(page.locator('[data-lp-check]')).toBeHidden();
    await expect(page.locator('[data-lp-feedback]:visible')).toHaveCount(3);
    for (let index = 0; index < 3; index++) {
      await expect(bands.nth(index)).toBeDisabled();
      await expect(bands.nth(index)).toHaveAttribute('aria-valuetext', new RegExp(lang === 'fr' ? ' à .*Dans votre plage' : ' to .*Caught'));
      await expect(page.locator('[data-lp-feedback]').nth(index)).toContainText(examples[lang].questions[index].source);
    }
    const original = await bands.first().getAttribute('aria-valuenow');
    await page.locator('[data-lp-line]').first().click({ position: { x: 1, y: 22 }, force: true });
    await expect(bands.first()).toHaveAttribute('aria-valuenow', original);
    const firstNode = await bands.first().elementHandle();
    await page.locator('[data-lp-try-again]').focus();
    await page.keyboard.press('Enter');
    await expect(bands.first()).toBeFocused();
    await expect(page.locator('[data-lp-try-again]')).toBeHidden();
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    await expect(page.locator('[data-lp-feedback]:visible')).toHaveCount(0);
    await expect(page.locator('[data-lp-answer]:visible')).toHaveCount(0);
    await expect(status).toHaveText(frenchTypography(strings[lang].cleared, lang));
    await expect.poll(() => page.evaluate(() => window.rangeAnnouncements)).toBe(2);
    expect(await firstNode.evaluate(node => node === document.querySelector('[data-lp-band]'))).toBe(true);
    await expect(bands.first()).toBeEnabled();
    await expect(bands.first()).toHaveAttribute('aria-valuenow', '4');
    await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-error]:visible')).toHaveCount(3);
  });

  test(`no JavaScript exposes answers with sources and hides sliders (${lang})`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto(`${baseURL}/estimate-magnitude/${lang}.html`);
      await expect(page.getByRole('slider')).toHaveCount(0);
      await expect(page.locator('[data-lp-check]')).toBeHidden();
      await expect(page.locator('[data-lp-instructions]')).toBeHidden();
      await expect(page.locator('[data-lp-fallback]')).not.toHaveAttribute('open');
      for (const [index, question] of examples[lang].questions.entries()) {
        await expect(page.locator('[data-lp-question] legend').nth(index)).toBeVisible();
        await expect(page.locator('[data-lp-question] legend').nth(index)).toHaveText(frenchTypography(question.question, lang));
      }
      await page.locator('[data-lp-fallback] summary').click();
      for (const question of examples[lang].questions) {
        await expect(page.locator('[data-lp-fallback]')).toContainText(frenchTypography(question.question, lang));
        await expect(page.locator('[data-lp-fallback]')).toContainText(question.source);
      }
      await expect(page.locator('[data-lp-fallback] li')).toHaveCount(3);
      await expect(page.getByRole('status')).toHaveText('');
    } finally { await context.close(); }
  });

  test(`320 px reflow, forced colours, reduced motion and accessibility (${lang})`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce', ...(browserName === 'chromium' ? { forcedColors: 'active' } : {}) });
    await open(page, lang);
    const fits = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('[data-lp-pattern]').evaluate(root => root.scrollWidth <= root.clientWidth)).toBe(true);
    };
    await fits();
    await expect(page.getByRole('slider').first()).toBeVisible();
    await setByKeyboard(page);
    const before = await new AxeBuilder({ page }).include('[data-lp-pattern]').analyze();
    expect(before.violations).toEqual([]);
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-lp-try-again]')).toBeFocused();
    await fits();
    const after = await new AxeBuilder({ page }).include('[data-lp-pattern]').analyze();
    expect(after.violations).toEqual([]);
    await page.locator('[data-lp-try-again]').click();
    await expect(page.getByRole('slider').first()).toBeFocused();
    await fits();
    await page.addStyleTag({ content: '.lp, .lp * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } .lp p { margin-bottom: 2em !important; }' });
    await setByKeyboard(page);
    await fits();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-lp-try-again]')).toBeFocused();
    await fits();
    for (const answer of await page.locator('[data-lp-answer]').all()) {
      expect(await answer.evaluate(element => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return range.getClientRects().length;
      })).toBe(1);
    }
  });

  for (const ratio of [10, 100, 1000]) {
    test(`configured ratio ${ratio} changes instructions, bands and scoring (${lang})`, async ({ page }) => {
      const content = { ...structuredClone(examples[lang]), ratio };
      content.questions.forEach(question => { question.answer = content.ratio; });
      await openContent(page, content, lang);
      await expect(page.locator('[data-lp-instructions]')).toHaveText(instructions[ratio]);
      for (const [index, band] of (await page.getByRole('slider').all()).entries()) {
        await band.press('Home');
        const label = format(strings[lang].range, { low: '1', high: numberText(content.ratio, lang) });
        await expect(band).toHaveAttribute('aria-valuetext', frenchTypography(`${label} ${content.questions[index].unit}`, lang));
      }
      await page.locator('[data-lp-check]').click();
      await expect(page.locator('[data-lp-result]')).toHaveText(frenchTypography(format(strings[lang].summary, { count: 3, total: 3 }), lang));
    });
  }
}

for (const lang of ['en', 'fr']) for (const ratio of [10, 100, 1000]) {
  test(`labels fit at every band position at 320 px with text spacing, ratio ${ratio} (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    const content = { ...structuredClone(examples[lang]), ratio };
    content.questions.forEach(question => { question.answer = 1e12; });
    await openContent(page, content, lang);
    await page.addStyleTag({ content: '.lp, .lp * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }' });
    for (const band of await page.getByRole('slider').all()) await band.press('Home');
    const fits = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('[data-lp-pattern]').evaluate(root => {
        const card = root.getBoundingClientRect();
        return [...root.querySelectorAll('[data-lp-value], [data-lp-answer]:not([hidden])')].every(label => {
          const bounds = label.getBoundingClientRect();
          return bounds.left >= card.left && bounds.right <= card.right;
        });
      })).toBe(true);
    };
    const first = page.getByRole('slider').first();
    const last = Number(await first.getAttribute('aria-valuemax'));
    for (let position = 0; position <= last; position++) {
      if (position) await first.press('ArrowRight');
      await expect(first).toHaveAttribute('aria-valuenow', String(position));
      await fits();
    }
    await first.press('End');
    await fits();
    await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-try-again]')).toBeFocused();
    await fits();
    for (const answer of await page.locator('[data-lp-answer]').all()) {
      await expect(answer).toHaveText(lang === 'en' ? '1,000,000,000,000' : /^1[\u00a0\u202f]000[\u00a0\u202f]000[\u00a0\u202f]000[\u00a0\u202f]000$/);
      expect(await answer.evaluate(element => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return range.getClientRects().length;
      })).toBe(1);
    }
  });
}

test('track taps and dragging select discrete bands without a keyboard', async ({ page }) => {
  await open(page);
  const band = page.getByRole('slider').first();
  const line = page.locator('[data-lp-line]').first();
  const track = await line.boundingBox();
  await line.click({ position: { x: 1, y: 22 } });
  await expect(band).toHaveAttribute('aria-valuenow', '0');
  await expect(band).toHaveAttribute('aria-valuetext', '1 to 10 staff');
  await expect(band).toBeFocused();
  const box = await band.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width + box.width, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(band).toHaveAttribute('aria-valuenow', await band.getAttribute('aria-valuemax'));
  await expect(band).toHaveAttribute('aria-valuetext', '50,000 to 500,000 staff');
  await page.locator('[data-lp-line]').nth(1).click({ position: { x: 1, y: 22 } });
  await page.locator('[data-lp-line]').nth(2).click({ position: { x: 1, y: 22 } });
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-result]')).toHaveText('You caught 0 of 3 answers in your ranges.');
  await expect(page.locator('[data-lp-feedback]').first()).toContainText('below your range');
  await expect(page.locator('[data-lp-feedback]').nth(1)).toContainText('above your range');
});

test('checked host state restores silently, destroy restores fallback', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { ranges: [0, 4, 8], touched: [true, true, true], shown: true }; });
  await page.goto('/estimate-magnitude/en.html');
  await expect(page.locator('[data-lp-result]')).toHaveText('You caught 3 of 3 answers in your ranges.');
  await expect(page.getByRole('status')).toHaveText('');
  // Wait past lock's two-frame focus work before checking the restored page.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
  await expect(page.locator('body')).toBeFocused();
  await page.evaluate(async () => {
    const { enhance } = await import('/patterns/estimate-magnitude/enhance.js');
    const { strings } = await import('/patterns/estimate-magnitude/strings.js');
    const root = document.querySelector('[data-lp-pattern]');
    // Repeated calls preserve the existing instance without reading another host's state.
    const existing = enhance(root, { content: {}, strings: strings.en });
    if (existing !== window.lpInstances[0]) throw new Error('Enhancement was not idempotent');
    existing.destroy(); existing.destroy();
  });
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await expect(page.getByRole('slider')).toHaveCount(0);
});

test('invalid host state is ignored and setting a range writes partial state', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { ranges: [999, 0, 0], touched: [true, true, true], shown: true }; });
  await open(page);
  await expect(page.locator('[data-lp-check]')).toBeVisible();
  await expect(page.getByRole('slider').first()).toHaveAttribute('aria-valuenow', '4');
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  await page.getByRole('slider').first().press('Home');
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ ranges: [0, 4, 4], touched: [true, false, false], shown: false });
});
