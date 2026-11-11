import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { expectChoiceMarks } from './choice-marks.js';

const english = JSON.parse(await readFile(new URL('../../patterns/which-is-better/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/which-is-better/examples/fr.json', import.meta.url)));
const TEXT_SPACING = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';
const HIGHLIGHTER = 'rgb(255, 228, 154)';

async function open(page, path = '/which-is-better/en.html') {
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
// Engines may put a space before the hidden comma, since it is positioned out of flow; speech is the same.
const groupName = (progress, question) => new RegExp(`^${progress} ?, ${question.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const row = (root, pick) => root.locator(`[data-lp-pick="${pick}"]`);
/** Choose a row and check it, then go on with Next. */
async function decide(root, pick, { next = true } = {}) {
  await row(root, pick).click();
  await root.locator('[data-lp-check]').click();
  if (next) await root.locator('[data-lp-next]').click();
}
// Replace the demo with other content through the public render and enhance interface.
async function mount(page, content, { lang = 'en', state } = {}) {
  await open(page, `/which-is-better/${lang}.html`);
  await page.evaluate(async ({ content, lang, state }) => {
    const { render } = await import('/patterns/which-is-better/render.js');
    const { enhance } = await import('/patterns/which-is-better/enhance.js');
    const { strings } = await import('/patterns/which-is-better/strings.js');
    window.lpInstances.forEach(instance => instance.destroy());
    document.querySelector('main').innerHTML = render(content, strings[lang], { id: 'custom', lang });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings[lang], state: state === undefined ? undefined : { read: () => state, write: () => {} } });
  }, { content, lang, state });
}

test('keyboard journey: error, one choice per question, focus on each result, the summary and Start over', async ({ page }) => {
  await open(page); await observe(page);
  const question = page.locator('[data-lp-question]');
  const feedback = page.locator('[data-lp-feedback]');
  await expect(page.locator('[data-lp-fallback]')).toBeHidden();
  await expect(page.locator('[data-lp-summary]')).toBeHidden();
  await expect(question).toHaveText(`Question 1 of 3, ${english.qualities[0].question}`);
  await expect(page.getByRole('group')).toHaveAccessibleName(groupName('Question 1 of 3', english.qualities[0].question));
  await expect(page.getByRole('group')).toHaveAccessibleDescription('Choose one.');

  // Tab order: Version A's sentences, Version B's, Neither, then Check.
  const order = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'neither'];
  for (const pick of order) { await page.keyboard.press('Tab'); await expect(row(page, pick)).toBeFocused(); }
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-check]')).toBeFocused();

  // Checking with nothing chosen links the error to every row and focuses the first.
  await page.keyboard.press('Enter');
  const error = page.locator('[data-lp-error]');
  await expect(error).toBeVisible(); await expect(error).toHaveText('Choose an answer');
  await expect(row(page, 'a1')).toBeFocused();
  await expect(row(page, 'a1')).toHaveAccessibleDescription('Choose an answer');
  expect(await announcements(page)).toEqual([]);

  // Space presses a row; pressing another moves the choice; pressing it again releases it.
  await page.keyboard.press('Space');
  await expect(error).toBeHidden(); await expect(page.locator('[aria-describedby="' + await error.getAttribute('id') + '"]')).toHaveCount(0);
  await expect(row(page, 'a1')).toHaveAttribute('aria-pressed', 'true');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
  await expect(row(page, 'b2')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(1);
  await expect(row(page, 'b2')).toHaveAttribute('aria-pressed', 'true');
  await expect(row(page, 'b2')).toHaveAccessibleName(`Version B, sentence 2: ${english.versions.b[1]}`);
  await page.keyboard.press('Space');
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0);
  await page.keyboard.press('Space');

  // Check: marks on the rows, focus reads the result and reason once, the rows lock.
  await page.locator('[data-lp-check]').focus(); await page.keyboard.press('Enter');
  await expect(feedback).toBeFocused();
  await expect(feedback).toHaveText(`Correct. ${english.qualities[0].reason}`);
  await expect(row(page, 'b2')).toHaveAttribute('data-lp-mark', 'correct');
  await expect(page.locator('[data-lp-mark]')).toHaveCount(1);
  await expect(page.locator('button[data-lp-pick]:disabled')).toHaveCount(7);
  await expect(page.locator('[data-lp-check]')).toBeHidden();
  await expectChoiceMarks(page);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ at: 0, picks: ['b2'] });
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-next]')).toBeFocused();
  await expect(page.locator('[data-lp-next]')).toHaveText('Next question');

  // Next: a fresh question, focus on its line.
  await page.keyboard.press('Enter');
  await expect(question).toBeFocused();
  await expect(question).toHaveText(`Question 2 of 3, ${english.qualities[1].question}`);
  await expect(page.locator('[data-lp-mark], [aria-pressed="true"], button[data-lp-pick]:disabled')).toHaveCount(0);
  await expect(feedback).toBeHidden();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ at: 1, picks: ['b2'] });

  // A sentence where neither version does it is wrong; the Neither row shows the answer.
  await decide(page, 'b2', { next: false });
  await expect(feedback).toBeFocused();
  await expect(feedback).toHaveText(`Incorrect. Correct answer: Neither version does this. ${english.qualities[1].reason}`);
  await expect(row(page, 'b2')).toHaveAttribute('data-lp-mark', 'wrong');
  await expect(row(page, 'neither')).toHaveAttribute('data-lp-mark', 'missed');
  await page.locator('[data-lp-next]').click();

  // The right version with the wrong sentence is wrong too, and the hidden line names the right one.
  await decide(page, 'b3', { next: false });
  await expect(feedback).toHaveText(`Incorrect. Correct answer: Version B, sentence 1: ${english.versions.b[0]} ${english.qualities[2].reason}`);
  await expect(page.locator('[data-lp-next]')).toHaveText('Show the summary');
  await expectChoiceMarks(page);
  expect(await announcements(page)).toEqual([]);

  // The summary: heading, one result sentence with focus, the annotated version, what both miss.
  await page.locator('[data-lp-next]').click();
  const end = page.locator('[data-lp-summary]');
  await expect(page.locator('[data-lp-step]')).toBeHidden();
  await expect(end.locator('h3')).toHaveText('What makes Version B better');
  await expect(end.locator('[data-lp-result]')).toBeFocused();
  await expect(end.locator('[data-lp-result]')).toHaveText('You answered 1 of 3 questions correctly.');
  await expect(end.locator('mark')).toHaveText([english.versions.b[0], english.versions.b[1]]);
  await expect(end.locator('.lp-which-is-better-note')).toHaveText([`This sentence shows: ${english.qualities[2].note}`, `This sentence shows: ${english.qualities[0].note}`]);
  // "Version B" is said to screen readers only; the heading above already names it.
  await expect(end.locator('.lp-which-is-better-group > .lp-visually-hidden')).toHaveText('Version B');
  await expect(end.locator('.lp-label')).toHaveText(['Missing from both versions']);
  await expect(end.locator('.lp-which-is-better-missing li')).toHaveText([english.qualities[1].note]);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ at: 3, picks: ['b2', 'b2', 'b3'] });
  expect(await announcements(page)).toEqual([]);

  // Start over: back to question 1, nothing chosen, one announcement.
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-restart]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(question).toBeFocused();
  await expect(question).toHaveText(`Question 1 of 3, ${english.qualities[0].question}`);
  await expect(end).toBeHidden();
  await expect(page.locator('[data-lp-mark], [aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('[data-lp-check]')).toBeVisible();
  expect(await announcements(page)).toEqual(['Answers cleared.']);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ at: 0, picks: [] });
  // A second pass works after the reset, and the stale status clears on the next result.
  await decide(page, 'neither', { next: false });
  await expect(feedback).toHaveText(`Incorrect. Correct answer: Version B, sentence 2: ${english.versions.b[1]} ${english.qualities[0].reason}`);
});

test('a chosen sentence keeps the accent border and takes the highlighter; marks replace both at the check', async ({ page }) => {
  await open(page);
  await row(page, 'b2').click();
  await expect(row(page, 'b2')).toHaveCSS('border-top-width', '2px');
  await expect(row(page, 'b2')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(row(page, 'b2').locator('.lp-which-is-better-text')).toHaveCSS('background-color', HIGHLIGHTER);
  // Neither keeps the standard tint.
  await row(page, 'neither').click();
  await expect(row(page, 'neither')).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(row(page, 'b2').locator('.lp-which-is-better-text')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await row(page, 'b2').click();
  // Choosing must not move the text: the highlighter's padding is offset.
  const before = await row(page, 'a1').boundingBox();
  await row(page, 'a1').click();
  expect(await row(page, 'a1').boundingBox()).toEqual(before);
  await row(page, 'b2').click();
  await page.locator('[data-lp-check]').click();
  // After the check the highlighter stays on the sentence that shows the quality.
  await expect(row(page, 'b2').locator('.lp-which-is-better-text')).toHaveCSS('background-color', HIGHLIGHTER);
  await expect(row(page, 'b2')).toHaveCSS('cursor', 'default');
  // The highlighter keeps AA contrast with the ink.
  await page.locator('[data-lp-next]').click(); await decide(page, 'neither'); await decide(page, 'b1');
  const contrast = await page.locator('[data-lp-summary] mark').first().evaluate(el => {
    const lum = value => { const [r, g, b] = value.match(/[\d.]+/g).slice(0, 3).map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
    const css = getComputedStyle(el), a = lum(css.color), b = lum(css.backgroundColor);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

for (const [lang, content, labels] of [
  ['en', english, { progress: 'Question 1 of 3, ', check: 'Check my answer', next: 'Next question', finish: 'Show the summary', summary: 'What makes Version B better', result: 'You answered 3 of 3 questions correctly.', name: 'Version B, sentence 2: ', neither: 'Neither version does this', missing: 'Missing from both versions', restart: 'Start over', cleared: 'Answers cleared.' }],
  ['fr', french, { progress: 'Question 1 sur 3, ', check: 'Vérifier ma réponse', next: 'Question suivante', finish: 'Afficher le résumé', summary: 'Ce qui rend la version B meilleure', result: 'Bonnes réponses : 3 sur 3.', name: 'Version B, phrase 2 : ', neither: 'Aucune des deux versions ne le fait', missing: 'Absent des deux versions', restart: 'Recommencer', cleared: 'Réponses effacées.' }]
]) {
  const typeset = value => lang === 'fr' ? value.replace(/ (?=[:$»])/g, ' ').replace(/ (?=[?!;])/g, ' ').replace(/« /g, '« ') : value;

  test(`card order, names and an all-correct run (${lang})`, async ({ page }) => {
    await open(page, `/which-is-better/${lang}.html`); await observe(page);
    const root = page.locator('[data-lp-pattern]');
    await expect(root).toHaveAttribute('lang', lang);
    await expect(root.locator('> h2.lp-heading')).toHaveText(content.title);
    await expect(root.locator('> .lp-context')).toHaveText(typeset(content.context));
    await expect(root.locator('[data-lp-step] h3')).toHaveText(['Version A', 'Version B']);
    await expect(row(root, 'b2')).toHaveAccessibleName(typeset(labels.name + content.versions.b[1]));
    await expect(row(root, 'b2').locator('.lp-choice-key')).toHaveText('2');
    await expect(row(root, 'neither')).toHaveAccessibleName(labels.neither);
    await expect(root.getByRole('group')).toHaveAccessibleName(groupName(labels.progress.slice(0, -2), typeset(content.qualities[0].question)));
    await expect(root.locator('[data-lp-check]')).toHaveText(labels.check);
    for (const [i, quality] of content.qualities.entries()) {
      await expect(root.locator('[data-lp-question-text]')).toHaveText(typeset(quality.question));
      await decide(root, quality.sentence === null ? 'neither' : `b${quality.sentence}`, { next: false });
      await expect(root.locator('[data-lp-feedback]')).toHaveText(`Correct. ${typeset(quality.reason)}`);
      await expect(root.locator('[data-lp-next]')).toHaveText(i === 2 ? labels.finish : labels.next);
      await root.locator('[data-lp-next]').click();
    }
    await expect(root.locator('[data-lp-summary] h3')).toHaveText(labels.summary);
    await expect(root.locator('[data-lp-result]')).toHaveText(labels.result);
    await expect(root.locator('[data-lp-summary] .lp-label').last()).toHaveText(labels.missing);
    await expect(root.locator('[data-lp-restart]')).toHaveText(labels.restart);
    await root.locator('[data-lp-restart]').click();
    expect(await announcements(page)).toEqual([labels.cleared]);
  });

  test(`no JavaScript shows both versions and each answer behind a disclosure (${lang})`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage(); await page.goto(`/which-is-better/${lang}.html`);
    await expect(page.locator('[data-lp-step], [data-lp-summary]')).toHaveCount(2);
    await expect(page.locator('[data-lp-step]')).toBeHidden(); await expect(page.locator('[data-lp-summary]')).toBeHidden();
    await expect(page.locator('button:visible')).toHaveCount(0);
    const fallback = page.locator('[data-lp-fallback]');
    await expect(fallback.locator('h3')).toHaveText(['Version A', 'Version B']);
    await expect(fallback.locator('.lp-which-is-better-plain').last().locator('li')).toHaveText(content.versions.b.map(typeset));
    await expect(fallback.locator('details')).toHaveCount(3);
    await expect(fallback.locator('details[open]')).toHaveCount(0);
    await expect(fallback.getByText(typeset(content.qualities[0].reason))).toBeHidden();
    for (const summary of await fallback.locator('summary').all()) await summary.click();
    await expect(fallback.locator('details').nth(0)).toContainText(typeset(labels.name + content.versions.b[1]));
    await expect(fallback.locator('details').nth(1)).toContainText(`${labels.neither}.`);
    await expect(fallback.locator('details').nth(2)).toContainText(typeset(content.qualities[2].reason));
    await context.close();
  });

  test(`axe on unchanged server HTML with the answers open (${lang})`, async ({ page }) => {
    // axe needs scripting enabled. Block enhancement to audit the same native baseline.
    await page.route('**/which-is-better/enhance.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export function enhance() { return { destroy() {} }; }' }));
    await open(page, `/which-is-better/${lang}.html`);
    await scan(page);
    for (const summary of await page.locator('summary').all()) await summary.click();
    await scan(page);
  });

  for (const width of [320, 1280]) test(`${width} CSS pixels with text spacing has no scroll or clipping at every stage (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 }); await open(page, `/which-is-better/${lang}.html`);
    await page.addStyleTag({ content: TEXT_SPACING });
    for (const stage of ['initial', 'error', 'chosen', 'checked', 'neither', 'summary']) {
      if (stage === 'error') await page.locator('[data-lp-check]').click();
      if (stage === 'chosen') await row(page, 'a3').click();
      if (stage === 'checked') await page.locator('[data-lp-check]').click();
      if (stage === 'neither') { await page.locator('[data-lp-next]').click(); await decide(page, 'b2', { next: false }); }
      if (stage === 'summary') { await page.locator('[data-lp-next]').click(); await decide(page, 'b1'); }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), stage).toBe(true);
      const problems = await page.evaluate(() => {
        const card = document.querySelector('[data-lp-pattern]').getBoundingClientRect();
        return [...document.querySelectorAll('[data-lp-pattern] :is(p, button, li, h2, h3, mark, .lp-choice-mark, .lp-which-is-better-note)')]
          .filter(el => el.getClientRects().length && !el.matches('[role="status"]') && !el.closest('.lp-visually-hidden'))
          .filter(el => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline' || el.getBoundingClientRect().right > card.right + 1 || el.getBoundingClientRect().left < card.left - 1)
          .map(el => el.textContent);
      });
      expect(problems, stage).toEqual([]);
    }
  });
}

