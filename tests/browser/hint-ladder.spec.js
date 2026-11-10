import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { expectChoiceMarks } from './choice-marks.js';

const english = JSON.parse(await readFile(new URL('../../patterns/hint-ladder/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/hint-ladder/examples/fr.json', import.meta.url)));
const TEXT_SPACING = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';
const START = { tries: [], opened: 0, followUp: null };
// Authored text carries no-break spaces, and French rendering adds more. Compare words, not spaces.
const plain = value => value.replace(/\s+/g, ' ').trim();

async function open(page, path = '/hint-ladder/en.html') {
  await page.goto(path);
  await page.waitForFunction(() => window.lpReady);
}
async function observe(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    new MutationObserver(records => {
      for (const record of records) window.lpAnnouncements.push(record.target.textContent);
    }).observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}
// Clearing the region is not speech, so empty entries are dropped.
const announcements = async page => (await page.evaluate(() => window.lpAnnouncements)).map(plain).filter(Boolean);
const saved = page => page.evaluate(() => window.lpSaved);
const scan = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
const first = root => root.locator('[data-lp-first]');
const followUp = root => root.locator('[data-lp-follow-up]');
const row = (section, value) => section.locator(`label:has(input[value="${value}"])`);
const steps = root => root.locator('[data-lp-steps] > li');
const hintButton = root => root.locator('[data-lp-hint]');
/** Choose an option in a question and check it. */
async function check(section, value) {
  await section.locator(`input[value="${value}"]`).check();
  await section.locator('[data-lp-check]').click();
}
// Replace the demo with other content through the public render and enhance interface.
async function mount(page, content, { lang = 'en', state } = {}) {
  await open(page, `/hint-ladder/${lang}.html`);
  await page.evaluate(async ({ content, lang, state }) => {
    const { render } = await import('/patterns/hint-ladder/render.js');
    const { enhance } = await import('/patterns/hint-ladder/enhance.js');
    const { strings } = await import('/patterns/hint-ladder/strings.js');
    window.lpInstances.forEach(instance => instance.destroy());
    document.querySelector('main').innerHTML = render(content, strings[lang], { id: 'custom', lang });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings[lang], state: state === undefined ? undefined : { read: () => state, write: () => {} } });
  }, { content, lang, state });
}

