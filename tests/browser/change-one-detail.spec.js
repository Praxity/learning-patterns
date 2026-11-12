import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { expectChoiceMarks } from './choice-marks.js';

const english = JSON.parse(await readFile(new URL('../../patterns/change-one-detail/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/change-one-detail/examples/fr.json', import.meta.url)));
const TEXT_SPACING = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';

async function open(page, path = '/change-one-detail/en.html') {
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
const announcements = page => page.evaluate(() => window.lpAnnouncements);
const scan = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
const round = (root, i) => root.locator('[data-lp-round]').nth(i);
/** Choose an option in round i and check it. */
async function decide(root, i, value) {
  await round(root, i).locator(`input[value="${value}"]`).check();
  await round(root, i).locator('[data-lp-check]').click();
}
// Replace the demo with other content through the public render and enhance interface.
async function mount(page, content, { lang = 'en', state } = {}) {
  await open(page, `/change-one-detail/${lang}.html`);
  await page.evaluate(async ({ content, lang, state }) => {
    const { render } = await import('/patterns/change-one-detail/render.js');
    const { enhance } = await import('/patterns/change-one-detail/enhance.js');
    const { strings } = await import('/patterns/change-one-detail/strings.js');
    window.lpInstances.forEach(instance => instance.destroy());
    document.querySelector('main').innerHTML = render(content, strings[lang], { id: 'custom', lang });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings[lang], state: state === undefined ? undefined : { read: () => state, write: () => {} } });
  }, { content, lang, state });
}