test('the versions sit side by side on a wide card and stack on a phone, and the notes follow', async ({ page }) => {
  for (const [width, side] of [[1280, true], [640, false], [390, false]]) {
    await page.setViewportSize({ width, height: 900 }); await open(page);
    const [a, b] = await Promise.all(['a1', 'b1'].map(pick => row(page, pick).boundingBox()));
    expect(Math.abs(a.y - b.y) < 1, `${width}px side by side`).toBe(side);
    await decide(page, 'b2'); await decide(page, 'neither'); await decide(page, 'b1');
    const [sentence, note] = await Promise.all([page.locator('[data-lp-summary] mark').first().boundingBox(), page.locator('.lp-which-is-better-note').first().boundingBox()]);
    // Wide: the note sits in the margin to the right. Narrow: under its sentence.
    if (side) expect(note.x).toBeGreaterThan(sentence.x + sentence.width);
    // Half a pixel of slack: Firefox rounds the two boxes' edges differently when they touch.
    else expect(note.y).toBeGreaterThanOrEqual(sentence.y + sentence.height - 0.5);
  }
});

for (const path of ['/which-is-better/en.html', '/which-is-better/fr.html', '/which-is-better/two.html']) {
  test(`axe at load, error, choice, each check, the summary and reset: ${path}`, async ({ page }) => {
    await open(page, path); await scan(page);
    const roots = await page.locator('[data-lp-pattern]').all();
    for (const root of roots) await root.locator('[data-lp-check]').click();
    await scan(page);
    for (const root of roots) await row(root, 'a2').click();
    await scan(page);
    for (const root of roots) { await root.locator('[data-lp-check]').click(); }
    await scan(page);
    for (const root of roots) { await root.locator('[data-lp-next]').click(); await decide(root, 'neither', { next: false }); }
    await scan(page);
    for (const root of roots) { await root.locator('[data-lp-next]').click(); await decide(root, 'b1'); }
    await scan(page);
    for (const root of roots) await root.locator('[data-lp-restart]').click();
    await scan(page);
  });
}

