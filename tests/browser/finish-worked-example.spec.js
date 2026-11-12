import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { frenchTypography } from '../../lib/html.js';
import { expectChoiceMarks } from './choice-marks.js';

const english = JSON.parse(await readFile(new URL('../../patterns/finish-worked-example/examples/en.json', import.meta.url), 'utf8'));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const TEXT_SPACING = '.lp, .lp * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } .lp p { margin-bottom: 2em !important; }';
const EMPTY = [[null, null, null], [null, null, null], [null, null, null]];
// Case 2 answered, case 3 open on its first step.
const AT_CASE_3 = { at: 2, picks: [[null, null, null], [null, null, 1], [null, null, null]] };

async function open(page, lang = 'en', saved) {
  if (saved) await page.addInitScript(value => { window.lpSeed = value; }, saved);
  await page.goto(`/finish-worked-example/${lang}.html`);
  await page.waitForFunction(() => window.lpReady);
}

// Replace the demo with other content through the public render and enhance interface.
async function mount(page, content, { lang = 'en', width = 1280 } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await open(page, lang);
  await page.evaluate(async ({ content, lang }) => {
    const { render } = await import('/patterns/finish-worked-example/render.js');
    const { strings } = await import('/patterns/finish-worked-example/strings.js');
    const { enhance } = await import('/patterns/finish-worked-example/enhance.js');
    window.lpInstances.forEach(instance => instance.destroy());
    document.querySelector('main').innerHTML = render(content, strings[lang], { id: 'custom', lang });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings[lang] });
  }, { content, lang });
}

async function observeStatus(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    const status = document.querySelector('[role="status"]');
    new MutationObserver(() => { if (status.textContent) window.lpAnnouncements.push(status.textContent); })
      .observe(status, { childList: true, characterData: true, subtree: true });
  });
}

const panel = (page, c) => page.locator('[data-lp-case]').nth(c);
const step = (page, c, s) => panel(page, c).locator('[data-lp-step]').nth(s);
const axe = async page => (await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations;

/** Choose an option and check the step. By keyboard, focus starts just before the step. */
async function answerStep(page, c, s, option, keyboard = false) {
  const item = step(page, c, s), radios = item.getByRole('radio');
  if (keyboard) {
    await page.keyboard.press('Tab');
    await expect(radios.first()).toBeFocused();
    await page.keyboard.press('Space');
    for (let i = 0; i < option; i++) await page.keyboard.press('ArrowDown');
    await expect(radios.nth(option)).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(item.locator('[data-lp-check]')).toBeFocused();
    await page.keyboard.press('Enter');
  } else {
    await radios.nth(option).check();
    await item.locator('[data-lp-check]').click();
  }
  await expect(item.locator('[data-lp-feedback]')).toBeFocused();
}

async function overflowing(page) {
  return page.evaluate(() => {
    const clipped = [...document.querySelectorAll('.lp :is(label, legend, button, dt, dd, p, h2, h3, summary, .lp-choice-mark)')].filter(el => {
      if (!el.getClientRects().length || el.closest('.lp-visually-hidden')) return false;
      const rect = el.getBoundingClientRect();
      return rect.left < 0 || rect.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 2;
    }).map(el => el.outerHTML.slice(0, 120));
    return { page: document.documentElement.scrollWidth - innerWidth, clipped };
  });
}

test('opens on the fully worked case: nothing to answer, every step labelled, one way on', async ({ page }) => {
  await open(page); await observeStatus(page);
  await expect(page.locator('[data-lp-case]:visible')).toHaveCount(1);
  await expect(page.locator('h2.lp-heading')).toHaveText('Check a supplier invoice before you pay it');
  await expect(panel(page, 0).locator('[data-lp-case-heading]')).toHaveText('Case 1 of 3. All 3 steps are done for you. Read the reason for each one.');
  await expect(panel(page, 0).locator('dt')).toHaveText(['Purchase order', 'Invoice', 'Delivery record']);
  await expect(panel(page, 0).getByRole('listitem')).toHaveCount(3);
  await expect(step(page, 0, 0)).toHaveText('Step 1, Done for you Does the invoice match the order? It matches Same items, quantity and price as the order. Your company holds an invoice only when it differs from the order.');
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('button')).toHaveText(['Next case']);
  await expect(page.locator('details:visible')).toHaveCount(0);
  await expect(page.locator('[role="status"]')).toHaveText('');
  expect(await page.evaluate(() => [document.activeElement === document.body, window.lpSaved])).toEqual([true, undefined]);
  expect(await axe(page)).toEqual([]);
});

