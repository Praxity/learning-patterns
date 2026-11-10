import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { frenchTypography } from '../../lib/html.js';
import { strings } from '../../patterns/if-then-plan/strings.js';

const examples = Object.fromEntries(await Promise.all(['en', 'fr'].map(async lang => [lang,
  JSON.parse(await readFile(new URL(`../../patterns/if-then-plan/examples/${lang}.json`, import.meta.url), 'utf8'))
])));
// The calendar file is written in UTC, so the expected times need a fixed zone: 10:00 in Toronto on 12 November is 15:00 UTC.
test.use({ timezoneId: 'America/Toronto' });

const PLAN = {
  en: 'When Sam starts to describe a problem, I will ask one open question before I suggest anything.',
  fr: 'Quand Sam commence à décrire un problème, je vais poser une question ouverte avant de proposer quoi que ce soit.'
};
const SO_FAR = { en: 'When Sam starts to describe a problem, I will…', fr: 'Quand Sam commence à décrire un problème, je vais…' };
const t = (lang, key) => frenchTypography(strings[lang][key], lang);
const option = (page, id) => page.locator(`[data-lp-pattern] input[value="${id}"]`).first();
const step = (page, name) => page.locator(`[data-lp-step="${name}"]`).first();
const add = page => page.locator('[data-lp-add]').first();

