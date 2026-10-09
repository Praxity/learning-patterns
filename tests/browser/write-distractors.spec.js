import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const english = JSON.parse(await readFile(new URL('../../patterns/write-distractors/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/write-distractors/examples/fr.json', import.meta.url)));
const draft = (text, misconception, custom = '') => ({ text, misconception, custom });

test('shared scene spans the quiz builder card and centres its tile on the question', async ({ page }) => {
  await open(page, 'en', false);
  await expect(page.locator('.lp-scene-label')).toHaveCount(0);
  await expect(page.locator('.lp-scene-title')).toHaveText(english.question);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.locator('.lp-scene').evaluate(el => {
      const scene = el.getBoundingClientRect(), card = el.parentElement.getBoundingClientRect();
      const tile = el.querySelector('.lp-scene-icon').getBoundingClientRect(), text = el.querySelector('div').getBoundingClientRect();
      return [scene.left - card.left, card.right - scene.right, tile.top + tile.height / 2 - text.top - text.height / 2];
    });
    for (const difference of geometry) expect(Math.abs(difference)).toBeLessThanOrEqual(1);
  }
});

test('right-answer icon and Start over sit on the text column; revealed answers open at once', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 'en', false);
  await retrieve(page.locator('[data-lp-pattern]'));
  expect(await page.locator('[data-lp-retrieval]').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  const centre = box => box.y + box.height / 2;
  const icon = await page.locator('[data-lp-right] .lp-icon').boundingBox();
  const heading = await page.locator('[data-lp-right] .lp-run-in').boundingBox();
  expect(Math.abs(centre(icon) - centre(heading))).toBeLessThanOrEqual(1);
  const column = await page.locator('[data-lp-answer]').boundingBox();
  const startOver = await page.locator('[data-lp-clear] svg').boundingBox();
  expect(Math.abs(startOver.x - column.x)).toBeLessThanOrEqual(.5);
});