for (const keyboard of [false, true]) test(`whole journey by ${keyboard ? 'keyboard' : 'pointer'}: a wrong step shows the answer and never blocks`, async ({ page, browserName }) => {
  await open(page); await observeStatus(page);
  const next = panel(page, 0).locator('[data-lp-next]');
  if (keyboard) { await next.focus(); await page.keyboard.press('Enter'); } else await next.click();

  // Case 2: two steps done, the last one is the learner's.
  const second = panel(page, 1);
  await expect(second.locator('[data-lp-case-heading]')).toBeFocused();
  await expect(second.locator('[data-lp-case-heading]')).toHaveText('Case 2 of 3. You do 1 of the 3 steps.');
  await expect(page.locator('[data-lp-case]:visible')).toHaveCount(1);
  await expect(second.locator('.lp-finish-worked-example-tag')).toHaveText(['Done for you', 'Done for you', 'Your step']);
  await expect(second.getByRole('group', { name: /^Step 3\s*,\s*Your step\s*,\s*What do you do\?$/ })).toBeVisible();
  await expect(second.getByRole('radio')).toHaveCount(3);
  await expect(second.getByRole('button')).toHaveText(['Check step 3', 'Previous case']);
  // The learner's steps carry the accent label; the worked ones stay quiet.
  expect(await second.locator('.lp-finish-worked-example-tag').evaluateAll(tags => tags.map(tag => getComputedStyle(tag).backgroundColor))).toEqual(['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'rgb(238, 242, 253)']);

  // Checking with no choice explains what is missing at the step.
  const third = step(page, 1, 2), check = third.locator('[data-lp-check]');
  await check.click();
  const error = third.locator('[data-lp-question-error]');
  await expect(error).toHaveText('Choose an answer for this step.');
  await expect(third.getByRole('radio').first()).toBeFocused();
  for (const radio of await third.getByRole('radio').all()) {
    await expect(radio).toHaveAttribute('aria-invalid', 'true');
    await expect(radio).toHaveAttribute('aria-describedby', await error.getAttribute('id'));
  }
  expect(await axe(page)).toEqual([]);
  expect(await page.evaluate(() => window.lpSaved.picks)).toEqual(EMPTY);

  // A wrong answer: marked, the correct one shown, the reason beside it, and the next case opens.
  if (keyboard) {
    await page.keyboard.press('Space');
    await expect(error).toBeHidden();
    await expect(third.locator('[aria-invalid], [aria-describedby]')).toHaveCount(0);
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
    await expect(third.locator('[data-lp-feedback]')).toBeFocused();
  } else {
    await third.getByRole('radio').first().check();
    await expect(error).toBeHidden();
    await check.click();
  }
  const feedback = third.locator('[data-lp-feedback]');
  await expect(feedback).toBeFocused();
  await expect(feedback).toHaveText('Incorrect. Correct answer: Pay only for what arrived. The invoice matches the order, so you do not hold it. You pay $320 for the 8 cartridges that arrived.');
  await expect(feedback.locator('.lp-visually-hidden')).toHaveText('Incorrect. Correct answer: Pay only for what arrived.');
  if (keyboard && browserName === 'chromium') expect(await feedback.evaluate(el => getComputedStyle(el).outlineWidth)).toBe('3px');
  await expect(third.locator('.lp-choice').nth(0)).toHaveAttribute('data-lp-mark', 'wrong');
  await expect(third.locator('.lp-choice').nth(1)).toHaveAttribute('data-lp-mark', 'missed');
  await expect(third.locator('[data-lp-mark]')).toHaveCount(2);
  await expect(third.locator('.lp-choice-mark')).toHaveText(['Incorrect', 'Correct answer']);
  await expect(third.locator('input:disabled')).toHaveCount(3);
  await expect(check).toBeHidden();
  await expectChoiceMarks(page);
  expect(await axe(page)).toEqual([]);
  // The focused reason is the only announcement for a step.
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ at: 1, picks: [[null, null, null], [null, null, 0], [null, null, null]] });

  const onward = second.locator('[data-lp-next]');
  await expect(onward).toBeVisible();
  if (keyboard) { await page.keyboard.press('Tab'); await expect(onward).toBeFocused(); await page.keyboard.press('Enter'); } else await onward.click();

  // Case 3: every step is the learner's, one at a time.
  const last = panel(page, 2);
  await expect(last.locator('[data-lp-case-heading]')).toBeFocused();
  await expect(last.locator('[data-lp-case-heading]')).toHaveText('Case 3 of 3. You do all 3 steps.');
  await expect(last.locator('.lp-finish-worked-example-tag')).toHaveText(['Your step', 'Your step', 'Your step']);
  await expect(last.locator('legend:visible')).toHaveCount(3);
  await expect(last.locator('.lp-choice:visible')).toHaveCount(3);
  await expect(last.getByRole('button')).toHaveText(['Check step 1', 'Previous case']);
  await answerStep(page, 2, 0, 1, keyboard);
  await expect(step(page, 2, 0).locator('[data-lp-feedback]')).toHaveText('Correct. The invoice charges $240 a desk. The order says $220.');
  await expect(step(page, 2, 0).locator('[data-lp-mark]')).toHaveCount(1);
  await expect(step(page, 2, 0).locator('.lp-choice').nth(1)).toHaveAttribute('data-lp-mark', 'correct');
  await expect(last.locator('.lp-choice:visible')).toHaveCount(5);
  await expect(last.getByRole('button')).toHaveText(['Check step 2', 'Previous case']);
  await answerStep(page, 2, 1, 0, keyboard);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  await expect(last.locator('[data-lp-result]')).toBeHidden();
  await answerStep(page, 2, 2, 2, keyboard);

  // The end: one sentence, announced once, and the answers are locked.
  await expect(last.locator('[data-lp-result]')).toHaveText('You got 3 of your 4 steps right.');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['You got 3 of your 4 steps right.']);
  await expect(last.getByRole('button')).toHaveText(['Start over', 'Previous case']);
  await expect(last.locator('input:disabled')).toHaveCount(8);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ at: 2, picks: [[null, null, null], [null, null, 0], [1, 0, 2]] });
  await expectChoiceMarks(page);
  expect(await axe(page)).toEqual([]);

  // Earlier cases stay open for reference, with what the learner did.
  if (keyboard) { await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await expect(last.locator('[data-lp-back]')).toBeFocused(); await page.keyboard.press('Enter'); } else await last.locator('[data-lp-back]').click();
  await expect(second.locator('[data-lp-case-heading]')).toBeFocused();
  await expect(third.locator('.lp-choice-mark')).toHaveText(['Incorrect', 'Correct answer']);
  await expect(page.locator('[role="status"]')).toHaveText('');
  await second.locator('[data-lp-back]').click();
  await expect(panel(page, 0).locator('[data-lp-case-heading]')).toBeFocused();
  await expect(panel(page, 0).getByRole('button')).toHaveText(['Next case']);
  expect(await page.evaluate(() => window.lpSaved.at)).toBe(0);
  await panel(page, 0).locator('[data-lp-next]').click();
  await second.locator('[data-lp-next]').click();

  // Start over clears every answer and returns to the worked case.
  const restart = last.locator('[data-lp-restart]');
  if (keyboard) { await restart.focus(); await page.keyboard.press('Enter'); } else await restart.click();
  await expect(panel(page, 0).locator('[data-lp-case-heading]')).toBeFocused();
  await expect(page.locator('[data-lp-case]:visible')).toHaveCount(1);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ at: 0, picks: EMPTY });
  await expect(page.locator('[data-lp-mark], input:checked, input:disabled')).toHaveCount(0);
  await expect(page.locator('[role="status"]')).toHaveText('');
  await panel(page, 0).locator('[data-lp-next]').click();
  await expect(second.locator('[data-lp-next]')).toBeHidden();
  await expect(third.locator('[data-lp-feedback]')).toBeHidden();
  await expect(check).toBeVisible();
  await answerStep(page, 1, 2, 1);
  await expect(third.locator('[data-lp-feedback]')).toHaveText('Correct. The invoice matches the order, so you do not hold it. You pay $320 for the 8 cartridges that arrived.');
});

