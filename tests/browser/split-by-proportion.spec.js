import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { frenchTypography } from '../../lib/html.js';
import { strings } from '../../patterns/split-by-proportion/strings.js';
import { quantity } from '../../patterns/split-by-proportion/logic.js';

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

async function textBox(locator) {
  return locator.evaluate(node => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const { x, y, width, height } = range.getBoundingClientRect();
    return { x, y, width, height };
  });
}

async function expectResultBar(page, mine, real, lang = 'en', content = examples[lang]) {
  const result = page.locator('[data-lp-result]');
  const bar = result.locator('.lp-split-by-proportion-bar');
  const halves = bar.locator('.lp-split-by-proportion-half');
  const letters = result.locator('.lp-split-by-proportion-letters');
  const captions = result.locator('.lp-split-by-proportion-chart > p.lp-small');
  await expect(bar).toHaveCount(1);
  await expect(halves).toHaveCount(2);
  await expect(letters).toHaveCount(2);
  await expect(captions).toHaveText([strings[lang].mine, strings[lang].real].map(value => frenchTypography(value, lang)));
  for (const caption of await captions.all()) await expect(caption).toHaveAttribute('aria-hidden', 'true');
  await expect(bar).toHaveAttribute('aria-hidden', 'true');
  await expect(bar).toHaveCSS('cursor', 'default');
  await expect(bar).toHaveCSS('pointer-events', 'none');
  await expect(bar).toHaveCSS('overflow', 'hidden');
  await expect(bar.locator('span span, .lp-split-by-proportion-grip')).toHaveCount(0);
  const inputStyle = await page.locator('[data-lp-bar]').evaluate(node => {
    const css = getComputedStyle(node);
    return { height: css.height, border: css.border, radius: css.borderRadius };
  });
  await expect(bar).toHaveCSS('height', inputStyle.height);
  await expect(bar).toHaveCSS('border', inputStyle.border);
  await expect(bar).toHaveCSS('border-radius', inputStyle.radius);
  const barBox = await bar.boundingBox();
  const topBox = await halves.first().boundingBox();
  const bottomBox = await halves.last().boundingBox();
  expect(Math.abs(topBox.height - bottomBox.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(topBox.y + topBox.height - barBox.y - barBox.height / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(bottomBox.y - barBox.y - barBox.height / 2)).toBeLessThanOrEqual(1);
  await expect(halves.first()).toHaveCSS('border-bottom', `1px solid ${await bar.evaluate(node => getComputedStyle(node).borderBottomColor)}`);
  await expect(halves.last()).toHaveCSS('border-top', `1px solid ${await bar.evaluate(node => getComputedStyle(node).borderTopColor)}`);
  const topCaptionBox = await captions.first().boundingBox();
  const bottomCaptionBox = await captions.last().boundingBox();
  expect(topCaptionBox.y + topCaptionBox.height).toBeLessThanOrEqual((await letters.first().boundingBox()).y);
  const bottomLabelsBox = await letters.last().boundingBox();
  expect(bottomLabelsBox.y + bottomLabelsBox.height).toBeLessThanOrEqual(bottomCaptionBox.y);
  await expect(result.locator('.lp-split-by-proportion-cols, .lp-split-by-proportion-col, .lp-split-by-proportion-vbar')).toHaveCount(0);
  for (const [row, shares] of [mine, real].entries()) {
    const half = halves.nth(row);
    const letterRow = letters.nth(row);
    await expect(letterRow).toHaveAttribute('aria-hidden', 'true');
    await expect(half.locator('.lp-split-by-proportion-seg')).toHaveCount(shares.length);
    const labels = letterRow.locator(':scope > span');
    await expect(labels).toHaveCount(shares.length);
    const width = (await half.boundingBox()).width;
    for (const [i, share] of shares.entries()) {
      const segment = half.locator('.lp-split-by-proportion-seg').nth(i);
      const label = labels.nth(i);
      const letter = label.locator('.lp-split-by-proportion-letter');
      const percentage = label.locator('[data-lp-segment-value]');
      await expect(letter).toHaveText('ABCDEF'[i]);
      await expect(percentage).toHaveText(frenchTypography(quantity(share, content, lang), lang));
      await expect(label.locator('.lp-split-by-proportion-label > span').first()).toHaveClass(row === 0
        ? 'lp-split-by-proportion-letter' : 'lp-split-by-proportion-pct');
      if (share === 0) {
        await expect(segment).toBeHidden();
        await expect(label).toBeHidden();
        continue;
      }
      await expect(segment).toBeVisible();
      await expect(letter).toBeVisible();
      await expect(percentage).toBeVisible();
      const segmentBox = await segment.boundingBox();
      const slotBox = await label.boundingBox();
      const labelBox = await label.locator('.lp-split-by-proportion-label').boundingBox();
      const letterBox = await textBox(letter);
      const percentageBox = await textBox(percentage);
      expect(Math.abs(segmentBox.width - width * share / content.total)).toBeLessThanOrEqual(1);
      const first = shares.findIndex(value => value > 0);
      const last = shares.findLastIndex(value => value > 0);
      if ((i === first || i === last) && labelBox.width > slotBox.width + 1) {
        expect(labelBox.x).toBeGreaterThanOrEqual(barBox.x + 1);
        expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(barBox.x + barBox.width - 1);
        if (i === first) expect(Math.abs(labelBox.x - segmentBox.x)).toBeLessThanOrEqual(1);
        else expect(Math.abs(labelBox.x + labelBox.width - segmentBox.x - segmentBox.width)).toBeLessThanOrEqual(1);
      } else {
        for (const box of [letterBox, percentageBox]) {
          expect(Math.abs(box.x + box.width / 2 - segmentBox.x - segmentBox.width / 2)).toBeLessThanOrEqual(2);
        }
      }
      if (row === 0) {
        expect(letterBox.y + letterBox.height).toBeLessThanOrEqual(percentageBox.y);
        expect(percentageBox.y + percentageBox.height).toBeLessThanOrEqual(barBox.y);
      } else {
        expect(percentageBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height);
        expect(percentageBox.y + percentageBox.height).toBeLessThanOrEqual(letterBox.y);
      }
    }
  }
  const table = page.getByRole('table', { name: frenchTypography(strings[lang].caption, lang), exact: true });
  await expect(table).toHaveCount(1);
  await expect(table.locator('.lp-split-by-proportion-swatch')).toHaveCount(0);
  const wrapper = table.locator('..');
  await expect(wrapper).toHaveClass('lp-visually-hidden');
  await expect(wrapper).toHaveCSS('overflow', 'hidden');
  expect(await wrapper.evaluate(node => {
    const { width, height } = node.getBoundingClientRect();
    return { width, height };
  })).toEqual({ width: 1, height: 1 });
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
    await expectResultBar(page, [35, 20, 15, 30], [35, 20, 15, 30], lang);
    expect(await page.evaluate(() => window.announcements)).toEqual([strings[lang].exact]);
    await page.keyboard.press('Enter');
    await expect(sliders(page).first()).toBeFocused();
    await expect(page.locator('[data-lp-try-again]')).toBeHidden();
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    expect(await page.locator('[data-lp-result] [data-lp-segment-value]').allTextContents()).toEqual(Array(8).fill(''));
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
    await expectResultBar(page, [0, 0, 0, 100], [35, 20, 15, 30], lang);
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
    await expectResultBar(page, [35, 20, 15, 30], [35, 20, 15, 30], lang);
    await scan();
  });
}