async function retrieve(root) {
  if (await root.locator('[data-lp-flow]').isVisible()) return;
  await root.locator('[data-lp-answer]').fill('No, breaks help.');
  await root.locator('[data-lp-check]').click();
  await root.locator('[data-lp-had-it]').click();
}
async function open(page, lang = 'en', authoring = true) {
  await page.goto(`/write-distractors/${lang}.html`);
  await page.waitForFunction(() => window.lpReady);
  if (authoring) for (const root of await page.locator('[data-lp-pattern]').all()) await retrieve(root);
}
async function fill(root, custom = false) {
  const rows = root.locator('[data-lp-option]');
  await rows.nth(0).locator('[data-lp-text]').fill('Yes, breaks slow you down.');
  await rows.nth(0).locator('select').selectOption('push-through');
  await rows.nth(1).locator('[data-lp-text]').fill('Yes, breaks make you lose your place.');
  await rows.nth(1).locator('select').selectOption(custom ? 'other' : 'phone');
  if (custom) await rows.nth(1).locator('input').fill('Breaks disrupt focus');
}
async function scan(page) {
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
}
async function observe(page) {
  await page.evaluate(() => {
    window.lpStatusObserver?.disconnect();
    window.lpAnnouncements = [];
    window.lpStatusObserver = new MutationObserver(records => {
      for (const record of records) window.lpAnnouncements.push(record.target.textContent);
    });
    window.lpStatusObserver.observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}

test('question previews replace result lists and preserve keyed row alignment at every width', async ({ page }) => {
  await open(page); await fill(page, true); await page.locator('[data-lp-compare]').click();
  const result = page.locator('[data-lp-result]');
  await expect(result.locator('[data-lp-preview]')).toHaveCount(2);
  await expect(result.locator('[data-lp-preview] h3')).toHaveText(['Your question', "The author's question"]);
  await expect(result.locator('[data-lp-untargeted], [data-lp-yours], .lp-write-distractors-list')).toHaveCount(0);
  expect(await result.evaluate(el => el.firstElementChild.matches('[data-lp-summary]'))).toBe(true);
  await expect(result.locator('[data-lp-preview="yours"] .lp-choice-mark')).toHaveText(['Correct answer', 'Same mistaken idea as the author']);
  for (const width of [1280, 730, 729, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.lp-write-distractors-comparison')).toHaveCSS('grid-template-columns', width >= 730 ? /\S+px \S+px/ : /^\S+px$/);
    const failures = await page.locator('[data-lp-option-summary], [data-lp-result] .lp-choice').evaluateAll((rows, width) => rows.flatMap(row => {
      const key = row.querySelector('.lp-choice-key').getBoundingClientRect();
      const text = row.querySelector('[data-lp-option-text]').getBoundingClientRect();
      const target = row.querySelector('.lp-small')?.getBoundingClientRect();
      const mark = row.querySelector('.lp-choice-mark')?.getBoundingClientRect();
      const problems = [];
      if (Math.abs(key.top - text.top) > 3 || text.left < key.right) problems.push('key alignment');
      if (target && (target.top < text.bottom || Math.abs(target.left - text.left) > 1)) problems.push('target alignment');
      if (target && mark && mark.top >= text.bottom && mark.top < target.top) problems.push('mark separates option from target');
      if (mark && mark.top < text.bottom && mark.left < text.right && mark.right > text.left) problems.push('mark overlap');
      if (row.scrollWidth > row.clientWidth + 1) problems.push('overflow');
      return problems.map(problem => `${width}: ${problem}: ${row.textContent}`);
    }), width);
    expect(failures).toEqual([]);
  }
});

test('Compare collapses builders to key, text and tag summaries; Start over restores fields', async ({ page }) => {
  await open(page); await fill(page, true);
  await page.locator('[data-lp-compare]').click();
  const builders = page.locator('.lp-write-distractors-builder');
  await expect(builders.locator('fieldset:visible')).toHaveCount(0);
  for (const key of await page.locator('.lp-choice-key').all()) await expect(key).toHaveAttribute('aria-hidden', 'true');
  expect(await builders.first().ariaSnapshot()).not.toMatch(/(?:text:|generic:) B(?:\n|$)/);
  await expect(page.locator('[data-lp-compare]')).toBeFocused();
  await expect(builders.locator('textarea:visible, select:visible, input:visible')).toHaveCount(0);
  await expect(builders.nth(0)).toContainText('B');
  await expect(builders.nth(0)).toContainText('Yes, breaks slow you down.');
  await expect(builders.nth(0)).toContainText(english.misconceptions.find(item => item.id === 'push-through').label);
  await expect(builders.nth(1)).toContainText('C');
  await expect(builders.nth(1)).toContainText('Yes, breaks make you lose your place.');
  await expect(builders.nth(1)).toContainText('Breaks disrupt focus');
  await page.locator('[data-lp-clear]').click(); await retrieve(page);
  await expect(builders.locator('fieldset:visible')).toHaveCount(2);
  await expect(builders.locator('textarea:visible, select:visible')).toHaveCount(4);
  for (const field of await builders.locator('textarea, select, input').all()) await expect(field).toHaveValue('');
});

for (const lang of ['en', 'fr']) {
  test(`answer first, unscored self-report, keyed builder and finished question (${lang})`, async ({ page }) => {
    const content = lang === 'en' ? english : french;
    await open(page, lang, false);
    const answer = page.locator('[data-lp-answer]');
    const check = page.locator('[data-lp-check]');
    await expect(page.locator('[data-lp-scene]')).toHaveText(content.question);
    await expect(page.locator('[data-lp-scene] svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(answer).toHaveAttribute('rows', '3');
    await expect(page.locator('[data-lp-right]')).toBeHidden();
    await expect(page.locator('[data-lp-flow]')).toBeHidden();
    await expect(page.locator('[data-lp-fallback]')).toBeHidden();
    await check.click();
    await expect(answer).toBeFocused();
    await expect(answer).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('[data-lp-answer-error]')).toBeVisible();
    await answer.fill('My attempt');
    await expect(answer).not.toHaveAttribute('aria-invalid');
    // Check by keyboard so focus retention is independent of native pointer behaviour.
    await check.focus();
    await observe(page);
    await check.press('Enter');
    await expect(answer).toHaveAttribute('readonly', '');
    await expect(check).toBeFocused();
    await expect(check).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('[data-lp-right]')).toContainText(content.rightAnswer);
    await expect(page.locator('[data-lp-right] svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('[data-lp-flow]')).toBeHidden();
    await expect(page.locator('[data-lp-fallback]')).toBeHidden();
    await expect(page.locator('[data-lp-had-it]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-lp-not-quite]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-lp-had-it]')).toHaveClass('lp-button lp-button-secondary');
    await observe(page);
    await page.locator('[data-lp-not-quite]').click();
    await expect(page.locator('[data-lp-not-quite]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-lp-write-heading]')).toBeFocused();
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([lang === 'en' ? 'Noted.' : 'Noté.']);
    expect(await page.evaluate(() => window.lpSaved.hadIt)).toBe(false);
    await expect(page.locator('[data-lp-option-key]')).toHaveCount(0);
    await expect(page.locator('legend')).toHaveText(lang === 'en' ? ['Wrong option B', 'Wrong option C'] : ['Mauvaise réponse B', 'Mauvaise réponse C']);
    await fill(page);
    await page.locator('[data-lp-compare]').click();
    const preview = page.locator('[data-lp-preview="yours"]');
    await expect(preview).toContainText(content.question);
    await expect(preview.locator('[data-lp-preview-key]')).toHaveText(['A', 'B', 'C']);
    await expect(preview.locator('li').first()).toContainText(content.rightAnswer);
    await expect(preview.locator('li').first()).toContainText(lang === 'en' ? 'Correct answer' : 'Bonne réponse');
    await expect(preview.locator('li').nth(1)).toContainText('Yes, breaks slow you down.');
    await expect(preview.locator('input, button, textarea')).toHaveCount(0);
    await expect(page.locator('[data-lp-result] [data-lp-preview="author"]')).toBeVisible();
    await page.locator('[data-lp-clear]').click();
    await expect(answer).toBeFocused();
    await expect(answer).toHaveValue('');
    await expect(answer).not.toHaveAttribute('readonly');
    await expect(check).toBeVisible();
    await expect(page.locator('[data-lp-right]')).toBeHidden();
    await expect(page.locator('[data-lp-flow]')).toBeHidden();
    expect(await page.evaluate(() => window.lpSaved)).toEqual({ answer: '', hadIt: null, options: [draft('', ''), draft('', '')], shown: false });
  });
}

test('old saved results restore as hidden drafts until retrieval is done', async ({ page }) => {
  await page.addInitScript(value => { window.lpSeed = value; }, { options: [draft('Old B', 'busy'), draft('Old C', 'phone')], shown: true });
  await open(page, 'en', false);
  await expect(page.locator('[data-lp-answer]')).toHaveValue('');
  await expect(page.locator('[data-lp-flow]')).toBeHidden();
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  await expect(page.locator('[role="status"]')).toHaveText('');
  await page.locator('[data-lp-answer]').fill('No');
  await page.locator('[data-lp-check]').click();
  await page.locator('[data-lp-had-it]').click();
  await expect(page.locator('[data-lp-text]').nth(0)).toHaveValue('Old B');
  await expect(page.locator('[data-lp-text]').nth(1)).toHaveValue('Old C');
});

test('retrieval guards reject blank answers and prevent skipping or repeating steps', async ({ page }) => {
  await open(page, 'en', false); await observe(page);
  // The hidden error isn't linked until it shows, so VoiceOver doesn't read it on arrival.
  await expect(page.locator('[data-lp-answer]')).not.toHaveAttribute('aria-describedby');
  await page.locator('[data-lp-answer]').fill(' \n ');
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-answer]')).toHaveAttribute('aria-invalid', 'true');
  const errorId = await page.locator('[data-lp-answer]').getAttribute('aria-describedby');
  await expect(page.locator(`[id="${errorId}"]`)).toHaveText('Write your answer before you check it.');
  await page.evaluate(() => {
    document.querySelector('[data-lp-had-it]').click();
    document.querySelector('[data-lp-compare]').click();
  });
  await expect(page.locator('[data-lp-flow]')).toBeHidden();
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  await page.locator('[data-lp-answer]').fill('A remembered answer');
  await expect(page.locator('[data-lp-answer]')).not.toHaveAttribute('aria-describedby');
  await observe(page);
  await page.locator('[data-lp-check]').click();
  await page.evaluate(() => document.querySelector('[data-lp-check]').click());
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([english.rightAnswer]);
  await observe(page);
  await page.locator('[data-lp-had-it]').click();
  await page.locator('[data-lp-had-it]').click();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Noted.']);
  expect(await page.evaluate(() => window.lpSaved.hadIt)).toBe(true);
  await page.locator('[data-lp-not-quite]').click();
  await expect(page.locator('[data-lp-had-it]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-lp-not-quite]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.lpSaved.hadIt)).toBe(false);
  await expect(page.locator('[data-lp-result]')).toBeHidden();
});

test('keyboard retrieval reveals the answer, records self-report and focuses authoring', async ({ page }) => {
  await open(page, 'en', false); await observe(page);
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-answer]')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-check]')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('[data-lp-answer]')).toBeFocused();
  await page.keyboard.type('No, attention needs a break.');
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-check]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-had-it]')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-not-quite]')).toBeFocused();
  await page.keyboard.press('Space');
  await expect(page.locator('[data-lp-write-heading]')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-text]').first()).toBeFocused();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['1 field needs attention.', english.rightAnswer, 'Noted.']);
});