test('keyboard journey: error, three locked decisions, one closing announcement and Start over', async ({ page }) => {
  await open(page); await observe(page);
  const rounds = page.locator('[data-lp-round]');
  await expect(rounds).toHaveCount(3);
  await expect(rounds.nth(0)).toBeVisible(); await expect(rounds.nth(1)).toBeHidden(); await expect(rounds.nth(2)).toBeHidden();
  await expect(page.locator('[data-lp-fallback]')).toBeHidden();

  // Checking with nothing chosen names the problem in the group and focuses its first option.
  await page.keyboard.press('Tab'); await expect(rounds.nth(0).locator('input').first()).toBeFocused();
  await page.keyboard.press('Tab'); await expect(rounds.nth(0).locator('[data-lp-check]')).toBeFocused();
  await page.keyboard.press('Enter');
  const error = rounds.nth(0).locator('[data-lp-error]');
  await expect(error).toBeVisible(); await expect(error).toHaveText('Choose an answer');
  await expect(error.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  await expect(rounds.nth(0).locator('fieldset')).toHaveAttribute('aria-describedby', await error.getAttribute('id'));
  await expect(rounds.nth(0).locator('input[aria-invalid="true"]')).toHaveCount(3);
  await expect(rounds.nth(0).locator('input').first()).toBeFocused();
  await expect(rounds.nth(1)).toBeHidden();
  expect(await announcements(page)).toEqual([]);

  // A choice clears the error. Billing is right for the first case.
  await page.keyboard.press('Space');
  await expect(error).toBeHidden();
  await expect(rounds.nth(0).locator('fieldset')).not.toHaveAttribute('aria-describedby');
  await expect(rounds.nth(0).locator('[aria-invalid]')).toHaveCount(0);
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  const feedback = i => rounds.nth(i).locator('[data-lp-feedback]');
  await expect(feedback(0)).toBeFocused();
  await expect(feedback(0)).toHaveText(`Correct. ${english.explanation}`);
  await expect(rounds.nth(0).locator('[data-lp-check]')).toBeHidden();
  await expect(rounds.nth(0).locator('input:disabled')).toHaveCount(3);
  await expect(rounds.nth(0).locator('[data-lp-mark]')).toHaveCount(1);
  await expect(rounds.nth(0).locator('label:has(input[value="billing"])')).toHaveAttribute('data-lp-mark', 'correct');
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: ['billing'] });

  // The first change opens under the locked decision; the result so far was read by focus alone.
  await expect(rounds.nth(1)).toBeVisible(); await expect(rounds.nth(2)).toBeHidden();
  await expect(rounds.nth(1).locator('h3')).toHaveText('Now one detail changes');
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  expect(await announcements(page)).toEqual([]);

  // Tab skips the locked round. Billing again is now wrong: the answer moved to security.
  await page.keyboard.press('Tab'); await expect(rounds.nth(1).locator('input').first()).toBeFocused();
  await page.keyboard.press('Space'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(feedback(1)).toBeFocused();
  await expect(feedback(1)).toHaveText(`Incorrect. Correct answer: Security. This detail changes the answer. ${english.changes[0].explanation}`);
  await expect(rounds.nth(1).locator('label:has(input[value="billing"])')).toHaveAttribute('data-lp-mark', 'wrong');
  await expect(rounds.nth(1).locator('label:has(input[value="security"])')).toHaveAttribute('data-lp-mark', 'missed');
  await expect(rounds.nth(1).locator('label:has(input[value="ask"])')).not.toHaveAttribute('data-lp-mark');
  await expect(rounds.nth(2).locator('h3')).toHaveText('Now a different detail changes instead');
  expect(await announcements(page)).toEqual([]);

  // The last decision: focus reads its feedback and the status region adds the score and the rule once.
  await page.keyboard.press('Tab'); await expect(rounds.nth(2).locator('input').first()).toBeFocused();
  await page.keyboard.press('Space'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(feedback(2)).toBeFocused();
  await expect(feedback(2)).toHaveText(`Correct. This detail doesn't change the answer. ${english.changes[1].explanation}`);
  const result = page.locator('[data-lp-result]');
  await expect(result).toBeVisible();
  await expect(result.locator('[data-lp-score]')).toHaveText('You got 2 of 3 right.');
  await expect(result.locator('h3')).toHaveText('What decides the answer');
  await expect(result.locator('h3 + p')).toHaveText(english.rule);
  expect(await announcements(page)).toEqual([`You got 2 of 3 right. ${english.rule}`]);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: ['billing', 'billing', 'billing'] });
  await expect(page.locator('input:disabled')).toHaveCount(9);
  await expect(page.locator('[data-lp-check]:visible')).toHaveCount(0);
  await expectChoiceMarks(page);

  // Start over is the only control left.
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-restart]')).toBeFocused();
  await expect(page.locator('[data-lp-restart]')).toHaveText('Start over');
  await page.keyboard.press('Enter');
  await expect(rounds.nth(0).locator('input').first()).toBeFocused();
  await expect(page.locator('input:checked')).toHaveCount(0); await expect(page.locator('input:disabled')).toHaveCount(0);
  await expect(page.locator('[data-lp-mark]')).toHaveCount(0); await expect(page.locator('.lp-choice-mark')).toHaveCount(0);
  await expect(rounds.nth(1)).toBeHidden(); await expect(rounds.nth(2)).toBeHidden();
  await expect(feedback(0)).toBeHidden(); await expect(result).toBeHidden(); await expect(page.locator('[data-lp-restart]')).toBeHidden();
  await expect(rounds.nth(0).locator('[data-lp-check]')).toBeVisible();
  expect(await announcements(page)).toEqual([`You got 2 of 3 right. ${english.rule}`, 'Answers cleared.']);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: [] });
  // A second pass works after the reset, and a new result replaces the stale status.
  await decide(page, 0, 'security');
  await expect(feedback(0)).toHaveText(`Incorrect. Correct answer: Billing. ${english.explanation}`);
  await expect(page.locator('[role="status"]')).toHaveText('');
});

