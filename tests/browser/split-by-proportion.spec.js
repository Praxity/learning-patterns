import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { frenchTypography } from '../../lib/html.js';
import { strings } from '../../patterns/split-by-proportion/strings.js';

const examples = Object.fromEntries(await Promise.all(['en', 'fr'].map(async lang => [lang,
  JSON.parse(await readFile(new URL(`../../patterns/split-by-proportion/examples/${lang}.json`, import.meta.url), 'utf8'))
])));
const sliders = page => page.getByRole('slider');
const values = page => sliders(page).evaluateAll(inputs => inputs.map(input => Number(input.value)));
async function open(page, lang = 'en') {
  await page.goto(`/split-by-proportion/${lang}.html`);
  await page.waitForFunction(() => window.lpReady);
}
async function observeStatus(page) {
  await page.evaluate(() => {
    window.announcements = [];
    const status = document.querySelector('[role=status]');
    new MutationObserver(() => {
      if (status.textContent) window.announcements.push(status.textContent);
    }).observe(status, { childList: true, characterData: true, subtree: true });
  });
}
async function exactByKeyboard(page) {
  await sliders(page).first().focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  await expect(sliders(page).nth(1)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  await expect(sliders(page).nth(2)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  expect(await values(page)).toEqual([35, 55, 70]);
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-check]')).toBeFocused();
  await page.keyboard.press('Enter');
}

for (const lang of ['en', 'fr']) {
  test(`complete keyboard interaction, focus, summary and retry (${lang})`, async ({ page }) => {
    await open(page, lang);
    await observeStatus(page);
    await page.evaluate(() => { window.originalSlider = document.querySelector('input'); });
    await expect(sliders(page)).toHaveCount(3);
    await expect(sliders(page).first()).toHaveAccessibleName(strings[lang].divider
      .replace('{left}', examples[lang].options[0].label).replace('{right}', examples[lang].options[1].label));
    await exactByKeyboard(page);
    await expect(page.locator('[data-lp-try-again]')).toBeFocused();
    await expect(page.locator('[data-lp-result]')).toBeVisible();
    await expect(page.locator('[data-lp-summary]')).toHaveText(strings[lang].exact);
    await expect(page.getByRole('status')).toHaveText(strings[lang].exact);
    await expect(page.locator('[data-lp-check]')).toBeHidden();
    for (let i = 0; i < 3; i++) await expect(sliders(page).nth(i)).toBeDisabled();
    expect(await page.locator('[data-lp-mine]').allTextContents()).toEqual([35, 20, 15, 30].map(n => frenchTypography(`${n}%`, lang)));
    expect(await page.evaluate(() => window.announcements)).toEqual([strings[lang].exact]);
    await page.keyboard.press('Enter');
    await expect(sliders(page).first()).toBeFocused();
    await expect(page.locator('[data-lp-try-again]')).toBeHidden();
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    await expect(page.locator('[data-lp-summary]')).toBeHidden();
    expect(await values(page)).toEqual([25, 50, 75]);
    expect(await page.evaluate(() => document.querySelector('input') === window.originalSlider)).toBe(true);
    expect(await page.evaluate(() => window.announcements)).toEqual([strings[lang].exact, strings[lang].cleared]);
    await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-error]')).toBeVisible();
  });

  test(`untouched validation and native slider announcements (${lang})`, async ({ page }) => {
    await open(page, lang);
    await page.locator('[data-lp-check]').click();
    await expect(page.getByRole('status')).toHaveText(strings[lang].untouched);
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    await observeStatus(page);
    await sliders(page).first().focus();
    await page.keyboard.press('End');
    expect(await values(page)).toEqual([100, 100, 100]);
    await expect(sliders(page).first()).toHaveAttribute('aria-valuetext', examples[lang].options.map((o, i) => `${o.label} ${frenchTypography(`${i === 0 ? 100 : 0}%`, lang)}`).join(', '));
    await expect(page.locator('[data-lp-error]')).toBeHidden();
    await expect(page.getByRole('status')).toBeEmpty();
    expect(await page.evaluate(() => window.announcements)).toEqual([]);
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    await page.keyboard.press('Home');
    expect(await values(page)).toEqual([0, 0, 0]);
    await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-summary]')).toContainText(lang === 'en' ? 'how-to questions' : frenchTypography("« Questions d'utilisation »", lang));
    await expect(page.getByRole('status')).toHaveText(await page.locator('[data-lp-summary]').textContent());
    expect(await page.evaluate(() => window.announcements.length)).toBe(1);
  });

  test(`pointer tapping, dragging, pushing and reset (${lang})`, async ({ page }) => {
    await open(page, lang);
    const bar = page.locator('[data-lp-bar]');
    await bar.scrollIntoViewIfNeeded();
    let box = await bar.boundingBox();
    await page.mouse.click(box.x + box.width * .85, box.y + box.height / 2);
    expect(await values(page)).toEqual([25, 50, 85]);
    await expect(sliders(page).last()).toBeFocused();
    await page.mouse.move(box.x + box.width * .25, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 5, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    expect(await values(page)).toEqual([100, 100, 100]);
    // At coincident dividers, a tap to their left moves the first one.
    await page.mouse.click(box.x + box.width * .9, box.y + box.height / 2);
    expect(await values(page)).toEqual([90, 100, 100]);
    await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-result]')).toBeVisible();
    await expect(page.locator('[data-lp-try-again]')).toBeFocused();
    await expect(page.locator('[data-lp-summary]')).toContainText(lang === 'en' ? 'sign-in problems' : frenchTypography('« Problèmes de connexion »', lang));
    await page.locator('[data-lp-try-again]').click();
    await expect(sliders(page).first()).toBeFocused();
    await page.keyboard.press('Home');
    await sliders(page).last().focus(); await page.keyboard.press('Home');
    expect(await values(page)).toEqual([0, 0, 0]);
    await bar.scrollIntoViewIfNeeded(); box = await bar.boundingBox();
    await page.mouse.move(box.x + 1, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .1, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    expect(await values(page)).toEqual([0, 0, 10]);
  });

  test(`no-JavaScript render includes the question, real split and source (${lang})`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    try {
      const page = await context.newPage();
      await page.goto(`/split-by-proportion/${lang}.html`);
      await expect(page.locator('legend')).toHaveText(frenchTypography(examples[lang].question, lang));
      await expect(page.locator('[data-lp-interaction]')).toBeHidden();
      await expect(page.locator('[data-lp-check]')).toBeHidden();
      await expect(page.locator('[data-lp-fallback]')).not.toHaveAttribute('open', '');
      for (const option of examples[lang].options) {
        await expect(page.locator('.lp-split-by-proportion-key li').filter({ hasText: option.label })).toBeVisible();
      }
      for (const node of await page.locator('[data-lp-share]').all()) await expect(node).toBeHidden();
      await page.locator('[data-lp-fallback] summary').focus(); await page.keyboard.press('Enter');
      for (const option of examples[lang].options) {
        const row = page.locator('[data-lp-fallback] tbody tr').filter({ hasText: option.label });
        await expect(row.locator('td')).toHaveText(frenchTypography(`${option.share}%`, lang));
      }
      await expect(page.locator('[data-lp-fallback]')).toContainText(examples[lang].source);
      await expect(page.getByRole('status')).toBeEmpty();
    } finally { await context.close(); }
  });

  test(`320px, text spacing, reduced motion and axe before and after check (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, lang);
    await page.addStyleTag({ content: '.lp, .lp * { line-height:1.5 !important; letter-spacing:.12em !important; word-spacing:.16em !important } .lp p { margin-bottom:2em !important }' });
    const scan = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).include('[data-lp-pattern]').analyze()).violations).toEqual([]);
    };
    await scan();
    await exactByKeyboard(page);
    await expect(page.locator('[data-lp-try-again]')).toBeFocused();
    await expect(page.locator('.lp-split-by-proportion-table')).toHaveCSS('table-layout', 'auto');
    for (const cell of await page.locator('[data-lp-result] td').all()) await expect(cell).toHaveCSS('white-space', 'nowrap');
    await scan();
  });
}

async function restore(page, saved, custom = examples.en) {
  await page.evaluate(async ({ saved, content }) => {
    const { render } = await import('/patterns/split-by-proportion/render.js');
    const { enhance } = await import('/patterns/split-by-proportion/enhance.js');
    const { strings } = await import('/patterns/split-by-proportion/strings.js');
    window.lpInstances[0].destroy();
    document.querySelector('main').innerHTML = render(content, strings.en, { id: 'restored', lang: 'en' });
    const root = document.querySelector('[data-lp-pattern]');
    const options = { content, strings: strings.en, state: { read: () => saved, write: value => { window.saved = value; } } };
    window.restored = enhance(root, options);
    window.sameInstance = enhance(root, options) === window.restored;
  }, { saved, content: custom });
}

test('host state restores silently, writes changes, ignores bad state and destroys without rebuilding', async ({ page }) => {
  await open(page);
  await restore(page, { dividers: [35, 55, 70], touched: true, shown: true });
  // Wait through the lock helper's deferred focus frames before checking silent restoration.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('body')).toBeFocused();
  expect(await page.evaluate(() => window.sameInstance)).toBe(true);
  await expect(page.locator('[data-lp-result]')).toBeVisible();
  await expect(page.getByRole('status')).toBeEmpty();
  expect(await values(page)).toEqual([35, 55, 70]);
  await page.locator('[data-lp-try-again]').click();
  await expect(sliders(page).first()).toBeFocused();
  expect(await page.evaluate(() => window.saved)).toEqual({ dividers: [25, 50, 75], touched: false, shown: false });
  await page.keyboard.press('End');
  expect(await page.evaluate(() => window.saved)).toEqual({ dividers: [100, 100, 100], touched: true, shown: false });
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-try-again]')).toBeFocused();
  expect(await page.evaluate(() => window.saved.shown)).toBe(true);
  await page.evaluate(() => { window.firstInput = document.querySelector('input'); window.restored.destroy(); window.restored.destroy(); });
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await expect(page.locator('[data-lp-interaction]')).toBeHidden();
  for (const node of await page.locator('[data-lp-share]').all()) await expect(node).toBeHidden();
  await expect(page.locator('.lp-split-by-proportion-key')).toBeVisible();
  expect(await page.evaluate(() => window.firstInput === document.querySelector('input'))).toBe(true);
  // Retire the destroyed demo instance; restore() calls destroy idempotently.
  await restore(page, { dividers: [60, 20, 75], touched: true, shown: true });
  expect(await values(page)).toEqual([25, 50, 75]);
  await expect(page.locator('[data-lp-result]')).toBeHidden();
});

test('six options with a 40-hour total support all five dividers at 320px', async ({ page }) => {
  await open(page);
  await page.setViewportSize({ width: 320, height: 900 });
  const content = { ...examples.en, total: 40, step: 1, unit: 'hours', unitOne: 'hour', close: 4,
    options: [10, 8, 7, 6, 5, 4].map((share, i) => ({ label: `Work ${i + 1}`, share })) };
  await restore(page, null, content);
  await expect(sliders(page)).toHaveCount(5);
  await sliders(page).first().focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-lp-share]').first()).toHaveText('1 hour');
  await expect(sliders(page).first()).toHaveAttribute('aria-valuetext', 'Work 1 1 hour, Work 2 12 hours');
  await sliders(page).last().focus(); await page.keyboard.press('Home');
  expect(await values(page)).toEqual([0, 0, 0, 0, 0]);
  const segment = page.locator('[data-lp-bar] .lp-split-by-proportion-seg:not([hidden])').first();
  await expect(segment).toHaveCSS('border-start-start-radius', '6px');
  await expect(segment).toHaveCSS('border-end-start-radius', '6px');
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-result]')).toBeVisible();
  expect(await page.locator('[data-lp-mine]').allTextContents()).toEqual(['0 hours', '0 hours', '0 hours', '0 hours', '0 hours', '40 hours']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('mismatched option markup fails with a named error before enhancement', async ({ page }) => {
  await open(page);
  for (const variation of ['fewer options', 'more options', 'input', 'segment', 'grip', 'share']) {
    const message = await page.evaluate(async ({ variation, example }) => {
      const { render } = await import('/patterns/split-by-proportion/render.js');
      const { enhance } = await import('/patterns/split-by-proportion/enhance.js');
      const { strings } = await import('/patterns/split-by-proportion/strings.js');
      const root = document.createElement('div');
      root.innerHTML = render(example, strings.en, { id: 'mismatch', lang: 'en' });
      const content = structuredClone(example);
      if (variation === 'fewer options') content.options = [{ label: 'A', share: 50 }, { label: 'B', share: 50 }];
      else if (variation === 'more options') content.options.push({ label: 'Extra', share: 0 });
      else root.querySelector({ input: 'input', segment: '[data-lp-bar] .lp-split-by-proportion-seg',
        grip: '.lp-split-by-proportion-grip', share: '[data-lp-share]' }[variation]).remove();
      try { enhance(root, { content, strings: strings.en }); }
      catch (error) { return error.message; }
      return null;
    }, { variation, example: examples.en });
    expect(message).toBe('Invalid split-by-proportion options markup');
  }
});

for (const forcedColors of ['none', 'active']) test(`divider focus ring and segment contrast (${forcedColors})`, async ({ page, browserName }) => {
  test.skip(forcedColors === 'active' && browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors });
  await open(page);
  await sliders(page).first().focus(); await page.keyboard.press('ArrowRight');
  const outline = await page.locator('.lp-split-by-proportion-grip').first().evaluate(node => {
    const css = getComputedStyle(node);
    return { width: css.outlineWidth, style: css.outlineStyle };
  });
  expect(outline).toEqual({ width: '3px', style: 'solid' });
  if (forcedColors === 'none') {
    const ratios = await page.locator('[data-lp-bar] .lp-split-by-proportion-seg').evaluateAll(nodes => {
      const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
      return nodes.map(node => { const css = getComputedStyle(node); return (luminance(css.backgroundColor) + .05) / (luminance(css.color) + .05); });
    });
    for (const [i, minimum] of [9.2, 10.9, 13.2, 8.4].entries()) expect(ratios[i]).toBeGreaterThanOrEqual(minimum);
  }
});
