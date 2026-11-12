import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { expectChoiceMarks } from './choice-marks.js';

const english = JSON.parse(await readFile(new URL('../../patterns/which-is-better/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/which-is-better/examples/fr.json', import.meta.url)));
const TEXT_SPACING = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';
const HIGHLIGHTER = 'rgb(255, 228, 154)';
const CLEAR = 'rgba(0, 0, 0, 0)';
const TRANSPARENT = /^rgba\(\d+, \d+, \d+, 0\)$/;
/** Body sentences in reading order, as picks count them. */
const sentences = (content, version) => content.versions[version].body.flat();

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
// Accessible names are whitespace-normalised, so French no-break spaces come back as plain spaces.
const groupName = (progress, question) => new RegExp(`^${progress} ?, ${question.replace(/\s+/g, ' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const pick = (root, value) => root.locator(`[data-lp-pick="${value}"]`);
/** Choose a sentence or Neither and check it, then go on with Next. */
async function decide(root, value, { next = true } = {}) {
  await pick(root, value).click();
  await root.locator('[data-lp-check]').click();
  if (next) await root.locator('[data-lp-next]').click();
}
/** Each marked sentence is followed by the shared mark for its kind, in the pattern's words. */
async function expectSentenceMarks(page) {
  const marks = await page.evaluate(async () => {
    const { renderChoiceMark } = await import('/lib/choice-mark.js');
    const { strings } = await import('/patterns/which-is-better/strings.js');
    const words = { correct: 'markCorrect', wrong: 'markWrong', missed: 'markAnswer' };
    return [...document.querySelectorAll('.lp-which-is-better-chunk[data-lp-mark]')].map(chunk => {
      const root = chunk.closest('[data-lp-pattern]'), kind = chunk.dataset.lpMark;
      const template = document.createElement('template');
      template.innerHTML = renderChoiceMark(kind, strings[root.lang][words[kind]], root.lang);
      return { kind, actual: chunk.nextElementSibling?.outerHTML, expected: template.content.firstElementChild.outerHTML };
    });
  });
  expect(marks.length, 'marked sentences').toBeGreaterThan(0);
  for (const { kind, actual, expected } of marks) expect(actual, `${kind} sentence mark`).toBe(expected);
  // Only the shared marks follow sentences.
  await expect(page.locator('.lp-which-is-better-body .lp-choice-mark')).toHaveCount(marks.length);
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

test('keyboard journey: error, one choice per question, arrow keys, focus on each result, the summary and Start over', async ({ page }) => {
  await open(page); await observe(page);
  const question = page.locator('[data-lp-question]');
  const feedback = page.locator('[data-lp-feedback]');
  const b = sentences(english, 'b');
  await expect(page.locator('[data-lp-fallback]')).toBeHidden();
  await expect(page.locator('[data-lp-summary]')).toBeHidden();
  await expect(question).toHaveText(`Question 1 of 3, ${english.qualities[0].question}`);
  const choices = page.locator('[data-lp-choices]');
  await expect(choices).toHaveAccessibleName(groupName('Question 1 of 3', english.qualities[0].question));
  await expect(choices).toHaveAccessibleDescription('Highlight one sentence in either version, or choose "Neither version does this".');
  // The instruction is body-size ink at regular weight, so the question stays the one bold line, and
  // a group gap separates it from the emails.
  const hint = page.locator('#' + await choices.getAttribute('aria-describedby'));
  await expect(hint).toHaveCSS('font-weight', '400');
  await expect(hint).toHaveCSS('font-size', '17px');
  await expect(hint).toHaveCSS('color', 'rgb(22, 24, 29)');
  const [hintBox, emailsBox] = await Promise.all([hint.boundingBox(), page.locator('[data-lp-step] .lp-which-is-better-pair').boundingBox()]);
  expect(emailsBox.y - (hintBox.y + hintBox.height)).toBeGreaterThanOrEqual(23);
  // Each email is a group named by its version, so moving into Version B says so.
  await expect(page.getByRole('group', { name: 'Version B', exact: true }).getByRole('button')).toHaveCount(b.length);

  // Tab order: Version A's body sentences, Version B's, Neither, then Check.
  const order = ['a1', 'a2', 'b1', 'b2', 'neither'];
  for (const value of order) { await page.keyboard.press('Tab'); await expect(pick(page, value)).toBeFocused(); }
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-check]')).toBeFocused();

  // Checking with nothing chosen links the error to every choice and focuses the first sentence.
  await page.keyboard.press('Enter');
  const error = page.locator('[data-lp-error]');
  await expect(error).toBeVisible(); await expect(error).toHaveText('Choose an answer');
  await expect(pick(page, 'a1')).toBeFocused();
  await expect(pick(page, 'a1')).toHaveAccessibleDescription('Choose an answer');
  await expect(pick(page, 'neither')).toHaveAccessibleDescription('Choose an answer');
  expect(await announcements(page)).toEqual([]);

  // Space presses a sentence; pressing another moves the choice; pressing it again releases it.
  await page.keyboard.press('Space');
  await expect(error).toBeHidden(); await expect(page.locator('[aria-describedby="' + await error.getAttribute('id') + '"]')).toHaveCount(0);
  await expect(pick(page, 'a1')).toHaveAttribute('aria-pressed', 'true');
  // Arrows move through both emails and wrap; Home and End jump to the ends. Neither is a Tab stop only.
  await page.keyboard.press('ArrowLeft'); await expect(pick(page, 'b2')).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(pick(page, 'a1')).toBeFocused();
  await page.keyboard.press('End'); await expect(pick(page, 'b2')).toBeFocused();
  await page.keyboard.press('Home'); await expect(pick(page, 'a1')).toBeFocused();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(pick(page, 'b2')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(1);
  await expect(pick(page, 'b2')).toHaveAttribute('aria-pressed', 'true');
  // A sentence's name is its own words; the email group gives the version.
  await expect(pick(page, 'b2')).toHaveAccessibleName(b[1]);
  await expect(pick(page, 'b2')).toHaveRole('button');
  await page.keyboard.press('Space');
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0);
  await page.keyboard.press('Space');

  // Check: marks follow the sentences, focus reads the result and reason once, the choices lock.
  await page.locator('[data-lp-check]').focus(); await page.keyboard.press('Enter');
  await expect(feedback).toBeFocused();
  await expect(feedback).toHaveText(`Correct. ${english.qualities[0].reason}`);
  // The verdict shows at the start of the feedback, icon and word, in the status colour.
  const verdict = feedback.locator('.lp-which-is-better-verdict');
  await expect(verdict).toHaveClass(/lp-met/);
  await expect(verdict.locator('> span:not(.lp-visually-hidden)')).toHaveText('Correct');
  await expect(verdict.locator('svg')).toBeVisible();
  await expect(pick(page, 'b2')).toHaveAttribute('data-lp-mark', 'correct');
  await expect(page.locator('[data-lp-mark]')).toHaveCount(1);
  await expect(page.locator('.lp-which-is-better-chunk[aria-disabled="true"]')).toHaveCount(4);
  await expect(pick(page, 'neither')).toBeDisabled();
  await expect(page.locator('[data-lp-check]')).toBeHidden();
  await expectSentenceMarks(page);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ at: 0, picks: ['b2'] });
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-next]')).toBeFocused();
  await expect(page.locator('[data-lp-next]')).toHaveText('Next question');

  // Next: a fresh question, focus on its line.
  await page.keyboard.press('Enter');
  await expect(question).toBeFocused();
  await expect(question).toHaveText(`Question 2 of 3, ${english.qualities[1].question}`);
  await expect(page.locator('[data-lp-mark], [aria-pressed="true"], [aria-disabled="true"], button[data-lp-pick]:disabled, .lp-choice-mark')).toHaveCount(0);
  await expect(feedback).toBeHidden();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ at: 1, picks: ['b2'] });

  // A sentence where neither version does it is wrong; the Neither row shows the answer.
  await decide(page, 'b2', { next: false });
  await expect(feedback).toBeFocused();
  await expect(feedback).toHaveText(`Incorrect. Correct answer: Neither version does this. ${english.qualities[1].reason}`);
  await expect(verdict).toHaveClass(/lp-missed/);
  await expect(verdict.locator('> span:not(.lp-visually-hidden)')).toHaveText('Incorrect');
  await expect(pick(page, 'b2')).toHaveAttribute('data-lp-mark', 'wrong');
  await expect(pick(page, 'neither')).toHaveAttribute('data-lp-mark', 'missed');
  await expectChoiceMarks(page);
  await expectSentenceMarks(page);
  await page.locator('[data-lp-next]').click();

  // The right version with the wrong sentence is wrong too, and the hidden line quotes the right one.
  await decide(page, 'b2', { next: false });
  await expect(feedback).toHaveText(`Incorrect. Correct answer, in Version B: ${b[0]} ${english.qualities[2].reason}`);
  await expect(page.locator('[data-lp-next]')).toHaveText('Show the summary');
  await expectSentenceMarks(page);
  expect(await announcements(page)).toEqual([]);

  // The summary: heading, one result sentence with focus, the annotated email, what both miss.
  await page.locator('[data-lp-next]').click();
  const end = page.locator('[data-lp-summary]');
  await expect(page.locator('[data-lp-step]')).toBeHidden();
  await expect(end.locator('h3')).toHaveText('What makes Version B better');
  await expect(end.locator('[data-lp-result]')).toBeFocused();
  await expect(end.locator('[data-lp-result]')).toHaveText('You answered 1 of 3 questions correctly.');
  await expect(end.locator('mark')).toHaveText([b[0], b[1]]);
  await expect(end.locator('.lp-which-is-better-note')).toHaveText([`This sentence shows: ${english.qualities[2].note}`, `This sentence shows: ${english.qualities[0].note}`]);
  // "Version B" is said to screen readers only; the heading above already names it.
  await expect(end.locator('.lp-which-is-better-email > .lp-visually-hidden')).toHaveText('Version B');
  await expect(end.locator('.lp-which-is-better-subject')).toHaveText(`Subject: ${english.versions.b.subject}`);
  await expect(end.locator('.lp-label')).toHaveText(['Missing from both versions']);
  await expect(end.locator('.lp-which-is-better-missing li')).toHaveText([english.qualities[1].note]);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ at: 3, picks: ['b2', 'b2', 'b2'] });
  expect(await announcements(page)).toEqual([]);

  // Start over: back to question 1, nothing chosen, one announcement.
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-restart]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(question).toBeFocused();
  await expect(question).toHaveText(`Question 1 of 3, ${english.qualities[0].question}`);
  await expect(end).toBeHidden();
  await expect(page.locator('[data-lp-mark], [aria-pressed="true"], [aria-disabled="true"]')).toHaveCount(0);
  await expect(page.locator('[data-lp-check]')).toBeVisible();
  expect(await announcements(page)).toEqual(['Answers cleared.']);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ at: 0, picks: [] });
  // A second pass works after the reset, and the stale status clears on the next result.
  await decide(page, 'neither', { next: false });
  await expect(feedback).toHaveText(`Incorrect. Correct answer, in Version B: ${b[1]} ${english.qualities[0].reason}`);
});

test('only body sentences are choices: the subject, greeting and sign-off are plain text', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-lp-step] [data-lp-pick]')).toHaveCount(sentences(english, 'a').length + sentences(english, 'b').length + 1);
  for (const selector of ['.lp-which-is-better-subject', '.lp-which-is-better-body > p:first-child', '.lp-which-is-better-body > p:last-child']) {
    const part = page.locator(`[data-lp-step] ${selector}`).first();
    await expect(part.locator('[data-lp-pick]')).toHaveCount(0);
    await part.click();
  }
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('[data-lp-step] .lp-which-is-better-body > p:last-child').first()).toHaveText(english.versions.a.signoff);
});

test('a chosen sentence takes the highlighter and an accent underline; a correct pick keeps it and adds a green underline', async ({ page }) => {
  await open(page);
  await pick(page, 'b2').click();
  await expect(pick(page, 'b2')).toHaveCSS('background-color', HIGHLIGHTER);
  await expect(pick(page, 'b2')).toHaveCSS('text-decoration-line', 'underline');
  await expect(pick(page, 'b2')).toHaveCSS('text-decoration-color', 'rgb(44, 85, 201)');
  // Neither keeps the row selection: accent border and tint.
  await pick(page, 'neither').click();
  await expect(pick(page, 'neither')).toHaveCSS('border-top-width', '2px');
  await expect(pick(page, 'neither')).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(pick(page, 'b2')).toHaveCSS('background-color', CLEAR);
  // Choosing must not move the text: the highlighter's padding is offset.
  const before = await pick(page, 'a2').boundingBox();
  await pick(page, 'a1').click();
  expect(await pick(page, 'a2').boundingBox()).toEqual(before);
  await pick(page, 'b2').click();
  await page.locator('[data-lp-check]').click();
  // A correct pick keeps its highlighter and adds a green underline.
  await expect(pick(page, 'b2')).toHaveCSS('background-color', HIGHLIGHTER);
  await expect(pick(page, 'b2')).toHaveCSS('text-decoration-color', 'rgb(18, 112, 79)');
  await expect(pick(page, 'b2')).toHaveCSS('cursor', 'default');
  // The highlighter keeps AA contrast with the ink.
  await page.locator('[data-lp-next]').click(); await decide(page, 'neither'); await decide(page, 'b1');
  const contrast = await page.locator('[data-lp-summary] mark').first().evaluate(el => {
    const lum = value => { const [r, g, b] = value.match(/[\d.]+/g).slice(0, 3).map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
    const css = getComputedStyle(el), a = lum(css.color), b = lum(css.backgroundColor);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

test('results follow Highlight the key passage: the pick keeps its highlighter, the missed answer is dashed with no fill', async ({ page }) => {
  await open(page);
  await decide(page, 'a2', { next: false });
  // A wrong pick keeps its yellow and has no underline.
  await expect(pick(page, 'a2')).toHaveCSS('background-color', HIGHLIGHTER);
  await expect(pick(page, 'a2')).toHaveCSS('text-decoration-line', 'none');
  // The right sentence the learner missed: dashed underline, no fill.
  await expect(pick(page, 'b2')).toHaveCSS('background-color', CLEAR);
  await expect(pick(page, 'b2')).toHaveCSS('text-decoration-style', 'dashed');
  await expectSentenceMarks(page);
});

test('each mark and each summary note sits on its own line under its sentence, and the next sentence starts a paragraph gap below', async ({ page }) => {
  // In the sample the answer sentences end their paragraphs; a sentence after each puts text after the mark and the note.
  const content = structuredClone(english);
  content.versions.a.body[0].push('I apologize for any inconvenience.');
  content.versions.b.body[0].push("For anything else, I'll reply when I'm back.");
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 }); await mount(page, content);
    await decide(page, 'a2', { next: false });
    const placed = await page.locator('.lp-which-is-better-body .lp-choice-mark').evaluateAll(marks => marks.map(mark => {
      const sentence = [...mark.previousElementSibling.getClientRects()].at(-1), badge = mark.getBoundingClientRect();
      const line = mark.closest('p').getBoundingClientRect(), after = mark.nextElementSibling.getClientRects()[0];
      return {
        below: badge.top >= sentence.bottom - 1, indented: badge.left >= line.left + 11,
        plain: getComputedStyle(mark).backgroundColor === 'rgba(0, 0, 0, 0)', gap: after.top - badge.bottom
      };
    }));
    expect(placed.length).toBe(2);
    for (const { below, indented, plain, gap } of placed) {
      expect({ below, indented, plain }, `${width}px`).toEqual({ below: true, indented: true, plain: true });
      expect(gap, `${width}px`).toBeGreaterThanOrEqual(11);
    }
    // The sentence after a summary note starts a paragraph gap below it, so it doesn't read as part of the note.
    await page.locator('[data-lp-next]').click(); await decide(page, 'neither'); await decide(page, 'b1');
    const gap = await page.locator('.lp-which-is-better-note').nth(1).evaluate(note => {
      const range = note.ownerDocument.createRange(); range.selectNodeContents(note.nextSibling);
      const first = [...range.getClientRects()].find(rect => rect.width > 4);
      return first.top - note.getBoundingClientRect().bottom;
    });
    expect(gap, `${width}px summary`).toBeGreaterThanOrEqual(11);
  }
});

test('the Neither key shows a check when chosen or correct and an x when wrong, in the mark colours', async ({ page }) => {
  await open(page);
  const neither = pick(page, 'neither'), key = neither.locator('.lp-choice-key');
  const shown = () => key.locator('svg').evaluateAll(icons => icons.map(icon => getComputedStyle(icon).display !== 'none'));
  expect(await shown()).toEqual([false, false]);
  await neither.click();
  expect(await shown()).toEqual([true, false]);
  await expect(key).toHaveCSS('background-color', 'rgb(44, 85, 201)');
  // Wrong on question 1: the x on the error colour.
  await page.locator('[data-lp-check]').click();
  expect(await shown()).toEqual([false, true]);
  await expect(key).toHaveCSS('background-color', 'rgb(180, 35, 24)');
  // Right on question 2: the check on the success colour.
  await page.locator('[data-lp-next]').click();
  expect(await shown()).toEqual([false, false]);
  await decide(page, 'neither', { next: false });
  expect(await shown()).toEqual([true, false]);
  await expect(key).toHaveCSS('background-color', 'rgb(18, 112, 79)');
});

test('the French Neither label wraps in balanced lines on a narrow card', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 }); await open(page, '/which-is-better/fr.html');
  // A 300px row, as in a host page with wider card padding, makes the label wrap.
  await pick(page, 'neither').evaluate(row => row.style.setProperty('inline-size', '300px', 'important'));
  const widths = await pick(page, 'neither').locator('span:not(.lp-choice-key)').evaluate(label => {
    const range = label.ownerDocument.createRange(); range.selectNodeContents(label);
    const lines = new Map();
    for (const rect of range.getClientRects()) if (rect.width > 0) lines.set(Math.round(rect.top), (lines.get(Math.round(rect.top)) ?? 0) + rect.width);
    return [...lines.values()];
  });
  // Unbalanced, the label left "fait" alone on its second line.
  expect(widths.length).toBe(2);
  expect(Math.min(...widths) / Math.max(...widths)).toBeGreaterThan(0.4);
});

for (const [lang, content, labels] of [
  ['en', english, { hint: 'Highlight one sentence in either version, or choose "Neither version does this".', progress: 'Question 1 of 3, ', check: 'Check my answer', next: 'Next question', finish: 'Show the summary', summary: 'What makes Version B better', result: 'You answered 3 of 3 questions correctly.', answerIn: 'Correct answer, in Version B: ', neither: 'Neither version does this', subject: 'Subject: ', missing: 'Missing from both versions', restart: 'Start over', cleared: 'Answers cleared.' }],
  ['fr', french, { hint: 'Surlignez une phrase dans l’une ou l’autre version, ou choisissez « Aucune des deux versions ne le fait ».', progress: 'Question 1 sur 3, ', check: 'Vérifier ma réponse', next: 'Question suivante', finish: 'Afficher le résumé', summary: 'Ce qui rend la version B meilleure', result: 'Bonnes réponses : 3 sur 3.', answerIn: 'Bonne réponse, dans la version B : ', neither: 'Aucune des deux versions ne le fait', subject: 'Objet : ', missing: 'Absent des deux versions', restart: 'Recommencer', cleared: 'Réponses effacées.' }]
]) {
  const typeset = value => lang === 'fr' ? value.replace(/ (?=[:$»])/g, ' ').replace(/ (?=[?!;])/g, ' ').replace(/« /g, '« ') : value;

  test(`card order, names and an all-correct run (${lang})`, async ({ page }) => {
    await open(page, `/which-is-better/${lang}.html`); await observe(page);
    const root = page.locator('[data-lp-pattern]');
    await expect(root).toHaveAttribute('lang', lang);
    await expect(root.locator('> h2.lp-heading')).toHaveText(content.title);
    await expect(root.locator('> .lp-context')).toHaveText(typeset(content.context));
    await expect(root.locator('[data-lp-step] h3')).toHaveText(['Version A', 'Version B']);
    await expect(root.locator('[data-lp-step] .lp-which-is-better-subject')).toHaveText(['a', 'b'].map(version => labels.subject + typeset(content.versions[version].subject)));
    await expect(pick(root, 'b2')).toHaveAccessibleName(typeset(sentences(content, 'b')[1]));
    await expect(pick(root, 'neither')).toHaveAccessibleName(labels.neither);
    await expect(root.locator('[data-lp-choices]')).toHaveAccessibleName(groupName(labels.progress.slice(0, -2), typeset(content.qualities[0].question)));
    await expect(root.locator('.lp-which-is-better-hint')).toHaveText(typeset(labels.hint));
    await expect(root.locator('[data-lp-check]')).toHaveText(labels.check);
    for (const [i, quality] of content.qualities.entries()) {
      await expect(root.locator('[data-lp-question-text]')).toHaveText(typeset(quality.question));
      await decide(root, quality.sentence === null ? 'neither' : `b${quality.sentence}`, { next: false });
      await expect(root.locator('[data-lp-feedback]')).toHaveText(`Correct. ${typeset(quality.reason)}`);
      // A correct Neither row already shows "Correct" just above, so its verdict is for screen readers only.
      const hidden = await root.locator('.lp-which-is-better-verdict').evaluate(el => el.classList.contains('lp-visually-hidden'));
      expect(hidden, `question ${i + 1}`).toBe(quality.sentence === null);
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

  test(`no JavaScript shows both emails and each answer behind a disclosure (${lang})`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage(); await page.goto(`/which-is-better/${lang}.html`);
    await expect(page.locator('[data-lp-step], [data-lp-summary]')).toHaveCount(2);
    await expect(page.locator('[data-lp-step]')).toBeHidden(); await expect(page.locator('[data-lp-summary]')).toBeHidden();
    await expect(page.locator('button:visible, [role="button"]:visible')).toHaveCount(0);
    const fallback = page.locator('[data-lp-fallback]');
    await expect(fallback.locator('h3')).toHaveText(['Version A', 'Version B']);
    const body = fallback.locator('.lp-which-is-better-body').last().locator('p');
    await expect(body).toHaveText([content.versions.b.greeting, ...content.versions.b.body.map(paragraph => paragraph.join(' ')), content.versions.b.signoff].map(typeset));
    await expect(fallback.locator('details')).toHaveCount(3);
    await expect(fallback.locator('details[open]')).toHaveCount(0);
    await expect(fallback.getByText(typeset(content.qualities[0].reason))).toBeHidden();
    for (const summary of await fallback.locator('summary').all()) await summary.click();
    await expect(fallback.locator('details').nth(0)).toContainText(typeset(labels.answerIn + sentences(content, 'b')[1]));
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
      if (stage === 'chosen') await pick(page, 'a2').click();
      if (stage === 'checked') await page.locator('[data-lp-check]').click();
      if (stage === 'neither') { await page.locator('[data-lp-next]').click(); await decide(page, 'b2', { next: false }); }
      if (stage === 'summary') { await page.locator('[data-lp-next]').click(); await decide(page, 'b1'); }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), stage).toBe(true);
      const problems = await page.evaluate(() => {
        const card = document.querySelector('[data-lp-pattern]').getBoundingClientRect();
        return [...document.querySelectorAll('[data-lp-pattern] :is(p, button, li, h2, h3, mark, .lp-which-is-better-chunk, .lp-choice-mark, .lp-which-is-better-note)')]
          .filter(el => el.getClientRects().length && !el.matches('[role="status"]') && !el.closest('.lp-visually-hidden'))
          .filter(el => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline' || el.getBoundingClientRect().right > card.right + 1 || el.getBoundingClientRect().left < card.left - 1)
          .map(el => el.textContent);
      });
      expect(problems, stage).toEqual([]);
    }
  });
}

test('the emails sit side by side on a wide card and stack on a phone, and each note sits under its sentence', async ({ page }) => {
  for (const [width, side] of [[1280, true], [640, false], [390, false]]) {
    await page.setViewportSize({ width, height: 900 }); await open(page);
    const [a, b] = await Promise.all(['a', 'b'].map(version => page.locator(`[data-lp-step] [aria-labelledby$="-${version}"] .lp-which-is-better-body`).boundingBox()));
    expect(Math.abs(a.y - b.y) < 1, `${width}px side by side`).toBe(side);
    // Side by side, the two bodies start and end level, whatever their length.
    if (side) expect(Math.abs(a.height - b.height)).toBeLessThan(1);
    else expect(b.y).toBeGreaterThan(a.y + a.height);
    await decide(page, 'b2'); await decide(page, 'neither'); await decide(page, 'b1');
    // The score comes before the heading that introduces the email.
    const [score, heading] = await Promise.all([page.locator('[data-lp-result]').boundingBox(), page.locator('[data-lp-summary] h3').boundingBox()]);
    expect(heading.y).toBeGreaterThan(score.y + score.height - 0.5);
    for (let i = 0; i < 2; i++) {
      const [sentence, note] = await Promise.all([page.locator('[data-lp-summary] mark').nth(i).boundingBox(), page.locator('.lp-which-is-better-note').nth(i).boundingBox()]);
      // Half a pixel of slack: Firefox rounds the two boxes' edges differently when they touch.
      expect(note.y).toBeGreaterThanOrEqual(sentence.y + sentence.height - 0.5);
    }
  }
});

for (const path of ['/which-is-better/en.html', '/which-is-better/fr.html', '/which-is-better/two.html']) {
  test(`axe at load, error, choice, each check, the summary and reset: ${path}`, async ({ page }) => {
    await open(page, path); await scan(page);
    const roots = await page.locator('[data-lp-pattern]').all();
    for (const root of roots) await root.locator('[data-lp-check]').click();
    await scan(page);
    for (const root of roots) await pick(root, 'a2').click();
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
  // Stray activations of locked choices and the hidden Check change nothing.
  await pick(page, 'b1').evaluate(chunk => chunk.click());
  await pick(page, 'b1').focus(); await page.keyboard.press('Space'); await page.keyboard.press('Enter');
  await pick(page, 'neither').evaluate(button => { button.disabled = false; button.click(); button.disabled = true; });
  await page.locator('[data-lp-check]').evaluate(button => { button.hidden = false; button.click(); });
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ at: 0, picks: ['a2'] });
  await expect(pick(page, 'a2')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('.lp-choice-mark')).toHaveCount(2);
});

for (const [seed, question, checked, after] of [[{ at: 1, picks: ['b2'] }, 2, false, { at: 1, picks: ['b2', 'b1'] }], [{ at: 1, picks: ['b2', 'a1'] }, 2, true, { at: 2, picks: ['b2', 'a1', 'b1'] }]]) {
  test(`saved answers restore silently on the open question: ${JSON.stringify(seed)}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, seed);
    await open(page);
    await expect(page.locator('[data-lp-progress]')).toHaveText(`Question ${question} of 3`);
    await expect(page.locator('[data-lp-feedback]')).toBeVisible({ visible: checked });
    await expect(page.locator('[data-lp-mark]')).toHaveCount(checked ? 2 : 0);
    await expect(page.locator('.lp-which-is-better-chunk[aria-disabled="true"]')).toHaveCount(checked ? 4 : 0);
    await expect(page.locator('button[data-lp-pick]:disabled')).toHaveCount(checked ? 1 : 0);
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