for (const [lang, content, labels] of [
  ['en', english, { first: 'Now one detail changes', next: 'Now a different detail changes instead', before: 'Before: ', now: 'Now: ', same: 'Everything else is as it was at the start.', moves: 'This detail changes the answer.', stays: "This detail doesn't change the answer.", check: 'Check my answer', summary: 'You got 3 of 3 right.', rule: 'What decides the answer', correct: 'Correct. ', restart: 'Start over', cleared: 'Answers cleared.' }],
  ['fr', french, { first: 'Maintenant, un détail change', next: 'Maintenant, c’est un autre détail qui change', before: 'Avant : ', now: 'Maintenant : ', same: 'Tout le reste est comme au départ.', moves: 'Ce détail change la réponse.', stays: 'Ce détail ne change pas la réponse.', check: 'Vérifier ma réponse', summary: 'Bonnes réponses : 3 sur 3.', rule: 'Ce qui détermine la réponse', correct: 'Correct. ', restart: 'Recommencer', cleared: 'Réponses effacées.' }]
]) {
  const typeset = value => lang === 'fr' ? value.replace(/ (?=[:$])/g, ' ').replace(/ (?=[?!;])/g, ' ') : value;

  test(`card order, the change shown in place, and an all-correct run (${lang})`, async ({ page }) => {
    await open(page, `/change-one-detail/${lang}.html`); await observe(page);
    const root = page.locator('[data-lp-pattern]');
    await expect(root).toHaveAttribute('lang', lang);
    // No scene bar: the title, the context, the case, then the question as the group's name.
    await expect(root.locator('.lp-scene')).toHaveCount(0);
    await expect(root.locator('> h2.lp-heading')).toHaveText(content.title);
    await expect(root.locator('> .lp-context')).toHaveText(content.context);
    await expect(round(root, 0).locator('.lp-quote')).toHaveText(typeset(content.case));
    await expect(round(root, 0).locator('del, ins')).toHaveCount(0);
    await expect(round(root, 0).getByRole('group', { name: typeset(content.question) })).toBeVisible();
    await expect(round(root, 0).locator('[data-lp-check]')).toHaveText(labels.check);
    for (const [n, option] of content.options.entries()) await expect(round(root, 0).getByRole('radio').nth(n)).toHaveAccessibleName(option.text);

    await decide(root, 0, content.correct);
    for (const [i, change] of content.changes.entries()) {
      const section = round(root, i + 1);
      await expect(section.locator('h3')).toHaveText(i ? labels.next : labels.first);
      // Old wording struck through, new wording highlighted and heavier; hidden words say which is which.
      const old = section.locator('.lp-quote del'), fresh = section.locator('.lp-quote ins');
      await expect(old).toHaveText(labels.before + typeset(change.from));
      await expect(fresh).toHaveText(labels.now + typeset(change.to));
      await expect(old).toHaveCSS('text-decoration-line', 'line-through');
      await expect(fresh).toHaveCSS('font-weight', '600');
      await expect(fresh).toHaveCSS('background-color', 'rgb(255, 228, 154)');
      await expect(fresh).toHaveCSS('text-decoration-line', 'none');
      for (const label of [old.locator('.lp-visually-hidden'), fresh.locator('.lp-visually-hidden')]) expect((await label.boundingBox()).width).toBeLessThanOrEqual(1);
      // Each change starts from the first case: with the old wording put back, the rest matches it.
      expect(await section.locator('.lp-quote').evaluate(quote => { const copy = quote.cloneNode(true); copy.querySelectorAll('.lp-visually-hidden, ins').forEach(node => node.remove()); return copy.textContent.replace(/ (?= )/, ''); })).toBe(typeset(content.case));
      // The first change follows the start directly, so only later changes say the rest is as it was.
      if (i) await expect(section.locator('.lp-quote + .lp-small')).toHaveText(labels.same);
      else await expect(section.locator('.lp-quote + .lp-small')).toHaveCount(0);
      await expect(section.getByRole('group', { name: typeset(content.question) })).toBeVisible();
      await decide(root, i + 1, change.correct);
      await expect(section.locator('[data-lp-feedback]')).toHaveText(`${labels.correct}${change.correct === content.correct ? labels.stays : labels.moves} ${typeset(change.explanation)}`);
      await expect(section.locator('[data-lp-feedback] strong')).toHaveText(change.correct === content.correct ? labels.stays : labels.moves);
    }
    await expect(root.locator('[data-lp-mark="correct"]')).toHaveCount(3);
    await expect(root.locator('[data-lp-mark]')).toHaveCount(3);
    await expect(root.locator('[data-lp-score]')).toHaveText(labels.summary);
    await expect(root.locator('[data-lp-result] h3')).toHaveText(labels.rule);
    await expect(root.locator('[data-lp-restart]')).toHaveText(labels.restart);
    expect(await announcements(page)).toEqual([`${labels.summary} ${typeset(content.rule)}`]);
    await expectChoiceMarks(page);
    await root.locator('[data-lp-restart]').click();
    expect((await announcements(page)).at(-1)).toBe(labels.cleared);
  });

  test(`no JavaScript keeps the steps: the first case, each change, and answers behind disclosures (${lang})`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage(); await page.goto(`/change-one-detail/${lang}.html`);
    await expect(page.getByRole('radio')).toHaveCount(3);
    await page.getByRole('radio').first().check(); await expect(page.getByRole('radio').first()).toBeChecked();
    await expect(page.locator('[data-lp-check]:visible, [data-lp-restart]:visible')).toHaveCount(0);
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    const fallback = page.locator('[data-lp-fallback]');
    await expect(fallback).toBeVisible();
    await expect(fallback.locator('details')).toHaveCount(4);
    await expect(fallback.locator('details[open]')).toHaveCount(0);
    await expect(fallback.locator('h3')).toHaveText([labels.first, labels.next]);
    await expect(fallback.locator('.lp-quote ins')).toHaveText(content.changes.map(change => labels.now + typeset(change.to)));
    // Answers are not on screen until their disclosure is opened.
    await expect(fallback.getByText(typeset(content.changes[0].explanation))).toBeHidden();
    for (const summary of await fallback.locator('summary').all()) await summary.click();
    const option = id => content.options.find(o => o.id === id).text;
    await expect(fallback.locator('details').nth(0)).toContainText(option(content.correct));
    await expect(fallback.locator('details').nth(0)).toContainText(typeset(content.explanation));
    await expect(fallback.locator('details').nth(1)).toContainText(`${labels.moves} `);
    await expect(fallback.locator('details').nth(1)).toContainText(option(content.changes[0].correct));
    await expect(fallback.locator('details').nth(1)).toContainText(typeset(content.changes[0].explanation));
    await expect(fallback.locator('details').nth(2)).toContainText(`${labels.stays} `);
    await expect(fallback.locator('details').nth(2)).toContainText(typeset(content.changes[1].explanation));
    await expect(fallback.locator('details').nth(3).locator('summary')).toHaveText(labels.rule);
    await expect(fallback.locator('details').nth(3)).toContainText(typeset(content.rule));
    await context.close();
  });

  test(`axe on unchanged server HTML with the answers open (${lang})`, async ({ page }) => {
    // axe needs scripting enabled. Block enhancement to audit the same native baseline.
    await page.route('**/change-one-detail/enhance.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export function enhance() { return { destroy() {} }; }' }));
    await open(page, `/change-one-detail/${lang}.html`);
    await scan(page);
    for (const summary of await page.locator('summary').all()) await summary.click();
    await scan(page);
  });

  test(`320 CSS pixels with text spacing has no scroll or clipping at every stage (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await open(page, `/change-one-detail/${lang}.html`);
    await page.addStyleTag({ content: TEXT_SPACING });
    for (const stage of ['initial', 'error', 'first', 'second', 'result']) {
      if (stage === 'error') await round(page, 0).locator('[data-lp-check]').click();
      if (stage === 'first') await decide(page, 0, 'ask');
      if (stage === 'second') await decide(page, 1, 'billing');
      if (stage === 'result') await decide(page, 2, 'security');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), stage).toBe(true);
      const problems = await page.evaluate(() => {
        const card = document.querySelector('[data-lp-pattern]').getBoundingClientRect();
        return [...document.querySelectorAll('[data-lp-pattern] :is(p, label, legend, button, li, h2, h3, del, ins, .lp-choice-mark)')]
          .filter(el => el.getClientRects().length && !el.matches('[role="status"]') && !el.closest('.lp-visually-hidden'))
          .filter(el => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline' || el.getBoundingClientRect().right > card.right + 1 || el.getBoundingClientRect().left < card.left - 1)
          .map(el => el.textContent);
      });
      expect(problems, stage).toEqual([]);
    }
    // Wrong, missed and correct marks all fit inside their rows at this width.
    await expect(page.locator('[data-lp-mark]')).toHaveCount(6);
  });
}

for (const path of ['/change-one-detail/en.html', '/change-one-detail/fr.html', '/change-one-detail/two.html']) {
  test(`axe at load, error, each decision, the summary and reset: ${path}`, async ({ page }) => {
    await open(page, path); await scan(page);
    const roots = await page.locator('[data-lp-pattern]').all();
    for (const root of roots) await round(root, 0).locator('[data-lp-check]').click();
    await scan(page);
    for (const root of roots) await decide(root, 0, 'billing');
    await scan(page);
    for (const root of roots) await decide(root, 1, 'ask');
    await scan(page);
    for (const root of roots) await decide(root, 2, 'security');
    await scan(page);
    for (const root of roots) await root.locator('[data-lp-restart]').click();
    await scan(page);
  });
}

test('a checked decision cannot be changed or checked twice', async ({ page }) => {
  await open(page);
  await decide(page, 0, 'security');
  const first = round(page, 0);
  await expect(first.locator('input[value="security"]')).toBeChecked();
  for (const radio of await first.locator('input').all()) await expect(radio).toBeDisabled();
  // A stray activation of the hidden button changes nothing.
  await first.locator('[data-lp-check]').evaluate(button => { button.hidden = false; button.disabled = false; button.click(); });
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: ['security'] });
  await expect(first.locator('.lp-choice-mark')).toHaveCount(2);
  // Locked rows show no pointer, and the earlier decision stays visible while the next is made.
  await expect(first.locator('label').first()).toHaveCSS('cursor', 'default');
  await round(page, 1).locator('input[value="ask"]').check();
  await expect(first.locator('[data-lp-feedback]')).toBeVisible();
  await expect(first.locator('label:has(input[value="security"])')).toHaveAttribute('data-lp-mark', 'wrong');
});

for (const width of [1280, 390]) test(`checking brings the next change into view and keeps the feedback above it at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await open(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await decide(page, 0, 'billing');
  await decide(page, 1, 'security');
  // Scroll positions are whole pixels, so an edge can sit a fraction of a pixel outside.
  for (const locator of [round(page, 1).locator('[data-lp-feedback]'), round(page, 2).locator('h3'), round(page, 2).locator('[data-lp-check]')]) await expect(locator).toBeInViewport({ ratio: .95 });
  await decide(page, 2, 'billing');
  for (const locator of [round(page, 2).locator('[data-lp-feedback]'), page.locator('[data-lp-result] h3 + p'), page.locator('[data-lp-restart]')]) await expect(locator).toBeInViewport({ ratio: .95 });
  // Feedback sits beside its options: inside the group, right under the last row.
  const gap = await round(page, 2).evaluate(section => section.querySelector('[data-lp-feedback]').getBoundingClientRect().top - section.querySelector('label:last-of-type').getBoundingClientRect().bottom);
  expect(gap).toBeGreaterThanOrEqual(8); expect(gap).toBeLessThanOrEqual(16);
  await page.locator('[data-lp-restart]').click();
  await expect(page.locator('h2.lp-heading')).toBeInViewport();
  await expect(round(page, 0).locator('.lp-quote')).toBeInViewport({ ratio: .95 });
});