test('answer drafts restore in step one without revealing the answer', async ({ page }) => {
  await page.addInitScript(value => { window.lpSeed = value; }, { answer: 'My draft', hadIt: null, options: [draft('', ''), draft('', '')], shown: false });
  await open(page, 'en', false);
  await expect(page.locator('[data-lp-answer]')).toHaveValue('My draft');
  await expect(page.locator('[data-lp-answer]')).not.toHaveAttribute('readonly');
  await expect(page.locator('[data-lp-right]')).toBeHidden();
  await expect(page.locator('[role="status"]')).toHaveText('');
  await page.locator('[data-lp-check]').click();
  await page.locator('[data-lp-had-it]').click();
  await expect(page.locator('[data-lp-answer]')).toHaveValue('My draft');
});

test('reduced motion stops every reveal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page);
  await fill(page); await page.locator('[data-lp-compare]').click();
  expect(await page.locator('.lp-reveal').evaluateAll(elements => elements.map(el => getComputedStyle(el).animationName))).toEqual(['none', 'none', 'none']);
});

test('shared course design keeps one frame and local icon feedback', async ({ page }) => {
  await open(page);
  const root = page.locator('[data-lp-pattern]');
  await expect(root).toHaveClass('lp lp-write-distractors');
  expect(await root.locator('fieldset').evaluateAll(rows => rows.map(row => getComputedStyle(row).borderWidth))).toEqual(['0px', '0px']);
  await expect(root.locator('legend.lp-run-in')).toHaveText(['Wrong option B', 'Wrong option C']);
  await page.locator('[data-lp-compare]').click();
  for (const error of await root.locator('.lp-error-text:visible').all()) {
    await expect(error.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(error.locator('path[d="M12 8v4"]')).toHaveCount(1);
  }
  await fill(page, true); await page.locator('[data-lp-compare]').click();
  await expect(root.locator('[data-lp-result]')).toHaveClass('lp-section lp-reveal');
  await expect(root.locator('[data-lp-summary]')).toHaveClass('lp-run-in');
  const yours = root.locator('[data-lp-preview="yours"] li').filter({ has: page.locator('.lp-small') });
  await expect(yours.nth(0).locator('.lp-met')).toHaveText('Same mistaken idea as the author');
  await expect(yours.nth(0).locator('.lp-met path[d="M5 12l5 5l10 -10"]')).toHaveCount(1);
  await expect(yours.nth(1).locator('.lp-choice-mark')).toHaveCount(0);
  expect(await yours.nth(0).locator('.lp-met').evaluate(el => getComputedStyle(el).color)).toBe('rgb(18, 112, 79)');
  expect(await yours.nth(1).locator('.lp-small').evaluate(el => getComputedStyle(el).color)).toBe('rgb(85, 92, 103)');
  for (const item of await yours.all()) {
    await expect(item.locator('p')).toHaveClass('lp-small');
  }
  const restart = root.getByRole('button', { name: 'Start over', exact: true });
  await expect(restart).toHaveClass('lp-button lp-button-quiet');
  await expect(restart.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  expect(await restart.evaluate(el => {
    const css = getComputedStyle(el);
    return [css.backgroundColor, css.textDecorationLine, css.minHeight];
  })).toEqual(['rgba(0, 0, 0, 0)', 'none', '44px']);
  await restart.click();
  await expect(root.locator('[data-lp-answer]')).toBeFocused();
  await expect(root.locator('[role="status"]')).toHaveText('Answer and options cleared.');
});

test('controls reveal in place, custom field toggles without a live Targets line', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-lp-flow]')).toBeVisible();
  await expect(page.locator('[data-lp-fallback]')).toBeHidden();
  await expect(page.locator('fieldset')).toHaveCount(2);
  await expect(page.locator('[data-lp-text]').first()).toHaveAttribute('maxlength', '300');
  const row = page.locator('fieldset').first();
  await expect(row.locator('input')).toBeHidden();
  await row.locator('select').selectOption('other');
  await expect(row.locator('input')).toBeVisible();
  await expect(row.locator('input')).toHaveAttribute('maxlength', '120');
  await row.locator('input').fill('My tag');
  await row.locator('select').selectOption('phone');
  await expect(row.locator('input')).toBeHidden();
  await expect(row.locator('[data-lp-selected]')).toHaveCount(0);
  await expect(row).not.toContainText('Targets:');
  await row.locator('select').selectOption('other');
  await expect(row.locator('input')).toHaveValue('My tag');
});