test('a checked question cannot be changed or checked twice', async ({ page }) => {
  await open(page);
  await decide(page, 'a2', { next: false });
  // Stray activations of locked rows and the hidden Check change nothing.
  await page.locator('[data-lp-pick="b1"]').evaluate(button => { button.disabled = false; button.click(); button.disabled = true; });
  await page.locator('[data-lp-check]').evaluate(button => { button.hidden = false; button.click(); });
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ at: 0, picks: ['a2'] });
  await expect(row(page, 'a2')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.lp-choice-mark')).toHaveCount(2);
});

for (const [seed, question, checked, after] of [[{ at: 1, picks: ['b2'] }, 2, false, { at: 1, picks: ['b2', 'b1'] }], [{ at: 1, picks: ['b2', 'a1'] }, 2, true, { at: 2, picks: ['b2', 'a1', 'b1'] }]]) {
  test(`saved answers restore silently on the open question: ${JSON.stringify(seed)}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, seed);
    await open(page);
    await expect(page.locator('[data-lp-progress]')).toHaveText(`Question ${question} of 3`);
    await expect(page.locator('[data-lp-feedback]')).toBeVisible({ visible: checked });
    await expect(page.locator('[data-lp-mark]')).toHaveCount(checked ? 2 : 0);
    await expect(page.locator('button[data-lp-pick]:disabled')).toHaveCount(checked ? 7 : 0);
    await expect(page.locator('[data-lp-next]')).toBeVisible({ visible: checked });
    await expect(page.locator('[role="status"]')).toHaveText('');
    expect(await page.evaluate(() => document.activeElement === document.body && scrollY === 0)).toBe(true);
    if (checked) await page.locator('[data-lp-next]').click();
    await decide(page, 'b1', { next: false });
    expect(await page.evaluate(() => window.lpSaved)).toEqual(after);
  });
}

test('a finished saved run restores the summary without speaking', async ({ page }) => {
  await page.addInitScript(value => { window.lpSeed = value; }, { at: 3, picks: ['b2', 'neither', 'a1'] });
  await open(page);
  await expect(page.locator('[data-lp-step]')).toBeHidden();
  await expect(page.locator('[data-lp-result]')).toHaveText('You answered 2 of 3 questions correctly.');
  await expect(page.locator('[data-lp-restart]')).toBeVisible();
  await expect(page.locator('[role="status"]')).toHaveText('');
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
});

for (const seed of [{ at: 1, picks: [] }, { at: 0, picks: ['z9'] }, { at: 4, picks: ['b2', 'b2', 'b2'] }, { at: 0, picks: [], shown: true }, 'not an object']) {
  test(`invalid saved state is ignored: ${JSON.stringify(seed)}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, seed); await open(page);
    await expect(page.locator('[data-lp-progress]')).toHaveText('Question 1 of 3');
    await expect(page.locator('[data-lp-mark], [aria-pressed="true"]')).toHaveCount(0);
    await expect(page.locator('[data-lp-summary]')).toBeHidden(); await expect(page.locator('[role="status"]')).toHaveText('');
  });
}