test('French journey uses French labels, feedback, marks and typography', async ({ page }) => {
  await open(page, 'fr'); await observeStatus(page);
  const fr = text => frenchTypography(text, 'fr');
  await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', 'fr');
  await expect(panel(page, 0).locator('[data-lp-case-heading]')).toHaveText('Cas 1 sur 3. Les 3 étapes sont déjà faites. Lisez la raison de chacune.');
  await expect(panel(page, 0).locator('dd').nth(1)).toHaveText(fr('20 chaises de bureau à 85 $ chacune, total 1 700 $'), { useInnerText: true });
  await panel(page, 0).getByRole('button', { name: 'Cas suivant' }).click();
  await expect(panel(page, 1).locator('[data-lp-case-heading]')).toHaveText('Cas 2 sur 3. Vous faites 1 des 3 étapes.');
  await expect(panel(page, 1).locator('.lp-finish-worked-example-tag')).toHaveText(['Déjà faite', 'Déjà faite', 'Votre étape']);
  await expect(panel(page, 1).getByRole('group', { name: /^Étape 3\s*,\s*Votre étape\s*,\s*Que devez-vous faire\s*\?$/ })).toBeVisible();
  await panel(page, 1).getByRole('button', { name: 'Vérifier l’étape 3' }).click();
  await expect(step(page, 1, 2).locator('[data-lp-question-error]')).toHaveText('Choisissez une réponse pour cette étape.');
  await answerStep(page, 1, 2, 2);
  expect(await step(page, 1, 2).locator('[data-lp-feedback]').evaluate(el => el.textContent)).toBe(fr('Incorrect. Bonne réponse : Payer seulement ce qui est arrivé. La facture correspond au bon de commande, donc vous ne la retenez pas. Vous payez 320 $ pour les 8 cartouches arrivées.'));
  await expect(step(page, 1, 2).locator('.lp-choice-mark')).toHaveText(['Bonne réponse', 'Incorrect']);
  await expectChoiceMarks(page);
  await panel(page, 1).getByRole('button', { name: 'Cas suivant' }).click();
  await expect(panel(page, 2).locator('[data-lp-case-heading]')).toHaveText('Cas 3 sur 3. Vous faites les 3 étapes.');
  await expect(panel(page, 2).getByRole('button')).toHaveText(['Vérifier l’étape 1', 'Cas précédent']);
  for (const [s, option] of [1, 0, 2].entries()) await answerStep(page, 2, s, option);
  await expect(step(page, 2, 0).locator('[data-lp-feedback] .lp-visually-hidden')).toHaveText('Correct.');
  await expect(panel(page, 2).locator('[data-lp-result]')).toHaveText('Vous avez réussi 3 de vos 4 étapes.');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Vous avez réussi 3 de vos 4 étapes.']);
  await expect(panel(page, 2).getByRole('button')).toHaveText(['Recommencer', 'Cas précédent']);
  expect(await axe(page)).toEqual([]);
});

