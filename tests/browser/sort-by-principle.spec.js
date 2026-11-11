import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { frenchTypography } from '../../lib/html.js';
import { expectChoiceMarks } from './choice-marks.js';

const english = JSON.parse(await readFile(new URL('../../patterns/sort-by-principle/examples/en.json', import.meta.url), 'utf8'));
const french = JSON.parse(await readFile(new URL('../../patterns/sort-by-principle/examples/fr.json', import.meta.url), 'utf8'));
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const TEXT_SPACING = '.lp, .lp * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } .lp p { margin-bottom: 2em !important; }';
const ROWS = ['name', 'ask', 'agree'];

async function open(page, lang = 'en', saved) {
  if (saved !== undefined) await page.addInitScript(value => { window.lpSeed = value; }, saved);
  await page.goto(`/sort-by-principle/${lang}.html`);
  await page.waitForFunction(() => window.lpReady);
}
async function observeStatus(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    const status = document.querySelector('[role="status"]');
    new MutationObserver(() => { if (status.textContent) window.lpAnnouncements.push(status.textContent); })
      .observe(status, { childList: true, characterData: true, subtree: true });
  });
}
const announcements = page => page.evaluate(() => window.lpAnnouncements);
const panel = (page, c) => page.locator('[data-lp-case]').nth(c);
const axe = async page => (await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations;
const feedback = (page, c) => panel(page, c).locator('[data-lp-feedback]');

/** Choose a principle and check the case, then wait for focus on its feedback. */
async function answer(page, c, id) {
  await panel(page, c).locator(`input[value="${id}"]`).check();
  await panel(page, c).locator('[data-lp-check]').click();
  await expect(feedback(page, c)).toBeFocused();
}
/** Answer every case, moving on after each. */
async function answerAll(page, picks) {
  for (const [c, id] of picks.entries()) {
    await answer(page, c, id);
    if (c < picks.length - 1) await panel(page, c).locator('[data-lp-next]').click();
  }
}

async function overflowing(page) {
  return page.evaluate(() => {
    const clipped = [...document.querySelectorAll('.lp :is(label, legend, button, li, p, h2, h3, summary, .lp-choice-mark)')].filter(el => {
      if (!el.getClientRects().length || el.closest('.lp-visually-hidden')) return false;
      const rect = el.getBoundingClientRect();
      return rect.left < 0 || rect.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 2;
    }).map(el => el.outerHTML.slice(0, 120));
    return { page: document.documentElement.scrollWidth - innerWidth, clipped };
  });
}

test('keyboard journey: error, a miss, the lure, a hit, the result with mixed-up pairs and Start over', async ({ page }) => {
  await open(page); await observeStatus(page);
  await expect(page.locator('[data-lp-case]:visible')).toHaveCount(1);
  await expect(panel(page, 0).locator('[data-lp-case-heading]')).toHaveText('Case 1 of 4');
  await expect(page.locator('[data-lp-fallback]:visible, [data-lp-result]:visible')).toHaveCount(0);
  // Each row gives the principle's name, then its rule.
  await expect(panel(page, 0).getByRole('radio').nth(1)).toHaveAccessibleName(/^Ask an open question\s*\.\s+The facts are agreed, but the cause is not known\. Ask what got in the way\.$/);

  // Checking with nothing chosen names the problem in the group and focuses its first option.
  await page.keyboard.press('Tab'); await expect(panel(page, 0).getByRole('radio').first()).toBeFocused();
  await page.keyboard.press('Tab'); await expect(panel(page, 0).locator('[data-lp-check]')).toBeFocused();
  await page.keyboard.press('Enter');
  const error = panel(page, 0).locator('[data-lp-error]');
  await expect(error).toHaveText('Choose a principle');
  await expect(panel(page, 0).locator('fieldset')).toHaveAttribute('aria-describedby', await error.getAttribute('id'));
  await expect(panel(page, 0).getByRole('radio').first()).toBeFocused();

  // Case 1: Name the behaviour is wrong but not the lure, so only the deciding fact shows.
  await page.keyboard.press('Space');
  await expect(error).toBeHidden();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(feedback(page, 0)).toBeFocused();
  await expect(feedback(page, 0)).toHaveText(`Incorrect. Correct answer: Agree the next action. ${english.cases[0].decides}`);
  await expect(panel(page, 0).locator('label:has(input[value="name"])')).toHaveAttribute('data-lp-mark', 'wrong');
  await expect(panel(page, 0).locator('label:has(input[value="agree"])')).toHaveAttribute('data-lp-mark', 'missed');
  await expect(panel(page, 0).locator('label:has(input[value="ask"])')).not.toHaveAttribute('data-lp-mark');
  await expect(panel(page, 0).getByRole('radio')).toHaveCount(3);
  await expect(panel(page, 0).locator('input:disabled')).toHaveCount(3);
  await expect(panel(page, 0).locator('[data-lp-check]')).toBeHidden();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: ['name'] });

  // Next case replaces this one and focus reads its heading.
  await page.keyboard.press('Tab'); await expect(panel(page, 0).locator('[data-lp-next]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(panel(page, 1).locator('[data-lp-case-heading]')).toBeFocused();
  await expect(panel(page, 1).locator('[data-lp-case-heading]')).toHaveText('Case 2 of 4');
  await expect(page.locator('[data-lp-case]:visible')).toHaveCount(1);

  // Case 2: Agree is the lure, so the surface detail comes first, with the principle in italics.
  await page.keyboard.press('Tab'); await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await expect(panel(page, 1).locator('input[value="agree"]')).toBeChecked();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(feedback(page, 1)).toBeFocused();
  await expect(feedback(page, 1)).toHaveText(`Incorrect. Correct answer: Name the behaviour. ${english.cases[1].looksLike} ${english.cases[1].decides}`);
  await expect(feedback(page, 1).locator('em')).toHaveText(['Agree the next action']);

  // Case 3: a hit still gives the deciding fact.
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await answer(page, 2, 'ask');
  await expect(feedback(page, 2)).toHaveText(`Correct. ${english.cases[2].decides}`);
  await expect(panel(page, 2).locator('[data-lp-mark]')).toHaveCount(1);
  expect(await announcements(page)).toEqual([]);

  // Case 4, the last: focus reads the feedback and the status region adds the result once.
  await panel(page, 2).locator('[data-lp-next]').click();
  await answer(page, 3, 'ask');
  const result = page.locator('[data-lp-result]');
  await expect(result.locator('[data-lp-score]')).toHaveText('You got 1 of 4 cases right.');
  await expect(result.locator('h3')).toHaveText('Principles you mixed up');
  await expect(result.locator('li')).toHaveText(['Name the behaviour and Agree the next action: 2 cases', 'Name the behaviour and Ask an open question: 1 case']);
  await expect(result.locator('li em')).toHaveText(['Name the behaviour', 'Agree the next action', 'Name the behaviour', 'Ask an open question']);
  expect(await announcements(page)).toEqual(['You got 1 of 4 cases right. Principles you mixed up: Name the behaviour and Agree the next action: 2 cases. Name the behaviour and Ask an open question: 1 case.']);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: ['name', 'agree', 'ask', 'ask'] });
  await expect(page.locator('[data-lp-next]:visible, [data-lp-check]:visible')).toHaveCount(0);
  await expectChoiceMarks(page);

  // Start over is the next stop, and returns to the first case.
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-restart]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(panel(page, 0).locator('[data-lp-case-heading]')).toBeFocused();
  await expect(page.locator('[data-lp-case]:visible')).toHaveCount(1);
  await expect(panel(page, 0)).toBeVisible();
  await expect(page.locator('input:checked, input:disabled, [data-lp-mark], .lp-choice-mark')).toHaveCount(0);
  await expect(page.locator('[data-lp-feedback]:visible, [data-lp-result]:visible')).toHaveCount(0);
  await expect(panel(page, 0).locator('[data-lp-check]')).toBeVisible();
  expect((await announcements(page)).at(-1)).toBe('Answers cleared.');
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: [] });
});

