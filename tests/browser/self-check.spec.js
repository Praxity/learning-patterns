import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const english = JSON.parse(await readFile(new URL('../../patterns/self-check/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/self-check/examples/fr.json', import.meta.url)));

async function open(page, path = '/en.html') {
  await page.goto(path);
  await page.waitForFunction(() => window.lpReady);
}

async function ticks(page) {
  await page.getByRole('textbox').fill('My draft');
  await page.getByRole('button', { name: 'Check my answer', exact: true }).click();
}

async function observeStatus(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    new MutationObserver(records => {
      for (const record of records) window.lpAnnouncements.push(record.target.textContent);
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
  await expect(page.locator('[data-lp-error]')).toBeHidden();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  const boxes = page.getByRole('checkbox'); await expect(boxes.first()).toBeFocused();
  await page.keyboard.press('Space');
  for (let index = 0; index < 6; index++) await page.keyboard.press('Tab');
  const show = page.getByRole('button', { name: 'Show feedback' });
  await expect(show).toBeFocused(); await page.keyboard.press('Enter'); await expect(show).toBeFocused();
  await expect(page.locator('[data-lp-result]')).toContainText('You ticked 1 of 6 parts.');
  await expect(page.locator('[data-lp-result]')).toContainText('Included');
  await expect(page.locator('[data-lp-result]')).toContainText('Not included');
  await page.keyboard.press('Enter'); await expect(show).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Start again' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(answer).toBeFocused();
  await expect(answer).toHaveValue(''); await expect(page.locator('[data-lp-ticks]')).toBeHidden();
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  await expect(page.locator('input:checked')).toHaveCount(0);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['You ticked 1 of 6 parts.', 'You ticked 1 of 6 parts.', 'Cleared.']);
});

for (const [lang, content, included, notIncluded] of [
  ['en', english, 'Included', 'Not included'],
  ['fr', french, 'Inclus', 'Non inclus']
]) {
  test(`feedback names every part and puts missed hints on their own line (${lang})`, async ({ page }) => {
    await open(page, `/${lang}.html`);
    await page.getByRole('textbox').fill('Draft'); await page.locator('[data-lp-check]').click();
    await page.getByRole('checkbox').first().check(); await page.locator('[data-lp-show]').click();
    const rows = page.locator('[data-lp-result] li');
    await expect(rows).toHaveCount(content.parts.length);
    for (const [index, part] of content.parts.entries()) {
      const row = rows.nth(index);
      // Ignore decorative icons, then compare the visible lines.
      const lines = (await row.innerText()).split('\n').map(line => line.trim()).filter(line => line && line !== '✓' && line !== '○');
      expect(lines).toEqual(index === 0 ? [`${included} ${part.label}`] : [`${notIncluded} ${part.label}`, part.missed]);
      await expect(row.locator('[aria-hidden="true"]')).toHaveCount(1);
    }
  });
}

test('Start again is hidden initially and after reset, and available from the checklist', async ({ page }) => {
  await open(page); await observeStatus(page);
  const restart = page.locator('[data-lp-restart]');
  await expect(restart).toBeHidden();
  await page.locator('[data-lp-check]').click();
  await expect(restart).toBeHidden();
  await ticks(page); await expect(restart).toBeVisible();
  await restart.click();
  await expect(restart).toBeHidden(); await expect(page.locator('[data-lp-ticks]')).toBeHidden();
  await expect(page.getByRole('textbox')).toHaveValue(''); await expect(page.getByRole('textbox')).toBeFocused();
  await ticks(page); await page.locator('[data-lp-show]').click();
  await expect(restart).toBeVisible(); await restart.click();
  await expect(restart).toBeHidden(); await expect(page.locator('[data-lp-result]')).toBeHidden();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Cleared.', 'You ticked 0 of 6 parts.', 'Cleared.']);
});