test('empty submit announces field count, links each error and focuses first textarea', async ({ page }) => {
  await open(page); await observe(page);
  await page.locator('[data-lp-compare]').click();
  await expect(page.locator('[data-lp-text]').first()).toBeFocused();
  await expect(page.locator('[role="status"]')).toHaveText('4 fields need attention.');
  // Errors name each option by the letter its legend shows (B, C), not its position.
  await expect(page.locator('[data-lp-text-error]')).toHaveText(['Write wrong option B.', 'Write wrong option C.']);
  const inputs = page.locator('[aria-invalid="true"]');
  await expect(inputs).toHaveCount(4);
  for (const input of await inputs.all()) {
    const id = await input.getAttribute('aria-describedby');
    await expect(page.locator(`[id="${id}"]`)).toBeVisible();
  }
  await page.locator('[data-lp-text]').first().fill('Draft');
  await expect(page.locator('[data-lp-text]').first()).not.toHaveAttribute('aria-invalid');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['4 fields need attention.']);
  await expect(page.locator('[data-lp-clear]')).toBeVisible();
});

for (const lang of ['en', 'fr']) {
  test(`coverage summary announces once above two questions with per-option targets (${lang})`, async ({ page }) => {
    const content = lang === 'en' ? english : french;
    await open(page, lang); await observe(page); await fill(page, true);
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
    await page.locator('[data-lp-compare]').click();
    const message = lang === 'en' ? "Your labels match 1 of the author's 4 mistaken ideas. You added 1 of your own."
      : "Idées fausses en commun avec l'auteur : 1 sur 4. Autres idées fausses : 1.";
    await expect(page.locator('[data-lp-summary]')).toHaveText(message);
    await expect(page.locator('[role="status"]')).toHaveText(message);
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([message]);
    expect(await page.locator('[data-lp-summary]').evaluate(el => getComputedStyle(el).fontWeight)).toBe('600');
    await expect(page.locator('[data-lp-result]')).not.toContainText(lang === 'en' ? 'Compared' : 'comparées');
    await expect(page.locator('[data-lp-result] [data-lp-preview] h3')).toHaveText(lang === 'en' ? ['Your question', "The author's question"] : ['Votre question', "La question de l'auteur"]);
    await expect(page.locator('[data-lp-result] [data-lp-preview="author"] .lp-small')).toHaveText(content.misconceptions.map(item => `${lang === 'en' ? 'Mistaken idea:' : 'Idée fausse :'} ${item.label}`));
    await expect(page.locator('[data-lp-result] [data-lp-preview="yours"] .lp-small')).toHaveText([`${lang === 'en' ? 'Mistaken idea:' : 'Idée fausse :'} ${content.misconceptions[1].label}`, `${lang === 'en' ? 'Mistaken idea:' : 'Idée fausse :'} Breaks disrupt focus`]);
    await expect(page.locator('[data-lp-result] [data-lp-untargeted], [data-lp-result] [data-lp-yours]')).toHaveCount(0);
  });

  for (const fixture of [
    { name: 'zero author, two own', author: 0, total: 4, own: 2, targets: ['other', 'other'], customs: ['New one', 'New two'] },
    { name: 'two author, zero own', author: 2, total: 4, own: 0, targets: ['busy', 'phone'] },
    { name: 'one author with duplicate tags and a custom alias', author: 1, total: 1, own: 0, targets: ['busy', 'other'], alias: true },
    { name: 'zero of one author, repeated own tag', author: 0, total: 1, own: 1, targets: ['other', 'other'], customs: ['New tag', ' new TAG '] }
  ]) {
    test(`count grammar and unique author coverage: ${fixture.name} (${lang})`, async ({ page }) => {
      const original = lang === 'en' ? english : french;
      const content = { ...original, authorOptions: fixture.total === 1 ? [original.authorOptions[0], { ...original.authorOptions[0], text: 'Another author option' }] : original.authorOptions };
      await open(page, lang);
      await page.evaluate(async ({ content, lang }) => {
        const { render } = await import('/patterns/write-distractors/render.js');
        const { enhance } = await import('/patterns/write-distractors/enhance.js');
        const { strings } = await import('/patterns/write-distractors/strings.js');
        window.lpInstances[0].destroy();
        document.querySelector('[data-lp-pattern]').outerHTML = render(content, strings[lang], { id: 'counts', lang });
        enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings[lang] });
      }, { content, lang });
      await retrieve(page.locator('[data-lp-pattern]'));
      await observe(page);
      for (let index = 0; index < 2; index++) {
        const row = page.locator('[data-lp-option]').nth(index);
        await row.locator('[data-lp-text]').fill(`Wrong answer ${index + 1}`);
        await row.locator('select').selectOption(fixture.targets[index]);
        if (fixture.targets[index] === 'other') await row.locator('input').fill(fixture.alias ? `  ${content.misconceptions[0].label.toUpperCase()}  ` : fixture.customs[index]);
      }
      await page.locator('[data-lp-compare]').click();
      const message = lang === 'en' ? `Your labels match ${fixture.author} of the author's ${fixture.total} ${fixture.total === 1 ? 'mistaken idea' : 'mistaken ideas'}. You added ${fixture.own} of your own.`
        : `${fixture.total === 1 ? 'Idée fausse' : 'Idées fausses'} en commun avec l'auteur : ${fixture.author} sur ${fixture.total}. Autres idées fausses : ${fixture.own}.`;
      await expect(page.locator('[data-lp-summary]')).toHaveText(message);
      expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([message]);
      const rows = page.locator('[data-lp-result] [data-lp-preview="yours"] li').filter({ has: page.locator('.lp-small') });
      const matches = fixture.author === 0 ? [] : [0, 1];
      for (const index of [0, 1]) {
        await expect(rows.nth(index).locator('.lp-choice-mark')).toHaveCount(matches.includes(index) ? 1 : 0);
        if (matches.includes(index)) await expect(rows.nth(index)).toHaveAttribute('data-lp-mark', 'correct');
      }
    });
  }
}