test('keyboard journey: error, a wrong try, a hint, the right answer, the question without hints and Start over', async ({ page }) => {
  await open(page); await observe(page);
  const one = first(page), two = followUp(page);
  await expect(two).toBeHidden();
  await expect(page.locator('[data-lp-fallback]')).toHaveCount(2);
  for (const fallback of await page.locator('[data-lp-fallback]').all()) await expect(fallback).toBeHidden();
  await expect(steps(page)).toHaveCount(3);
  await expect(page.locator('[data-lp-steps]')).toBeHidden();

  // Checking with nothing chosen names the problem in the group and focuses its first option.
  await page.keyboard.press('Tab'); await expect(one.locator('input').first()).toBeFocused();
  await page.keyboard.press('Tab'); await expect(one.locator('[data-lp-check]')).toBeFocused();
  await page.keyboard.press('Enter');
  const error = one.locator('[data-lp-error]');
  await expect(error).toBeVisible(); await expect(error).toHaveText('Choose an answer');
  await expect(error.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  await expect(one.locator('fieldset')).toHaveAttribute('aria-describedby', await error.getAttribute('id'));
  await expect(one.locator('input[aria-invalid="true"]')).toHaveCount(4);
  await expect(one.locator('input').first()).toBeFocused();
  expect(await announcements(page)).toEqual([]);

  // A choice clears the error. Monday is wrong: it is marked, gets its reason and closes.
  await page.keyboard.press('Space');
  await expect(error).toBeHidden();
  await expect(one.locator('fieldset')).not.toHaveAttribute('aria-describedby');
  await expect(one.locator('[aria-invalid]')).toHaveCount(0);
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  const monday = row(one, 'monday');
  await expect(monday).toHaveAttribute('data-lp-mark', 'wrong');
  await expect(monday.locator('[data-lp-reason]')).toBeVisible();
  await expect(monday.locator('[data-lp-reason]')).toHaveText(english.options[0].feedback);
  await expect(monday.locator('input')).toBeDisabled(); await expect(monday.locator('input')).not.toBeChecked();
  // The other options stay open, focus stays on the button and the status region speaks once.
  await expect(one.locator('input:disabled')).toHaveCount(1);
  await expect(one.locator('[data-lp-mark]')).toHaveCount(1);
  await expect(one.locator('[data-lp-check]')).toBeFocused();
  const wrong = plain(`Incorrect. ${english.options[0].feedback}`);
  expect(await announcements(page)).toEqual([wrong]);
  expect(await saved(page)).toEqual({ tries: ['monday'], opened: 0, followUp: null });
  await expect(two).toBeHidden();

  // The hint button is the next stop. Its name carries the count, and the hint it opens takes focus.
  await page.keyboard.press('Tab'); await expect(hintButton(page)).toBeFocused();
  await expect(hintButton(page)).toHaveText('Show hint 1 of 2');
  await page.keyboard.press('Enter');
  await expect(steps(page).nth(0)).toBeFocused();
  await expect(steps(page).nth(0).locator('p').first()).toHaveText('Hint 1 of 2');
  await expect(steps(page).nth(0).locator('p').last()).toHaveText(english.hints[0]);
  await expect(steps(page).nth(1)).toBeHidden(); await expect(steps(page).nth(2)).toBeHidden();
  await expect(hintButton(page)).toHaveText('Show hint 2 of 2');
  await expect(page.locator('[role="status"]')).toHaveText('');
  expect(await saved(page)).toEqual({ tries: ['monday'], opened: 1, followUp: null });
  // From the hint, Tab reaches the check button.
  await page.keyboard.press('Tab'); await expect(one.locator('[data-lp-check]')).toBeFocused();

  // The right answer ends the first question: focus reads the worked answer and the next question opens.
  await one.locator('input[value="wednesday"]').check();
  await one.locator('[data-lp-check]').focus(); await page.keyboard.press('Enter');
  const worked = steps(page).nth(2);
  await expect(worked).toBeFocused();
  await expect(worked.locator('[data-lp-verdict]')).toHaveText('Correct.');
  await expect(worked.locator('p').first()).toHaveText('Worked answer');
  await expect(worked.locator('p').last()).toHaveText(english.worked);
  await expect(row(one, 'wednesday')).toHaveAttribute('data-lp-mark', 'correct');
  await expect(one.locator('[data-lp-mark]')).toHaveCount(2);
  await expect(one.locator('input:disabled')).toHaveCount(4);
  await expect(one.locator('[data-lp-check]')).toBeHidden(); await expect(hintButton(page)).toBeHidden();
  await expect(steps(page).nth(1)).toBeHidden();
  await expect(two).toBeVisible();
  await expect(two.locator('h3')).toHaveText('Now try one without hints');
  await expect(two.locator('[data-lp-hint]')).toHaveCount(0);
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  expect(await announcements(page)).toEqual([wrong]);

  // Tab skips the closed question. The question without hints takes one answer.
  await page.keyboard.press('Tab'); await expect(two.locator('input').first()).toBeFocused();
  await page.keyboard.press('Space'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  const feedback = two.locator('[data-lp-feedback]');
  await expect(feedback).toBeFocused();
  await expect(feedback).toHaveText(`Incorrect. Correct answer: Tuesday. ${english.followUp.explanation}`);
  await expect(row(two, 'friday')).toHaveAttribute('data-lp-mark', 'wrong');
  await expect(row(two, 'tuesday')).toHaveAttribute('data-lp-mark', 'missed');
  await expect(two.locator('[data-lp-mark]')).toHaveCount(2);
  await expect(page.locator('input:disabled')).toHaveCount(8);
  await expect(page.locator('[data-lp-check]:visible')).toHaveCount(0);
  const summary = 'You answered the first question correctly in 2 tries with 1 hint, then answered the question without hints incorrectly.';
  await expect(page.locator('[data-lp-summary]')).toHaveText(summary);
  expect(await announcements(page)).toEqual([wrong, summary]);
  expect(await saved(page)).toEqual({ tries: ['monday', 'wednesday'], opened: 1, followUp: 'friday' });
  await expectChoiceMarks(page);

  // Start over is the only control left.
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-restart]')).toBeFocused();
  await expect(page.locator('[data-lp-restart]')).toHaveText('Start over');
  await page.keyboard.press('Enter');
  await expect(one.locator('input').first()).toBeFocused();
  await expect(page.locator('input:checked, input:disabled, [data-lp-mark], .lp-choice-mark')).toHaveCount(0);
  await expect(page.locator('[data-lp-reason]:visible, [data-lp-steps]:visible, [data-lp-feedback]:visible')).toHaveCount(0);
  await expect(two).toBeHidden(); await expect(page.locator('[data-lp-result]')).toBeHidden();
  await expect(one.locator('[data-lp-check]')).toBeVisible();
  await expect(hintButton(page)).toHaveText('Show hint 1 of 2');
  expect((await announcements(page)).at(-1)).toBe('Answers cleared.');
  expect(await saved(page)).toEqual(START);
  // A second pass works after the reset.
  await check(one, 'wednesday');
  await expect(steps(page).nth(2).locator('[data-lp-verdict]')).toHaveText('Correct.');
  await expect(page.locator('[role="status"]')).toHaveText('');
});

for (const [lang, content, labels] of [
  ['en', english, { check: 'Check my answer', hint: n => `Show hint ${n} of 2`, hintLabel: n => `Hint ${n} of 2`, showWorked: 'Show the worked answer', worked: 'Worked answer', gate: 'The worked answer opens after you check an answer.', wrong: 'Incorrect', answer: 'Correct answer', next: 'Now try one without hints', correct: 'Correct. ', summary: 'You saw the worked answer to the first question after 1 try with 2 hints, then answered the question without hints correctly.', restart: 'Start over', cleared: 'Answers cleared.', choose: 'Choose an answer', show: 'Show the answer', reveal: option => `Correct answer: ${option}.` }],
  ['fr', french, { check: 'Vérifier ma réponse', hint: n => `Afficher l’indice ${n} sur 2`, hintLabel: n => `Indice ${n} sur 2`, showWorked: 'Afficher la solution détaillée', worked: 'Solution détaillée', gate: 'La solution détaillée s’affiche une fois que vous avez vérifié une réponse.', wrong: 'Incorrect', answer: 'Bonne réponse', next: 'Maintenant, une question sans indice', correct: 'Correct. ', summary: 'Vous avez vu la solution détaillée de la première question après 1 essai avec 2 indices, puis vous avez répondu correctement à la question sans indice.', restart: 'Recommencer', cleared: 'Réponses effacées.', choose: 'Choisissez une réponse', show: 'Afficher la réponse', reveal: option => `Bonne réponse : ${option}.` }]
]) {
  test(`card order, the hint ladder and a worked answer that waits for one try (${lang})`, async ({ page }) => {
    await open(page, `/hint-ladder/${lang}.html`); await observe(page);
    const root = page.locator('[data-lp-pattern]'), one = first(root), two = followUp(root);
    await expect(root).toHaveAttribute('lang', lang);
    // No scene bar: the title, the context, then the question as the group's name.
    await expect(root.locator('.lp-scene')).toHaveCount(0);
    await expect(root.locator('> h2.lp-heading')).toHaveText(content.title);
    await expect(root.locator('> .lp-context')).toHaveText(content.context);
    await expect(one.locator('legend')).toHaveText(content.question);
    await expect(one.locator('[data-lp-check]')).toHaveText(labels.check);
    for (const [n, option] of content.options.entries()) await expect(one.getByRole('radio').nth(n)).toHaveAccessibleName(option.text);

    // Both hints open before any answer is checked.
    for (const n of [1, 2]) {
      await expect(hintButton(root)).toHaveText(labels.hint(n));
      await expect(hintButton(root)).not.toHaveAttribute('aria-disabled');
      await hintButton(root).click();
      await expect(steps(root).nth(n - 1).locator('p').first()).toHaveText(labels.hintLabel(n));
      await expect(steps(root).nth(n - 1).locator('p').last()).toHaveText(content.hints[n - 1]);
    }
    // The worked answer waits: the button stays focusable, says why, and does nothing yet.
    const gate = one.locator('[data-lp-gate]');
    await expect(hintButton(root)).toHaveText(labels.showWorked);
    await expect(hintButton(root)).toHaveAttribute('aria-disabled', 'true');
    await expect(hintButton(root)).toHaveAttribute('aria-describedby', await gate.getAttribute('id'));
    await expect(gate).toBeVisible(); await expect(gate).toHaveText(labels.gate);
    // Playwright waits for an enabled control, and this one reports itself unavailable. A person can
    // still click it or press Enter on it, so do both.
    await hintButton(root).click({ force: true });
    await expect(steps(root).nth(2)).toBeHidden(); await expect(two).toBeHidden();
    await hintButton(root).focus(); await expect(hintButton(root)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(hintButton(root)).toBeFocused();
    await expect(steps(root).nth(2)).toBeHidden(); await expect(two).toBeHidden();
    await expect(gate).toBeVisible();
    expect(await saved(page)).toEqual({ tries: [], opened: 2, followUp: null });

    // One checked answer opens it.
    await check(one, 'thursday');
    await expect(row(one, 'thursday').locator('.lp-choice-mark')).toHaveText(labels.wrong);
    expect(await announcements(page)).toEqual([plain(`${labels.wrong}. ${content.options[3].feedback}`)]);
    await expect(gate).toBeHidden();
    await expect(hintButton(root)).not.toHaveAttribute('aria-disabled'); await expect(hintButton(root)).not.toHaveAttribute('aria-describedby');
    await hintButton(root).click();
    const worked = steps(root).nth(2);
    await expect(worked).toBeFocused();
    await expect(worked.locator('[data-lp-verdict]')).toHaveText('');
    await expect(worked.locator('p').first()).toHaveText(labels.worked);
    await expect(worked.locator('p').last()).toHaveText(content.worked);
    // The learner did not choose the correct option, so it gets the neutral mark.
    await expect(row(one, 'wednesday')).toHaveAttribute('data-lp-mark', 'missed');
    await expect(row(one, 'wednesday').locator('.lp-choice-mark')).toHaveText(labels.answer);
    await expect(one.locator('input:checked')).toHaveCount(0);
    await expect(one.locator('[data-lp-check]')).toBeHidden(); await expect(hintButton(root)).toBeHidden();
    expect(await saved(page)).toEqual({ tries: ['thursday'], opened: 3, followUp: null });

    await expect(two.locator('h3')).toHaveText(labels.next);
    await expect(two.locator('legend')).toHaveText(content.followUp.question);
    await two.locator('[data-lp-check]').click();
    await expect(two.locator('[data-lp-error]')).toHaveText(labels.choose);
    await expect(two.locator('input').first()).toBeFocused();
    await check(two, 'tuesday');
    await expect(two.locator('[data-lp-error]')).toBeHidden();
    await expect(two.locator('[data-lp-feedback]')).toBeFocused();
    await expect(two.locator('[data-lp-feedback]')).toHaveText(`${labels.correct}${content.followUp.explanation}`);
    await expect(two.locator('[data-lp-mark]')).toHaveCount(1);
    await expect(root.locator('[data-lp-summary]')).toHaveText(labels.summary);
    await expect(root.locator('[data-lp-restart]')).toHaveText(labels.restart);
    expect((await announcements(page)).at(-1)).toBe(labels.summary);
    await expectChoiceMarks(page);
    await root.locator('[data-lp-restart]').click();
    expect((await announcements(page)).at(-1)).toBe(labels.cleared);
  });

  test(`no JavaScript keeps both questions, with each hint and answer behind its own closed disclosure (${lang})`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage(); await page.goto(`/hint-ladder/${lang}.html`);
    await expect(page.getByRole('radio')).toHaveCount(8);
    await page.getByRole('radio').first().check(); await expect(page.getByRole('radio').first()).toBeChecked();
    await page.getByRole('radio').last().check(); await expect(page.getByRole('radio').last()).toBeChecked();
    await expect(page.locator('[data-lp-check]:visible, [data-lp-hint]:visible, [data-lp-restart]:visible')).toHaveCount(0);
    await expect(page.locator('[data-lp-steps], [data-lp-result], [data-lp-gate]')).toHaveCount(3);
    for (const hidden of await page.locator('[data-lp-steps], [data-lp-result], [data-lp-gate], [data-lp-reason], [data-lp-feedback]').all()) await expect(hidden).toBeHidden();
    await expect(followUp(page)).toBeVisible();
    await expect(followUp(page).locator('h3')).toHaveText(labels.next);
    const details = page.locator('details');
    await expect(details).toHaveCount(4);
    await expect(page.locator('details[open]')).toHaveCount(0);
    await expect(page.locator('summary')).toHaveText([labels.hintLabel(1), labels.hintLabel(2), labels.worked, labels.show]);
    // Nothing gives the answer away until its disclosure is opened.
    await expect(details.nth(2).getByText(content.worked)).toBeHidden();
    for (const summary of await page.locator('summary').all()) await summary.click();
    const option = (options, id) => options.find(o => o.id === id).text;
    await expect(details.nth(0)).toContainText(content.hints[0]);
    await expect(details.nth(1)).toContainText(content.hints[1]);
    await expect(details.nth(2).locator('p').first()).toHaveText(labels.reveal(option(content.options, content.correct)));
    await expect(details.nth(2)).toContainText(content.worked);
    await expect(details.nth(2).locator('li')).toHaveCount(3);
    for (const [n, wrong] of content.options.filter(o => o.feedback).entries()) {
      await expect(details.nth(2).locator('li').nth(n).locator('strong')).toHaveText(wrong.text);
      await expect(details.nth(2).locator('li').nth(n).locator('p')).toHaveText(wrong.feedback);
    }
    await expect(details.nth(3).locator('p').first()).toHaveText(labels.reveal(option(content.followUp.options, content.followUp.correct)));
    await expect(details.nth(3)).toContainText(content.followUp.explanation);
    await context.close();
  });

  test(`axe on unchanged server HTML with the disclosures open (${lang})`, async ({ page }) => {
    // axe needs scripting enabled. Block enhancement to audit the same native baseline.
    await page.route('**/hint-ladder/enhance.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export function enhance() { return { destroy() {} }; }' }));
    await open(page, `/hint-ladder/${lang}.html`);
    await scan(page);
    for (const summary of await page.locator('summary').all()) await summary.click();
    await scan(page);
  });

  test(`320 CSS pixels with text spacing has no scroll or clipping at every stage (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await open(page, `/hint-ladder/${lang}.html`);
    await page.addStyleTag({ content: TEXT_SPACING });
    for (const stage of ['initial', 'error', 'wrong', 'hints', 'second wrong', 'worked', 'follow-up error', 'result']) {
      if (stage === 'error') await first(page).locator('[data-lp-check]').click();
      if (stage === 'wrong') await check(first(page), 'tuesday');
      if (stage === 'hints') { await hintButton(page).click(); await hintButton(page).click(); }
      if (stage === 'second wrong') await check(first(page), 'monday');
      if (stage === 'worked') await hintButton(page).click();
      if (stage === 'follow-up error') await followUp(page).locator('[data-lp-check]').click();
      if (stage === 'result') await check(followUp(page), 'monday');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), stage).toBe(true);
      const problems = await page.evaluate(() => {
        const card = document.querySelector('[data-lp-pattern]').getBoundingClientRect();
        return [...document.querySelectorAll('[data-lp-pattern] :is(p, label, legend, button, li, h2, h3, .lp-choice-mark, [data-lp-reason])')]
          .filter(el => el.getClientRects().length && !el.matches('[role="status"]') && !el.closest('.lp-visually-hidden'))
          .filter(el => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline' || el.getBoundingClientRect().right > card.right + 1 || el.getBoundingClientRect().left < card.left - 1)
          .map(el => el.textContent);
      });
      expect(problems, stage).toEqual([]);
    }
    // Two wrong tries and the neutral answer on the first question, a wrong pick and the answer on the second.
    await expect(page.locator('[data-lp-mark]')).toHaveCount(5);
  });
}

for (const path of ['/hint-ladder/en.html', '/hint-ladder/fr.html', '/hint-ladder/two.html']) {
  test(`axe at load, error, a wrong try, open hints, the waiting button, the worked answer, the result and reset: ${path}`, async ({ page }) => {
    await open(page, path); await scan(page);
    const roots = await page.locator('[data-lp-pattern]').all();
    for (const root of roots) await first(root).locator('[data-lp-check]').click();
    await scan(page);
    for (const root of roots) { await hintButton(root).click(); await hintButton(root).click(); }
    await scan(page);
    for (const root of roots) await check(first(root), 'monday');
    await scan(page);
    for (const root of roots) await hintButton(root).click();
    await scan(page);
    for (const root of roots) await followUp(root).locator('[data-lp-check]').click();
    await scan(page);
    for (const root of roots) await check(followUp(root), 'wednesday');
    await scan(page);
    for (const root of roots) await root.locator('[data-lp-restart]').click();
    await scan(page);
  });
}

test('when only the correct option is left, the question ends and the worked answer shows by itself', async ({ page }) => {
  await open(page); await observe(page);
  const one = first(page);
  await check(one, 'monday'); await check(one, 'tuesday');
  await expect(followUp(page)).toBeHidden();
  await expect(one.locator('input:disabled')).toHaveCount(2);
  await check(one, 'thursday');
  const worked = steps(page).nth(2);
  await expect(worked).toBeFocused();
  // The last reason is read with the worked answer, so the status region stays quiet for this check.
  await expect(worked.locator('[data-lp-verdict]')).toHaveText(`Incorrect. ${english.options[3].feedback}`);
  await expect(worked.locator('p').last()).toHaveText(english.worked);
  expect(await announcements(page)).toEqual(['monday', 'tuesday'].map(id => plain(`Incorrect. ${english.options.find(o => o.id === id).feedback}`)));
  await expect(page.locator('[role="status"]')).toHaveText('');
  await expect(steps(page).nth(0)).toBeHidden(); await expect(steps(page).nth(1)).toBeHidden();
  await expect(one.locator('[data-lp-mark="wrong"]')).toHaveCount(3);
  await expect(one.locator('[data-lp-reason]:visible')).toHaveCount(3);
  await expect(row(one, 'wednesday')).toHaveAttribute('data-lp-mark', 'missed');
  await expect(one.locator('input:checked')).toHaveCount(0);
  await expect(one.locator('[data-lp-check]')).toBeHidden(); await expect(hintButton(page)).toBeHidden();
  expect(await saved(page)).toEqual({ tries: ['monday', 'tuesday', 'thursday'], opened: 0, followUp: null });
  await check(followUp(page), 'monday');
  await expect(page.locator('[data-lp-summary]')).toHaveText('You saw the worked answer to the first question after 3 tries with no hints, then answered the question without hints incorrectly.');
});

test('a checked wrong option cannot be chosen or counted again', async ({ page }) => {
  await open(page);
  const one = first(page);
  await check(one, 'tuesday');
  const tuesday = row(one, 'tuesday');
  await expect(tuesday.locator('input')).toBeDisabled(); await expect(tuesday.locator('input')).not.toBeChecked();
  // The gallery prototype counted a second check of the same option as another try.
  await tuesday.click({ force: true });
  await expect(tuesday.locator('input')).not.toBeChecked();
  await one.locator('[data-lp-check]').click();
  await expect(one.locator('[data-lp-error]')).toBeVisible();
  await expect(one.locator('input[aria-invalid="true"]')).toHaveCount(3);
  await expect(tuesday.locator('input')).not.toHaveAttribute('aria-invalid');
  // Focus goes to the first option still open.
  await expect(row(one, 'monday').locator('input')).toBeFocused();
  expect(await saved(page)).toEqual({ tries: ['tuesday'], opened: 0, followUp: null });
  await expect(tuesday).toHaveAttribute('data-lp-mark', 'wrong'); await expect(tuesday.locator('.lp-choice-mark')).toHaveCount(1);
  // The closed row shows no pointer, and its reason stays while the learner chooses again.
  await expect(tuesday).toHaveCSS('cursor', 'default');
  await check(one, 'wednesday');
  await expect(tuesday.locator('[data-lp-reason]')).toBeVisible();
  await check(followUp(page), 'tuesday');
  await expect(page.locator('[data-lp-summary]')).toHaveText('You answered the first question correctly in 2 tries with no hints, then answered the question without hints correctly.');
  // The second question takes one answer: a stray activation of its hidden button changes nothing.
  await followUp(page).locator('[data-lp-check]').evaluate(button => { button.hidden = false; button.disabled = false; button.click(); });
  expect(await saved(page)).toEqual({ tries: ['tuesday', 'wednesday'], opened: 0, followUp: 'tuesday' });
});

test('a wrong check puts focus on the check button when the checked option held it', async ({ page }) => {
  await open(page); await observe(page);
  const one = first(page), tuesday = one.locator('input[value="tuesday"]');
  await tuesday.focus(); await page.keyboard.press('Space');
  await expect(tuesday).toBeChecked(); await expect(tuesday).toBeFocused();
  // Safari does not focus a button on a pointer click. A scripted click activates it the same way,
  // with focus left on the option that the check is about to close.
  await one.locator('[data-lp-check]').evaluate(button => button.click());
  await expect(tuesday).toBeDisabled();
  await expect(one.locator('[data-lp-check]')).toBeFocused();
  expect(await announcements(page)).toEqual([plain(`Incorrect. ${english.options[1].feedback}`)]);
  // The next try works from there: the learner is not left with focus on nothing.
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
});

for (const width of [1280, 390]) test(`hints, the worked answer and the result come into view at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await open(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await hintButton(page).click();
  await expect(steps(page).nth(0)).toBeInViewport({ ratio: .95 });
  await hintButton(page).click();
  await expect(steps(page).nth(1)).toBeInViewport({ ratio: .95 });
  // The hints sit between the options and the buttons, a group's gap under the last row.
  const gap = await first(page).evaluate(section => section.querySelector('[data-lp-steps]').getBoundingClientRect().top - section.querySelector('fieldset').getBoundingClientRect().bottom);
  expect(gap).toBeGreaterThanOrEqual(20); expect(gap).toBeLessThanOrEqual(28);
  await check(first(page), 'wednesday');
  for (const locator of [steps(page).nth(2).locator('p').first(), followUp(page).locator('h3'), followUp(page).locator('[data-lp-check]')]) await expect(locator).toBeInViewport({ ratio: .95 });
  await check(followUp(page), 'tuesday');
  for (const locator of [followUp(page).locator('[data-lp-feedback]'), page.locator('[data-lp-summary]'), page.locator('[data-lp-restart]')]) await expect(locator).toBeInViewport({ ratio: .95 });
  await page.locator('[data-lp-restart]').click();
  await expect(page.locator('h2.lp-heading')).toBeInViewport();
});

