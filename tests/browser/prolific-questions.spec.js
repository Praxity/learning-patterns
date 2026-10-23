import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { frenchTypography } from '../../lib/html.js';

const english = JSON.parse(await readFile(new URL('../../patterns/prolific-questions/examples/en.json', import.meta.url), 'utf8'));
const french = JSON.parse(await readFile(new URL('../../patterns/prolific-questions/examples/fr.json', import.meta.url), 'utf8'));
const seed = () => ({ deck: [1, 2, 3, 4, 5, 6, 7, 8, 9], last: 0, order: [2, 0, 1], picks: [null, null, null], checked: false, completed: 0, placed: 0 });

async function open(page, lang = 'en', saved = seed()) {
  await page.addInitScript(value => { window.lpSeed = value; }, saved);
  await page.goto(`/prolific-questions/${lang}.html`);
  await page.waitForFunction(() => window.lpReady);
}

async function observeStatus(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    new MutationObserver(() => {
      const text = document.querySelector('[role="status"]').textContent;
      if (text) window.lpAnnouncements.push(text);
    }).observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}

async function choose(page, picks, keyboard = false) {
  const facts = page.locator('[data-lp-fact]');
  for (const [i, slot] of picks.entries()) {
    const radios = facts.nth(i).getByRole('radio');
    if (keyboard) {
      if (i === 0) await radios.first().focus();
      await expect(radios.first()).toBeFocused();
      await page.keyboard.press('Space');
      for (let j = 0; j < slot; j++) await page.keyboard.press('ArrowRight');
      await expect(radios.nth(slot)).toBeChecked();
      await page.keyboard.press('Tab');
    } else {
      await radios.nth(slot).check();
    }
  }
}

for (const keyboard of [false, true]) test(`complete check and new set using ${keyboard ? 'keyboard' : 'pointer'}`, async ({ page }) => {
  await open(page); await observeStatus(page);
  const facts = page.locator('[data-lp-fact]');
  await expect(facts.nth(0).locator('legend')).toHaveText(english.cases[0][2]);
  await choose(page, [2, 1, 1], keyboard);
  const check = page.locator('[data-lp-check]');
  if (keyboard) {
    await expect(check).toBeFocused(); await page.keyboard.press('Enter');
  } else await check.click();
  await expect(page.locator('[data-lp-next]')).toBeFocused();
  await expect(check).toBeHidden();
  await expect(page.locator('[data-lp-fact] input:disabled')).toHaveCount(9);
  await expect(page.locator('[data-lp-mark="correct"]')).toHaveCount(2);
  await expect(page.locator('[data-lp-mark="wrong"]')).toHaveCount(1);
  await expect(page.locator('[data-lp-mark="missed"]')).toHaveCount(1);
  await expect(page.locator('[data-lp-result]')).toHaveText('1 set, 2 of 3 facts placed right.');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['2 of 3 right in this set. So far: 1 set, 2 of 3 facts placed right.']);
  const before = await facts.locator('legend').allTextContents();
  // A new set must reuse the server controls and preserve the running count.
  await page.evaluate(() => { window.lpOriginalRadio = document.querySelector('input'); });
  await expect(page.getByRole('button')).toHaveCount(1);
  if (keyboard) await page.keyboard.press('Enter'); else await page.locator('[data-lp-next]').click();
  await expect(page.locator('[data-lp-question]')).toBeFocused();
  await expect(check).toBeVisible();
  await expect(page.locator('input:checked, input:disabled, [data-lp-mark]')).toHaveCount(0);
  expect(await page.evaluate(() => window.lpOriginalRadio === document.querySelector('input'))).toBe(true);
  expect(await page.evaluate(() => [window.lpSaved.completed, window.lpSaved.placed])).toEqual([1, 2]);
  expect(await page.evaluate(() => window.lpSaved.last)).toBe(9);
  expect(await facts.locator('legend').allTextContents()).not.toEqual(before);
  await expect(page.locator('[role="status"]')).toHaveText('');
});

test('Check freezes every radio before returning to the event loop', async ({ page }) => {
  await open(page);
  await choose(page, [2, 0, 1]);
  const frozen = await page.evaluate(() => {
    const check = document.querySelector('[data-lp-check]');
    check.focus();
    check.click();
    return [...document.querySelectorAll('[data-lp-fact] input')].every(input => input.disabled);
  });
  expect(frozen).toBe(true);
  await expect(page.locator('[data-lp-next]')).toBeFocused();
});