for (const [picks, open_, locked] of [[['billing'], 2, 3], [['ask', 'security'], 3, 6]]) {
  test(`saved decisions restore locked and silent, with the next change open: ${picks.join(', ')}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, { picks });
    await open(page);
    await expect(page.locator('[data-lp-round]:visible')).toHaveCount(open_);
    await expect(page.locator('input:disabled')).toHaveCount(locked);
    await expect(page.locator('input:checked')).toHaveCount(picks.length);
    await expect(page.locator('[data-lp-feedback]:visible')).toHaveCount(picks.length);
    await expect(page.locator('[data-lp-check]:visible')).toHaveCount(1);
    await expect(page.locator('[data-lp-result]')).toBeHidden(); await expect(page.locator('[data-lp-restart]')).toBeHidden();
    await expect(page.locator('[role="status"]')).toHaveText('');
    expect(await page.evaluate(() => document.activeElement === document.body && scrollY === 0)).toBe(true);
    // The restored learner carries on from the open round.
    await decide(page, picks.length, 'billing');
    expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: [...picks, 'billing'] });
  });
}

test('a finished saved case restores its marks, summary and Start over without speaking', async ({ page }) => {
  await page.addInitScript(value => { window.lpSeed = value; }, { picks: ['billing', 'security', 'ask'] });
  await open(page);
  await expect(page.locator('[data-lp-round]:visible')).toHaveCount(3);
  await expect(page.locator('input:disabled')).toHaveCount(9);
  await expect(page.locator('[data-lp-check]:visible')).toHaveCount(0);
  await expect(page.locator('[data-lp-score]')).toHaveText('You got 2 of 3 right.');
  await expect(page.locator('[data-lp-mark="correct"]')).toHaveCount(2);
  await expect(page.locator('[data-lp-mark="wrong"]')).toHaveCount(1);
  await expect(page.locator('[data-lp-mark="missed"]')).toHaveCount(1);
  await expect(page.locator('[data-lp-restart]')).toBeVisible();
  await expect(page.locator('[role="status"]')).toHaveText('');
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
});

for (const seed of [{ picks: ['nobody'] }, { picks: 'billing' }, { picks: ['billing', 'billing', 'billing', 'billing'] }, { picks: ['billing'], shown: true }, 'not an object']) {
  test(`invalid saved state is ignored: ${JSON.stringify(seed)}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, seed); await open(page);
    await expect(page.locator('input:checked')).toHaveCount(0); await expect(page.locator('input:disabled')).toHaveCount(0);
    await expect(page.locator('[data-lp-round]:visible')).toHaveCount(1);
    await expect(page.locator('[data-lp-result]')).toBeHidden(); await expect(page.locator('[role="status"]')).toHaveText('');
  });
}