test('keyboard-only error, custom tag, comparison, repeated announcement and clear', async ({ page }) => {
  await open(page); await observe(page);
  const texts = page.locator('[data-lp-text]'), selects = page.locator('select');
  await page.keyboard.press('Tab'); await expect(texts.nth(0)).toBeFocused();
  await page.keyboard.press('Tab'); await expect(selects.nth(0)).toBeFocused();
  await page.keyboard.press('Tab'); await expect(texts.nth(1)).toBeFocused();
  await page.keyboard.press('Tab'); await expect(selects.nth(1)).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-compare]')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(texts.nth(0)).toBeFocused();
  await page.keyboard.type('Yes, keep pushing.'); await page.keyboard.press('Tab');
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab');
  await page.keyboard.type('Yes, pauses disrupt focus.'); await page.keyboard.press('Tab');
  await page.keyboard.press('End'); await page.keyboard.press('Tab');
  await expect(page.locator('input').nth(1)).toBeFocused();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.locator('input').nth(1)).toBeFocused();
  await expect(page.locator('[role="status"]')).toHaveText('1 field needs attention.');
  await page.keyboard.type('Breaks disrupt focus'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-compare]')).toBeFocused();
  const coverage = await page.locator('[data-lp-coverage]').innerText();
  await expect(page.locator('[role="status"]')).toHaveText(coverage);
  await expect(page.locator('[data-lp-coverage]')).toHaveText("Your labels match 1 of the author's 4 mistaken ideas. You added 1 of your own.");
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-clear]')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('[data-lp-answer]')).toBeFocused();
  for (const field of await page.locator('textarea, select, input').all()) await expect(field).toHaveValue('');
  await expect(page.locator('[data-lp-result]')).toBeHidden(); await expect(page.locator('[data-lp-clear]')).toBeHidden();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['4 fields need attention.', '1 field needs attention.', coverage, coverage, 'Answer and options cleared.']);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ answer: '', hadIt: null, options: [draft('', ''), draft('', '')], shown: false });
});

for (const lang of ['en', 'fr', 'two']) {
  test(`axe at load, field errors, custom input and results (${lang})`, async ({ page }) => {
    await open(page, lang, false); await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-check]').click();
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) {
      await root.locator('[data-lp-answer]').fill('No, breaks help.');
      await root.locator('[data-lp-check]').click();
    }
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-had-it]').click();
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-compare]').click();
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await fill(root, true);
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-compare]').click();
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-clear]').click();
    await scan(page);
  });
}