for (const [name, seed, expected] of [
  ['one wrong try and one hint', { tries: ['tuesday'], opened: 1, followUp: null }, { marks: 1, disabled: 1, steps: 1, hint: 'Show hint 2 of 2', gated: false, followUp: false }],
  ['every hint and no try', { tries: [], opened: 2, followUp: null }, { marks: 0, disabled: 0, steps: 2, hint: 'Show the worked answer', gated: true, followUp: false }],
  ['the worked answer opened', { tries: ['monday'], opened: 3, followUp: null }, { marks: 2, disabled: 4, steps: 3, hint: null, gated: false, followUp: true }],
  ['only the correct option left', { tries: ['monday', 'tuesday', 'thursday'], opened: 0, followUp: null }, { marks: 4, disabled: 4, steps: 1, hint: null, gated: false, followUp: true }]
]) {
  test(`saved progress restores silently: ${name}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, seed);
    await open(page);
    const one = first(page);
    await expect(one.locator('[data-lp-mark]')).toHaveCount(expected.marks);
    await expect(one.locator('input:disabled')).toHaveCount(expected.disabled);
    await expect(one.locator('[data-lp-reason]:visible')).toHaveCount(seed.tries.length);
    await expect(page.locator('[data-lp-steps] > li:visible')).toHaveCount(expected.steps);
    if (expected.hint) await expect(hintButton(page)).toHaveText(expected.hint); else await expect(hintButton(page)).toBeHidden();
    await expect(one.locator('[data-lp-gate]')).toBeVisible({ visible: expected.gated });
    await expect(followUp(page)).toBeVisible({ visible: expected.followUp });
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    await expect(page.locator('[role="status"]')).toHaveText('');
    expect(await page.evaluate(() => document.activeElement === document.body && scrollY === 0)).toBe(true);
    // The restored learner carries on from where they stopped.
    if (expected.followUp) {
      await check(followUp(page), 'tuesday');
      expect(await saved(page)).toEqual({ ...seed, followUp: 'tuesday' });
    } else {
      await check(one, 'wednesday');
      expect(await saved(page)).toEqual({ ...seed, tries: [...seed.tries, 'wednesday'] });
    }
  });
}

test('a finished saved card restores its marks, sentence and Start over without speaking', async ({ page }) => {
  await page.addInitScript(value => { window.lpSeed = value; }, { tries: ['wednesday'], opened: 0, followUp: 'tuesday' });
  await open(page);
  await expect(page.locator('input:disabled')).toHaveCount(8);
  await expect(page.locator('input:checked')).toHaveCount(2);
  await expect(page.locator('[data-lp-mark="correct"]')).toHaveCount(2); await expect(page.locator('[data-lp-mark]')).toHaveCount(2);
  await expect(page.locator('[data-lp-check]:visible, [data-lp-hint]:visible')).toHaveCount(0);
  await expect(steps(page).nth(2)).toBeVisible();
  await expect(followUp(page).locator('[data-lp-feedback]')).toHaveText(`Correct. ${english.followUp.explanation}`);
  await expect(page.locator('[data-lp-summary]')).toHaveText('You answered the first question correctly in 1 try with no hints, then answered the question without hints correctly.');
  await expect(page.locator('[data-lp-restart]')).toBeVisible();
  await expect(page.locator('[role="status"]')).toHaveText('');
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
});

for (const seed of [{ tries: ['saturday'], opened: 0, followUp: null }, { tries: 'monday', opened: 0, followUp: null }, { tries: ['wednesday', 'monday'], opened: 0, followUp: null }, { tries: [], opened: 3, followUp: null }, { tries: ['monday'], opened: 0, followUp: 'tuesday' }, { tries: [], opened: 0 }, 'not an object']) {
  test(`invalid saved state is ignored: ${JSON.stringify(seed)}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, seed); await open(page);
    await expect(page.locator('input:checked, input:disabled, [data-lp-mark]')).toHaveCount(0);
    await expect(page.locator('[data-lp-steps]')).toBeHidden(); await expect(followUp(page)).toBeHidden();
    await expect(hintButton(page)).toHaveText('Show hint 1 of 2');
    await expect(page.locator('[data-lp-result]')).toBeHidden(); await expect(page.locator('[role="status"]')).toHaveText('');
  });
}