test('the pattern works in memory without a state adapter', async ({ page }) => {
  await mount(page, english);
  await decide(page, 0, 'billing'); await decide(page, 1, 'security'); await decide(page, 2, 'billing');
  await expect(page.locator('[data-lp-score]')).toHaveText('You got 3 of 3 right.');
  await page.locator('[data-lp-restart]').click();
  await expect(page.locator('[data-lp-round]:visible')).toHaveCount(1);
});

test('one change makes two decisions, and four options keep their letter keys', async ({ page }) => {
  const content = { ...english, options: [...english.options, { id: 'close', text: 'Close the ticket' }], changes: [english.changes[0]] };
  await mount(page, content);
  await expect(page.locator('[data-lp-round]')).toHaveCount(2);
  await expect(round(page, 0).getByRole('radio')).toHaveCount(4);
  expect(await round(page, 0).locator('label').evaluateAll(rows => rows.map(row => getComputedStyle(row, '::before').content))).toEqual(Array(4).fill('counter(lp-key, upper-alpha) / ""'));
  await decide(page, 0, 'close'); await decide(page, 1, 'security');
  await expect(page.locator('[data-lp-score]')).toHaveText('You got 1 of 2 right.');
  await expect(page.locator('[data-lp-restart]')).toBeVisible();
});