test('the pattern works in memory without a state adapter, with two questions and no Neither', async ({ page }) => {
  const content = { ...english, qualities: [english.qualities[0], { ...english.qualities[2] }] };
  await mount(page, content);
  await expect(page.locator('[data-lp-progress]')).toHaveText('Question 1 of 2');
  await decide(page, 'b2'); await decide(page, 'b1');
  await expect(page.locator('[data-lp-result]')).toHaveText('You answered 2 of 2 questions correctly.');
  await expect(page.locator('[data-lp-summary] .lp-label')).toHaveCount(0);
  await page.locator('[data-lp-restart]').click();
  await expect(page.locator('[data-lp-progress]')).toHaveText('Question 1 of 2');
});

test('worst-case authored text wraps inside the card at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const token = 'Q3-Client-Report_Northwind_Industries_Holdings_FINAL_v12_approved-by-legal.xlsx';
  const content = structuredClone(english);
  content.title = `Compare ${token}`;
  content.versions.a = [...english.versions.a, `${token} ${'More words in a long sentence. '.repeat(6)}`.slice(0, 300)];
  content.versions.b[2] = `Send ${token} to Jo.`;
  content.qualities[0].note = `Who to call about ${token}`;
  await mount(page, content, { state: { at: 0, picks: ['a4'] } });
  const overflow = async () => page.evaluate(() => {
    const card = document.querySelector('[data-lp-pattern]').getBoundingClientRect();
    return document.documentElement.scrollWidth <= innerWidth && Math.max(...[...document.querySelectorAll('[data-lp-pattern] *')].filter(el => el.getClientRects().length && !el.closest('.lp-visually-hidden')).map(el => el.getBoundingClientRect().right - card.right)) <= 0;
  });
  expect(await overflow()).toBe(true);
  await page.locator('[data-lp-next]').click(); await decide(page, 'neither'); await decide(page, 'b1');
  expect(await overflow()).toBe(true);
});