test('saved progress restores silently: marks, the open step and no focus move', async ({ page }) => {
  await open(page, 'en', { at: 2, picks: [[null, null, null], [null, null, 1], [0, null, null]] });
  await observeStatus(page);
  await expect(page.locator('[data-lp-case]:visible')).toHaveCount(1);
  await expect(panel(page, 2)).toBeVisible();
  await expect(step(page, 2, 0).locator('.lp-choice').nth(0)).toHaveAttribute('data-lp-mark', 'wrong');
  await expect(step(page, 2, 0).locator('.lp-choice').nth(1)).toHaveAttribute('data-lp-mark', 'missed');
  await expect(step(page, 2, 0).locator('[data-lp-feedback]')).toHaveText('Incorrect. Correct answer: The price is different. The invoice charges $240 a desk. The order says $220.');
  await expect(step(page, 2, 0).locator('input:disabled')).toHaveCount(3);
  await expect(panel(page, 2).getByRole('button')).toHaveText(['Check step 2', 'Previous case']);
  await expect(panel(page, 2).locator('.lp-choice:visible')).toHaveCount(5);
  expect(await page.evaluate(() => [document.activeElement === document.body, window.lpAnnouncements, document.querySelector('[role="status"]').textContent])).toEqual([true, [], '']);
  await panel(page, 2).locator('[data-lp-back]').click();
  await expect(step(page, 1, 2).locator('.lp-choice').nth(1)).toHaveAttribute('data-lp-mark', 'correct');
  await expect(panel(page, 1).locator('[data-lp-next]')).toBeVisible();
});