test('worst-case authored text wraps inside the card at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const token = 'Q3-Client-Report_Northwind_Industries_Holdings_FINAL_v12_approved-by-legal.xlsx';
  const content = structuredClone(english);
  content.title = `Route ${token}`;
  content.case = `${token} ${english.case} ${'A long closing sentence about nothing in particular. '.repeat(6)}`.slice(0, 600);
  content.options[2].text = `Back to the customer for more detail about ${token} and every other attachment they sent this week`;
  content.changes[0].to = `That is not my name, and I have never used ${token.slice(0, 60)}.`;
  content.rule = `${english.rule} ${token}`;
  await mount(page, content, { state: { picks: ['ask', 'ask', 'ask'] } });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const overflow = await page.evaluate(() => {
    const card = document.querySelector('[data-lp-pattern]').getBoundingClientRect();
    return Math.max(...[...document.querySelectorAll('[data-lp-pattern] *')].filter(el => el.getClientRects().length && !el.closest('.lp-visually-hidden')).map(el => el.getBoundingClientRect().right - card.right));
  });
  expect(overflow).toBeLessThanOrEqual(0);
  // A mark that cannot share the first line drops under the option text, never under the key.
  const mark = await round(page, 0).locator('label:has(input[value="ask"])').evaluate(row => {
    const text = row.querySelector('span:not(.lp-choice-mark)').getBoundingClientRect(), mark = row.querySelector('.lp-choice-mark').getBoundingClientRect();
    return { below: mark.top - text.bottom, indent: mark.left - text.left };
  });
  expect(mark.below).toBeGreaterThanOrEqual(0); expect(Math.abs(mark.indent)).toBeLessThanOrEqual(1);
});