test('two instances have unique ids and independent answers', async ({ page }) => {
  await open(page, '/which-is-better/two.html');
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  await row(roots.first(), 'b2').click();
  await expect(roots.nth(1).locator('[aria-pressed="true"]')).toHaveCount(0);
  await roots.nth(1).locator('[data-lp-check]').click();
  await expect(roots.nth(1).locator('[data-lp-error]')).toBeVisible();
  await expect(roots.first().locator('[data-lp-error]')).toBeHidden();
  await roots.first().locator('[data-lp-check]').click();
  await expect(roots.first().locator('[data-lp-mark]')).toHaveCount(1);
  await expect(roots.nth(1).locator('[data-lp-mark]')).toHaveCount(0);
});

test('enhance twice returns one instance; destroy restores the no-JavaScript view and can re-enhance', async ({ page }) => {
  await open(page); expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await decide(page, 'b2'); await decide(page, 'a1', { next: false });
  await page.evaluate(() => window.lpInstances[0].destroy());
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await expect(page.locator('[data-lp-step], [data-lp-summary]')).toHaveCount(2);
  await expect(page.locator('[data-lp-step]')).toBeHidden(); await expect(page.locator('[data-lp-summary]')).toBeHidden();
  await expect(page.locator('[data-lp-mark], [aria-pressed="true"], button:disabled')).toHaveCount(0);
  await expect(page.locator('[data-lp-progress]')).toHaveText('Question 1 of 3');
  const again = await page.evaluate(() => window.lpEnhance() !== window.lpInstances[0]);
  expect(again).toBe(true);
  await expect(page.locator('[data-lp-step]')).toBeVisible();
  await expect(page.locator('[data-lp-fallback]')).toBeHidden();
});