test('Start again uses a secondary button with accent border and the same target and focus ring', async ({ page }) => {
  await open(page); await ticks(page);
  const restart = page.locator('[data-lp-restart]');
  const style = await restart.evaluate(el => {
    const css = getComputedStyle(el);
    return { background: css.backgroundColor, color: css.color, border: css.borderColor, borderStyle: css.borderStyle, minHeight: css.minHeight, height: el.getBoundingClientRect().height };
  });
  expect(style).toMatchObject({ background: 'rgba(0, 0, 0, 0)', color: 'rgb(23, 79, 120)', border: 'rgb(23, 79, 120)', borderStyle: 'solid', minHeight: '44px' });
  expect(style.height).toBeGreaterThanOrEqual(44);
  for (const name of ['check', 'show', 'restart']) {
    const button = page.locator(`[data-lp-${name}]`);
    if (name !== 'restart') {
      const primary = await button.evaluate(el => { const css = getComputedStyle(el); return { background: css.backgroundColor, color: css.color }; });
      expect(primary).toEqual({ background: 'rgb(23, 79, 120)', color: 'rgb(255, 255, 255)' });
    }
    await button.focus();
    const outline = await button.evaluate(el => { const css = getComputedStyle(el); return [css.outlineWidth, css.outlineStyle, css.outlineOffset, css.outlineColor]; });
    expect(outline).toEqual(['2px', 'solid', '2px', 'rgb(0, 95, 204)']);
  }
  // Theme overrides must also reach the secondary button.
  await page.locator('[data-lp-pattern]').evaluate(el => el.style.setProperty('--lp-accent', '#123456'));
  expect(await restart.evaluate(el => [getComputedStyle(el).color, getComputedStyle(el).borderColor])).toEqual(['rgb(18, 52, 86)', 'rgb(18, 52, 86)']);
});

for (const path of ['/en.html', '/fr.html', '/two.html']) {
  test(`axe at load, checklist and feedback: ${path}`, async ({ page }) => {
    await open(page, path);
    const scan = async () => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await scan();
    for (const root of await page.locator('[data-lp-pattern]').all()) {
      await root.getByRole('textbox').fill('Draft'); await root.locator('[data-lp-check]').click();
    }
    await scan();
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-show]').click();
    await scan();
  });
}

test('editing answers or ticks preserves feedback, next submit replaces it and saves each change', async ({ page }) => {
  await open(page); await ticks(page);
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: 'Show feedback' }).click();
  const before = await page.locator('[data-lp-result]').innerHTML();
  await page.getByRole('textbox').fill('Edited draft');
  await page.getByRole('checkbox').nth(1).check();
  expect(await page.locator('[data-lp-result]').innerHTML()).toBe(before);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ answer: 'Edited draft', ticked: ['work_deadline', 'reason'], shown: true });
  await page.getByRole('button', { name: 'Show feedback' }).click();
  await expect(page.locator('[data-lp-result] > p').first()).toHaveText('You ticked 2 of 6 parts.');
  await expect(page.locator('[data-lp-result] > ul')).toHaveCount(1);
  await page.getByRole('button', { name: 'Start again' }).click();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ answer: '', ticked: [], shown: false });
});

for (const [lang, content] of [['en', english], ['fr', french]]) {
  test(`no JavaScript: native details contains all hints and model (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`/${lang}.html`);
    await expect(page.getByRole('textbox')).toHaveAttribute('rows', '5');
    await page.locator('summary').click(); await expect(page.locator('details')).toHaveAttribute('open', '');
    for (const part of content.parts) await expect(page.locator('details')).toContainText(part.missed);
    for (const part of content.parts) await expect(page.locator('details')).toContainText(part.label);
    await expect(page.locator('details')).toContainText(content.model);
    await expect(page.locator('[data-lp-flow]')).toBeHidden();
    await context.close();
  });

  test(`320px and WCAG text spacing without overflow or overlap (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await open(page, `/${lang}.html`);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    await page.getByRole('textbox').fill('Draft'); await page.locator('[data-lp-check]').click(); await page.locator('[data-lp-show]').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // The status region is deliberately clipped for screen readers. Check visible text.
    const problems = await page.evaluate(() => [...document.querySelectorAll('p, label, legend, button, li, h2')].filter(el => el.getClientRects().length && !el.matches('[role="status"]')).flatMap(el => {
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
  await open(page, '/fr.html'); await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', 'fr');
  await page.getByRole('textbox').fill('Mon message'); await page.locator('[data-lp-check]').click();
  await page.getByRole('checkbox').first().check(); await page.locator('[data-lp-show]').click();
  await expect(page.locator('[data-lp-result]')).toContainText('Vous avez coché 1 des 6 éléments.');
  await expect(page.locator('[data-lp-result]')).toContainText(french.model);
});

for (const shown of [false, true]) {
  test(`valid saved state restores checklist and shown=${shown} without announcements`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, { answer: 'Saved answer', ticked: ['reason'], shown });
    await open(page); await expect(page.getByRole('textbox')).toHaveValue('Saved answer');
    await expect(page.getByRole('checkbox').nth(1)).toBeChecked(); await expect(page.locator('[data-lp-ticks]')).toBeVisible();
    await expect(page.locator('[data-lp-restart]')).toBeVisible();
    await expect(page.locator('[role="status"]')).toHaveText('');
    if (shown) await expect(page.locator('[data-lp-result]')).toContainText('You ticked 1 of 6 parts.');
    else await expect(page.locator('[data-lp-result]')).toBeHidden();
  });
}

test('invalid saved state is ignored', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { answer: 'Invalid', ticked: ['unknown'], shown: true }; });
  await open(page); await expect(page.getByRole('textbox')).toHaveValue('');
  await expect(page.locator('[data-lp-ticks]')).toBeHidden(); await expect(page.locator('[role="status"]')).toHaveText('');
  await expect(page.locator('[data-lp-restart]')).toBeHidden();
});