test('two instances have unique ids and independent decisions', async ({ page }) => {
  await open(page, '/change-one-detail/two.html');
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  const names = await page.locator('input').evaluateAll(els => [...new Set(els.map(el => el.name))]); expect(names).toHaveLength(6);
  const roots = page.locator('[data-lp-pattern]');
  await decide(roots.first(), 0, 'billing');
  await expect(roots.nth(1).locator('input:checked')).toHaveCount(0);
  await expect(roots.nth(1).locator('[data-lp-round]:visible')).toHaveCount(1);
  await round(roots.nth(1), 0).locator('[data-lp-check]').click();
  await expect(roots.nth(1).locator('[data-lp-error]:visible')).toHaveCount(1);
  await expect(roots.first().locator('[data-lp-error]:visible')).toHaveCount(0);
  await expect(roots.first().locator('[data-lp-round]:visible')).toHaveCount(2);
});

test('enhance twice returns one instance; destroy restores the no-JavaScript view and can re-enhance', async ({ page }) => {
  await open(page); expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  const nodes = await page.locator('[data-lp-pattern] *').count();
  await decide(page, 0, 'billing'); await decide(page, 1, 'security');
  await page.evaluate(() => window.lpInstances[0].destroy());
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await expect(page.locator('[data-lp-round]:visible')).toHaveCount(1);
  await expect(page.locator('[data-lp-check]:visible, [data-lp-restart]:visible')).toHaveCount(0);
  await expect(page.locator('input:checked, input:disabled, [data-lp-mark], .lp-choice-mark')).toHaveCount(0);
  await expect(page.locator('[data-lp-feedback]:visible')).toHaveCount(0);
  await expect(page.locator('[role="status"]')).toHaveText('');
  expect(await page.locator('[data-lp-pattern] *').count()).toBe(nodes);
  // Listeners are gone: a destroyed instance writes nothing.
  const before = await page.evaluate(() => window.lpSaved);
  await page.locator('input').first().check();
  await round(page, 0).locator('[data-lp-check]').evaluate(button => { button.hidden = false; button.click(); button.hidden = true; });
  expect(await page.evaluate(() => window.lpSaved)).toEqual(before);
  // The page's adapter still holds the two decisions, so a new instance restores them.
  expect(await page.evaluate(() => { const instance = window.lpEnhance(); return instance === window.lpEnhance() && instance !== window.lpInstances[0]; })).toBe(true);
  await expect(page.locator('[data-lp-fallback]')).toBeHidden();
  await expect(page.locator('[data-lp-round]:visible')).toHaveCount(3);
  await decide(page, 2, 'billing');
  await expect(page.locator('[data-lp-score]')).toHaveText('You got 3 of 3 right.');
});

test('missing and mismatched markup fail loudly', async ({ page }) => {
  await open(page);
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/change-one-detail/enhance.js');
    const { strings } = await import('/patterns/change-one-detail/strings.js');
    enhance(document.createElement('section'), { content, strings: strings.en });
  }, english)).rejects.toThrow('Missing change-one-detail markup');
  for (const violation of ['missing-round', 'missing-radio', 'wrong-value', 'not-radio', 'missing-label', 'missing-error', 'missing-feedback', 'missing-check', 'missing-status']) {
    await open(page);
    await page.evaluate(kind => {
      window.lpInstances[0].destroy();
      if (kind === 'missing-round') document.querySelectorAll('[data-lp-round]')[2].remove();
      if (kind === 'missing-radio') document.querySelector('input').closest('label').remove();
      if (kind === 'wrong-value') document.querySelector('input').value = 'bad';
      if (kind === 'not-radio') document.querySelector('input').type = 'checkbox';
      if (kind === 'missing-label') document.querySelector('label').replaceWith(document.querySelector('input'));
      if (kind === 'missing-error') document.querySelector('[data-lp-error]').remove();
      if (kind === 'missing-feedback') document.querySelectorAll('[data-lp-feedback]')[1].remove();
      if (kind === 'missing-check') document.querySelector('[data-lp-check]').remove();
      if (kind === 'missing-status') document.querySelector('[role="status"]').remove();
    }, violation);
    await expect(page.evaluate(() => window.lpEnhance()), violation).rejects.toThrow(/Invalid change-one-detail|Missing change-one-detail/);
  }
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/change-one-detail/enhance.js');
    const { strings } = await import('/patterns/change-one-detail/strings.js');
    window.lpInstances[0].destroy();
    enhance(document.querySelector('[data-lp-pattern]'), { content: { ...content, changes: [] }, strings: strings.en });
  }, english)).rejects.toThrow(/changes/);
});