test('forced colours keep the choice, the highlight, the marks and focus distinct', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page);
  const ring = locator => locator.evaluate(el => { const css = getComputedStyle(el); return [css.outlineWidth, css.outlineStyle]; });
  await page.keyboard.press('Tab'); await expect(row(page, 'a1')).toBeFocused();
  expect(await ring(row(page, 'a1'))).toEqual(['3px', 'solid']);
  await row(page, 'b3').click();
  await expect(row(page, 'b3')).toHaveCSS('border-top-width', '2px');
  const text = await row(page, 'b3').locator('.lp-which-is-better-text').evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).forcedColorAdjust]);
  expect(text[1]).toBe('none'); expect(text[0]).not.toBe('rgba(0, 0, 0, 0)');
  await page.locator('[data-lp-check]').click();
  await expect(row(page, 'b3')).toHaveCSS('border-style', 'double');
  await expect(row(page, 'b2')).toHaveCSS('border-top-style', 'dashed');
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-next]')).toBeFocused();
  expect(await ring(page.locator('[data-lp-next]'))).toEqual(['3px', 'solid']);
});

test('on a phone, an empty check and each Next bring the question, and the error under it, into view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await open(page, '/which-is-better/fr.html');
  await page.locator('[data-lp-check]').click();
  for (const locator of [page.locator('[data-lp-question]'), page.locator('[data-lp-error]')]) await expect(locator).toBeInViewport({ ratio: .95 });
  // The error sits between the question and the versions.
  const [question, error, versions] = await Promise.all(['[data-lp-question]', '[data-lp-error]', '[data-lp-step] h3'].map(selector => page.locator(selector).first().boundingBox()));
  expect(error.y).toBeGreaterThan(question.y); expect(versions.y).toBeGreaterThan(error.y);
  for (const pick of ['b2', 'neither']) {
    await decide(page, pick, { next: false });
    // The reason reads as the answer to the question, not a caption on the Neither row.
    const gap = await page.locator('[data-lp-feedback]').evaluate(feedback => feedback.getBoundingClientRect().top - feedback.ownerDocument.querySelector('[data-lp-pick="neither"]').getBoundingClientRect().bottom);
    expect(gap).toBeGreaterThanOrEqual(15);
    await page.locator('[data-lp-next]').click();
    await expect(page.locator('[data-lp-question]')).toBeFocused();
    await expect(page.locator('[data-lp-question]')).toBeInViewport({ ratio: .95 });
  }
  await decide(page, 'b1');
  await expect(page.locator('[data-lp-result]')).toBeInViewport({ ratio: .95 });
});

