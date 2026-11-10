import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { expectChoiceMarks } from './choice-marks.js';
import { frenchTypography } from '../../lib/html.js';
import { strings } from '../../patterns/answer-with-confidence/strings.js';

const NAME = 'answer-with-confidence';
const english = JSON.parse(await readFile(new URL(`../../patterns/${NAME}/examples/en.json`, import.meta.url)));
const french = JSON.parse(await readFile(new URL(`../../patterns/${NAME}/examples/fr.json`, import.meta.url)));
const TEXT_SPACING = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';

async function open(page, path = `/${NAME}/en.html`) {
  await page.goto(path);
  await page.waitForFunction(() => window.lpReady);
}
// Replace the demo with this content through the public render/enhance interface.
async function mount(page, content, { lang = 'en', seed } = {}) {
  await open(page, `/${NAME}/${lang}.html`);
  await page.evaluate(async ({ content, lang, seed }) => {
    const { render } = await import('/patterns/answer-with-confidence/render.js');
    const { enhance } = await import('/patterns/answer-with-confidence/enhance.js');
    const { strings } = await import('/patterns/answer-with-confidence/strings.js');
    window.lpInstances[0].destroy();
    window.lpSaved = undefined;
    document.querySelector('main').innerHTML = render(content, strings[lang], { id: 'mounted', lang });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings[lang], state: { read: () => seed, write: value => { window.lpSaved = value; } } });
  }, { content, lang, seed });
}
async function observe(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    new MutationObserver(records => {
      for (const record of records) window.lpAnnouncements.push(record.target.textContent);
    }).observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}
const announced = page => page.evaluate(() => window.lpAnnouncements.filter(Boolean));
const scan = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
const question = (root, n) => root.locator('[data-lp-question]').nth(n);
/** Answer question n. `how` is sure, unsure or dont-know; no option submits with nothing chosen. */
async function answer(root, n, option, how) {
  const q = question(root, n);
  if (option) await q.locator(`input[value="${option}"]`).check();
  await q.locator(how === 'dont-know' ? '[data-lp-dont-know]' : `[data-lp-certainty="${how}"]`).click();
}
// Sure and wrong, unsure and right, sure and right.
async function finish(root) {
  await answer(root, 0, 'sender', 'sure');
  await answer(root, 1, 'lower', 'unsure');
  await answer(root, 2, 'still-there', 'sure');
}
const boxes = (page, selector) => page.locator(selector).evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return [r.top + scrollY, r.height]; }));
const near = (actual, expected, label) => actual.forEach((value, i) => expect(Math.abs(value - expected[i]), `${label}: ${value} vs ${expected[i]}`).toBeLessThan(0.5));