test('French journey: French marks, feedback, typography, and no pairs when every case is right', async ({ page }) => {
  await open(page, 'fr'); await observeStatus(page);
  await expect(panel(page, 0).locator('[data-lp-case-heading]')).toHaveText('Cas 1 sur 4');
  await answer(page, 0, 'ask');
  await expect(feedback(page, 0)).toHaveText(frenchTypography(`Incorrect. Bonne réponse : Convenir de la prochaine action. ${french.cases[0].looksLike} ${french.cases[0].decides}`, 'fr'));
  await expect(panel(page, 0).locator('[data-lp-mark="wrong"] .lp-choice-mark')).toHaveText('Incorrect');
  await expect(panel(page, 0).locator('[data-lp-mark="missed"] .lp-choice-mark')).toHaveText('Bonne réponse');
  await panel(page, 0).locator('[data-lp-next]').click();
  for (const [c, id] of [[1, 'name'], [2, 'ask'], [3, 'name']]) {
    await answer(page, c, id);
    if (c < 3) await panel(page, c).locator('[data-lp-next]').click();
  }
  await expect(page.locator('[data-lp-score]')).toHaveText('Vous avez réussi 3 cas sur 4.');
  await expect(page.locator('[data-lp-result] li')).toHaveText([frenchTypography('Poser une question ouverte et Convenir de la prochaine action : 1 cas', 'fr')]);
  await expect(page.locator('[data-lp-restart]')).toHaveText('Recommencer');

  await page.locator('[data-lp-restart]').click();
  await answerAll(page, ['agree', 'name', 'ask', 'name']);
  await expect(page.locator('[data-lp-score]')).toHaveText('Vous avez réussi 4 cas sur 4.');
  await expect(page.locator('[data-lp-pairs]')).toBeHidden();
  expect((await announcements(page)).at(-1)).toBe('Vous avez réussi 4 cas sur 4.');
});