for (const [lang, content] of [['en', english], ['fr', french]]) {
  test(`authored options, same-target labels, language and summary (${lang})`, async ({ page }) => {
    await open(page, lang); await fill(page, true); await page.locator('[data-lp-compare]').click();
    await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', lang);
    const author = page.locator('[data-lp-result] [data-lp-preview="author"] li');
    await expect(author).toHaveCount(5);
    await expect(author.first()).toContainText(content.rightAnswer);
    for (const [index, item] of content.authorOptions.entries()) {
      await expect(author.nth(index + 1)).toContainText(item.text);
      await expect(author.nth(index + 1)).toContainText(content.misconceptions.find(target => target.id === item.misconception).label);
    }
    const yours = page.locator('[data-lp-preview="yours"] li');
    await expect(yours.nth(1)).toContainText(lang === 'en' ? 'Same mistaken idea as the author' : "Même idée fausse que l'auteur");
    await expect(yours.nth(2)).not.toHaveAttribute('data-lp-mark');
    await expect(yours.nth(2).locator('.lp-small')).toHaveText(lang === 'en' ? 'Mistaken idea: Breaks disrupt focus' : 'Idée fausse : Breaks disrupt focus');
    await expect(page.locator('[data-lp-clear]')).toHaveAccessibleName(lang === 'en' ? 'Start over' : 'Recommencer');
    await expect(yours.locator('svg[aria-hidden="true"]')).toHaveCount(2);
    await expect(yours.locator('.lp-choice-key[aria-hidden="true"]')).toHaveCount(3);
    await expect(page.locator('[data-lp-summary]')).toHaveText(lang === 'en'
      ? "Your labels match 1 of the author's 4 mistaken ideas. You added 1 of your own."
      : "Idées fausses en commun avec l'auteur : 1 sur 4. Autres idées fausses : 1.");
  });

  test(`native no-JavaScript baseline (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage(); await page.goto(`/write-distractors/${lang}.html`);
    await expect(page.locator('[data-lp-pattern]')).toContainText(content.question);
    await expect(page.locator('[data-lp-pattern]')).toContainText(content.rightAnswer);
    await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-answer]')).toBeFocused();
    await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-answer-fallback] summary')).toBeFocused();
    await page.keyboard.press('Enter'); await expect(page.locator('[data-lp-answer-fallback]')).toHaveAttribute('open', '');
    await expect(page.locator('[data-lp-answer-fallback]')).toContainText(content.rightAnswer);
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
    await expect(page.locator('[data-lp-fallback]')).toHaveAttribute('open', '');
    for (const item of content.authorOptions) await expect(page.locator('[data-lp-fallback]')).toContainText(item.text);
    for (const item of content.misconceptions) await expect(page.locator('[data-lp-fallback]')).toContainText(item.label);
    await expect(page.locator('[data-lp-flow]')).toBeHidden(); await expect(page.locator('[role="status"]')).toHaveText('');
    // axe schedules script callbacks, which cannot run with JavaScript disabled.
    // Scan an exact copy of the baseline DOM, with its scripts removed.
    const baseline = await page.evaluate(() => {
      const clone = document.documentElement.cloneNode(true);
      for (const script of clone.querySelectorAll('script')) script.remove();
      return '<!doctype html>' + clone.outerHTML;
    });
    const auditContext = await browser.newContext();
    const auditPage = await auditContext.newPage();
    await auditPage.goto(page.url()); await auditPage.setContent(baseline); await scan(auditPage);
    await auditContext.close(); await context.close();
  });

  test(`320px reflow and text spacing, all visible labels readable (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await open(page, lang);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    await page.locator('[data-lp-compare]').click();
    const check = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.evaluate(() => [...document.querySelectorAll('p, label, legend, button, li, h2, h3')].filter(el => el.getClientRects().length && !el.matches('[role="status"]')).flatMap(el => {
        const failures = [];
        if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) failures.push(el.textContent);
        const children = [...el.children].filter(child => child.getClientRects().length);
        for (let i = 1; i < children.length; i++) {
          const a = children[i - 1].getBoundingClientRect(), b = children[i].getBoundingClientRect();
          if (Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1) failures.push('overlap: ' + el.textContent);
        }
        return failures;
      }))).toEqual([]);
    };
    await check(); await fill(page, true); await check();
    await page.locator('[data-lp-compare]').click(); await check();
    await page.locator('[data-lp-clear]').click(); await retrieve(page); await fill(page, true);
    await page.locator('select').first().selectOption('phone');
    await expect(page.locator('[data-lp-selected]')).toHaveCount(0); await check();
  });
}

test('right answer, duplicate and custom errors use the field and update only on submit', async ({ page }) => {
  await open(page); await observe(page); await fill(page);
  await page.locator('[data-lp-text]').first().fill(english.rightAnswer.toUpperCase());
  await page.locator('[data-lp-compare]').click();
  await expect(page.locator('[data-lp-text]').first()).toBeFocused();
  await expect(page.locator('[data-lp-text-error]').first()).toContainText('is the right answer');
  await page.locator('[data-lp-text]').first().fill('Same'); await page.locator('[data-lp-text]').nth(1).fill(' SAME ');
  await page.locator('[data-lp-compare]').click();
  await expect(page.locator('[data-lp-text]').nth(1)).toBeFocused();
  await expect(page.locator('[data-lp-text-error]').nth(1)).toContainText('different');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['1 field needs attention.', '1 field needs attention.']);
});