for (const [lang, content] of [['en', english], ['fr', french]]) {
  const s = strings[lang], t = value => frenchTypography(value, lang);

  test(`keyboard journey: one submit control, feedback in its place, summary and Start over (${lang})`, async ({ page }) => {
    await open(page, `/${NAME}/${lang}.html`); await observe(page);
    const first = question(page, 0), second = question(page, 1), third = question(page, 2);
    await expect(page.locator('.lp-scene-title')).toHaveText(t(content.title));
    await expect(page.locator('[data-lp-intro]')).toHaveText(t(s.intro));
    await expect(page.locator('[data-lp-fallback]')).toBeHidden();
    await expect(page.locator('.lp-answer-with-confidence-question-number')).toHaveText([1, 2, 3].map(n => t(s.questionNumber.replace('{number}', n).replace('{total}', 3))));
    // The option list is the question's own; the submit control is one named group of two buttons.
    await expect(first.getByRole('radio')).toHaveCount(3);
    const group = first.getByRole('group', { name: s.submitGroupTo.replace('{number}', 1), exact: true });
    await expect(group.getByRole('button')).toHaveText([s.sure, s.unsure]);
    await expect(group.locator('.lp-answer-with-confidence-submit-label')).toHaveText(t(s.submit));
    for (const button of await group.getByRole('button').all()) await expect(button).not.toHaveAttribute('aria-pressed');

    // Question 1: sure and wrong.
    await first.locator('input').first().focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab'); await expect(group.getByRole('button').nth(0)).toBeFocused();
    await page.keyboard.press('Tab'); await expect(group.getByRole('button').nth(1)).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    const box = first.locator('[data-lp-feedback="sender"]');
    await expect(box).toBeFocused();
    await expect(first.locator('[data-lp-feedback]:visible')).toHaveCount(1);
    await expect(box.locator('[data-lp-verdict]:visible')).toHaveText([t(s.verdictSureWrong)]);
    await expect(box).toContainText(t(s.correctAnswer.replace('{option}', content.questions[0].options[1].text)));
    await expect(box).toContainText(t(content.questions[0].options[0].feedback));
    await expect(box.locator('[data-lp-right-when]')).toBeVisible();
    await expect(box.locator('[data-lp-right-when]')).toHaveText(t(`${s.rightWhen} ${content.questions[0].options[0].rightWhen}`));
    await expect(box.locator('svg[aria-hidden="true"]')).toHaveCount(1);
    await expect(group).toBeHidden();
    await expect(first.locator('input:disabled')).toHaveCount(3);
    await expect(first.locator('label').nth(0)).toHaveAttribute('data-lp-mark', 'wrong');
    await expect(first.locator('label').nth(1)).toHaveAttribute('data-lp-mark', 'missed');
    await expect(first.getByRole('radio').nth(0)).toHaveAccessibleName(new RegExp(`^${t(content.questions[0].options[0].text)}\\s*${s.markWrong}$`));
    await expectChoiceMarks(page);
    // Focus on the feedback reads it once; the status region stays silent, and so does the summary.
    expect(await announced(page)).toEqual([]);
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    expect(await page.evaluate(() => window.lpSaved)).toEqual({ answers: { 'reply-all': 'sender' } });

    // Question 2: unsure and right. Tab from the feedback lands on the next question's options.
    await page.keyboard.press('Tab'); await expect(second.locator('input').first()).toBeFocused();
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
    await expect(second.locator('input[value="lower"]')).toBeChecked();
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    await expect(second.locator('[data-lp-certainty="unsure"]')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(second.locator('[data-lp-feedback="lower"]')).toBeFocused();
    await expect(second.locator('[data-lp-verdict]:visible')).toHaveText([t(s.verdictUnsureRight)]);
    await expect(second.locator('[data-lp-mark]')).toHaveCount(1);
    await expect(second.locator('[data-lp-feedback="lower"] .lp-visually-hidden')).toHaveCount(0);

    // Question 3: unsure and wrong shows the feedback without "Why it can seem right".
    await answer(page, 2, 'covered', 'unsure');
    const last = third.locator('[data-lp-feedback="covered"]');
    await expect(last).toBeFocused();
    await expect(last.locator('[data-lp-verdict]:visible')).toHaveText([t(s.verdictUnsureWrong)]);
    await expect(last.locator('[data-lp-right-when]')).toBeHidden();

    // The summary: one sentence, then only the questions where certainty and result disagreed.
    const result = page.locator('[data-lp-result]');
    const sentence = t(s.summaryOne.replace('{right}', 1).replace('{total}', 3));
    await expect(result.locator('[data-lp-summary]')).toHaveText(sentence);
    const lists = result.locator('[data-lp-review]:visible');
    await expect(lists.locator('h3')).toHaveText([t(s.verdictSureWrong), t(s.verdictUnsureRight)]);
    await expect(lists.locator('[data-lp-review-hint]')).toHaveText([t(s.sureWrongOne), t(s.unsureRightOne)]);
    await expect(lists.getByRole('button')).toHaveText([t(content.questions[0].text), t(content.questions[1].text)]);
    expect(await announced(page)).toEqual([`${sentence} ${t(s.listCount.replace('{heading}', s.verdictSureWrong).replace('{count}', 1))} ${t(s.listCount.replace('{heading}', s.verdictUnsureRight).replace('{count}', 1))}`]);
    // Certainty is never written through the state adapter.
    expect(await page.evaluate(() => window.lpSaved)).toEqual({ answers: { 'reply-all': 'sender', percent: 'lower', redact: 'covered' } });
    await expect(page.locator('input:disabled')).toHaveCount(9);

    await lists.getByRole('button').nth(1).focus(); await page.keyboard.press('Enter');
    await expect(second.locator('fieldset')).toBeFocused();
    await result.locator('[data-lp-restart]').focus(); await page.keyboard.press('Enter');
    await expect(first.locator('input').first()).toBeFocused();
    await expect(page.locator('input:disabled, input:checked, [data-lp-mark], .lp-choice > .lp-choice-mark, [data-lp-feedback]:visible, [data-lp-review] ul')).toHaveCount(0);
    await expect(page.locator('[data-lp-submit]:visible')).toHaveCount(3);
    await expect(result).toBeHidden();
    expect(await page.evaluate(() => window.lpSaved)).toEqual({ answers: {} });
    expect(await announced(page)).toEqual([expect.any(String), t(s.cleared)]);
  });

  test(`submitting with nothing chosen links one message and focuses the first option (${lang})`, async ({ page }) => {
    await open(page, `/${NAME}/${lang}.html`); await observe(page);
    const second = question(page, 1), message = second.locator('[data-lp-question-error]');
    await expect(message).toBeHidden();
    await answer(page, 1, null, 'sure');
    await expect(message).toHaveText(t(s.choose));
    await expect(message.locator('svg[aria-hidden="true"]')).toHaveCount(1);
    await expect(second.locator('fieldset')).toHaveAttribute('aria-describedby', await message.getAttribute('id'));
    await expect(second.locator('input[aria-invalid="true"]')).toHaveCount(3);
    await expect(second.locator('input').first()).toBeFocused();
    await expect(second.locator('[data-lp-feedback]:visible, [data-lp-mark]')).toHaveCount(0);
    await expect(page.locator('[data-lp-question-error]:visible')).toHaveCount(1);
    expect(await announced(page)).toEqual([]);
    expect(await page.evaluate(() => window.lpSaved)).toBeUndefined();
    await second.locator('input').nth(1).check();
    await expect(message).toBeHidden();
    await expect(second.locator('fieldset')).not.toHaveAttribute('aria-describedby');
    await expect(second.locator('input[aria-invalid]')).toHaveCount(0);
  });

  test(`"Don't know" is a third segment that needs no option and shows the correct answer (${lang})`, async ({ page }) => {
    await mount(page, { ...content, dontKnow: true }, { lang }); await observe(page);
    const first = question(page, 0);
    await expect(first.getByRole('radio')).toHaveCount(3);
    await expect(first.getByRole('group').getByRole('button')).toHaveText([s.sure, s.unsure, s.dontKnow]);
    await answer(page, 0, null, 'unsure');
    await expect(first.locator('[data-lp-question-error]')).toHaveText(t(s.chooseOrDontKnow));
    // A chosen option is dropped: "Don't know" is a way to submit, not an answer.
    await answer(page, 0, 'sender', 'dont-know');
    const box = first.locator('[data-lp-feedback="dont-know"]');
    await expect(box).toBeFocused();
    await expect(first.locator('[data-lp-feedback]:visible')).toHaveCount(1);
    await expect(box.locator('[data-lp-verdict]:visible')).toHaveText([t(s.verdictDontKnow)]);
    await expect(box).toContainText(t(content.questions[0].options[1].feedback));
    await expect(first.locator('input:checked')).toHaveCount(0);
    await expect(first.locator('[data-lp-mark]')).toHaveCount(1);
    await expect(first.locator('label').nth(1)).toHaveAttribute('data-lp-mark', 'missed');
    await expect(first.locator('[data-lp-question-error]')).toBeHidden();
    expect(await page.evaluate(() => window.lpSaved)).toEqual({ answers: { 'reply-all': 'dont-know' } });
    await answer(page, 1, 'lower', 'sure'); await answer(page, 2, 'still-there', 'sure');
    // Sure and right twice: nothing to list.
    await expect(page.locator('[data-lp-summary]')).toHaveText(t(s.summaryMany.replace('{right}', 2).replace('{total}', 3)));
    await expect(page.locator('[data-lp-review]:visible')).toHaveCount(0);
    expect(await announced(page)).toEqual([t(s.summaryMany.replace('{right}', 2).replace('{total}', 3))]);
    await scan(page);
  });

  test(`no JavaScript provides native radios and each correct option with its feedback (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage(); await page.goto(`/${NAME}/${lang}.html`);
    await expect(page.getByRole('radio')).toHaveCount(9);
    await page.getByRole('radio').first().check(); await expect(page.getByRole('radio').first()).toBeChecked();
    await expect(page.locator('[data-lp-stage], [data-lp-intro], [data-lp-result]').first()).toBeHidden();
    await expect(page.locator('[data-lp-submit]:visible, [data-lp-feedback]:visible')).toHaveCount(0);
    await page.locator('summary').click(); await expect(page.locator('details')).toHaveAttribute('open', '');
    for (const q of content.questions) {
      const correct = q.options.find(o => o.id === q.correct);
      await expect(page.locator('details')).toContainText(t(s.correctAnswer.replace('{option}', correct.text)));
      await expect(page.locator('details')).toContainText(t(correct.feedback));
    }
    await context.close();
  });

  test(`axe on unchanged server HTML with native answers open (${lang})`, async ({ page }) => {
    // axe needs scripting enabled. Block enhancement to audit the same native baseline.
    await page.route(`**/${NAME}/enhance.js`, route => route.fulfill({ contentType: 'text/javascript', body: 'export function enhance() { return { destroy() {} }; }' }));
    await open(page, `/${NAME}/${lang}.html`);
    await scan(page); await page.locator('summary').click(); await scan(page);
  });

  test(`320 CSS pixels with text spacing has no scroll, clipping or overlap (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await mount(page, { ...content, dontKnow: true }, { lang });
    await page.addStyleTag({ content: TEXT_SPACING });
    for (const stage of ['initial', 'error', 'result']) {
      if (stage === 'error') await answer(page, 0, null, 'sure');
      if (stage === 'result') await finish(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const problems = await page.evaluate(() => [...document.querySelectorAll('p, label, legend, button, li, h2, h3')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility === 'visible' && !el.matches('[role="status"], .lp-visually-hidden')).flatMap(el => {
        const failures = [];
        if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) failures.push(el.textContent);
        const children = [...el.children].filter(child => child.getClientRects().length && getComputedStyle(child).visibility === 'visible' && !child.matches('.lp-visually-hidden'));
        for (let i = 1; i < children.length; i++) {
          const a = children[i - 1].getBoundingClientRect(), b = children[i].getBoundingClientRect();
          if (Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1) failures.push('overlap: ' + el.textContent);
        }
        return failures;
      }));
      expect(problems, stage).toEqual([]);
    }
  });

  for (const width of [1280, 390, 320]) for (const spacing of width === 320 ? [false, true] : [false]) {
    test(`feedback appears in one stable box: no layout shift at ${width}px${spacing ? ' with text spacing' : ''} (${lang})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mount(page, { ...content, dontKnow: true }, { lang });
      if (spacing) await page.addStyleTag({ content: TEXT_SPACING });
      await page.evaluate(() => document.fonts.ready);
      // Every answer and certainty, including an error first, leaves each box where and as tall as it was.
      const cases = [['sender', 'sure'], ['sender', 'unsure'], ['to-cc', 'sure'], ['to-cc', 'unsure'], ['all-bcc', 'sure'], [null, 'dont-know']];
      for (const [option, how] of cases) {
        const before = await boxes(page, '[data-lp-stage]');
        const rowHeights = async () => (await boxes(page, '[data-lp-question] .lp-choice')).slice(0, 3).reduce((sum, [, height]) => sum + height, 0);
        const rowsBefore = await rowHeights();
        await answer(page, 0, option, how);
        await expect(question(page, 0).locator('[data-lp-feedback]:visible')).toHaveCount(1);
        const after = await boxes(page, '[data-lp-stage]');
        // The box keeps its height at every width.
        near(after.map(([, height]) => height), before.map(([, height]) => height), `${option} ${how} height`);
        // Each option keeps room for its mark, beside the text or under it in a narrow card, so no row
        // grows and nothing on the page moves at any width.
        expect(Math.abs(await rowHeights() - rowsBefore), `${option} ${how} rows`).toBeLessThan(0.5);
        near(after.map(([top]) => top), before.map(([top]) => top), `${option} ${how} top`);
        // Fresh question for the next case.
        await answer(page, 1, 'lower', 'sure'); await answer(page, 2, 'still-there', 'sure');
        await page.locator('[data-lp-restart]').click();
      }
      // An empty submit shows its message in the same space. In a wide card it fits; in a narrow one the
      // stacked buttons already fill the space, so the message may add lines. It is not feedback.
      const before = await boxes(page, '[data-lp-stage]');
      await answer(page, 0, null, 'sure');
      await expect(question(page, 0).locator('[data-lp-question-error]')).toBeVisible();
      if (width >= 1280) near((await boxes(page, '[data-lp-stage]')).flat(), before.flat(), 'error');
    });
  }
}

for (const path of [`/${NAME}/en.html`, `/${NAME}/fr.html`, `/${NAME}/two.html`]) {
  test(`axe at load, error, feedback, summary and reset: ${path}`, async ({ page }) => {
    await open(page, path); await scan(page);
    const roots = await page.locator('[data-lp-pattern]').all();
    for (const root of roots) await answer(root, 0, null, 'sure');
    await scan(page);
    for (const root of roots) await answer(root, 0, 'sender', 'sure');
    await scan(page);
    for (const root of roots) { await answer(root, 1, 'lower', 'unsure'); await answer(root, 2, 'covered', 'unsure'); }
    await scan(page);
    for (const root of roots) await root.locator('[data-lp-restart]').click();
    await scan(page);
  });
}

test('the submit control is joined segments of equal weight, stacked in a narrow card', async ({ page }) => {
  await open(page);
  const segments = question(page, 0).locator('.lp-answer-with-confidence-segment');
  const look = () => segments.evaluateAll(els => els.map(el => { const css = getComputedStyle(el), r = el.getBoundingClientRect(); return { color: css.color, background: css.backgroundColor, border: css.borderTopColor, weight: css.fontWeight, size: css.fontSize, left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height }; }));
  const wide = await look();
  expect(new Set(wide.map(({ color, background, border, weight, size }) => [color, background, border, weight, size].join())).size).toBe(1);
  expect(wide[0].size).toBe('16px');
  expect(wide[0].height).toBeGreaterThanOrEqual(44);
  // Joined: the second segment overlaps the first one's border by a pixel.
  expect(wide[1].left - wide[0].right).toBeCloseTo(-1, 0);
  expect(wide[1].top).toBeCloseTo(wide[0].top, 0);
  await expect(segments.nth(0)).toHaveCSS('border-top-left-radius', '10px');
  await expect(segments.nth(0)).toHaveCSS('border-top-right-radius', '0px');
  await expect(segments.nth(1)).toHaveCSS('border-bottom-right-radius', '10px');
  await page.setViewportSize({ width: 390, height: 900 });
  const narrow = await look();
  expect(narrow[1].top - narrow[0].bottom).toBeCloseTo(-1, 0);
  expect(narrow[1].left).toBeCloseTo(narrow[0].left, 0);
  expect(narrow[1].right).toBeCloseTo(narrow[0].right, 0);
  // Keyboard focus draws the shared ring above the neighbouring segment.
  await question(page, 0).locator('input').first().focus();
  await page.keyboard.press('Tab');
  await expect(segments.nth(0)).toHaveCSS('outline-width', '3px');
  await expect(segments.nth(0)).toHaveCSS('z-index', '1');
});

test('every result has its own verdict, and feedback text is the chosen option\'s only', async ({ page }) => {
  await open(page);
  const s = strings.en, first = question(page, 0);
  for (const [option, how, verdict, tone] of [['sender', 'sure', s.verdictSureWrong, 'lp-missed'], ['sender', 'unsure', s.verdictUnsureWrong, 'lp-missed'], ['to-cc', 'sure', s.verdictSureRight, 'lp-met'], ['to-cc', 'unsure', s.verdictUnsureRight, 'lp-met']]) {
    await answer(page, 0, option, how);
    const box = first.locator('[data-lp-feedback]:visible');
    await expect(box).toHaveCount(1);
    await expect(box.locator('[data-lp-verdict]:visible')).toHaveText([verdict]);
    await expect(box.locator('.lp-answer-with-confidence-verdict')).toHaveClass(new RegExp(tone));
    const visible = await box.evaluate(el => [...el.querySelectorAll('p')].filter(p => getComputedStyle(p).visibility === 'visible' && !p.matches('.lp-visually-hidden, .lp-answer-with-confidence-verdict')).map(p => p.textContent));
    const chosen = english.questions[0].options.find(o => o.id === option);
    expect(visible).toEqual(option === 'sender' && how === 'sure' ? [chosen.feedback, `${s.rightWhen} ${chosen.rightWhen}`] : [chosen.feedback]);
    await answer(page, 1, 'lower', 'sure'); await answer(page, 2, 'still-there', 'sure');
    await page.locator('[data-lp-restart]').click();
  }
  // A sure wrong answer whose option has no authored line shows the feedback alone.
  await answer(page, 1, 'higher', 'sure');
  await expect(question(page, 1).locator('[data-lp-feedback="higher"] [data-lp-right-when]')).toHaveCount(0);
});

test('saved answers restore silently without certainty; the rest of the set still collects it', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { answers: { 'reply-all': 'sender', percent: 'lower' } }; });
  await open(page); await observe(page);
  const s = strings.en, first = question(page, 0);
  await expect(page.locator('body')).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('');
  await expect(first.locator('[data-lp-verdict]:visible')).toHaveText([s.verdictWrong]);
  await expect(first.locator('[data-lp-feedback="sender"] [data-lp-right-when]')).toBeHidden();
  await expect(question(page, 1).locator('[data-lp-verdict]:visible')).toHaveText([s.verdictRight]);
  await expect(page.locator('input:disabled')).toHaveCount(6);
  await expect(page.locator('input:checked')).toHaveCount(2);
  await expect(page.locator('.lp-choice > .lp-choice-mark')).toHaveCount(3);
  await expect(page.locator('[data-lp-submit]:visible')).toHaveCount(1);
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  await answer(page, 2, 'covered', 'sure');
  await expect(page.locator('[data-lp-summary]')).toHaveText('You answered 1 of 3 correctly.');
  // Only the question answered since the page loaded has a certainty to list.
  await expect(page.locator('[data-lp-review]:visible').getByRole('button')).toHaveText([english.questions[2].text]);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ answers: { 'reply-all': 'sender', percent: 'lower', redact: 'covered' } });
});

test('a fully answered saved set restores its summary without lists, focus or speech', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { answers: { 'reply-all': 'sender', percent: 'lower', redact: 'still-there' } }; });
  await open(page);
  await expect(page.locator('[data-lp-summary]')).toHaveText('You answered 2 of 3 correctly.');
  await expect(page.locator('[data-lp-review]:visible')).toHaveCount(0);
  await expect(page.locator('[data-lp-restart]')).toBeVisible();
  await expect(page.locator('body')).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('');
  await expect(page.locator('[data-lp-submit]:visible')).toHaveCount(0);
});

for (const seed of [{ answers: { 'reply-all': 'lower' } }, { answers: { 'reply-all': 'dont-know' } }, { answers: { 'reply-all': 'sender' }, certainties: { 'reply-all': 'sure' } }, { picks: {} }]) {
  test(`invalid saved state is ignored: ${JSON.stringify(seed)}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, seed); await open(page);
    await expect(page.locator('input:checked, input:disabled, [data-lp-mark], [data-lp-feedback]:visible')).toHaveCount(0);
    await expect(page.locator('[data-lp-submit]:visible')).toHaveCount(3);
    await expect(page.getByRole('status')).toHaveText('');
  });
}