test('saved answers restore silently on the first open case', async ({ page }) => {
  await open(page, 'en', { picks: ['agree', 'name'] }); await observeStatus(page);
  await expect(page.locator('[data-lp-case]:visible')).toHaveCount(1);
  await expect(panel(page, 2)).toBeVisible();
  await expect(panel(page, 2).locator('input:checked, [data-lp-mark]')).toHaveCount(0);
  await expect(page.locator('body')).toBeFocused();
  await answer(page, 2, 'ask');
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: ['agree', 'name', 'ask'] });
});

test('a finished activity restores on the last case with its feedback and result, without speaking', async ({ page }) => {
  await open(page, 'en', { picks: ['agree', 'name', 'ask', 'ask'] });
  await expect(panel(page, 3)).toBeVisible();
  await expect(feedback(page, 3)).toHaveText(`Incorrect. Correct answer: Name the behaviour. ${english.cases[3].looksLike} ${english.cases[3].decides}`);
  await expect(page.locator('[data-lp-score]')).toHaveText('You got 3 of 4 cases right.');
  await expect(page.locator('[data-lp-result] li')).toHaveText(['Name the behaviour and Ask an open question: 1 case']);
  await expect(page.locator('[data-lp-restart]')).toBeVisible();
  await expect(page.locator('[role="status"]')).toHaveText('');
  await expect(page.locator('body')).toBeFocused();
});

for (const seed of [{ picks: ['nobody'] }, { picks: 'agree' }, { picks: ['agree', 'name', 'ask', 'name', 'name'] }, { picks: [], at: 2 }, 'not an object']) {
  test(`invalid saved state is ignored: ${JSON.stringify(seed)}`, async ({ page }) => {
    await open(page, 'en', seed);
    await expect(panel(page, 0)).toBeVisible();
    await expect(page.locator('[data-lp-mark], input:checked')).toHaveCount(0);
  });
}

test('without JavaScript every case shows with its choices, and each answer opens on request', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 320, height: 900 } });
  const page = await context.newPage();
  for (const [lang, content] of [['en', english], ['fr', french]]) {
    await page.goto(`/sort-by-principle/${lang}.html`);
    await expect(page.locator('[data-lp-case]:visible')).toHaveCount(4);
    await expect(page.locator('button:visible, [data-lp-feedback]:visible, [data-lp-result]:visible')).toHaveCount(0);
    await expect(page.locator('details:visible')).toHaveCount(4);
    await page.locator('[data-lp-case]').nth(1).getByRole('radio').first().check();
    await page.locator('summary').nth(1).click();
    const answerText = lang === 'en' ? 'Correct answer: Name the behaviour.' : 'Bonne réponse : Nommer le comportement.';
    await expect(page.locator('details').nth(1).locator('p')).toHaveText([answerText, `${content.cases[1].looksLike} ${content.cases[1].decides}`].map(text => frenchTypography(text, lang)));
    expect(await overflowing(page)).toEqual({ page: 0, clipped: [] });
  }
  await context.close();
});

for (const path of ['/sort-by-principle/en.html', '/sort-by-principle/fr.html', '/sort-by-principle/two.html']) {
  test(`axe at load, error, a miss and the result: ${path}`, async ({ page }) => {
    await page.goto(path); await page.waitForFunction(() => window.lpReady);
    const root = page.locator('[data-lp-pattern]').first();
    const open_ = c => root.locator('[data-lp-case]').nth(c);
    expect(await axe(page)).toEqual([]);
    await open_(0).locator('[data-lp-check]').click();
    expect(await axe(page)).toEqual([]);
    for (const [c, id] of ['ask', 'agree', 'name', 'ask'].entries()) {
      await open_(c).locator(`input[value="${id}"]`).check();
      await open_(c).locator('[data-lp-check]').click();
      if (c === 0) expect(await axe(page)).toEqual([]);
      if (c < 3) await open_(c).locator('[data-lp-next]').click();
    }
    await expect(root.locator('[data-lp-result]')).toBeVisible();
    expect(await axe(page)).toEqual([]);
  });
}