test('enhance is idempotent and destroy removes listeners and restores fallback', async ({ page }) => {
  await open(page); expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await observeStatus(page); await ticks(page); await page.locator('[data-lp-show]').click();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['You ticked 0 of 6 parts.']);
  await page.evaluate(() => window.lpInstances[0].destroy());
  await expect(page.locator('[data-lp-flow]')).toBeHidden(); await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await page.evaluate(() => window.lpEnhance()); await ticks(page); await page.locator('[data-lp-show]').click();
  await expect(page.locator('[data-lp-result] > ul')).toHaveCount(1);
});

test('two instances have unique IDs and independent controls', async ({ page }) => {
  await open(page, '/two.html');
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id));
  expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  await roots.first().getByRole('textbox').fill('First draft'); await roots.first().locator('[data-lp-check]').click();
  await roots.first().getByRole('checkbox').first().check(); await roots.first().locator('[data-lp-show]').click();
  await expect(roots.nth(1).getByRole('textbox')).toHaveValue(''); await expect(roots.nth(1).locator('[data-lp-ticks]')).toBeHidden();
  await expect(roots.nth(1).locator('[role="status"]')).toHaveText('');
});

test('destroy is safe to repeat after another enhancement', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const old = window.lpInstances[0];
    old.destroy(); window.lpEnhance(); old.destroy();
  });
  await expect(page.locator('[data-lp-flow]')).toBeVisible();
  expect(await page.evaluate(() => window.lpEnhance() === window.lpEnhance())).toBe(true);
  await observeStatus(page); await ticks(page); await page.locator('[data-lp-show]').click();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['You ticked 0 of 6 parts.']);
});

test('missing or mismatched markup throws a useful error', async ({ page }) => {
  await open(page);
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/self-check/enhance.js');
    const { strings } = await import('/patterns/self-check/strings.js');
    enhance(document.createElement('section'), { content, strings: strings.en });
  }, english)).rejects.toThrow('Missing self-check markup: textarea');
  await page.evaluate(() => { window.lpInstances[0].destroy(); document.querySelector('input').remove(); });
  await expect(page.evaluate(() => window.lpEnhance())).rejects.toThrow('Invalid self-check parts markup');
});

test('forced colours keeps a 2px focus outline on buttons and checkboxes', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page); await ticks(page);
  for (const locator of [page.getByRole('checkbox').first(), page.locator('[data-lp-check]'), page.locator('[data-lp-show]'), page.locator('[data-lp-restart]')]) {
    await locator.focus();
    const outline = await locator.evaluate(el => { const css = getComputedStyle(el); return { width: css.outlineWidth, style: css.outlineStyle, offset: css.outlineOffset, color: css.outlineColor }; });
    expect(outline.width).toBe('2px'); expect(outline.style).toBe('solid'); expect(outline.offset).toBe('2px'); expect(outline.color).not.toBe('rgba(0, 0, 0, 0)');
  }
  const styles = await page.locator('[data-lp-flow] button').evaluateAll(buttons => buttons.map(el => {
    const css = getComputedStyle(el);
    return { color: css.color, background: css.backgroundColor, borderColor: css.borderColor, borderStyle: css.borderStyle, borderWidth: css.borderWidth };
  }));
  // Resolve system colours in the active palette, without hardcoding a theme.
  const system = await page.evaluate(() => {
    const probe = document.createElement('span'); document.body.append(probe);
    const colors = {};
    for (const name of ['ButtonText', 'ButtonFace']) { probe.style.color = name; colors[name] = getComputedStyle(probe).color; }
    probe.remove(); return colors;
  });
  for (const style of styles) {
    expect(style.color).toBe(system.ButtonText); expect(style.background).toBe(system.ButtonFace);
    expect(style.borderColor).toBe(system.ButtonText); expect(style.borderWidth).toBe('1px');
  }
  expect(styles[0].borderStyle).toBe('solid'); expect(styles[1].borderStyle).toBe('solid');
  expect(styles[2].borderStyle).toBe('dashed');
});