test('shared look: one card, sans headings, keyed rows, a quiet reset and body-size feedback', async ({ page }) => {
  await open(page);
  const root = page.locator('[data-lp-pattern]');
  await expect(root.locator('.lp-box, .lp-scene')).toHaveCount(0);
  await expect(root.locator('h2.lp-heading')).toHaveCSS('font-size', '21px');
  // Under a card title the repeated question steps down one size.
  await expect(round(root, 0).locator('legend')).toHaveCSS('font-size', '19px');
  await expect(round(root, 0).locator('legend')).toHaveCSS('font-weight', '600');
  await decide(root, 0, 'billing'); await decide(root, 1, 'billing'); await decide(root, 2, 'billing');
  for (const locator of [round(root, 1).locator('.lp-small'), root.locator('.lp-choice-mark').first(), root.locator('[data-lp-restart]')]) await expect(locator).toHaveCSS('font-size', '16px');
  for (const locator of [round(root, 1).locator('.lp-quote'), round(root, 1).locator('[data-lp-feedback]'), root.locator('[data-lp-score]'), root.locator('[data-lp-result] h3 + p')]) await expect(locator).toHaveCSS('font-size', '17px');
  await expect(round(root, 1).locator('h3')).toHaveCSS('font-weight', '600');
  await expect(root.locator('[data-lp-restart]')).toHaveClass(/lp-button-quiet/);
  await expect(root.locator('[data-lp-restart] svg[aria-hidden="true"]')).toHaveCount(1);
  // Later rounds and the summary are sections with a top rule; the first round has none.
  await expect(round(root, 0)).toHaveCSS('border-top-width', '0px');
  for (const section of [round(root, 1), round(root, 2), root.locator('[data-lp-result]')]) await expect(section).toHaveCSS('border-top-width', '1px');
  // Keyboard focus on feedback draws the shared ring.
  await page.keyboard.press('Tab');
  await round(root, 2).locator('[data-lp-feedback]').focus();
  await expect(round(root, 2).locator('[data-lp-feedback]')).toHaveCSS('outline-width', '3px');
  // The highlight keeps AA contrast against the ink.
  const contrast = await round(root, 1).locator('ins').evaluate(el => {
    const lum = value => { const [r, g, b] = value.match(/[\d.]+/g).slice(0, 3).map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
    const css = getComputedStyle(el), a = lum(css.color), b = lum(css.backgroundColor);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

test('forced colours keep the change, the marks, the reset and focus distinct', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page);
  await decide(page, 0, 'billing'); await decide(page, 1, 'billing'); await decide(page, 2, 'billing');
  const second = round(page, 1);
  await expect(second.locator('del')).toHaveCSS('text-decoration-line', 'line-through');
  await expect(second.locator('ins')).toHaveCSS('text-decoration-line', 'underline');
  await expect(second.locator('ins')).toHaveCSS('font-weight', '600');
  await expect(second.locator('[data-lp-mark="wrong"]')).toHaveCSS('border-style', 'double');
  await expect(second.locator('[data-lp-mark="missed"]')).toHaveCSS('border-top-style', 'dashed');
  await expect(page.locator('[data-lp-restart]')).toHaveCSS('text-decoration-line', 'underline');
  await page.keyboard.press('Tab');
  for (const locator of [page.locator('[data-lp-restart]'), second.locator('[data-lp-feedback]')]) {
    await locator.focus();
    const style = await locator.evaluate(el => { const css = getComputedStyle(el); return [css.outlineWidth, css.outlineStyle, css.outlineColor]; });
    expect(style.slice(0, 2)).toEqual(['3px', 'solid']); expect(style[2]).not.toBe('rgba(0, 0, 0, 0)');
  }
});
