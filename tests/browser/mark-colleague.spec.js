import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { frenchTypography } from '../../lib/html.js';
import { strings } from '../../patterns/mark-colleague/strings.js';

const examples = Object.fromEntries(await Promise.all(['en', 'fr'].map(async lang => [lang,
  JSON.parse(await readFile(new URL(`../../patterns/mark-colleague/examples/${lang}.json`, import.meta.url), 'utf8'))
])));
const t = (lang, text) => frenchTypography(text, lang);
const fill = (lang, key, values = {}) => t(lang, strings[lang][key].replace(/\{(\w+)\}/g, (match, name) => String(values[name] ?? match)));
const FEEDBACK = { en: 'Please say why we can not refund after 45 days.', fr: 'Dites pourquoi nous ne remboursons pas après 45 jours.' };

const field = page => page.locator('[data-lp-pattern] textarea').first();
const check = page => page.locator('[data-lp-check]').first();
const show = page => page.locator('[data-lp-show]').first();
const box = (page, id) => page.locator(`[data-lp-pattern] input[value="${id}"]`).first();

async function open(page, lang = 'en') {
  await page.goto(`/mark-colleague/${lang}.html`);
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
async function finish(page, lang, ticked) {
  await field(page).fill(FEEDBACK[lang]);
  await check(page).click();
  for (const id of ticked) await box(page, id).check();
  await show(page).click();
  await expect(page.locator('[data-lp-result]')).toBeVisible();
}

for (const lang of ['en', 'fr']) {
  test(`keyboard journey: write, tick, add once, then read every issue (${lang})`, async ({ page }) => {
    await open(page, lang);
    await observeStatus(page);
    const content = examples[lang];
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(t(lang, content.title));
    await expect(page.getByRole('heading', { level: 3 })).toHaveText(content.messages.map(message => t(lang, message.heading)));
    await expect(page.getByLabel(fill(lang, 'prompt', { colleague: 'Priya' }))).toBeVisible();
    await expect(page.locator('[data-lp-ticks]')).toBeHidden();
    await expect(page.locator('[data-lp-restart]')).toBeHidden();
    await expect(page.locator('[data-lp-fallback]')).toBeHidden();

    await field(page).focus();
    await page.keyboard.type(FEEDBACK[lang]);
    await page.keyboard.press('Tab');
    await expect(check(page)).toBeFocused();
    await page.keyboard.press('Enter');
    // Focus reads the checklist question and the first part to look at.
    await expect(box(page, 'no_reason')).toBeFocused();
    await expect(page.getByRole('group', { name: fill(lang, 'legend', { colleague: 'Priya' }) })).toBeVisible();
    await expect(page.locator('[data-lp-ticks] label')).toHaveText(content.issues.map(issue => t(lang, issue.label)));
    await expect(check(page)).toBeHidden();
    await expect(page.locator('[data-lp-restart]')).toBeVisible();
    // Explanations wait for the second check.
    await expect(page.locator('[data-lp-issues] > li')).toHaveCount(0);
    await expect(page.getByText(t(lang, content.issues[0].explanation))).toBeHidden();
    await page.keyboard.press('Space');
    await expect(box(page, 'no_reason')).toBeChecked();
    expect(await page.evaluate(() => window.lpSaved)).toEqual({ feedback: FEEDBACK[lang], ticked: ['no_reason'], stage: 'compare' });

    // The one chance to add: the field is still open between the checks.
    await field(page).focus();
    await page.keyboard.press('End');
    await page.keyboard.type(' Offer the credit.');
    await box(page, 'no_alternative').focus();
    await page.keyboard.press('Space');
    await show(page).focus();
    await page.keyboard.press('Enter');

    const summary = page.locator('[data-lp-summary]');
    await expect(summary).toBeFocused();
    await expect(summary).toHaveText(fill(lang, 'resultSome', { count: 2, total: 3 }));
    const items = page.locator('[data-lp-issues] > li');
    await expect(items).toHaveCount(3);
    for (const [index, issue] of content.issues.entries()) {
      await expect(items.nth(index).locator('.lp-run-in')).toHaveText(t(lang, issue.label));
      await expect(items.nth(index)).toContainText(t(lang, issue.explanation));
    }
    await expect(items.locator('.lp-mark-colleague-mark')).toHaveText([strings[lang].raised, strings[lang].raised, strings[lang].notRaised]);
    await expect(items.locator('.lp-mark-colleague-mark svg[aria-hidden="true"]')).toHaveCount(3);
    // The sentence sits above the list.
    const [above, below] = await Promise.all([summary.boundingBox(), items.first().boundingBox()]);
    expect(above.y).toBeLessThan(below.y);
    // It ends here: feedback read-only, checklist and buttons gone, Start over still usable.
    await expect(field(page)).toHaveValue(`${FEEDBACK[lang]} Offer the credit.`);
    await expect(field(page)).toHaveJSProperty('readOnly', true);
    await expect(page.locator('[data-lp-ticks]')).toBeHidden();
    await expect(show(page)).toBeHidden();
    await expect(check(page)).toBeHidden();
    await expect(page.locator('[data-lp-restart]')).toBeEnabled();
    // Every result was read through focus.
    expect(await page.evaluate(() => window.announcements)).toEqual([]);
    expect(await page.evaluate(() => window.lpSaved)).toEqual({ feedback: `${FEEDBACK[lang]} Offer the credit.`, ticked: ['no_reason', 'no_alternative'], stage: 'done' });
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-lp-restart]')).toBeFocused();
  });

  test(`empty feedback gets a linked error at either check (${lang})`, async ({ page }) => {
    await open(page, lang);
    await observeStatus(page);
    const error = page.locator('[data-lp-error]');
    await check(page).click();
    await expect(error).toBeVisible();
    await expect(error).toHaveText(fill(lang, 'empty'));
    await expect(field(page)).toBeFocused();
    await expect(field(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(field(page)).toHaveAttribute('aria-describedby', 'example-error');
    await expect(page.locator('[data-lp-ticks]')).toBeHidden();
    await page.keyboard.type('Say why.');
    await expect(error).toBeHidden();
    await expect(field(page)).not.toHaveAttribute('aria-invalid', 'true');
    await expect(field(page)).not.toHaveAttribute('aria-describedby');
    await check(page).click();
    await field(page).fill('  ');
    await show(page).click();
    await expect(error).toHaveText(fill(lang, 'empty'));
    await expect(field(page)).toBeFocused();
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    // The linked error is read with the field, so nothing is announced.
    expect(await page.evaluate(() => window.announcements)).toEqual([]);
  });

  test(`320px, text spacing, reduced motion and axe at every stage (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, lang);
    await page.addStyleTag({ content: '.lp, .lp * { line-height:1.5 !important; letter-spacing:.12em !important; word-spacing:.16em !important } .lp p { margin-bottom:2em !important }' });
    const scan = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const card = page.locator('[data-lp-pattern]');
      expect(await card.evaluate(root => Math.max(0, ...[...root.querySelectorAll('*')].filter(el => el.getClientRects().length && !el.closest('.lp-visually-hidden')).map(el => el.getBoundingClientRect().right - root.getBoundingClientRect().right)))).toBeLessThanOrEqual(0);
      expect((await new AxeBuilder({ page }).include('[data-lp-pattern]').analyze()).violations).toEqual([]);
    };
    await scan();
    await check(page).click();
    await scan();
    await field(page).fill(FEEDBACK[lang]);
    await check(page).click();
    await box(page, 'vague_next_step').check();
    await scan();
    await show(page).click();
    await expect(page.locator('[data-lp-result]')).toBeVisible();
    await scan();
  });

  test(`without JavaScript the emails, the field and every explanation remain (${lang})`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    try {
      const page = await context.newPage();
      await page.goto(`/mark-colleague/${lang}.html`);
      for (const message of examples[lang].messages) await expect(page.getByRole('heading', { name: t(lang, message.heading) })).toBeVisible();
      await expect(field(page)).toBeEditable();
      await expect(check(page)).toBeHidden();
      await expect(page.locator('[data-lp-flow]')).toBeHidden();
      const fallback = page.locator('[data-lp-fallback]');
      await expect(fallback).not.toHaveAttribute('open', '');
      await expect(fallback.locator('summary')).toHaveText(t(lang, strings[lang].show));
      await fallback.locator('summary').focus();
      await page.keyboard.press('Enter');
      for (const issue of examples[lang].issues) await expect(fallback.getByText(t(lang, issue.explanation))).toBeVisible();
      await expect(fallback.locator('.lp-mark-colleague-mark')).toHaveCount(0);
      await expect(page.getByRole('status')).toBeEmpty();
    } finally { await context.close(); }
  });
}

test('the result sentence counts none and all', async ({ page }) => {
  await open(page);
  await finish(page, 'en', []);
  await expect(page.locator('[data-lp-summary]')).toHaveText('Your feedback raised none of the 3 issues.');
  await expect(page.locator('.lp-mark-colleague-mark')).toHaveText(['Not raised', 'Not raised', 'Not raised']);
  await page.locator('[data-lp-restart]').click();
  await finish(page, 'en', ['no_reason', 'no_alternative', 'vague_next_step']);
  await expect(page.locator('[data-lp-summary]')).toHaveText('Your feedback raised all 3 issues.');
  await expect(page.locator('.lp-mark-colleague-mark')).toHaveText(['Raised', 'Raised', 'Raised']);
});

test('start over clears the feedback and the ticks and announces it once', async ({ page }) => {
  await open(page);
  await finish(page, 'en', ['no_reason']);
  await observeStatus(page);
  await page.locator('[data-lp-restart]').click();
  await expect(page.getByRole('status')).toHaveText(strings.en.cleared);
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveValue('');
  await expect(field(page)).toBeEditable();
  await expect(check(page)).toBeVisible();
  await expect(page.locator('[data-lp-ticks]')).toBeHidden();
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  await expect(page.locator('[data-lp-restart]')).toBeHidden();
  await expect(page.locator('[data-lp-pattern] input:checked')).toHaveCount(0);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ feedback: '', ticked: [], stage: 'write' });
  expect(await page.evaluate(() => window.announcements)).toEqual([strings.en.cleared]);
  // The whole sequence runs again.
  await finish(page, 'en', ['vague_next_step']);
  await expect(page.locator('[data-lp-summary]')).toHaveText('Your feedback raised 1 of 3 issues.');
});

test('the emails and the result are set apart without a box inside the card', async ({ page }) => {
  await open(page);
  const boxed = scope => page.locator(scope).evaluateAll(roots => roots.flatMap(root => [root, ...root.querySelectorAll('*')])
    .filter(el => el.getClientRects().length && !el.matches('input, textarea, button, button *, svg, svg *, .lp-choice, .lp-choice *'))
    .filter(el => {
      const css = getComputedStyle(el);
      return parseFloat(css.borderLeftWidth) > 0 || parseFloat(css.borderRightWidth) > 0 || parseFloat(css.borderBottomWidth) > 0
        || css.backgroundColor !== 'rgba(0, 0, 0, 0)' || css.boxShadow !== 'none';
    }).map(el => el.outerHTML.slice(0, 80)));
  expect(await boxed('.lp-mark-colleague-mail')).toEqual([]);
  // A rule above each email separates the two messages and the field.
  await expect(page.locator('.lp-mark-colleague-mail').nth(1)).toHaveCSS('border-top-width', '1px');
  await finish(page, 'en', ['no_reason']);
  expect(await boxed('[data-lp-result]')).toEqual([]);
});

test('host state restores silently, ignores damaged values and survives destroy without a rebuild', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { feedback: 'Say why.', ticked: ['no_alternative'], stage: 'done' }; });
  await open(page);
  await expect(page.locator('[data-lp-summary]')).toHaveText('Your feedback raised 1 of 3 issues.');
  await expect(field(page)).toHaveValue('Say why.');
  await expect(field(page)).toHaveJSProperty('readOnly', true);
  await expect(page.locator('[data-lp-restart]')).toBeEnabled();
  await expect(page.getByRole('status')).toBeEmpty();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  const kept = await page.evaluate(() => {
    const before = document.querySelector('[data-lp-ticks]');
    window.lpInstances[0].destroy();
    return before === document.querySelector('[data-lp-ticks]') && before.isConnected;
  });
  expect(kept).toBe(true);
  await expect(field(page)).toHaveValue('');
  await expect(field(page)).toBeEditable();
  await expect(page.locator('[data-lp-flow]')).toBeHidden();
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
});

test('destroy stops saving, and a fresh enhance saves once per event', async ({ page }) => {
  await open(page);
  const writes = await page.evaluate(async content => {
    const { enhance } = await import('/patterns/mark-colleague/enhance.js');
    const { strings } = await import('/patterns/mark-colleague/strings.js');
    const root = document.querySelector('[data-lp-pattern]');
    const field = root.querySelector('textarea');
    const log = [];
    const state = { read: () => null, write: value => log.push(value) };
    window.lpInstances[0].destroy();
    enhance(root, { content, strings: strings.en, state }).destroy();
    // A destroyed instance hears nothing.
    field.value = 'Say why.';
    field.dispatchEvent(new Event('input'));
    root.querySelector('[data-lp-check]').click();
    const afterDestroy = log.length;
    enhance(root, { content, strings: strings.en, state });
    field.dispatchEvent(new Event('input'));
    root.querySelector('[data-lp-check]').click();
    const tick = root.querySelector('input[value="no_reason"]');
    tick.checked = true;
    tick.dispatchEvent(new Event('change'));
    root.querySelector('[data-lp-show]').click();
    return { afterDestroy, stages: log.map(value => value.stage), last: log.at(-1) };
  }, examples.en);
  expect(writes.afterDestroy).toBe(0);
  expect(writes.stages).toEqual(['write', 'compare', 'compare', 'done']);
  expect(writes.last).toEqual({ feedback: 'Say why.', ticked: ['no_reason'], stage: 'done' });
  await expect(page.locator('[data-lp-summary]')).toHaveText('Your feedback raised 1 of 3 issues.');
});

for (const [label, feedback] of [['blank', '   '], ['too long', 'x'.repeat(2001)]]) {
  test(`a finished state with ${label} feedback is not restored as finished`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = { feedback: value, ticked: ['no_reason'], stage: 'done' }; }, feedback);
    await open(page);
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    await expect(field(page)).toBeEditable();
    await expect(check(page)).toBeVisible();
  });
}

test('a saved checklist restores with its ticks and an open field', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { feedback: 'Say why.', ticked: ['no_reason'], stage: 'compare' }; });
  await open(page);
  await expect(page.locator('[data-lp-ticks]')).toBeVisible();
  await expect(box(page, 'no_reason')).toBeChecked();
  await expect(field(page)).toBeEditable();
  await expect(check(page)).toBeHidden();
  await expect(page.getByRole('status')).toBeEmpty();
});

test('destroy after the result restores the server render', async ({ page }) => {
  await open(page);
  await finish(page, 'en', ['no_reason']);
  const after = await page.evaluate(async content => {
    const { render } = await import('/patterns/mark-colleague/render.js');
    const { strings } = await import('/patterns/mark-colleague/strings.js');
    const root = document.querySelector('[data-lp-pattern]');
    window.lpInstances[0].destroy();
    const fresh = document.createElement('template');
    fresh.innerHTML = render(content, strings.en, { id: 'example', lang: 'en' });
    return { markup: root.outerHTML, server: fresh.content.firstElementChild.outerHTML, checked: root.querySelectorAll('input:checked').length, value: root.querySelector('textarea').value };
  }, examples.en);
  expect(after.markup).toBe(after.server);
  expect(after.checked).toBe(0);
  expect(after.value).toBe('');
});

for (const [label, seed] of [
  ['ticks before the checklist', { feedback: 'Say why.', ticked: ['no_reason'], stage: 'write' }],
  ['an unknown issue', { feedback: 'Say why.', ticked: ['tone'], stage: 'done' }],
  ['an unknown stage', { feedback: 'Say why.', ticked: [], stage: 'sent' }]
]) {
  test(`damaged saved state is ignored: ${label}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, seed);
    await open(page);
    await expect(field(page)).toHaveValue('');
    await expect(check(page)).toBeVisible();
    await expect(page.locator('[data-lp-ticks]')).toBeHidden();
    await expect(page.locator('[data-lp-result]')).toBeHidden();
  });
}

