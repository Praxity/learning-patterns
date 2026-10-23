import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { frenchTypography } from '../../lib/html.js';
import { render } from '../../patterns/draw-your-guess/render.js';
import { strings } from '../../patterns/draw-your-guess/strings.js';

const english = JSON.parse(await readFile(new URL('../../patterns/draw-your-guess/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/draw-your-guess/examples/fr.json', import.meta.url)));

async function open(page, path = '/draw-your-guess/en.html') {
  await page.goto(path); await page.waitForFunction(() => window.lpReady);
}
async function keyboardGuess(page) {
  const sliders = page.getByRole('slider');
  await sliders.first().focus();
  for (let i = 0; i < 4; i++) {
    await expect(sliders.nth(i)).toBeFocused();
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Tab');
  }
}
async function observe(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    const status = document.querySelector('[role=status]');
    new MutationObserver(() => { if (status.textContent) window.lpAnnouncements.push(status.textContent); }).observe(status, { childList: true, characterData: true, subtree: true });
  });
}

for (const [lang, content] of [['en', english], ['fr', french]]) {
  test(`keyboard check, one announcement, locking and Try again (${lang})`, async ({ page }) => {
    await open(page, `/draw-your-guess/${lang}.html`); await observe(page);
    const sliders = page.getByRole('slider');
    for (let i = 0; i < 4; i++) {
      await expect(sliders.nth(i)).toHaveAccessibleName(content.future[i].name);
      await expect(sliders.nth(i)).toHaveValue('120');
    }
    await keyboardGuess(page);
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
    await expect(page.locator('[data-lp-check]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-lp-try-again]')).toBeFocused();
    await expect(page.locator('[data-lp-result]')).toBeVisible();
    await expect(page.locator('[data-lp-summary]')).toHaveText(frenchTypography(content.feedback.fellThenFlat, lang));
    await expect(page.locator('[data-lp-check]')).toBeHidden();
    for (const input of await sliders.all()) await expect(input).toBeDisabled();
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([frenchTypography(content.feedback.fellThenFlat, lang)]);
    await expect(page.locator('[data-lp-comparison] li')).toHaveCount(4);
    expect((await page.locator('[data-lp-real]').getAttribute('points')).split(' ')).toHaveLength(8);
    await expect(sliders.first()).toHaveAttribute('aria-valuetext', lang === 'en' ? 'April: your guess 115, real 95 calls a day' : 'avril\u202f: votre estimation 115, valeur réelle 95 appels par jour');
    // Record focus at the instant Try again is hidden, before any later focus can mask a gap.
    await page.evaluate(() => {
      const again = document.querySelector('[data-lp-try-again]');
      new MutationObserver(() => { if (again.hidden) window.lpFocusWhenRetryHidden = document.activeElement?.id; }).observe(again, { attributes: true, attributeFilter: ['hidden'] });
    });
    await page.keyboard.press('Enter');
    await expect(sliders.first()).toBeFocused(); await expect(sliders.first()).toHaveValue('120');
    expect(await page.evaluate(() => window.lpFocusWhenRetryHidden)).toBe(await sliders.first().getAttribute('id'));
    await expect(page.locator('[data-lp-result]')).toBeHidden(); await expect(page.locator('[data-lp-try-again]')).toBeHidden();
    await expect(page.locator('[data-lp-guess]')).toHaveAttribute('points', '');
    expect((await page.locator('[data-lp-real]').getAttribute('points')).split(' ')).toHaveLength(4);
    await expect(page.locator('.lp-draw-your-guess-dot')).toHaveCount(0);
    await expect(page.locator('.lp-draw-your-guess-val')).toHaveCount(0);
    await expect(page.locator('[data-lp-chart]')).not.toHaveClass(/lp-draw-your-guess-done/);
    await expect(sliders.first()).toHaveAttribute('aria-valuetext', lang === 'en' ? 'April, not set' : 'avril, aucune estimation');
    await expect(page.locator('[role=status]')).toHaveText(strings[lang].cleared);
    expect(await page.evaluate(() => window.lpSaved)).toEqual({ guesses: [null, null, null, null], shown: false });
    await keyboardGuess(page); await page.keyboard.press('Enter');
    await expect(page.locator('[data-lp-result]')).toBeVisible();
  });
}

test('missing points show one error and one announcement; changing a value clears the error', async ({ page }) => {
  await open(page); await observe(page);
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-error]')).toContainText('April, May, June and July');
  const errorId = await page.locator('[data-lp-error]').getAttribute('id');
  for (const slider of await page.getByRole('slider').all()) {
    await expect(slider).toHaveAttribute('aria-invalid', 'true');
    await expect(slider).toHaveAttribute('aria-describedby', errorId);
    await expect(slider).toHaveAccessibleDescription('Set a point for every month first. Still empty: April, May, June and July.');
  }
  expect(await page.evaluate(() => window.lpAnnouncements.length)).toBe(1);
  await page.getByRole('slider').first().focus(); await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-lp-error]')).toBeHidden();
  for (const slider of await page.getByRole('slider').all()) {
    await expect(slider).not.toHaveAttribute('aria-invalid');
    await expect(slider).not.toHaveAttribute('aria-describedby');
  }
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-error]')).toContainText('May, June and July');
  await expect(page.locator('[data-lp-result]')).toBeHidden();
});