for (const lang of ['en', 'fr']) for (const textSpacing of [false, true]) {
  test(`400% reflow keeps every state inside the card (${lang}, text spacing ${textSpacing})`, async ({ page }) => {
    // 320 CSS px represents reflow at 400% zoom from a 1280px viewport.
    await page.setViewportSize({ width: 320, height: 900 });
    await open(page, lang);
    if (textSpacing) await page.addStyleTag({ content: TEXT_SPACING });
    expect(await overflowing(page)).toEqual({ page: 0, clipped: [] });
    // Misses show two marks and both feedback lines, the longest state of a case.
    await answerAll(page, ['ask', 'agree', 'agree', 'ask']);
    await expect(page.locator('[data-lp-result]')).toBeVisible();
    expect(await overflowing(page)).toEqual({ page: 0, clipped: [] });
  });
}

test('the card is the only box: the case, feedback and result have no panel', async ({ page }) => {
  await open(page);
  await answerAll(page, ['ask', 'agree', 'agree', 'ask']);
  const boxed = await page.locator('[data-lp-pattern]').evaluate(root => [...root.querySelectorAll('*')]
    // Choice rows and buttons are shared roles from lib/base.css; nothing else inside the card is filled or bordered.
    .filter(el => !el.closest('.lp-choice, .lp-button') && el.getClientRects().length
      && (getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)' || ['Top', 'Right', 'Bottom', 'Left'].filter(side => parseFloat(getComputedStyle(el)[`border${side}Width`]) > 0).length > 1))
    .map(el => el.className || el.localName));
  expect(boxed).toEqual([]);
});

test('a case change slides in, and is instant under reduced motion', async ({ page }) => {
  await open(page);
  await answer(page, 0, 'agree');
  await panel(page, 0).locator('[data-lp-next]').click();
  expect(await panel(page, 1).evaluate(el => [el.classList.contains('lp-sort-by-principle-enter'), getComputedStyle(el).animationName, getComputedStyle(el).animationDuration])).toEqual([true, 'lp-sort-by-principle-slide', '0.24s']);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await answer(page, 1, 'name');
  await panel(page, 1).locator('[data-lp-next]').click();
  await expect(panel(page, 2).locator('[data-lp-case-heading]')).toBeFocused();
  expect(await panel(page, 2).evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('a checked case cannot be changed or checked twice', async ({ page }) => {
  await open(page);
  // Mount with a state adapter that records every write.
  await page.evaluate(async content => {
    const { render } = await import('/patterns/sort-by-principle/render.js');
    const { enhance } = await import('/patterns/sort-by-principle/enhance.js');
    const { strings } = await import('/patterns/sort-by-principle/strings.js');
    window.lpInstances.forEach(instance => instance.destroy());
    document.querySelector('main').innerHTML = render(content, strings.en, { id: 'twice', lang: 'en' });
    window.lpWrites = [];
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, state: { read: () => undefined, write: value => window.lpWrites.push(value) } });
  }, english);
  await answer(page, 0, 'agree');
  // Turn the locked controls back on and send the events a second submission would.
  await panel(page, 0).evaluate(panel => {
    const other = panel.querySelector('input[value="ask"]'), check = panel.querySelector('[data-lp-check]');
    other.disabled = false; other.checked = true; other.dispatchEvent(new Event('change', { bubbles: true }));
    check.disabled = false; check.hidden = false;
    check.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  expect(await page.evaluate(() => window.lpWrites)).toEqual([{ picks: ['agree'] }]);
  await expect(feedback(page, 0)).toHaveText(`Correct. ${english.cases[0].decides}`);
  await expect(panel(page, 0).locator('[data-lp-mark]')).toHaveCount(1);
  await expect(panel(page, 0).locator('label:has(input[value="agree"])')).toHaveAttribute('data-lp-mark', 'correct');
});

test('at 390px each check brings Next case into view with the feedback above it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const lang of ['en', 'fr']) {
    await open(page, lang);
    for (const [c, id] of ['ask', 'agree', 'agree'].entries()) {
      await answer(page, c, id);
      await expect(panel(page, c).locator('[data-lp-next]')).toBeInViewport({ ratio: 1 });
      await expect(feedback(page, c)).toBeInViewport({ ratio: 1 });
      await panel(page, c).locator('[data-lp-next]').click();
    }
  }
});

test('missing or mismatched server markup fails loudly through enhance', async ({ page }) => {
  await open(page);
  const failures = await page.evaluate(async content => {
    const { enhance } = await import('/patterns/sort-by-principle/enhance.js');
    const { render } = await import('/patterns/sort-by-principle/render.js');
    const { strings } = await import('/patterns/sort-by-principle/strings.js');
    const planted = {
      'no status region': root => root.querySelector('[role="status"]').remove(),
      'no case heading': root => root.querySelector('[data-lp-case-heading]').removeAttribute('data-lp-case-heading'),
      'no feedback line': root => root.querySelector('[data-lp-feedback]').remove(),
      'no next button': root => root.querySelector('[data-lp-next]').remove(),
      'no pair list': root => root.querySelector('[data-lp-pair-list]').remove(),
      'a radio missing': root => root.querySelector('input[type="radio"]').closest('label').remove(),
      'a radio with the wrong value': root => { root.querySelector('input[type="radio"]').value = 'other'; },
      'a case missing': root => root.querySelectorAll('[data-lp-case]')[2].remove()
    };
    return Object.fromEntries(Object.entries(planted).map(([name, corrupt]) => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = render(content, strings.en, { id: 'bad', lang: 'en' });
      const root = wrapper.firstElementChild;
      corrupt(root);
      try { enhance(root, { content, strings: strings.en }); return [name, 'no error']; } catch (error) { return [name, error.message]; }
    }));
  }, english);
  expect(failures).toEqual({
    'no status region': 'Missing sort-by-principle markup: [role="status"]',
    'no case heading': 'Missing sort-by-principle markup: [data-lp-case-heading]',
    'no feedback line': 'Missing sort-by-principle markup: [data-lp-feedback]',
    'no next button': 'Missing sort-by-principle markup: [data-lp-next]',
    'no pair list': 'Missing sort-by-principle markup: [data-lp-pair-list]',
    'a radio missing': 'Invalid sort-by-principle options markup',
    'a radio with the wrong value': 'Invalid sort-by-principle options markup',
    'a case missing': 'Invalid sort-by-principle cases markup'
  });
});

test('two copies on one page keep separate ids, answers and progress', async ({ page }) => {
  await page.goto('/sort-by-principle/two.html');
  await page.waitForFunction(() => window.lpReady);
  expect(await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(el => el.id); return ids.length - new Set(ids).size; })).toBe(0);
  const [first, second] = [page.locator('[data-lp-pattern]').nth(0), page.locator('[data-lp-pattern]').nth(1)];
  await first.locator('[data-lp-case]').first().locator('input[value="agree"]').check();
  await first.locator('[data-lp-check]:visible').click();
  await expect(first.locator('[data-lp-mark="correct"]')).toHaveCount(1);
  await expect(second.locator('[data-lp-mark], input:checked')).toHaveCount(0);
  await expect(second.locator('[data-lp-check]:visible')).toHaveCount(1);
});