test('one question: context, then the question as the card heading, and a one-question summary', async ({ page }) => {
  const { title, ...untitled } = english;
  await mount(page, { ...untitled, questions: english.questions.slice(0, 1) });
  await expect(page.locator('.lp-answer-with-confidence-question-number, .lp-scene')).toHaveCount(0);
  await expect(page.locator('[data-lp-pattern]').getByRole('heading')).toHaveText([english.questions[0].text]);
  const order = await page.locator('[data-lp-pattern]').evaluate(card => ['.lp-context', '[data-lp-intro]', 'legend h2'].map(selector => card.querySelector(selector).getBoundingClientRect().top));
  expect(order).toEqual([...order].sort((a, b) => a - b));
  // The question is the largest text on the card.
  await expect(page.locator('legend h2')).toHaveCSS('font-size', '21px');
  await expect(page.getByRole('group', { name: strings.en.submitGroup, exact: true })).toBeVisible();
  await answer(page, 0, 'to-cc', 'unsure');
  await expect(page.locator('[data-lp-summary]')).toHaveText('You answered 1 of 1 correctly.');
  await expect(page.locator('[data-lp-review]:visible h3')).toHaveText([strings.en.verdictUnsureRight]);
  await scan(page);
});

test('two instances have unique ids and independent answers, errors and summaries', async ({ page }) => {
  await open(page, `/${NAME}/two.html`);
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  const names = await page.locator('input').evaluateAll(els => [...new Set(els.map(el => el.name))]); expect(names).toHaveLength(6);
  const roots = page.locator('[data-lp-pattern]');
  await finish(roots.first());
  await expect(roots.first().locator('[data-lp-result]')).toBeVisible();
  await expect(roots.nth(1).locator('input:checked, input:disabled, [data-lp-feedback]:visible')).toHaveCount(0);
  await expect(roots.nth(1).locator('[data-lp-result]')).toBeHidden();
  await answer(roots.nth(1), 0, null, 'unsure');
  await expect(roots.nth(1).locator('[data-lp-question-error]:visible')).toHaveCount(1);
  await expect(roots.first().locator('[data-lp-question-error]:visible')).toHaveCount(0);
});