test('draft state saves every field, submitted state is clean, Start over clears the comparison', async ({ page }) => {
  await open(page); await observe(page); await fill(page, true);
  const before = await page.evaluate(() => window.lpSaved);
  expect(before.shown).toBe(false); expect(before.options[1].custom).toBe('Breaks disrupt focus');
  await page.locator('[data-lp-text]').first().fill('  A  B  '); await page.locator('[data-lp-compare]').click();
  expect((await page.evaluate(() => window.lpSaved)).options[0].text).toBe('A B');
  await expect(page.locator('[data-lp-text]').first()).toBeHidden();
  await page.locator('[data-lp-clear]').click();
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  expect((await page.evaluate(() => window.lpSaved)).shown).toBe(false);
  expect((await page.evaluate(() => window.lpAnnouncements)).length).toBe(2);
});

for (const shown of [false, true]) {
  test(`valid saved custom state restores with shown=${shown}, silently`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, { answer: 'No', hadIt: false, options: [draft('A', 'push-through'), draft('B', 'other', 'Focus lost')], shown });
    await open(page);
    await expect(page.locator('[data-lp-answer]')).toHaveValue('No');
    await expect(page.locator('[data-lp-answer]')).toHaveAttribute('readonly', '');
    await expect(page.locator('[data-lp-had-it]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-lp-not-quite]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-lp-text]').first()).toHaveValue('A');
    await expect(page.locator('input').nth(1)).toHaveValue('Focus lost');
    if (shown) {
      await expect(page.locator('input').nth(1)).toBeHidden();
      await expect(page.locator('[data-lp-option-summary]').nth(1)).toContainText('Focus lost');
    } else await expect(page.locator('input').nth(1)).toBeVisible();
    await expect(page.locator('[role="status"]')).toHaveText('');
    if (shown) { await expect(page.locator('[data-lp-result]')).toContainText('Focus lost'); await expect(page.locator('[data-lp-clear]')).toBeVisible(); }
    else { await expect(page.locator('[data-lp-result]')).toBeHidden(); await expect(page.locator('[data-lp-clear]')).toBeVisible(); }
  });
}

test('invalid state is ignored', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { options: [{ text: 'Invalid', misconception: 'unknown', custom: '' }], shown: true }; });
  await open(page, 'en', false); await expect(page.locator('[data-lp-answer]')).toHaveValue('');
  await expect(page.locator('[data-lp-result]')).toBeHidden(); await expect(page.locator('[role="status"]')).toHaveText('');
});

test('destroy and re-enhance without host state resets the self-report controls', async ({ page }) => {
  await open(page, 'en', false);
  await page.evaluate(async content => {
    const { render } = await import('/patterns/write-distractors/render.js');
    const { enhance } = await import('/patterns/write-distractors/enhance.js');
    const { strings } = await import('/patterns/write-distractors/strings.js');
    window.lpInstances[0].destroy();
    document.querySelector('[data-lp-pattern]').outerHTML = render(content, strings.en, { id: 'no-state', lang: 'en' });
    const root = document.querySelector('[data-lp-pattern]');
    const instance = enhance(root, { content, strings: strings.en });
    root.querySelector('[data-lp-answer]').value = 'No';
    root.querySelector('[data-lp-check]').click();
    root.querySelector('[data-lp-had-it]').click();
    instance.destroy();
    enhance(root, { content, strings: strings.en });
  }, english);
  await expect(page.locator('[data-lp-had-it]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-lp-not-quite]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-lp-flow]')).toBeHidden();
  await expect(page.locator('[data-lp-answer]')).not.toHaveAttribute('readonly');
  await expect(page.locator('[data-lp-check]')).not.toHaveAttribute('aria-disabled');
});

test('two instances have unique IDs and independent fields and results', async ({ page }) => {
  await open(page, 'two', false);
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id));
  expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  await retrieve(roots.first());
  await fill(roots.first()); await roots.first().locator('[data-lp-compare]').click();
  await expect(roots.nth(1).locator('[data-lp-text]').first()).toHaveValue('');
  await expect(roots.nth(1).locator('[data-lp-result]')).toBeHidden();
  await expect(roots.nth(1).locator('[role="status"]')).toHaveText('');
});

test('enhance twice, destroy twice, re-enhance: one listener and restored baseline', async ({ page }) => {
  await open(page); expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await observe(page); await fill(page); await page.locator('[data-lp-compare]').click();
  expect((await page.evaluate(() => window.lpAnnouncements)).length).toBe(1);
  await page.evaluate(() => window.lpInstances[0].destroy());
  await expect(page.locator('[data-lp-flow]')).toBeHidden(); await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await page.evaluate(() => { window.lpEnhance(); window.lpInstances[0].destroy(); });
  await expect(page.locator('[data-lp-flow]')).toBeVisible();
  await expect(page.locator('[data-lp-option]').first()).toBeHidden();
  await page.locator('[data-lp-clear]').click();
  await retrieve(page.locator('[data-lp-pattern]'));
  await observe(page); await fill(page); await page.locator('[data-lp-compare]').click();
  expect((await page.evaluate(() => window.lpAnnouncements)).length).toBe(1);
});