for (const lang of ['en', 'fr']) for (const width of [1280, 320]) {
  test(`result percentages stay visible and labels do not overlap at ${width}px (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, lang);
    await page.evaluate(() => document.fonts.ready);
    await exactByKeyboard(page);
    await expectResultBar(page, [35, 20, 15, 30], [35, 20, 15, 30], lang);
    for (const row of await page.locator('.lp-split-by-proportion-letters').all()) {
      for (const label of await row.locator(':scope > span').all()) {
        const slotBox = await label.boundingBox();
        const labelBox = await label.locator('.lp-split-by-proportion-label').boundingBox();
        expect(labelBox.width).toBeLessThanOrEqual(slotBox.width + 1);
      }
      const boxes = await Promise.all((await row.locator('[data-lp-segment-value]').all()).map(textBox));
      for (let i = 1; i < boxes.length; i++) {
        expect(boxes[i - 1].x + boxes[i - 1].width).toBeLessThanOrEqual(boxes[i].x);
      }
    }
  });
}

test('text alignment assertion detects missing label centring', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 'fr');
  await exactByKeyboard(page);
  await expectResultBar(page, [35, 20, 15, 30], [35, 20, 15, 30], 'fr');
  // The initial text-align value reproduces removing the label's centring declaration.
  const mutation = await page.addStyleTag({ content: '.lp-split-by-proportion-label { text-align: initial !important; }' });
  const segmentBox = await page.locator('[data-lp-result] .lp-split-by-proportion-seg').first().boundingBox();
  const letterBox = await textBox(page.locator('.lp-split-by-proportion-letters .lp-split-by-proportion-letter').first());
  expect(Math.abs(letterBox.x + letterBox.width / 2 - segmentBox.x - segmentBox.width / 2)).toBeGreaterThan(2);
  await mutation.evaluate(node => node.remove());
  await expectResultBar(page, [35, 20, 15, 30], [35, 20, 15, 30], 'fr');
});

async function restore(page, saved, custom = examples.en, lang = 'en') {
  await page.evaluate(async ({ saved, content, lang }) => {
    const { render } = await import('/patterns/split-by-proportion/render.js');
    const { enhance } = await import('/patterns/split-by-proportion/enhance.js');
    const { strings } = await import('/patterns/split-by-proportion/strings.js');
    window.lpInstances[0].destroy();
    document.querySelector('main').innerHTML = render(content, strings[lang], { id: 'restored', lang });
    const root = document.querySelector('[data-lp-pattern]');
    const options = { content, strings: strings[lang], state: { read: () => saved, write: value => { window.saved = value; } } };
    window.restored = enhance(root, options);
    window.sameInstance = enhance(root, options) === window.restored;
  }, { saved, content: custom, lang });
}

test('host state restores silently, writes changes, ignores bad state and destroys without rebuilding', async ({ page }) => {
  await open(page);
  await restore(page, { dividers: [35, 55, 70], touched: true, shown: true });
  // Wait through the lock helper's deferred focus frames before checking silent restoration.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('body')).toBeFocused();
  expect(await page.evaluate(() => window.sameInstance)).toBe(true);
  await expect(page.locator('[data-lp-result]')).toBeVisible();
  await expectResultBar(page, [35, 20, 15, 30], [35, 20, 15, 30]);
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

test('joined result halves retain zero and off-step real shares', async ({ page }) => {
  await open(page);
  const content = { ...examples.en,
    options: [0, 1, 34, 65].map((share, i) => ({ label: `Option ${i + 1}`, share })) };
  await restore(page, null, content);
  await sliders(page).first().focus();
  await page.keyboard.press('End');
  await page.locator('[data-lp-check]').click();
  await expectResultBar(page, [100, 0, 0, 0], [0, 1, 34, 65]);
  const table = page.getByRole('table', { name: strings.en.caption, exact: true });
  expect(await table.locator('tbody td').allTextContents()).toEqual(['100%', '0%', '0%', '1%', '0%', '34%', '0%', '65%']);
});

for (const lang of ['en', 'fr']) test(`six options with a 40-hour total support all five dividers at 320px (${lang})`, async ({ page }) => {
  await open(page, lang);
  await page.setViewportSize({ width: 320, height: 900 });
  const content = { ...examples[lang], total: 40, step: 1, unit: lang === 'en' ? 'hours' : 'heures', unitOne: lang === 'en' ? 'hour' : 'heure', close: 4,
    options: [10, 8, 7, 6, 5, 4].map((share, i) => ({ label: `${lang === 'en' ? 'Work' : 'Travail'} ${i + 1}`, share })) };
  await restore(page, null, content, lang);
  await expect(sliders(page)).toHaveCount(5);
  await sliders(page).first().focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-lp-share]').first()).toHaveText(`1\u00a0${content.unitOne}`);
  await expect(sliders(page).first()).toHaveAttribute('aria-valuetext', `${content.options[0].label} 1\u00a0${content.unitOne}, ${content.options[1].label} 12\u00a0${content.unit}`);
  await sliders(page).last().focus(); await page.keyboard.press('Home');
  expect(await values(page)).toEqual([0, 0, 0, 0, 0]);
  const segment = page.locator('[data-lp-bar] .lp-split-by-proportion-seg:not([hidden])').first();
  await expect(segment).toHaveCSS('border-start-start-radius', '6px');
  await expect(segment).toHaveCSS('border-end-start-radius', '6px');
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-result]')).toBeVisible();
  expect(await page.locator('[data-lp-mine]').allTextContents()).toEqual([...Array(5).fill(lang === 'en' ? '0\u00a0hours' : '0\u00a0heure'), `40\u00a0${content.unit}`]);
  await expectResultBar(page, [0, 0, 0, 0, 0, 40], [10, 8, 7, 6, 5, 4], lang, content);
  const lastValue = page.locator('.lp-split-by-proportion-letters').last().locator('[data-lp-segment-value]').last();
  await expect(lastValue).toHaveText(`4 ${content.unit}`);
  expect(await lastValue.evaluate(node => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return range.getClientRects().length;
  })).toBeGreaterThan(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const lang of ['en', 'fr']) test(`multiword units wrap in result labels and the fallback table at 320px (${lang})`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await open(page, lang);
  const content = { ...examples[lang], total: 40, step: 1, unit: lang === 'en' ? 'hours of focused work weekly per person' : 'heures de travail concentré par personne', close: 4,
    options: [{ label: lang === 'en' ? 'Reading' : 'Lecture', share: 20 }, { label: lang === 'en' ? 'Writing' : 'Écriture', share: 20 }] };
  await restore(page, null, content, lang);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await sliders(page).first().focus(); await page.keyboard.press('ArrowRight');
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-result]')).toBeVisible();
  await expectResultBar(page, [21, 19], [20, 20], lang, content);
  for (const value of await page.locator('.lp-split-by-proportion-letters [data-lp-segment-value]').all()) {
    expect(await value.evaluate(node => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getClientRects().length;
    })).toBeGreaterThan(1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.restored.destroy());
  await page.locator('[data-lp-fallback] summary').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('oversized end labels stay inside the bar when leading and trailing shares are zero', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await open(page);
  for (const real of [[0, 1, 39, 0], [0, 39, 1, 0]]) {
    const content = { ...examples.en, total: 40, step: 1, unit: 'hours', close: 4,
      options: real.map((share, i) => ({ label: `Work ${i + 1}`, share })) };
    await restore(page, { dividers: [0, 0, 40], touched: true, shown: true }, content);
    await expectResultBar(page, [0, 0, 40, 0], real, 'en', content);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
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