test('a finished activity restores with its result and no announcement', async ({ page }) => {
  await open(page, 'en', { at: 2, picks: [[null, null, null], [null, null, 1], [1, 0, 2]] });
  await expect(panel(page, 2).locator('[data-lp-result]')).toHaveText('You got 4 of your 4 steps right.');
  await expect(panel(page, 2).getByRole('button')).toHaveText(['Start over', 'Previous case']);
  await expect(page.locator('[role="status"]')).toHaveText('');
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
});

for (const [name, saved] of [
  ['a case not reached', { at: 2, picks: EMPTY }],
  ['an answer to a worked step', { at: 0, picks: [[0, null, null], [null, null, null], [null, null, null]] }],
  ['a skipped step', { at: 2, picks: [[null, null, null], [null, null, 1], [null, 0, null]] }],
  ['a malformed value', 'yes']
]) test(`invalid saved state is ignored: ${name}`, async ({ page }) => {
  await open(page, 'en', saved);
  await expect(panel(page, 0)).toBeVisible();
  await expect(page.locator('[data-lp-case]:visible')).toHaveCount(1);
  await expect(page.locator('[data-lp-mark], input:checked')).toHaveCount(0);
});

test('a worked step after one of the learner’s waits until that step is checked', async ({ page }) => {
  const forward = structuredClone(english);
  forward.cases[1].steps.forEach((item, s) => { item.worked = s !== 0; });
  await mount(page, forward);
  await panel(page, 0).locator('[data-lp-next]').click();
  await expect(panel(page, 1).locator('.lp-finish-worked-example-tag')).toHaveText(['Your step', 'Done for you', 'Done for you']);
  await expect(panel(page, 1).locator('[data-lp-body]:visible')).toHaveCount(0);
  // Rendered text only: the hidden result must not show.
  await expect(step(page, 1, 1)).toHaveText(/^Step 2\s*,\s*Done for you\s+Did everything arrive\?$/, { useInnerText: true });
  await expect(panel(page, 1).locator('[data-lp-next]')).toBeHidden();
  await answerStep(page, 1, 0, 0);
  await expect(panel(page, 1).locator('[data-lp-body]:visible')).toHaveCount(2);
  await expect(step(page, 1, 1)).toContainText('Some items are missing Only 8 of the 10 cartridges arrived.');
  await expect(panel(page, 1).locator('[data-lp-next]')).toBeVisible();
});

test('without JavaScript every case is readable and each case’s answers open on request', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 320, height: 900 } });
  const page = await context.newPage();
  for (const lang of ['en', 'fr']) {
    await page.goto(`/finish-worked-example/${lang}.html`);
    await expect(page.locator('[data-lp-case]:visible')).toHaveCount(3);
    await expect(page.locator('button:visible')).toHaveCount(0);
    await expect(page.locator('details:visible')).toHaveCount(2);
    await expect(page.locator('[data-lp-feedback]:visible, [data-lp-result]:visible')).toHaveCount(0);
    await page.locator('[data-lp-case]').nth(1).getByRole('radio').nth(1).check();
    await page.locator('summary').first().click();
    await expect(page.locator('details').first().locator('li')).toHaveText(lang === 'en'
      ? ['Step 3: Pay only for what arrived The invoice matches the order, so you do not hold it. You pay $320 for the 8 cartridges that arrived.']
      : [frenchTypography('Étape 3 : Payer seulement ce qui est arrivé La facture correspond au bon de commande, donc vous ne la retenez pas. Vous payez 320 $ pour les 8 cartouches arrivées.', 'fr')], { useInnerText: true });
    await page.locator('summary').nth(1).click();
    await expect(page.locator('details').nth(1).locator('li')).toHaveCount(3);
    // axe needs page scripts, so it checks this same markup after destroy() in the last test.
    expect(await overflowing(page)).toEqual({ page: 0, clipped: [] });
  }
  await context.close();
});