test('enhance twice returns one instance; destroy removes listeners and restores the answers disclosure', async ({ page }) => {
  await open(page); expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await finish(page);
  await page.evaluate(() => window.lpInstances[0].destroy());
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await expect(page.locator('[data-lp-stage]:visible, [data-lp-intro]:visible, [data-lp-result]:visible, [data-lp-mark], input:disabled, input:checked')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('');
  const before = await page.evaluate(() => window.lpSaved);
  await page.locator('input').first().check();
  await page.locator('[data-lp-certainty="sure"]').first().evaluate(button => button.click());
  expect(await page.evaluate(() => window.lpSaved)).toEqual(before);
  await expect(page.locator('[data-lp-mark]')).toHaveCount(0);
  // Enhancing again restores what the host saved.
  await page.evaluate(() => { window.lpSeed = window.lpSaved; window.lpEnhance(); });
  await expect(page.locator('[data-lp-fallback]')).toBeHidden();
  await expect(page.locator('[data-lp-summary]')).toHaveText('You answered 2 of 3 correctly.');
  expect(await page.evaluate(() => window.lpEnhance() === window.lpEnhance())).toBe(true);
});

test('question ids that are Object.prototype names submit, save and restore like any other', async ({ page }) => {
  // Built in the page from JSON, so "__proto__" stays an own key.
  const json = JSON.stringify(english).replace('"id":"reply-all"', '"id":"__proto__"').replace('"id":"percent"', '"id":"constructor"').replace('"id":"redact"', '"id":"toString"');
  const start = seed => page.evaluate(async ({ json, seed }) => {
    const { render } = await import('/patterns/answer-with-confidence/render.js');
    const { enhance } = await import('/patterns/answer-with-confidence/enhance.js');
    const { strings } = await import('/patterns/answer-with-confidence/strings.js');
    const content = JSON.parse(json);
    window.lpInstances.forEach(instance => instance.destroy());
    window.lpHostile?.destroy();
    document.querySelector('main').innerHTML = render(content, strings.en, { id: 'hostile', lang: 'en' });
    window.lpHostile = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, state: { read: () => seed ? JSON.parse(seed) : undefined, write: value => { window.lpSavedJson = JSON.stringify(value); } } });
  }, { json, seed });
  await open(page); await start();
  await answer(page, 0, 'sender', 'sure');
  await expect(question(page, 0).locator('[data-lp-verdict]:visible')).toHaveText([strings.en.verdictSureWrong]);
  await answer(page, 1, 'lower', 'unsure');
  await answer(page, 2, 'covered', 'sure');
  await expect(page.locator('[data-lp-summary]')).toHaveText('You answered 1 of 3 correctly.');
  await expect(page.locator('[data-lp-review="sureWrong"]').getByRole('button')).toHaveCount(2);
  const saved = await page.evaluate(() => window.lpSavedJson);
  expect(saved).toBe('{"answers":{"__proto__":"sender","constructor":"lower","toString":"covered"}}');
  // Start over leaves the dictionaries prototype-free too.
  await page.locator('[data-lp-restart]').click();
  await answer(page, 0, 'to-cc', 'sure');
  expect(await page.evaluate(() => window.lpSavedJson)).toBe('{"answers":{"__proto__":"to-cc"}}');
  // Restore every answer, then a partial set that still collects certainty.
  await start(saved);
  await expect(page.locator('[data-lp-verdict]:visible')).toHaveText([strings.en.verdictWrong, strings.en.verdictRight, strings.en.verdictWrong]);
  await expect(page.locator('[data-lp-summary]')).toHaveText('You answered 1 of 3 correctly.');
  await start('{"answers":{"constructor":"lower"}}');
  await answer(page, 0, 'sender', 'sure'); await answer(page, 2, 'still-there', 'unsure');
  await expect(page.locator('[data-lp-review]:visible').getByRole('button')).toHaveText([english.questions[0].text, english.questions[2].text]);
  expect(await page.evaluate(() => window.lpSavedJson)).toBe('{"answers":{"constructor":"lower","__proto__":"sender","toString":"still-there"}}');
});