test('the pattern works in memory without a state adapter', async ({ page }) => {
  await mount(page, english);
  await check(first(page), 'wednesday'); await check(followUp(page), 'tuesday');
  await expect(page.locator('[data-lp-summary]')).toHaveText('You answered the first question correctly in 1 try with no hints, then answered the question without hints correctly.');
  await page.locator('[data-lp-restart]').click();
  await expect(followUp(page)).toBeHidden(); await expect(page.locator('[data-lp-mark]')).toHaveCount(0);
});

test('three options, one hint and a two-option second question follow the same rules', async ({ page }) => {
  const content = { ...english, options: english.options.slice(0, 3), hints: [english.hints[0]], followUp: { ...english.followUp, options: english.followUp.options.slice(1, 3) } };
  await mount(page, content);
  const one = first(page);
  await expect(one.getByRole('radio')).toHaveCount(3);
  expect(await one.locator('label').evaluateAll(rows => rows.map(row => getComputedStyle(row, '::before').content))).toEqual(Array(3).fill('counter(lp-key, upper-alpha) / ""'));
  await expect(steps(page)).toHaveCount(2);
  await expect(hintButton(page)).toHaveText('Show hint 1 of 1');
  await hintButton(page).click();
  await expect(steps(page).nth(0).locator('p').first()).toHaveText('Hint 1 of 1');
  await expect(hintButton(page)).toHaveText('Show the worked answer');
  await expect(hintButton(page)).toHaveAttribute('aria-disabled', 'true');
  // With three options the second wrong try leaves only the correct one, so it ends the question.
  await check(one, 'monday');
  await expect(followUp(page)).toBeHidden();
  await check(one, 'tuesday');
  await expect(steps(page).nth(1)).toBeFocused();
  await expect(row(one, 'wednesday')).toHaveAttribute('data-lp-mark', 'missed');
  await expect(followUp(page).getByRole('radio')).toHaveCount(2);
  await check(followUp(page), 'tuesday');
  await expect(page.locator('[data-lp-summary]')).toHaveText('You saw the worked answer to the first question after 2 tries with 1 hint, then answered the question without hints correctly.');
});