for (const lang of ['en', 'fr']) for (const textSpacing of [false, true]) {
  test(`400% reflow keeps every case inside the card (${lang}, text spacing ${textSpacing})`, async ({ page }) => {
    // 320 CSS px represents reflow at 400% zoom from a 1280px viewport.
    await page.setViewportSize({ width: 320, height: 900 });
    await open(page, lang, AT_CASE_3);
    if (textSpacing) await page.addStyleTag({ content: TEXT_SPACING });
    // Wrong answers show both marks, the longest state of a step.
    for (const [s, option] of [0, 1, 0].entries()) await answerStep(page, 2, s, option);
    await expect(panel(page, 2).locator('[data-lp-result]')).toBeVisible();
    expect(await overflowing(page)).toEqual({ page: 0, clipped: [] });
    // Facts stack under their labels when the card is narrow.
    const fact = await panel(page, 2).locator('.lp-finish-worked-example-facts > div').first().evaluate(row => {
      const [label, value] = [row.querySelector('dt'), row.querySelector('dd')].map(el => el.getBoundingClientRect());
      return value.top >= label.bottom - 1;
    });
    expect(fact).toBe(true);
    for (const c of [1, 0]) {
      await panel(page, c + 1).locator('[data-lp-back]').click();
      expect(await overflowing(page)).toEqual({ page: 0, clipped: [] });
    }
  });
}

test('the longest allowed content stays inside the card at 320px', async ({ page }) => {
  const token = 'Q3-Client-Report_Northwind_Industries_Holdings_FINAL_v12_approved-by-legal.xlsx';
  // The name comes first so options stay unique after the cut.
  const fill = (text, limit) => `${text} ${token} `.repeat(10).slice(0, limit).trim();
  const long = structuredClone(english);
  long.title = fill('title', 120); long.context = fill('context', 300);
  for (const item of long.steps) { item.question = fill('question', 120); item.options = item.options.map((_, n) => fill(`option ${n}`, 80)); }
  for (const item of long.cases) {
    for (const fact of item.facts) { fact.label = fill('label', 40); fact.text = fill('fact', 120); }
    for (const entry of item.steps) entry.reason = fill('reason', 200);
  }
  await mount(page, long, { width: 320 });
  expect(await overflowing(page)).toEqual({ page: 0, clipped: [] });
  await panel(page, 0).locator('[data-lp-next]').click();
  await answerStep(page, 1, 2, 0);
  await panel(page, 1).locator('[data-lp-next]').click();
  for (const s of [0, 1, 2]) await answerStep(page, 2, s, 0);
  expect(await overflowing(page)).toEqual({ page: 0, clipped: [] });
});

test('at 1280px each fact sits beside its label and the title is the largest text', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 'en', AT_CASE_3);
  const layout = await page.locator('[data-lp-pattern]').evaluate(root => {
    const size = selector => parseFloat(getComputedStyle(root.querySelector(selector)).fontSize);
    const row = root.querySelector('[data-lp-case]:not([hidden]) .lp-finish-worked-example-facts > div');
    const [label, value] = [row.querySelector('dt'), row.querySelector('dd')].map(el => el.getBoundingClientRect());
    return {
      title: size('h2.lp-heading'), heading: size('[data-lp-case]:not([hidden]) h3'), share: size('[data-lp-case]:not([hidden]) .lp-finish-worked-example-share'),
      question: size('[data-lp-case]:not([hidden]) legend .lp-run-in'), tag: size('[data-lp-case]:not([hidden]) .lp-finish-worked-example-tag'),
      label: size('[data-lp-case]:not([hidden]) dt'),
      beside: Math.abs(label.top - value.top) < 3 && value.left > label.right
    };
  });
  expect(layout).toEqual({ title: 21, heading: 19, share: 16, question: 17, tag: 16, label: 16, beside: true });
});