test('two-part content uses two columns without inline styles and stacks in narrow containers', async ({ page }) => {
  await open(page);
  const content = { ...english, parts: english.parts.slice(0, 2), workedExample: english.workedExample.slice(0, 2), cases: english.cases.map(facts => facts.slice(0, 2)) };
  await page.evaluate(async content => {
    const { render } = await import('/patterns/prolific-questions/render.js');
    const { enhance } = await import('/patterns/prolific-questions/enhance.js');
    const { strings } = await import('/patterns/prolific-questions/strings.js');
    window.lpInstances[0].destroy();
    document.querySelector('[data-lp-pattern]').outerHTML = render(content, strings.en, { id: 'two-parts', lang: 'en' });
    document.querySelector('[data-lp-pattern]').removeAttribute('style');
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
  }, content);
  await expect(page.locator('[data-lp-fact]')).toHaveCount(2);
  await expect(page.getByRole('radio')).toHaveCount(4);
  for (const selector of ['.lp-prolific-questions-worked', '.lp-prolific-questions-fact']) {
    expect(await page.locator(selector).first().evaluate(el => new Set([...el.children].filter(child => child.getClientRects().length).map(child => Math.round(child.getBoundingClientRect().left))).size)).toBe(2);
  }
  expect(await page.locator('[data-lp-worked]').evaluate(el => getComputedStyle(el).borderBlockStartWidth)).toBe('0px');
  await expect(page.locator('[data-lp-worked]').getByRole('region')).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 900 });
  for (const selector of ['.lp-prolific-questions-worked', '.lp-prolific-questions-fact']) {
    expect(await page.locator(selector).first().evaluate(el => new Set([...el.children].filter(child => child.getClientRects().length).map(child => Math.round(child.getBoundingClientRect().left))).size)).toBe(1);
  }
});

test('French results keep singular wording for one answer and zero cumulative placements', async ({ page }) => {
  await open(page, 'fr');
  await choose(page, [2, 1, 0]);
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[role="status"]')).toHaveText("1 bonne réponse sur 3 dans cette série. Jusqu'ici\u202f: 1 série, 1 fait bien classé sur 3.");
  await page.reload(); await page.waitForFunction(() => window.lpReady);
  await choose(page, [0, 1, 2]);
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-result]')).toHaveText('1 série, 0 fait bien classé sur 3.');
});

test('missing answers describe only unanswered groups and announce once per check', async ({ page }) => {
  await open(page); await observeStatus(page);
  const check = page.locator('[data-lp-check]');
  await check.click();
  await expect(check).toBeFocused();
  await expect(page.locator('[data-lp-error]')).toHaveText('Choose an answer for each fact first.');
  await expect(page.locator('[data-lp-fact][aria-describedby]')).toHaveCount(3);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Choose an answer for each fact first.']);
  await page.locator('[data-lp-fact]').nth(0).getByRole('radio').nth(2).check();
  await check.click();
  await expect(page.locator('[data-lp-fact][aria-describedby]')).toHaveCount(2);
  await expect(page.locator('[data-lp-error]')).toHaveText('Choose an answer for the other 2 facts too.');
  await page.locator('[data-lp-fact]').nth(1).getByRole('radio').nth(0).check();
  await check.click();
  await expect(page.locator('[data-lp-error]')).toHaveText('Choose an answer for the last fact too.');
  await page.locator('[data-lp-fact]').nth(2).getByRole('radio').nth(1).check();
  await expect(page.locator('[data-lp-error]')).toBeHidden();
  await expect(page.locator('[data-lp-fact][aria-describedby]')).toHaveCount(0);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([
    'Choose an answer for each fact first.', 'Choose an answer for the other 2 facts too.', 'Choose an answer for the last fact too.'
  ]);
});