test('three hints count to three before the worked answer', async ({ page }) => {
  await mount(page, { ...english, hints: [...english.hints, 'Monday is the day this order counts as received.'] });
  for (const n of [1, 2, 3]) {
    await expect(hintButton(page)).toHaveText(`Show hint ${n} of 3`);
    await hintButton(page).click();
    await expect(steps(page).nth(n - 1).locator('p').first()).toHaveText(`Hint ${n} of 3`);
  }
  await expect(hintButton(page)).toHaveText('Show the worked answer');
  await check(first(page), 'wednesday'); await check(followUp(page), 'tuesday');
  await expect(page.locator('[data-lp-summary]')).toHaveText('You answered the first question correctly in 1 try with 3 hints, then answered the question without hints correctly.');
});

test('worst-case authored text wraps inside the card at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const token = 'Q3-Client-Report_Northwind_Industries_Holdings_FINAL_v12_approved-by-legal.xlsx';
  const content = structuredClone(english);
  content.title = `Find ${token}`;
  content.question = `${english.question} ${token}`;
  content.options[0].text = `Monday, unless the customer also sent ${token} and every other attachment this week`;
  content.options[0].feedback = `${english.options[0].feedback} ${token} ${'A long closing sentence about nothing in particular. '.repeat(6)}`.slice(0, 600);
  content.hints[1] = `${english.hints[1]} ${token}`;
  content.worked = `${english.worked} ${token}`;
  content.followUp.explanation = `${english.followUp.explanation} ${token}`;
  await mount(page, content, { state: { tries: ['monday', 'tuesday', 'thursday'], opened: 2, followUp: 'friday' } });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const overflow = await page.evaluate(() => {
    const card = document.querySelector('[data-lp-pattern]').getBoundingClientRect();
    return Math.max(...[...document.querySelectorAll('[data-lp-pattern] *')].filter(el => el.getClientRects().length && !el.closest('.lp-visually-hidden')).map(el => el.getBoundingClientRect().right - card.right));
  });
  expect(overflow).toBeLessThanOrEqual(0);
  // The mark drops under the option text and the reason follows it, both in the text column.
  const places = await row(first(page), 'monday').evaluate(label => {
    const [text, reason] = [...label.querySelectorAll(':scope > span:not(.lp-choice-mark)')].map(el => el.getBoundingClientRect()), mark = label.querySelector('.lp-choice-mark').getBoundingClientRect();
    return { markBelow: mark.top - text.bottom, reasonBelow: reason.top - mark.bottom, markIndent: mark.left - text.left, reasonIndent: reason.left - text.left };
  });
  expect(places.markBelow).toBeGreaterThanOrEqual(0); expect(places.reasonBelow).toBeGreaterThanOrEqual(0);
  expect(Math.abs(places.markIndent)).toBeLessThanOrEqual(1); expect(Math.abs(places.reasonIndent)).toBeLessThanOrEqual(1);
});