test('the card is the only box: the facts have no panel and a rule sets the steps apart', async ({ page }) => {
  await open(page, 'en', AT_CASE_3);
  const look = await panel(page, 2).evaluate(root => {
    const facts = getComputedStyle(root.querySelector('.lp-finish-worked-example-facts'));
    const steps = getComputedStyle(root.querySelector('.lp-finish-worked-example-steps'));
    // Choice rows and the status pills are shared roles from lib/base.css; nothing else inside the card is filled or bordered.
    const boxed = [...root.querySelectorAll('*')].filter(el => !el.closest('.lp-choice, .lp-button, .lp-finish-worked-example-tag') && el.getClientRects().length
      && (getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)' || ['Top', 'Right', 'Bottom', 'Left'].filter(side => parseFloat(getComputedStyle(el)[`border${side}Width`]) > 0).length > 1)).map(el => el.className);
    const [first, second] = [...root.querySelectorAll('[data-lp-step]')].map(el => el.getBoundingClientRect());
    return { fill: facts.backgroundColor, border: facts.borderTopWidth, padding: facts.paddingLeft, rule: [steps.borderTopWidth, steps.borderTopStyle, steps.paddingTop, steps.paddingLeft], stepGap: Math.round(second.top - first.bottom), boxed };
  });
  expect(look).toEqual({ fill: 'rgba(0, 0, 0, 0)', border: '0px', padding: '0px', rule: ['1px', 'solid', '24px', '0px'], stepGap: 24, boxed: [] });
});

test('missing or mismatched server markup fails loudly through enhance and changes nothing', async ({ page }) => {
  await open(page);
  const failures = await page.evaluate(async content => {
    const { enhance } = await import('/patterns/finish-worked-example/enhance.js');
    const { render } = await import('/patterns/finish-worked-example/render.js');
    const { strings } = await import('/patterns/finish-worked-example/strings.js');
    const planted = {
      'no status region': root => root.querySelector('[role="status"]').remove(),
      'no case heading': root => root.querySelector('[data-lp-case-heading]').removeAttribute('data-lp-case-heading'),
      'no worked result': root => root.querySelector('[data-lp-body]').remove(),
      'no reason line': root => root.querySelector('[data-lp-feedback]').remove(),
      'no check button': root => root.querySelector('[data-lp-check]').remove(),
      'a radio missing from a group': root => root.querySelector('input[type="radio"]').closest('label').remove(),
      'a radio with the wrong value': root => { root.querySelector('input[type="radio"]').value = '7'; },
      'a checkbox in a radio group': root => { root.querySelector('input[type="radio"]').type = 'checkbox'; },
      'a step missing from a case': root => root.querySelector('[data-lp-step]').remove(),
      'an extra step in a case': root => root.querySelector('[data-lp-step]').after(root.querySelector('[data-lp-step]').cloneNode(true)),
      'a case missing': root => root.querySelectorAll('[data-lp-case]')[2].remove(),
      'an extra case': root => root.querySelector('[data-lp-case]').after(root.querySelector('[data-lp-case]').cloneNode(true))
    };
    return Object.fromEntries(Object.entries(planted).map(([name, corrupt]) => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = render(content, strings.en, { id: 'bad', lang: 'en' });
      const root = wrapper.firstElementChild;
      corrupt(root);
      const before = root.outerHTML;
      try { enhance(root, { content, strings: strings.en }); return [name, 'no error']; } catch (error) { return [name, `${error.message}${root.outerHTML === before ? '' : ' (markup changed)'}`]; }
    }));
  }, english);
  expect(failures).toEqual({
    'no status region': 'Missing finish-worked-example markup: [role="status"]',
    'no case heading': 'Missing finish-worked-example markup: [data-lp-case-heading]',
    'no worked result': 'Missing finish-worked-example markup: [data-lp-body]',
    'no reason line': 'Missing finish-worked-example markup: [data-lp-feedback]',
    'no check button': 'Missing finish-worked-example markup: [data-lp-check]',
    'a radio missing from a group': 'Invalid finish-worked-example options markup',
    'a radio with the wrong value': 'Invalid finish-worked-example options markup',
    'a checkbox in a radio group': 'Invalid finish-worked-example options markup',
    'a step missing from a case': 'Invalid finish-worked-example steps markup',
    'an extra step in a case': 'Invalid finish-worked-example steps markup',
    'a case missing': 'Invalid finish-worked-example cases markup',
    'an extra case': 'Invalid finish-worked-example cases markup'
  });
});