test('enhance is idempotent and destroy restores the no-JavaScript view', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await answer(page, 0, 'ask');
  const before = await page.locator('[data-lp-pattern]').evaluate(root => root.querySelectorAll('*').length);
  await page.evaluate(() => window.lpInstances[0].destroy());
  await expect(page.locator('[data-lp-case]:visible')).toHaveCount(4);
  await expect(page.locator('details:visible')).toHaveCount(4);
  await expect(page.locator('button:visible, [data-lp-feedback]:visible, [data-lp-mark], input:checked, input:disabled')).toHaveCount(0);
  await expect(page.locator('[role="status"]')).toHaveText('');
  for (const summary of await page.locator('summary').all()) await summary.click();
  expect(await axe(page)).toEqual([]);
  // Enhancing again reads the saved answer and builds on the same markup.
  await page.evaluate(() => { window.lpInstances = [window.lpEnhance()]; });
  await expect(page.locator('[data-lp-case]:visible')).toHaveCount(1);
  await expect(panel(page, 1)).toBeVisible();
  // The fallback disclosures stay open from before, but are hidden again.
  await expect(page.locator('details:visible')).toHaveCount(0);
  expect(await page.locator('[data-lp-pattern]').evaluate(root => root.querySelectorAll('*').length)).toBe(before);
});

test('rows keep the order of the principles', async ({ page }) => {
  await open(page);
  expect(await panel(page, 0).getByRole('radio').evaluateAll(radios => radios.map(radio => radio.value))).toEqual(ROWS);
});