async function open(page, lang = 'en') {
  await page.goto(`/if-then-plan/${lang}.html`);
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
// Choose with the keyboard, then move to the button and press it.
async function chooseAndAdd(page, id) {
  await option(page, id).focus();
  await page.keyboard.press('Space');
  await expect(option(page, id)).toBeChecked();
  await page.keyboard.press('Tab');
  await expect(add(page)).toBeFocused();
  await page.keyboard.press('Enter');
}
async function buildPlan(page) {
  await option(page, 'problem').check();
  await add(page).click();
  await option(page, 'open').check();
  await add(page).click();
  await expect(page.locator('[data-lp-result]')).toBeVisible();
}

for (const lang of ['en', 'fr']) {
  test(`keyboard journey: a vague moment, then a plan read as one sentence (${lang})`, async ({ page }) => {
    await open(page, lang);
    await observeStatus(page);
    const vague = examples[lang].when.options[2];
    await expect(step(page, 'when').locator('legend')).toHaveText(t(lang, 'whenStem'));
    await expect(step(page, 'will')).toBeHidden();
    await expect(page.locator('[data-lp-restart]')).toBeHidden();

    await chooseAndAdd(page, 'spare');
    const announced = frenchTypography(strings[lang].vagueStatus.replace('{reason}', vague.vague), lang);
    await expect(page.getByRole('status')).toHaveText(announced);
    await expect(add(page)).toBeFocused();
    const row = step(page, 'when').locator('.lp-choice[data-lp-vague]');
    await expect(row).toHaveCount(1);
    await expect(row.locator('.lp-choice-mark')).toHaveText(t(lang, 'markVague'));
    await expect(row.locator('.lp-choice-mark svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(row.locator('[data-lp-reason]')).toHaveText(frenchTypography(vague.vague, lang));
    await expect(option(page, 'spare')).toBeDisabled();
    await expect(option(page, 'spare')).not.toBeChecked();
    for (const id of ['problem', 'asks', 'quiet']) await expect(option(page, id)).toBeEnabled();
    // Plan feedback is not an answer mark: no Correct or Incorrect anywhere.
    await expect(page.locator('[data-lp-mark]')).toHaveCount(0);
    await expect(step(page, 'will')).toBeHidden();

    await chooseAndAdd(page, 'problem');
    await expect(step(page, 'when')).toBeHidden();
    await expect(step(page, 'will').locator('legend')).toHaveText(frenchTypography(SO_FAR[lang], lang));
    await expect(page.getByRole('group', { name: frenchTypography(SO_FAR[lang], lang) })).toBeVisible();
    await expect(option(page, 'open')).toBeFocused();
    await expect(page.getByRole('status')).toBeEmpty();
    await expect(page.locator('[data-lp-restart]')).toBeVisible();

    await chooseAndAdd(page, 'open');
    await expect(page.locator('[data-lp-plan]')).toBeFocused();
    // The focused block holds the label and the sentence, so both are read.
    await expect(page.locator('[data-lp-plan]')).toContainText(t(lang, 'planLabel'));
    await expect(page.locator('[data-lp-plan-text]')).toHaveText(frenchTypography(PLAN[lang], lang));
    await expect(page.locator('[data-lp-steps]')).toBeHidden();
    await expect(add(page)).toBeHidden();
    await expect(page.locator('[data-lp-calendar]')).toBeDisabled();
    await expect(page.getByRole('status')).toBeEmpty();
    // The two accepted steps are read through focus, so only the vague choice was announced.
    expect(await page.evaluate(() => window.announcements)).toEqual([announced]);
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-lp-start]')).toBeFocused();
    expect(await page.evaluate(() => window.lpSaved)).toEqual({ when: 'problem', will: 'open', start: '' });
  });

  test(`pressing the button with nothing chosen shows a linked error (${lang})`, async ({ page }) => {
    await open(page, lang);
    await add(page).click();
    const error = step(page, 'when').locator('[data-lp-error]');
    await expect(error).toBeVisible();
    await expect(error).toHaveText(t(lang, 'chooseWhen'));
    await expect(page.getByRole('status')).toHaveText(t(lang, 'chooseWhen'));
    await expect(step(page, 'when')).toHaveAttribute('aria-describedby', 'example-when-hint example-when-error');
    await expect(option(page, 'problem')).toHaveAttribute('aria-invalid', 'true');
    await expect(step(page, 'will')).toBeHidden();
    await option(page, 'problem').check();
    await expect(error).toBeHidden();
    await expect(step(page, 'when')).toHaveAttribute('aria-describedby', 'example-when-hint');
    await expect(option(page, 'problem')).not.toHaveAttribute('aria-invalid', 'true');
    await add(page).click();
    await add(page).click();
    await expect(step(page, 'will').locator('[data-lp-error]')).toHaveText(t(lang, 'chooseWill'));
    await expect(page.getByRole('status')).toHaveText(t(lang, 'chooseWill'));
  });

  test(`the calendar button waits for a future time, then downloads the plan (${lang})`, async ({ page }) => {
    await open(page, lang);
    await buildPlan(page);
    await observeStatus(page);
    const field = page.locator('[data-lp-start]');
    const button = page.locator('[data-lp-calendar]');
    const problem = page.locator('[data-lp-start-error]');
    await expect(page.getByLabel(frenchTypography(examples[lang].dateLabel, lang))).toHaveAttribute('type', 'datetime-local');
    await expect(field).toHaveAttribute('aria-describedby', 'example-start-hint');
    await expect(button).toBeDisabled();

    await field.fill('2020-01-01T10:00');
    await expect(button).toBeDisabled();
    await expect(problem).toBeVisible();
    await expect(problem).toHaveText(t(lang, 'past'));
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAttribute('aria-describedby', 'example-start-hint example-start-error');
    await expect(page.getByRole('status')).toHaveText(t(lang, 'past'));

    await field.fill('2030-11-12T10:00');
    await expect(problem).toBeHidden();
    await expect(field).not.toHaveAttribute('aria-invalid', 'true');
    await expect(button).toBeEnabled();
    expect(await page.evaluate(() => window.lpSaved)).toEqual({ when: 'problem', will: 'open', start: '2030-11-12T10:00' });

    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    expect(download.suggestedFilename()).toBe(strings[lang].fileName);
    const file = await readFile(await download.path(), 'utf8');
    expect(file.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(file.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true);
    const lines = file.replaceAll('\r\n ', '').split('\r\n');
    // The entry is the ten minutes before the chosen time.
    expect(lines).toContain('DTSTART:20301112T145000Z');
    expect(lines).toContain('DTEND:20301112T150000Z');
    expect(lines).toContain(`SUMMARY:${frenchTypography(PLAN[lang], lang).replaceAll(',', '\\,')}`);
    expect(lines.find(line => line.startsWith('DESCRIPTION:') && line.includes('\\n\\n'))).toContain(frenchTypography(examples[lang].title, lang));
    await expect(page.locator('[data-lp-downloaded]')).toBeVisible();
    await expect(page.locator('[data-lp-downloaded]')).toHaveText(t(lang, 'downloaded'));
    await expect(page.getByRole('status')).toHaveText(t(lang, 'downloaded'));
    expect(await page.evaluate(() => window.announcements)).toEqual([t(lang, 'past'), t(lang, 'downloaded')]);
    // Changing the time withdraws the note about the earlier file.
    await field.fill('2030-11-13T09:00');
    await expect(page.locator('[data-lp-downloaded]')).toBeHidden();
  });

  test(`start over clears the plan, the vague marks and the date (${lang})`, async ({ page }) => {
    await open(page, lang);
    await option(page, 'spare').check();
    await add(page).click();
    await buildPlan(page);
    await page.locator('[data-lp-start]').fill('2030-11-12T10:00');
    await page.locator('[data-lp-restart]').click();
    await expect(page.getByRole('status')).toHaveText(t(lang, 'cleared'));
    await expect(step(page, 'when')).toBeVisible();
    await expect(step(page, 'will')).toBeHidden();
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    await expect(page.locator('[data-lp-restart]')).toBeHidden();
    await expect(page.locator('[data-lp-vague], [data-lp-reason], .lp-choice-mark')).toHaveCount(0);
    await expect(page.locator('[data-lp-pattern] input[type="radio"]:checked')).toHaveCount(0);
    await expect(option(page, 'spare')).toBeEnabled();
    await expect(option(page, 'problem')).toBeFocused();
    await expect(page.locator('[data-lp-start]')).toHaveValue('');
    expect(await page.evaluate(() => window.lpSaved)).toEqual({ when: null, will: null, start: '' });
    await option(page, 'quiet').check();
    await add(page).click();
    await expect(step(page, 'will').locator('legend')).toHaveText(frenchTypography(strings[lang].soFar.replace('{when}', examples[lang].when.options[3].text), lang));
  });

  test(`without JavaScript both lists, the reasons and the sentence to copy remain (${lang})`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    try {
      const page = await context.newPage();
      await page.goto(`/if-then-plan/${lang}.html`);
      await expect(page.locator('legend')).toHaveText([t(lang, 'whenStem'), t(lang, 'willStem')]);
      for (const name of ['when', 'will']) {
        await expect(step(page, name)).toBeVisible();
        for (const item of examples[lang][name].options) await expect(step(page, name).locator('.lp-choice').filter({ hasText: frenchTypography(item.text, lang) })).toBeVisible();
      }
      await expect(add(page)).toBeHidden();
      await expect(page.locator('[data-lp-result]')).toBeHidden();
      await expect(page.locator('[data-lp-restart]')).toBeHidden();
      const fallback = page.locator('[data-lp-fallback]');
      await expect(fallback).toBeVisible();
      await expect(fallback).toContainText(t(lang, 'noScript'));
      await expect(fallback.locator('.lp-stem')).toHaveText(frenchTypography(strings[lang].soFar.replace('{when}', '…'), lang));
      await expect(fallback.locator('details')).not.toHaveAttribute('open', '');
      await fallback.locator('summary').focus(); await page.keyboard.press('Enter');
      for (const item of [examples[lang].when.options[2], examples[lang].will.options[1]]) {
        await expect(fallback.locator('li').filter({ hasText: frenchTypography(item.vague, lang) })).toBeVisible();
      }
      await expect(page.getByRole('status')).toBeEmpty();
    } finally { await context.close(); }
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
    await add(page).click();
    await scan();
    await option(page, 'spare').check();
    await add(page).click();
    await expect(step(page, 'when').locator('[data-lp-vague]')).toHaveCount(1);
    await scan();
    await option(page, 'problem').check();
    await add(page).click();
    await option(page, 'patient').check();
    await add(page).click();
    await scan();
    await option(page, 'open').check();
    await add(page).click();
    await expect(page.locator('[data-lp-result]')).toBeVisible();
    await scan();
    await page.locator('[data-lp-start]').fill('2020-01-01T10:00');
    await expect(page.locator('[data-lp-start-error]')).toBeVisible();
    await scan();
  });
}

test('the plan and the steps are set apart without a box inside the card', async ({ page }) => {
  await open(page);
  const boxed = scope => page.locator(scope).evaluate(root => [root, ...root.querySelectorAll('*')]
    .filter(el => el.getClientRects().length && !el.matches('input, button, button *, svg, svg *, .lp-choice, .lp-choice *'))
    .filter(el => {
      const css = getComputedStyle(el);
      return parseFloat(css.borderLeftWidth) > 0 || parseFloat(css.borderRightWidth) > 0 || parseFloat(css.borderBottomWidth) > 0
        || css.backgroundColor !== 'rgba(0, 0, 0, 0)' || css.boxShadow !== 'none';
    }).map(el => el.outerHTML.slice(0, 80)));
  expect(await boxed('[data-lp-steps]')).toEqual([]);
  await buildPlan(page);
  expect(await boxed('[data-lp-result]')).toEqual([]);
  // A rule and larger type do the separating.
  await expect(page.locator('[data-lp-result]')).toHaveCSS('border-top-width', '1px');
  await expect(page.locator('[data-lp-plan-text]')).toHaveCSS('font-size', '21px');
  await expect(page.locator('[data-lp-plan-text]')).toHaveCSS('font-weight', '600');
});

test('the second step keeps the sentence where the first step had it', async ({ page }) => {
  await open(page);
  const top = name => step(page, name).locator('legend').evaluate(el => el.getBoundingClientRect().top + scrollY);
  const first = await top('when');
  await option(page, 'problem').check();
  await add(page).click();
  expect(Math.abs(await top('will') - first)).toBeLessThanOrEqual(1);
});

test('host state restores silently, ignores damaged values and survives destroy without a rebuild', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { when: 'asks', will: 'tried', start: '2030-11-12T10:00' }; });
  await open(page);
  await expect(page.locator('[data-lp-plan-text]')).toHaveText('When Sam asks me what to do, I will ask what Sam has already tried.');
  await expect(page.locator('[data-lp-start]')).toHaveValue('2030-11-12T10:00');
  await expect(page.locator('[data-lp-calendar]')).toBeEnabled();
  await expect(page.getByRole('status')).toBeEmpty();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  const kept = await page.evaluate(() => {
    const before = document.querySelector('[data-lp-step="when"]');
    window.lpInstances[0].destroy();
    return before === document.querySelector('[data-lp-step="when"]') && before.isConnected;
  });
  expect(kept).toBe(true);
  await expect(step(page, 'when')).toBeVisible();
  await expect(step(page, 'will')).toBeVisible();
  await expect(step(page, 'will').locator('legend')).toHaveText(strings.en.willStem);
  await expect(add(page)).toBeHidden();
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
});