test('two instances have unique ids and independent progress', async ({ page }) => {
  await open(page, '/hint-ladder/two.html');
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  const names = await page.locator('input').evaluateAll(els => [...new Set(els.map(el => el.name))]); expect(names).toHaveLength(4);
  const roots = page.locator('[data-lp-pattern]');
  await hintButton(roots.first()).click(); await hintButton(roots.first()).click();
  await check(first(roots.first()), 'monday');
  await expect(roots.nth(1).locator('input:checked, input:disabled, [data-lp-mark]')).toHaveCount(0);
  await expect(roots.nth(1).locator('[data-lp-steps]')).toBeHidden();
  await expect(hintButton(roots.nth(1))).toHaveText('Show hint 1 of 2');
  await first(roots.nth(1)).locator('[data-lp-check]').click();
  await expect(roots.nth(1).locator('[data-lp-error]:visible')).toHaveCount(1);
  await expect(roots.first().locator('[data-lp-error]:visible')).toHaveCount(0);
  // Each waiting button points at its own card's line.
  await hintButton(roots.nth(1)).click(); await hintButton(roots.nth(1)).click();
  await expect(hintButton(roots.nth(1))).toHaveAttribute('aria-describedby', 'second-gate');
  await expect(hintButton(roots.first())).not.toHaveAttribute('aria-describedby');
});