test('the summary entries read as links, all in one style', async ({ page }) => {
  await open(page);
  await answer(page, 0, 'sender', 'sure'); await answer(page, 1, 'lower', 'unsure'); await answer(page, 2, 'covered', 'sure');
  const entries = page.locator('[data-lp-review]:visible').getByRole('button');
  await expect(entries).toHaveCount(3);
  const look = () => entries.evaluateAll(els => els.map(el => { const css = getComputedStyle(el); return [css.color, css.backgroundColor, css.textDecorationLine, css.fontWeight].join(); }));
  expect(new Set(await look())).toEqual(new Set(['rgb(28, 60, 148),rgba(0, 0, 0, 0),underline,400']));
  await entries.first().hover();
  expect(new Set(await look()).size).toBe(1);
});

test('missing and mismatched markup fail loudly', async ({ page }) => {
  await open(page);
  const attempt = change => page.evaluate(async ({ content, change }) => {
    const { render } = await import('/patterns/answer-with-confidence/render.js');
    const { enhance } = await import('/patterns/answer-with-confidence/enhance.js');
    const { strings } = await import('/patterns/answer-with-confidence/strings.js');
    const host = document.createElement('div');
    host.innerHTML = change === 'empty' ? '<section></section>' : render(content, strings.en, { id: 'broken', lang: 'en' });
    if (change === 'option') host.querySelector('input').value = 'other';
    if (change === 'feedback') host.querySelector('[data-lp-feedback]').remove();
    if (change === 'question') host.querySelector('[data-lp-question]').remove();
    enhance(host.firstElementChild, { content: change === 'dontKnow' ? { ...content, dontKnow: true } : content, strings: strings.en });
  }, { content: english, change });
  await expect(attempt('empty')).rejects.toThrow('Missing answer-with-confidence markup');
  await expect(attempt('question')).rejects.toThrow('Invalid answer-with-confidence questions markup');
  for (const change of ['option', 'feedback', 'dontKnow']) await expect(attempt(change)).rejects.toThrow('Invalid answer-with-confidence options markup');
});