for (const seed of [{ at: 1, picks: [] }, { at: 0, picks: ['z9'] }, { at: 0, picks: ['b4'] }, { at: 4, picks: ['b2', 'b2', 'b2'] }, { at: 0, picks: [], shown: true }, 'not an object']) {
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

// At 1280 the emails sit side by side: each column must wrap a long word rather than widen past the card.
for (const width of [320, 1280]) test(`worst-case authored text wraps inside the card at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const token = 'Q3-Client-Report_Northwind_Industries_Holdings_FINAL_v12_approved-by-legal.xlsx';
  const content = structuredClone(english);
  content.title = `Compare ${token}`;
  content.versions.a.subject = `Re: ${token}`;
  content.versions.a.body.push([`${token} ${'More words in a long sentence. '.repeat(6)}`.slice(0, 300)]);
  content.versions.b.body[0].push(`Send ${token} to Jo.`);
  content.versions.b.signoff = `Thanks,\n${token}`;
  content.qualities[0].note = `Who to call about ${token}`;
  await mount(page, content, { state: { at: 0, picks: ['a3'] } });
  const overflow = async () => page.evaluate(() => {
    const card = document.querySelector('[data-lp-pattern]').getBoundingClientRect();
    return document.documentElement.scrollWidth <= innerWidth && Math.max(...[...document.querySelectorAll('[data-lp-pattern] *')].filter(el => el.getClientRects().length && !el.closest('.lp-visually-hidden')).map(el => el.getBoundingClientRect().right - card.right)) <= 0;
  });
  expect(await overflow(), 'question').toBe(true);
  await page.locator('[data-lp-next]').click(); await decide(page, 'neither'); await decide(page, 'b1');
  expect(await overflow(), 'summary').toBe(true);
});

test('the English title does not break inside "out-of-office" on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await open(page);
  const lines = await page.locator('[data-lp-pattern] > h2').evaluate(heading => {
    const node = heading.firstChild, text = node.textContent, range = heading.ownerDocument.createRange();
    range.setStart(node, text.indexOf('out')); range.setEnd(node, text.indexOf('office') + 6);
    return new Set([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => Math.round(rect.top))).size;
  });
  expect(lines).toBe(1);
});

test('two instances have unique ids and independent answers', async ({ page }) => {
  await open(page, '/which-is-better/two.html');
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  await pick(roots.first(), 'b2').click();
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
  await expect(page.locator('[data-lp-mark], [aria-pressed="true"], [aria-disabled="true"], button:disabled, .lp-choice-mark')).toHaveCount(0);
  await expect(page.locator('[data-lp-progress]')).toHaveText('Question 1 of 3');
  // Destroyed sentences ignore keys.
  await pick(page, 'a1').evaluate(chunk => chunk.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0);
  const again = await page.evaluate(() => window.lpEnhance() !== window.lpInstances[0]);
  expect(again).toBe(true);
  await expect(page.locator('[data-lp-step]')).toBeVisible();
  await expect(page.locator('[data-lp-fallback]')).toBeHidden();
});

test('forced colours keep the choice, the highlight, the marks and focus distinct', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page);
  const ring = locator => locator.evaluate(el => { const css = getComputedStyle(el); return [css.outlineWidth, css.outlineStyle]; });
  await page.keyboard.press('Tab'); await expect(pick(page, 'a1')).toBeFocused();
  expect(await ring(pick(page, 'a1'))).toEqual(['3px', 'solid']);
  await pick(page, 'a2').click();
  const chosen = await pick(page, 'a2').evaluate(el => { const css = getComputedStyle(el); return [css.backgroundColor, css.forcedColorAdjust, css.textDecorationLine]; });
  expect(chosen[1]).toBe('none'); expect(chosen[0]).not.toBe(CLEAR); expect(chosen[2]).toBe('underline');
  await page.locator('[data-lp-check]').click();
  // The wrong pick keeps the mark colours; the missed answer has a dashed underline and no fill.
  // Forced colours report transparent with the canvas RGB, so the alpha is what says "no fill".
  await expect(pick(page, 'a2')).not.toHaveCSS('background-color', TRANSPARENT);
  await expect(pick(page, 'b2')).toHaveCSS('text-decoration-style', 'dashed');
  await expect(pick(page, 'b2')).toHaveCSS('background-color', TRANSPARENT);
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-next]')).toBeFocused();
  expect(await ring(page.locator('[data-lp-next]'))).toEqual(['3px', 'solid']);
});

test('on a phone, an empty check shows the error just above Check, and each Next brings the question into view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await open(page, '/which-is-better/fr.html');
  await page.locator('[data-lp-check]').click();
  for (const locator of [page.locator('[data-lp-error]'), page.locator('[data-lp-check]')]) await expect(locator).toBeInViewport({ ratio: .95 });
  // The error sits between the Neither row and Check, and the page stays by the button.
  const [neither, error, check] = await Promise.all(['[data-lp-pick="neither"]', '[data-lp-error]', '[data-lp-check]'].map(selector => page.locator(selector).boundingBox()));
  expect(error.y).toBeGreaterThan(neither.y + neither.height); expect(check.y).toBeGreaterThan(error.y + error.height);
  await expect(pick(page, 'a1')).toBeFocused();
  await expect(pick(page, 'a1')).toHaveAccessibleDescription('Choisissez une réponse');
  for (const value of ['b2', 'neither']) {
    await decide(page, value, { next: false });
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

test('choices ring for keyboard focus only, so a tapped sentence does not look chosen twice', async ({ page, browserName }) => {
  await open(page);
  await page.keyboard.press('Tab'); await expect(pick(page, 'a1')).toBeFocused();
  await expect(pick(page, 'a1')).toHaveCSS('outline-style', 'solid'); await expect(pick(page, 'a1')).toHaveCSS('outline-width', '3px');
  await open(page);
  await pick(page, 'a2').click();
  await expect(pick(page, 'a2')).toHaveCSS('outline-style', 'none');
  await pick(page, 'neither').click();
  await expect(pick(page, 'neither')).toHaveCSS('outline-style', 'none');
  await pick(page, 'neither').click();
  // WebKit decides focus-visible for script focus by its own rules, so the empty check is asserted elsewhere.
  if (browserName === 'webkit') return;
  await page.locator('[data-lp-check]').click();
  await expect(pick(page, 'a1')).toBeFocused();
  await expect(pick(page, 'a1')).toHaveCSS('outline-style', 'none');
});

for (const [lang, width] of [['en', 320], ['en', 1280], ['fr', 320], ['fr', 390], ['fr', 1280]]) {
  test(`the phone number stays on one line at ${width}px (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await open(page, `/which-is-better/${lang}.html`);
    const lines = target => target.evaluate(el => {
      const node = el.firstChild, text = node.textContent, range = el.ownerDocument.createRange();
      range.setStart(node, text.indexOf('514')); range.setEnd(node, text.indexOf('0142') + 4);
      return new Set([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => Math.round(rect.top))).size;
    });
    // In its email while choosing, then highlighted in the summary.
    expect(await lines(pick(page, 'b2'))).toBe(1);
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
    const attempt = (selector, data = content, all = false) => {
      host.innerHTML = render(content, strings.en, { id: 'planted', lang: 'en' });
      if (selector) (all ? [...host.querySelectorAll(selector)] : [host.querySelector(selector)]).forEach(element => element.remove());
      try { enhance(host.firstElementChild, { content: data, strings: strings.en }); return 'enhanced'; } catch (error) { return error.message; }
    };
    const selectors = ['[data-lp-fallback]', '[data-lp-step]', '[data-lp-choices]', '[data-lp-question]', '[data-lp-progress]', '[data-lp-question-text]', '[data-lp-error]', '[data-lp-feedback]', '[data-lp-verdict]', '[data-lp-reason]', '[data-lp-check]', '[data-lp-next]', '[data-lp-summary]', '[data-lp-result]', '[data-lp-restart]', '[role="status"]'];
    return {
      selectors, missing: selectors.map(selector => attempt(selector)),
      neither: attempt('[data-lp-pick="neither"]'), sentences: attempt('.lp-which-is-better-chunk', content, true),
      invalid: attempt(null, { ...content, qualities: [] })
    };
  }, english);
  expect(messages.missing).toEqual(messages.selectors.map(selector => `Missing which-is-better markup: ${selector}`));
  expect([messages.neither, messages.sentences]).toEqual(['Missing which-is-better markup: [data-lp-pick]', 'Missing which-is-better markup: [data-lp-pick]']);
  expect(messages.invalid).toMatch(/qualities/);
});

for (const width of [390, 640]) test(`in the summary at ${width}px each highlight is no wider than its text`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await open(page, '/which-is-better/fr.html');
  await decide(page, 'b2'); await decide(page, 'neither'); await decide(page, 'b1');
  const lines = await page.locator('[data-lp-summary] mark').evaluateAll(marks => marks.map(mark => {
    const range = mark.ownerDocument.createRange(); range.selectNodeContents(mark);
    const text = [...range.getClientRects()].filter(rect => rect.width > 0);
    return [...mark.getClientRects()].filter(rect => rect.width > 0).map((rect, i) => rect.width - text[i].width);
  }));
  expect(lines.length).toBe(2);
  expect(lines.flat().length).toBeGreaterThanOrEqual(2);
  // No side padding, as in Highlight the key passage; a pixel of slack for rounding.
  for (const extra of lines.flat()) expect(extra).toBeLessThanOrEqual(1);
});