test('rows ring for keyboard focus only, so a tapped row does not look chosen twice', async ({ page, browserName }) => {
  await open(page);
  await page.keyboard.press('Tab'); await expect(row(page, 'a1')).toBeFocused();
  await expect(row(page, 'a1')).toHaveCSS('outline-style', 'solid'); await expect(row(page, 'a1')).toHaveCSS('outline-width', '3px');
  await open(page);
  await row(page, 'a2').click();
  await expect(row(page, 'a2')).toHaveCSS('outline-style', 'none');
  await row(page, 'a2').click();
  // WebKit decides focus-visible for script focus by its own rules, so the empty check is asserted elsewhere.
  if (browserName === 'webkit') return;
  await page.locator('[data-lp-check]').click();
  await expect(row(page, 'a1')).toBeFocused();
  await expect(row(page, 'a1')).toHaveCSS('outline-style', 'none');
});

for (const [lang, width] of [['en', 320], ['en', 1280], ['fr', 320], ['fr', 390], ['fr', 1280]]) {
  test(`the phone number stays on one line at ${width}px (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await open(page, `/which-is-better/${lang}.html`);
    const lines = target => target.evaluate(el => {
      const node = el.firstChild, text = node.textContent, range = el.ownerDocument.createRange();
      range.setStart(node, text.indexOf('514')); range.setEnd(node, text.indexOf('0142') + 4);
      return new Set([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => Math.round(rect.top))).size;
    });
    // In its row while choosing, then highlighted in the summary.
    expect(await lines(row(page, 'b2').locator('.lp-which-is-better-text'))).toBe(1);
    await decide(page, 'b2'); await decide(page, 'neither'); await decide(page, 'b1');
    expect(await lines(page.locator('[data-lp-summary] mark').nth(1))).toBe(1);
  });
}

test('missing markup and invalid content fail loudly with the part named', async ({ page }) => {
  await open(page);
  const messages = await page.evaluate(async content => {
    const { render } = await import('/patterns/which-is-better/render.js');
    const { enhance } = await import('/patterns/which-is-better/enhance.js');
    const { strings } = await import('/patterns/which-is-better/strings.js');
    const host = document.createElement('div'); document.body.append(host);
    const attempt = (selector, data = content) => {
      host.innerHTML = render(content, strings.en, { id: 'planted', lang: 'en' });
      if (selector) host.querySelector(selector).remove();
      try { enhance(host.firstElementChild, { content: data, strings: strings.en }); return 'enhanced'; } catch (error) { return error.message; }
    };
    const selectors = ['[data-lp-fallback]', '[data-lp-step]', '[role="group"]', '[data-lp-question]', '[data-lp-progress]', '[data-lp-question-text]', '[data-lp-error]', '[data-lp-feedback]', '[data-lp-verdict]', '[data-lp-reason]', '[data-lp-check]', '[data-lp-next]', '[data-lp-summary]', '[data-lp-result]', '[data-lp-restart]', '[role="status"]'];
    return { selectors, missing: selectors.map(selector => attempt(selector)), invalid: attempt(null, { ...content, qualities: [] }) };
  }, english);
  expect(messages.missing).toEqual(messages.selectors.map(selector => `Missing which-is-better markup: ${selector}`));
  expect(messages.invalid).toMatch(/qualities/);
});

test('after a wrong pick the right sentence keeps the highlighter and the wrong one loses it', async ({ page }) => {
  await open(page);
  await decide(page, 'a2', { next: false });
  await expect(row(page, 'b2').locator('.lp-which-is-better-text')).toHaveCSS('background-color', HIGHLIGHTER);
  await expect(row(page, 'a2').locator('.lp-which-is-better-text')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('on a wide card sentence n of each version starts level, even after a mark adds a line', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await open(page);
  const tops = () => Promise.all(['a1', 'b1', 'a2', 'b2', 'a3', 'b3'].map(pick => row(page, pick).evaluate(el => Math.round(el.getBoundingClientRect().top))));
  const level = values => [0, 2, 4].every(i => Math.abs(values[i] - values[i + 1]) <= 1);
  expect(level(await tops())).toBe(true);
  await decide(page, 'b1', { next: false });
  expect(level(await tops())).toBe(true);
});

for (const width of [390, 640]) test(`in the stacked summary at ${width}px each highlight is no wider than its text`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await open(page, '/which-is-better/fr.html');
  await decide(page, 'b2'); await decide(page, 'neither'); await decide(page, 'b1');
  const lines = await page.locator('[data-lp-summary] mark').evaluateAll(marks => marks.map(mark => {
    const range = mark.ownerDocument.createRange(); range.selectNodeContents(mark);
    const text = [...range.getClientRects()].filter(rect => rect.width > 0);
    return [...mark.getClientRects()].filter(rect => rect.width > 0).map((rect, i) => rect.width - text[i].width);
  }));
  expect(lines.flat().length).toBeGreaterThan(2);
  // Only the 3px of padding on each side, as on the question screens.
  for (const extra of lines.flat()) expect(extra).toBeLessThanOrEqual(6.5);
});