test('missing and mismatched markup throws, state adapter failures propagate', async ({ page }) => {
  await open(page);
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/write-distractors/enhance.js');
    const { strings } = await import('/patterns/write-distractors/strings.js');
    enhance(document.createElement('section'), { content, strings: strings.en });
  }, english)).rejects.toThrow('Missing write-distractors markup: [data-lp-fallback]');
  await page.evaluate(() => { window.lpInstances[0].destroy(); document.querySelector('fieldset').remove(); });
  await expect(page.evaluate(() => window.lpEnhance())).rejects.toThrow('Invalid write-distractors option count');
  await open(page);
  await expect(page.evaluate(async content => {
    window.lpInstances[0].destroy();
    const { enhance } = await import('/patterns/write-distractors/enhance.js');
    const { strings } = await import('/patterns/write-distractors/strings.js');
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, state: { read() { throw new Error('Host read failed'); }, write() {} } });
  }, english)).rejects.toThrow('Host read failed');
});

test('injected length violations are caught even beyond HTML maxlength', async ({ page }) => {
  await open(page); await fill(page, true);
  await page.locator('[data-lp-text]').first().evaluate(el => { el.value = 'x'.repeat(301); });
  await page.locator('input').nth(1).evaluate(el => { el.value = 'y'.repeat(121); });
  await page.locator('[data-lp-compare]').click();
  await expect(page.locator('[data-lp-text-error]').first()).toContainText('300');
  await expect(page.locator('[data-lp-custom-error]').nth(1)).toContainText('120');
  await expect(page.locator('[role="status"]')).toHaveText('2 fields need attention.');
});

test('missing builder summary fails loudly before partial enhancement', async ({ page }) => {
  await open(page, 'en', false);
  await page.evaluate(() => { window.lpInstances[0].destroy(); document.querySelector('[data-lp-option-summary]').remove(); });
  await expect(page.evaluate(() => window.lpEnhance())).rejects.toThrow('Missing write-distractors markup: [data-lp-option-summary="0"]');
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await expect(page.locator('[data-lp-check]')).toBeHidden();
});

test('result text escapes hostile learner input and custom tags', async ({ page }) => {
  await open(page); await fill(page, true);
  await page.locator('[data-lp-text]').first().fill('<img src=x onerror="window.lpInjected=true">');
  await page.locator('input').nth(1).fill('<script>window.lpInjected=true</script>');
  await page.locator('[data-lp-compare]').click();
  await expect(page.locator('[data-lp-result] img, [data-lp-result] script')).toHaveCount(0);
  await expect(page.locator('[data-lp-result]')).toContainText('<script>window.lpInjected=true</script>');
  await expect(page.locator('[data-lp-option-summary] img, [data-lp-option-summary] script')).toHaveCount(0);
  await expect(page.locator('[data-lp-option-summary]').nth(1)).toContainText('<script>window.lpInjected=true</script>');
  expect(await page.evaluate(() => window.lpInjected)).toBeUndefined();
});

test('forced colours keeps focus rings and quiet Start over', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page); await fill(page, true);
  for (const field of [page.locator('[data-lp-text]').first(), page.locator('select').first(), page.locator('input').nth(1), page.locator('[data-lp-compare]'), page.locator('[data-lp-clear]')]) {
    await field.focus();
    const style = await field.evaluate(el => { const css = getComputedStyle(el); return [css.outlineWidth, css.outlineStyle, css.outlineOffset, css.outlineColor]; });
    expect(style.slice(0, 3)).toEqual(['2px', 'solid', '2px']); expect(style[3]).not.toBe('rgba(0, 0, 0, 0)');
  }
  await page.locator('[data-lp-compare]').click();
  await expect(page.locator('[data-lp-option-summary]').nth(1)).toContainText('Breaks disrupt focus');
  const colors = await page.evaluate(() => {
    const probe = document.createElement('span'); document.body.append(probe);
    probe.style.color = 'ButtonText'; const text = getComputedStyle(probe).color;
    probe.style.color = 'ButtonFace'; const face = getComputedStyle(probe).color;
    probe.style.color = 'LinkText'; const link = getComputedStyle(probe).color;
    probe.remove();
    // Chromium replaces a focused transparent button border in forced colours.
    // Resolve that native border in the active palette, just like system ink.
    const button = document.createElement('button');
    button.style.cssText = 'border:1px solid transparent;color:LinkText;background:ButtonFace';
    document.body.append(button); button.focus();
    const quietBorder = getComputedStyle(button).borderColor;
    button.remove(); document.querySelector('[data-lp-clear]').focus();
    return { text, face, link, quietBorder };
  });
  const styles = await page.locator('[data-lp-compare], [data-lp-clear]').evaluateAll(elements => elements.map(el => {
    const css = getComputedStyle(el); return { color: css.color, background: css.backgroundColor, border: css.borderColor, style: css.borderStyle, underline: css.textDecorationLine };
  }));
  expect(styles).toEqual([
    { color: colors.text, background: colors.face, border: colors.text, style: 'solid', underline: 'none' },
    { color: colors.link, background: colors.face, border: colors.quietBorder, style: 'solid', underline: 'none' }
  ]);
});