test('hostile text stays text in the feedback and the summary', async ({ page }) => {
  const content = structuredClone(english);
  content.questions[0].text = '<img src=x onerror=alert(1)> {right}';
  content.questions[0].options[0].feedback = '<b>bold</b> & {option}';
  content.questions[0].options[0].rightWhen = '<i>when</i>';
  await mount(page, content);
  await finish(page);
  await expect(page.locator('[data-lp-pattern] :is(img, b, i)')).toHaveCount(0);
  await expect(question(page, 0).locator('[data-lp-feedback="sender"]')).toContainText('<b>bold</b> & {option}');
  await expect(page.locator('[data-lp-review]:visible').getByRole('button').first()).toHaveText('<img src=x onerror=alert(1)> {right}');
});

test('forced colours keep the segments, the feedback box and focus rings visible', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page);
  const segment = question(page, 0).locator('.lp-answer-with-confidence-segment').first();
  await expect(segment).toHaveCSS('border-top-style', 'solid');
  await expect(segment).toHaveCSS('border-top-width', '1px');
  await question(page, 0).locator('input').first().focus();
  await page.keyboard.press('Space'); await page.keyboard.press('Tab');
  const ring = await segment.evaluate(el => { const css = getComputedStyle(el); return [css.outlineWidth, css.outlineStyle, css.outlineColor]; });
  expect(ring.slice(0, 2)).toEqual(['3px', 'solid']); expect(ring[2]).not.toBe('rgba(0, 0, 0, 0)');
  await page.keyboard.press('Enter');
  const box = question(page, 0).locator('[data-lp-feedback="sender"]');
  await expect(box).toBeFocused();
  // The reserved space is unpainted: no box inside the activity box.
  await expect(question(page, 0).locator('[data-lp-stage]')).toHaveCSS('border-top-width', '0px');
  await expect(box).toHaveCSS('outline-width', '3px');
  await expect(question(page, 0).locator('[data-lp-mark]').first()).toHaveCSS('border-style', 'double');
  await answer(page, 1, 'lower', 'sure'); await answer(page, 2, 'still-there', 'sure');
  await expect(page.locator('[data-lp-restart]')).toHaveCSS('text-decoration-line', 'underline');
});

test('reduced motion reveals the summary without a smooth scroll', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 500 });
  await open(page);
  await page.evaluate(() => {
    window.lpScrolls = [];
    const scroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (options) { window.lpScrolls.push(options?.behavior); return scroll.call(this, options); };
  });
  await finish(page);
  await expect(page.locator('[data-lp-result]')).toBeInViewport();
  expect(await page.evaluate(() => window.lpScrolls.at(-1))).toBe('instant');
});