test('enhance twice returns one instance; destroy restores the no-JavaScript view and can re-enhance', async ({ page }) => {
  await open(page); expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  const nodes = await page.locator('[data-lp-pattern] *').count();
  await hintButton(page).click(); await check(first(page), 'monday'); await check(first(page), 'wednesday');
  await page.evaluate(() => window.lpInstances[0].destroy());
  for (const fallback of await page.locator('[data-lp-fallback]').all()) await expect(fallback).toBeVisible();
  await expect(followUp(page)).toBeVisible();
  await expect(page.locator('[data-lp-check]:visible, [data-lp-hint]:visible, [data-lp-restart]:visible')).toHaveCount(0);
  await expect(page.locator('input:checked, input:disabled, [data-lp-mark], .lp-choice-mark')).toHaveCount(0);
  await expect(page.locator('[data-lp-reason]:visible, [data-lp-steps]:visible, [data-lp-feedback]:visible, [data-lp-gate]:visible')).toHaveCount(0);
  await expect(page.locator('[aria-disabled], [aria-describedby], [aria-invalid]')).toHaveCount(0);
  await expect(page.locator('[role="status"]')).toHaveText('');
  expect(await page.locator('[data-lp-pattern] *').count()).toBe(nodes);
  // Listeners are gone: a destroyed instance writes nothing.
  const before = await saved(page);
  await page.locator('input').first().check();
  for (const button of await page.locator('[data-lp-check], [data-lp-hint]').all()) await button.evaluate(el => { el.hidden = false; el.click(); el.hidden = true; });
  expect(await saved(page)).toEqual(before);
  // The page's adapter still holds the progress, so a new instance restores it.
  expect(await page.evaluate(() => { const instance = window.lpEnhance(); return instance === window.lpEnhance() && instance !== window.lpInstances[0]; })).toBe(true);
  for (const fallback of await page.locator('[data-lp-fallback]').all()) await expect(fallback).toBeHidden();
  await expect(first(page).locator('[data-lp-mark]')).toHaveCount(2);
  await expect(page.locator('[data-lp-steps] > li:visible')).toHaveCount(2);
  await check(followUp(page), 'tuesday');
  await expect(page.locator('[data-lp-summary]')).toHaveText('You answered the first question correctly in 2 tries with 1 hint, then answered the question without hints correctly.');
});

test('missing and mismatched markup fail loudly', async ({ page }) => {
  await open(page);
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/hint-ladder/enhance.js');
    const { strings } = await import('/patterns/hint-ladder/strings.js');
    enhance(document.createElement('section'), { content, strings: strings.en });
  }, english)).rejects.toThrow('Missing hint-ladder markup');
  for (const violation of ['missing-first', 'missing-radio', 'wrong-value', 'not-radio', 'missing-label', 'missing-error', 'missing-reason', 'missing-step', 'missing-verdict', 'missing-hint', 'missing-gate', 'missing-feedback', 'missing-follow-up-check', 'missing-summary', 'missing-restart', 'missing-status', 'missing-fallback']) {
    await open(page);
    await page.evaluate(kind => {
      window.lpInstances[0].destroy();
      const q = selector => document.querySelector(selector);
      if (kind === 'missing-first') q('[data-lp-first]').removeAttribute('data-lp-first');
      if (kind === 'missing-radio') q('input').closest('label').remove();
      if (kind === 'wrong-value') q('input').value = 'bad';
      if (kind === 'not-radio') q('input').type = 'checkbox';
      if (kind === 'missing-label') q('label').replaceWith(q('input'));
      if (kind === 'missing-error') q('[data-lp-error]').remove();
      if (kind === 'missing-reason') q('[data-lp-reason]').remove();
      if (kind === 'missing-step') q('[data-lp-steps] > li').remove();
      if (kind === 'missing-verdict') q('[data-lp-steps] [data-lp-verdict]').remove();
      if (kind === 'missing-hint') q('[data-lp-hint]').remove();
      if (kind === 'missing-gate') q('[data-lp-gate]').remove();
      if (kind === 'missing-feedback') q('[data-lp-feedback]').remove();
      if (kind === 'missing-follow-up-check') q('[data-lp-follow-up] [data-lp-check]').remove();
      if (kind === 'missing-summary') q('[data-lp-summary]').remove();
      if (kind === 'missing-restart') q('[data-lp-restart]').remove();
      if (kind === 'missing-status') q('[role="status"]').remove();
      if (kind === 'missing-fallback') q('[data-lp-fallback]').remove();
    }, violation);
    await expect(page.evaluate(() => window.lpEnhance()), violation).rejects.toThrow(/Invalid hint-ladder|Missing hint-ladder/);
  }
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/hint-ladder/enhance.js');
    const { strings } = await import('/patterns/hint-ladder/strings.js');
    window.lpInstances[0].destroy();
    enhance(document.querySelector('[data-lp-pattern]'), { content: { ...content, hints: [] }, strings: strings.en });
  }, english)).rejects.toThrow(/hints/);
});