for (const lang of ['en', 'fr']) {
  const content = lang === 'en' ? english : french;
  test(`native no-JS answers and worked example (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`/prolific-questions/${lang}.html`);
    await expect(page.locator('[data-lp-worked]')).toBeVisible();
    for (const fact of content.workedExample) await expect(page.locator('[data-lp-worked]')).toContainText(frenchTypography(fact, lang));
    await expect(page.locator('[data-lp-practice]')).toBeHidden();
    const fallback = page.locator('[data-lp-fallback]');
    await fallback.locator('summary').click();
    for (const fact of content.cases.flat()) await expect(fallback).toContainText(frenchTypography(fact, lang));
    for (const part of content.parts) await expect(fallback).toContainText(part.label);
    await expect(fallback).not.toContainText(frenchTypography(content.context, lang));
    await expect(page.locator('.lp-context')).toHaveText(`${lang === 'en' ? 'Context:' : 'Contexte\u202f:'} ${frenchTypography(content.context, lang)}`);
    await context.close();
  });

  test(`axe, translated result, 320px and text spacing (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await open(page, lang);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', lang);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    const scan = async () => {
      await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running' && !animation.pending));
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    };
    await scan(); await choose(page, [2, 1, 1]); await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-next]')).toBeFocused();
    await expect(page.locator('[data-lp-result]')).toHaveText(lang === 'en' ? '1 set, 2 of 3 facts placed right.' : '1 série, 2 faits bien classés sur 3.');
    await expect(page.locator('[data-lp-mark="missed"] .lp-choice-mark')).toHaveText(lang === 'en' ? 'Correct answer' : 'Bonne réponse');
    await scan();
    const clipped = await page.locator('[data-lp-pattern]').evaluate(root => [...root.querySelectorAll('p, label, legend, button, h2, h3, h4')]
      .filter(el => el.getClientRects().length && !el.matches('.lp-visually-hidden') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1))
      .map(el => el.textContent));
    expect(clipped).toEqual([]);
  });
}

for (const checked of [false, true]) test(`saved deck, order, picks and counts restore silently, checked=${checked}`, async ({ page }) => {
  const saved = { ...seed(), picks: checked ? [2, 0, 1] : [2, null, null], checked, completed: checked ? 1 : 0, placed: checked ? 3 : 0 };
  await open(page, 'en', saved);
  // Regression guard for restore focus; lock's own specs prove that focus: false suppresses movement.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await expect(page.locator('input:checked')).toHaveCount(checked ? 3 : 1);
  await expect(page.locator('[role="status"]')).toHaveText('');
  expect(await page.evaluate(() => window.lpSaved)).toEqual(saved);
  if (checked) {
    await expect(page.locator('[data-lp-fact] input:disabled')).toHaveCount(9);
    await expect(page.locator('[data-lp-next]')).toBeEnabled();
    await expect(page.locator('[data-lp-result]')).toHaveText('1 set, 3 of 3 facts placed right.');
    await page.locator('[data-lp-next]').click();
    expect(await page.evaluate(() => window.lpSaved.last)).toBe(9);
  } else await expect(page.locator('[data-lp-check]')).toBeVisible();
});

test('invalid saved state is ignored, enhancement and destruction are idempotent', async ({ page }) => {
  await open(page, 'en', { ...seed(), deck: [0, 0] });
  await expect(page.locator('input:checked')).toHaveCount(0);
  await expect(page.locator('[role="status"]')).toHaveText('');
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await page.evaluate(() => {
    window.lpInstances[0].destroy();
    window.lpInstances[0].destroy();
  });
  await expect(page.locator('[data-lp-practice]')).toBeHidden();
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await page.evaluate(() => { window.lpEnhance(); window.lpInstances[0].destroy(); });
  await expect(page.locator('[data-lp-practice]')).toBeVisible();
  await observeStatus(page); await choose(page, [0, 0, 0]);
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-next]')).toBeFocused();
  expect(await page.evaluate(() => window.lpAnnouncements)).toHaveLength(1);
});

test('two instances have unique IDs and independent controls', async ({ page }) => {
  await page.goto('/prolific-questions/two.html'); await page.waitForFunction(() => window.lpReady);
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id));
  expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  for (const fact of await roots.first().locator('[data-lp-fact]').all()) await fact.getByRole('radio').first().check();
  await roots.first().locator('[data-lp-check]').click();
  await expect(roots.first().locator('[data-lp-next]')).toBeFocused();
  await expect(roots.nth(1).locator('input:checked, input:disabled, [data-lp-mark]')).toHaveCount(0);
  await expect(roots.nth(1).locator('[data-lp-result]')).toBeHidden();
});

test('forced colours retains native radios and keyboard focus', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page);
  const radio = page.locator('[data-lp-fact] input').first(); await radio.focus();
  expect(await radio.evaluate(el => getComputedStyle(el).position)).toBe('static');
  expect(await radio.evaluate(el => el.getBoundingClientRect().width < el.parentElement.getBoundingClientRect().width)).toBe(true);
  expect(await radio.locator('..').evaluate(el => getComputedStyle(el).outlineWidth)).toBe('3px');
  await page.keyboard.press('Space'); await expect(radio).toBeChecked();
  await choose(page, [2, 0, 1]);
  await page.locator('[data-lp-check]').click();
  // This mark layout belongs to the pattern's forced-colours rule, not base.css.
  expect(await page.locator('.lp-choice-mark').first().evaluate(el => getComputedStyle(el).flexBasis)).toBe('100%');
});