test('two copies on one page keep their own work', async ({ page }) => {
  await page.goto('/mark-colleague/two.html');
  await page.waitForFunction(() => window.lpReady);
  const cards = page.locator('[data-lp-pattern]');
  await expect(cards).toHaveCount(2);
  const ids = await page.locator('[data-lp-pattern] [id]').evaluateAll(nodes => nodes.map(node => node.id));
  expect(new Set(ids).size).toBe(ids.length);
  await cards.nth(0).locator('textarea').fill('Say why.');
  await cards.nth(0).locator('[data-lp-check]').click();
  await expect(cards.nth(0).locator('[data-lp-ticks]')).toBeVisible();
  await expect(cards.nth(1).locator('[data-lp-ticks]')).toBeHidden();
  await expect(cards.nth(1).locator('textarea')).toHaveValue('');
});

test('forced colours keep the marks and keyboard focus', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced-colour emulation is checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' });
  await open(page);
  await field(page).fill('Say why.');
  await page.keyboard.press('Tab');
  await expect(check(page)).toBeFocused();
  await expect(check(page)).toHaveCSS('outline-style', 'solid');
  await expect(check(page)).toHaveCSS('outline-width', '3px');
  await check(page).click();
  await box(page, 'no_reason').check();
  await show(page).click();
  const summary = page.locator('[data-lp-summary]');
  await expect(summary).toBeFocused();
  await expect(page.locator('.lp-mark-colleague-mark')).toHaveText(['Raised', 'Not raised', 'Not raised']);
  for (const mark of await page.locator('.lp-mark-colleague-mark svg').all()) await expect(mark).toBeVisible();
});