test('pointer taps and a drag across columns set points and preserve keyboard continuation', async ({ page }) => {
  await open(page); await observe(page);
  let area = await page.locator('[data-lp-future]').boundingBox();
  const x = i => area.x + area.width * (i + .5) / 4;
  const y = area.y + area.height / 2;
  for (let i = 0; i < 4; i++) {
    await page.mouse.click(x(i), y);
    await expect(page.getByRole('slider').nth(i)).toBeFocused();
    await expect(page.getByRole('slider').nth(i)).toHaveValue('75');
  }
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-check]')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('slider').last()).toBeFocused();
  await expect(page.locator('.lp-draw-your-guess-col').last()).toHaveCSS('outline-width', '3px');
  await expect(page.locator('[data-lp-chart]')).not.toHaveClass(/lp-draw-your-guess-pointer/);
  // A host may move focus outside the chart without a keydown inside it.
  area = await page.locator('[data-lp-future]').boundingBox();
  await page.mouse.click(x(3), area.y + area.height / 2);
  await page.locator('[data-lp-check]').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('slider').last()).toBeFocused();
  await expect(page.locator('.lp-draw-your-guess-col').last()).toHaveCSS('outline-width', '3px');
  await page.keyboard.press('ArrowUp'); await expect(page.getByRole('slider').last()).toHaveValue('80');
  area = await page.locator('[data-lp-future]').boundingBox();
  await page.mouse.move(x(0), area.y + area.height / 3); await page.mouse.down();
  for (let i = 0; i < 4; i++) await page.mouse.move(x(i), area.y + area.height / 3);
  await page.mouse.up();
  for (const slider of await page.getByRole('slider').all()) await expect(slider).toHaveValue('100');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-try-again]')).toBeFocused();
});

test('out-of-order guesses keep a gap in the line; Home and End reach boundaries', async ({ page }) => {
  await open(page);
  const sliders = page.getByRole('slider');
  await sliders.nth(1).focus(); await page.keyboard.press('Home');
  await expect(sliders.nth(1)).toHaveValue('0'); await expect(page.locator('[data-lp-guess]')).toHaveAttribute('points', '');
  await sliders.first().focus(); await page.keyboard.press('End'); await expect(sliders.first()).toHaveValue('150');
  expect((await page.locator('[data-lp-guess]').getAttribute('points')).split(' ')).toHaveLength(3);
});

test('without JavaScript the answer disclosure contains all values and the source', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage(); await page.goto('/draw-your-guess/en.html');
    await expect(page.getByRole('slider')).toHaveCount(0); await expect(page.locator('[data-lp-check]')).toBeHidden();
    await page.locator('[data-lp-fallback] summary').click();
    await expect(page.locator('[data-lp-fallback] tbody tr')).toHaveCount(8);
    await expect(page.locator('[data-lp-fallback]')).toContainText('IT help desk call log, December to July');
    await expect(page.getByRole('group')).not.toHaveAttribute('aria-describedby');
    await expect(page.locator('[data-lp-fallback]')).toContainText('79');
  } finally { await context.close(); }
});

for (const shown of [false, true]) test(`valid saved state restores silently, shown=${shown}`, async ({ page }) => {
  await page.addInitScript(shown => { window.lpSeed = { guesses: [100, 90, 80, shown ? 80 : null], shown }; }, shown);
  await open(page); await expect(page.getByRole('slider').first()).toHaveValue('100');
  // Lock defers focus by two frames. Wait past them before checking a silent restore.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator('body')).toBeFocused();
  await expect(page.locator('[role=status]')).toHaveText('');
  if (shown) { await expect(page.locator('[data-lp-result]')).toBeVisible(); await expect(page.getByRole('slider').first()).toBeDisabled(); }
  else await expect(page.locator('[data-lp-result]')).toBeHidden();
});