for (const [label, seed] of [
  ['a vague moment', { when: 'spare', will: null, start: '' }],
  ['an action without a moment', { when: null, will: 'open', start: '' }],
  ['a date without a plan', { when: 'asks', will: null, start: '2030-11-12T10:00' }]
]) {
  test(`damaged saved state is ignored: ${label}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, seed);
    await open(page);
    await expect(step(page, 'when')).toBeVisible();
    await expect(step(page, 'will')).toBeHidden();
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    await expect(page.locator('[data-lp-pattern] input[type="radio"]:checked')).toHaveCount(0);
  });
}

test('two plans on one page keep their own choices', async ({ page }) => {
  await page.goto('/if-then-plan/two.html');
  await page.waitForFunction(() => window.lpReady);
  const cards = page.locator('[data-lp-pattern]');
  await expect(cards).toHaveCount(2);
  const ids = await page.locator('[data-lp-pattern] [id]').evaluateAll(nodes => nodes.map(node => node.id));
  expect(new Set(ids).size).toBe(ids.length);
  await cards.nth(0).locator('input[value="problem"]').check();
  await cards.nth(1).locator('input[value="quiet"]').check();
  await expect(cards.nth(0).locator('input[value="problem"]')).toBeChecked();
  await cards.nth(0).locator('[data-lp-add]').click();
  await expect(cards.nth(0).locator('[data-lp-step="will"]')).toBeVisible();
  await expect(cards.nth(1).locator('[data-lp-step="will"]')).toBeHidden();
  await expect(cards.nth(1).locator('input[value="quiet"]')).toBeChecked();
});

test('forced colours keep the vague mark, its border and keyboard focus', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced-colour emulation is checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' });
  await open(page);
  await chooseAndAdd(page, 'spare');
  const row = step(page, 'when').locator('.lp-choice[data-lp-vague]');
  await expect(row).toHaveCSS('border-top-style', 'double');
  await expect(row).toHaveCSS('border-top-width', '3px');
  await expect(row.locator('.lp-choice-mark')).toBeVisible();
  await expect(add(page)).toBeFocused();
  await expect(add(page)).toHaveCSS('outline-style', 'solid');
  await expect(add(page)).toHaveCSS('outline-width', '3px');
});