test('shared look: one card with no panel inside it, keyed rows, a secondary hint button and a quiet reset', async ({ page }) => {
  await open(page);
  const root = page.locator('[data-lp-pattern]'), one = first(root), two = followUp(root);
  await expect(root.locator('.lp-box, .lp-scene, .lp-quote')).toHaveCount(0);
  await expect(root.locator('h2.lp-heading')).toHaveCSS('font-size', '21px');
  // Under a card title the questions step down one size.
  await expect(one.locator('legend')).toHaveCSS('font-size', '19px');
  await expect(one.locator('legend')).toHaveCSS('font-weight', '600');
  await expect(hintButton(root)).toHaveClass(/lp-button-secondary/);
  await expect(hintButton(root).locator('svg[aria-hidden="true"]')).toHaveCount(1);
  await hintButton(root).click(); await hintButton(root).click();
  await expect(one.locator('[data-lp-gate]')).toHaveCSS('font-size', '16px');
  await check(one, 'tuesday'); await check(one, 'wednesday'); await check(two, 'monday');
  // The card is the only box: hints, the worked answer, the second question, its explanation and the
  // result are set apart by space, a rule, an icon and a label, never by a border or a fill of their own.
  for (const part of [root.locator('[data-lp-steps]'), ...await steps(root).all(), one, two.locator('fieldset'), two.locator('[data-lp-feedback]'), root.locator('[data-lp-summary]')]) {
    await expect(part).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    for (const side of ['top', 'right', 'bottom', 'left']) await expect(part).toHaveCSS(`border-${side}-width`, '0px');
    await expect(part).toHaveCSS('box-shadow', 'none');
  }
  for (const section of [two, root.locator('[data-lp-result]')]) {
    await expect(section).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(section).toHaveCSS('border-top-width', '1px');
    for (const side of ['right', 'bottom', 'left']) await expect(section).toHaveCSS(`border-${side}-width`, '0px');
  }
  // Each step has a decorative icon, a label and its text; the label is body size and semibold.
  for (const step of await steps(root).all()) {
    await expect(step.locator('svg[aria-hidden="true"]')).toHaveCount(1);
    await expect(step.locator('p').first()).toHaveCSS('font-weight', '600');
    for (const text of await step.locator('p').all()) await expect(text).toHaveCSS('font-size', '17px');
    // The icon sits on the label's line and the text hangs under the label.
    const places = await step.evaluate(li => { const [icon, label, text] = [li.querySelector('svg'), ...li.querySelectorAll('p')].map(el => el.getBoundingClientRect()); return { centre: Math.abs((icon.top + icon.bottom) / 2 - (label.top + label.bottom) / 2), indent: text.left - label.left, after: label.left - icon.right }; });
    expect(places.centre).toBeLessThanOrEqual(1.5); expect(Math.abs(places.indent)).toBeLessThanOrEqual(.5); expect(places.after).toBeGreaterThanOrEqual(8);
  }
  for (const locator of [one.locator('[data-lp-reason]').first(), root.locator('.lp-choice-mark').first(), two.locator('h3'), root.locator('[data-lp-restart]')]) await expect(locator).toHaveCSS('font-size', '16px');
  for (const locator of [two.locator('[data-lp-feedback]'), root.locator('[data-lp-summary]')]) await expect(locator).toHaveCSS('font-size', '17px');
  await expect(root.locator('[data-lp-restart]')).toHaveClass(/lp-button-quiet/);
  await expect(root.locator('[data-lp-restart] svg[aria-hidden="true"]')).toHaveCount(1);
  // Keyboard focus on a step or on feedback draws the shared ring.
  await page.keyboard.press('Tab');
  for (const locator of [steps(root).nth(2), two.locator('[data-lp-feedback]')]) {
    await locator.focus();
    await expect(locator).toHaveCSS('outline-width', '3px');
  }
});

test('forced colours keep the marks, the waiting button, the reset and focus distinct', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page);
  const one = first(page), two = followUp(page);
  await hintButton(page).click(); await hintButton(page).click();
  // The waiting button keeps a border and its visible reason.
  await expect(hintButton(page)).not.toHaveCSS('border-top-width', '0px');
  await expect(one.locator('[data-lp-gate]')).toBeVisible();
  await check(one, 'tuesday'); await hintButton(page).click(); await check(two, 'monday');
  await expect(one.locator('[data-lp-mark="wrong"]')).toHaveCSS('border-style', 'double');
  await expect(one.locator('[data-lp-mark="missed"]')).toHaveCSS('border-top-style', 'dashed');
  await expect(two.locator('[data-lp-mark="wrong"]')).toHaveCSS('border-style', 'double');
  await expect(page.locator('[data-lp-restart]')).toHaveCSS('text-decoration-line', 'underline');
  await page.keyboard.press('Tab');
  for (const locator of [page.locator('[data-lp-restart]'), steps(page).nth(2), two.locator('[data-lp-feedback]')]) {
    await locator.focus();
    const style = await locator.evaluate(el => { const css = getComputedStyle(el); return [css.outlineWidth, css.outlineStyle, css.outlineColor]; });
    expect(style.slice(0, 2)).toEqual(['3px', 'solid']); expect(style[2]).not.toBe('rgba(0, 0, 0, 0)');
  }
});