test('invalid state is ignored; repeated enhancement and destroy preserve the fallback', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { guesses: [79, 80, 80, 80], shown: true }; });
  await open(page); await expect(page.getByRole('slider').first()).toHaveValue('120');
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await keyboardGuess(page); await page.keyboard.press('Enter');
  await page.evaluate(() => { const old = window.lpInstances[0]; old.destroy(); old.destroy(); });
  await expect(page.locator('[data-lp-fallback]')).toBeVisible(); await expect(page.getByRole('slider')).toHaveCount(0);
  await expect(page.getByRole('group')).not.toHaveAttribute('aria-describedby');
  await page.locator('body').evaluate(body => { body.tabIndex = -1; body.focus(); });
  await observe(page); await page.evaluate(() => { window.lpEnhance(); });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator('[data-lp-result]')).toBeVisible();
  await expect(page.getByRole('slider').first()).toBeDisabled();
  await expect(page.locator('body')).toBeFocused();
  await expect(page.locator('[role=status]')).toHaveText('');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  await page.locator('[data-lp-try-again]').click();
  await expect(page.getByRole('slider').first()).toBeFocused();
  await keyboardGuess(page); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([strings.en.cleared, english.feedback.fellThenFlat]);
});

test('two instances have independent controls and unique ids', async ({ page }) => {
  await open(page, '/draw-your-guess/two.html');
  const roots = page.locator('[data-lp-pattern]');
  await roots.first().getByRole('slider').first().focus(); await page.keyboard.press('ArrowLeft');
  await expect(roots.nth(1).getByRole('slider').first()).toHaveAttribute('aria-valuetext', 'April, not set');
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id));
  expect(new Set(ids).size).toBe(ids.length);
});

test('320 px, text spacing, reduced motion and axe checks before and after submission', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page);
  await page.addStyleTag({ content: '.lp { line-height:1.5; letter-spacing:.12em; word-spacing:.16em } .lp p { margin-bottom:2em }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include('[data-lp-pattern]').analyze()).violations).toEqual([]);
  await keyboardGuess(page); await page.keyboard.press('Enter'); await expect(page.locator('[data-lp-try-again]')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).include('[data-lp-pattern]').analyze()).violations).toEqual([]);
});

test('forced colours retain distinct markers and a 3 px keyboard focus ring', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page);
  await page.getByRole('slider').first().focus(); await page.keyboard.press('ArrowLeft');
  const outline = await page.locator('.lp-draw-your-guess-col').first().evaluate(el => getComputedStyle(el).outlineWidth);
  expect(outline).toBe('3px');
  await expect(page.locator('.lp-draw-your-guess-sq').first()).toHaveCSS('border-radius', '0px');
  await expect(page.locator('.lp-draw-your-guess-dot').first()).toHaveCSS('border-radius', '50%');
  const square = await page.locator('.lp-draw-your-guess-sq').first().evaluate(el => getComputedStyle(el).backgroundColor);
  const dot = await page.locator('.lp-draw-your-guess-dot').first().evaluate(el => getComputedStyle(el).backgroundColor);
  expect(square).not.toBe(dot);
  const squareIcon = await page.locator('.lp-draw-your-guess-sq-ico').evaluate(el => getComputedStyle(el).fill);
  const dotIcon = await page.locator('.lp-draw-your-guess-dot-ico').evaluate(el => getComputedStyle(el).fill);
  expect(squareIcon).not.toBe(dotIcon);
  const system = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.cssText = 'color:CanvasText;background:Canvas;forced-color-adjust:none';
    document.body.append(probe);
    const style = getComputedStyle(probe), colours = { ink: style.color, paper: style.backgroundColor };
    probe.remove();
    return colours;
  });
  expect(square).toBe(system.ink); expect(squareIcon).toBe(system.ink);
  expect(dot).toBe(system.paper); expect(dotIcon).toBe(system.paper);
  await expect(page.locator('.lp-draw-your-guess-sq').first()).toHaveCSS('forced-color-adjust', 'none');
  await expect(page.locator('.lp-draw-your-guess-dot').first()).toHaveCSS('forced-color-adjust', 'none');
});

test('French fractional real values use the locale in slider descriptions and comparisons', async ({ page }) => {
  const content = structuredClone(french);
  content.future[0].value = 95.5;
  await page.route('**/draw-your-guess/fr.html', route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><html lang="fr-CA"><head><meta charset="utf-8"></head><body>
      ${render(content, strings.fr, { id: 'fractional', lang: 'fr-CA' })}
      <script type="module">
        import { enhance } from '/patterns/draw-your-guess/enhance.js';
        import { strings } from '/patterns/draw-your-guess/strings.js';
        enhance(document.querySelector('[data-lp-pattern]'), { content: ${JSON.stringify(content).replaceAll('<', '\\u003c')}, strings: strings.fr });
        window.lpReady = true;
      </script></body></html>`
  }));
  await open(page, '/draw-your-guess/fr.html');
  await expect(page.getByRole('group')).toHaveAttribute('aria-describedby', 'fractional-help');
  await keyboardGuess(page); await page.keyboard.press('Enter');
  await expect(page.getByRole('slider').first()).toHaveAttribute('aria-valuetext', 'avril\u202f: votre estimation 115, valeur réelle 95,5 appels par jour');
  await expect(page.locator('[data-lp-comparison] li').first()).toHaveText('avril\u202f: votre estimation 115, valeur réelle 95,5 appels par jour');
});