test('forced colours keep the step labels and the marks visible', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' });
  await open(page, 'en', AT_CASE_3);
  await answerStep(page, 2, 0, 0);
  const borders = await panel(page, 2).evaluate(root => {
    const probe = document.createElement('span');
    probe.style.color = 'CanvasText'; root.append(probe);
    const canvasText = getComputedStyle(probe).color; probe.remove();
    return {
      canvasText,
      tag: getComputedStyle(root.querySelector('.lp-finish-worked-example-tag[data-lp-yours]')).borderTopColor,
      marked: [...root.querySelectorAll('[data-lp-mark]')].map(row => getComputedStyle(row).borderTopStyle)
    };
  });
  expect(borders.tag).toBe(borders.canvasText);
  expect(borders.marked).toEqual(['double', 'dashed']);
  await expect(panel(page, 2).locator('.lp-finish-worked-example-tag').first()).toHaveText('Your step');
  expect(await axe(page)).toEqual([]);
});

test('a case change slides in, and is instant under reduced motion', async ({ page }) => {
  await open(page);
  await panel(page, 0).locator('[data-lp-next]').click();
  expect(await panel(page, 1).evaluate(el => [el.classList.contains('lp-finish-worked-example-enter'), getComputedStyle(el).animationName, getComputedStyle(el).animationDuration])).toEqual([true, 'lp-finish-worked-example-slide', '0.24s']);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await panel(page, 1).locator('[data-lp-back]').click();
  await expect(panel(page, 0).locator('[data-lp-case-heading]')).toBeFocused();
  expect(await panel(page, 0).evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('two copies on one page keep separate ids, answers and progress', async ({ page }) => {
  await page.goto('/finish-worked-example/two.html');
  await page.waitForFunction(() => window.lpReady);
  expect(await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(el => el.id); return ids.length - new Set(ids).size; })).toBe(0);
  const [first, second] = [page.locator('[data-lp-pattern]').nth(0), page.locator('[data-lp-pattern]').nth(1)];
  await first.locator('[data-lp-next]:visible').click();
  await first.locator('[data-lp-case]:visible').getByRole('radio').nth(1).check();
  await first.locator('[data-lp-check]:visible').click();
  await expect(first.locator('[data-lp-mark="correct"]')).toHaveCount(1);
  await expect(second.locator('[data-lp-case]:visible [data-lp-case-heading]')).toHaveText(/^Case 1 of 3/);
  await expect(second.locator('[data-lp-mark], input:checked')).toHaveCount(0);
  await expect(page.locator('[role="status"]')).toHaveCount(2);
});

test('enhance is idempotent and destroy restores the no-JavaScript view', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await panel(page, 0).locator('[data-lp-next]').click();
  await answerStep(page, 1, 2, 1);
  const before = await page.locator('[data-lp-pattern]').evaluate(root => root.querySelectorAll('*').length);
  await page.evaluate(() => window.lpInstances[0].destroy());
  await expect(page.locator('[data-lp-case]:visible')).toHaveCount(3);
  await expect(page.locator('details:visible')).toHaveCount(2);
  await expect(page.locator('button:visible, [data-lp-feedback]:visible, [data-lp-mark], input:checked, input:disabled')).toHaveCount(0);
  await expect(page.locator('.lp-choice:visible')).toHaveCount(11);
  await expect(page.locator('[role="status"]')).toHaveText('');
  for (const summary of await page.locator('summary').all()) await summary.click();
  expect(await axe(page)).toEqual([]);
  // Enhancing again reads the saved progress and builds on the same markup.
  await page.evaluate(() => { window.lpInstances = [window.lpEnhance()]; });
  await expect(page.locator('[data-lp-case]:visible')).toHaveCount(1);
  await expect(step(page, 1, 2).locator('.lp-choice').nth(1)).toHaveAttribute('data-lp-mark', 'correct');
  await expect(panel(page, 1).locator('[data-lp-next]')).toBeVisible();
  expect(await page.locator('[data-lp-pattern]').evaluate(root => root.querySelectorAll('*').length)).toBe(before);
});
