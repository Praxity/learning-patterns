import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const english = JSON.parse(await readFile(new URL('../../patterns/formats/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/formats/examples/fr.json', import.meta.url)));
const formats = ['text', 'slides', 'audio', 'outline', 'quiz'];
async function open(page, path = '/formats/en.html') {
  await page.goto(path);
  await expect(page.locator('[data-lp-formats]')).toBeVisible();
}
const button = (page, name) => page.locator(`[data-lp-format="${name}"]`);
const point = page => page.locator('[data-lp-point]:visible');
const question = page => page.locator('[data-lp-question]:visible');
const scan = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
async function observe(page) {
  await page.evaluate(() => {
    window.lpObserver?.disconnect(); window.lpAnnouncements = [];
    window.lpObserver = new MutationObserver(records => {
      for (const record of records) window.lpAnnouncements.push(record.target.textContent);
    });
    window.lpObserver.observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}

test('keyboard switching preserves section, announces once, keeps focus and saves copied state', async ({ page }) => {
  await open(page); await observe(page);
  await expect(point(page)).toHaveCount(1); await expect(point(page)).toHaveAttribute('data-lp-point', 'stonewalling');
  await expect(page.getByRole('status')).toHaveText('');
  await page.keyboard.press('Tab'); await expect(button(page, 'text')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(button(page, 'slides')).toBeFocused();
  await page.keyboard.press('Space'); await expect(button(page, 'slides')).toBeFocused();
  await expect(point(page).locator('[data-lp-view="slides"]')).toBeVisible();
  await page.locator('[data-lp-next]').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-next]')).toBeFocused();
  await expect(page.locator('[data-lp-place]')).toHaveText('Section 2 of 3');
  for (const format of formats) {
    await button(page, format).focus(); await page.keyboard.press('Enter');
    await expect(button(page, format)).toBeFocused(); await expect(button(page, format)).toHaveAttribute('aria-pressed', 'true');
    await expect(point(page)).toHaveAttribute('data-lp-point', 'problem');
    await expect(point(page).locator(`[data-lp-view="${format}"]`)).toBeVisible();
    expect(await page.evaluate(() => window.lpSaved)).toEqual({ format, section: 1 });
  }
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([
    'Showing Slides, section 1.', 'Showing Slides, section 2.', 'Showing Text, section 2.',
    'Showing Slides, section 2.', 'Showing Audio script, section 2.', 'Showing Outline, section 2.', 'Showing Quiz, section 2.'
  ]);
  await expect(point(page).getByText('There is no quiz question for this section. Review the outline, then choose Next.')).toBeVisible();
  await page.evaluate(() => { window.lpSaved.section = 0; });
  await page.locator('[data-lp-next]').click();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ format: 'quiz', section: 2 });
});

test('boundaries and selecting the current format are inert and preserve focus', async ({ page }) => {
  await open(page); await observe(page);
  const previous = page.locator('[data-lp-previous]'), next = page.locator('[data-lp-next]');
  await previous.focus(); await page.keyboard.press('Enter'); await expect(previous).toBeFocused();
  await button(page, 'text').click(); await expect(button(page, 'text')).toBeFocused();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  expect(await page.evaluate(() => window.lpSaved)).toBeUndefined();
  await next.click(); await next.click(); await observe(page);
  await next.focus(); await page.keyboard.press('Enter'); await expect(next).toBeFocused(); await expect(next).toHaveAttribute('aria-disabled', 'true');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  await expect(page.locator('[data-lp-summary]')).toBeVisible();
  await expect(page.locator('[data-lp-summary]')).toContainText(english.summary);
  await previous.focus(); await page.keyboard.press('Enter'); await expect(previous).toBeFocused(); await expect(page.locator('[data-lp-summary]')).toBeHidden();
});

test('quiz submits feedback on the selected row, clears it on change and retains it across formats', async ({ page }) => {
  await open(page); await button(page, 'quiz').click(); await observe(page);
  const q = question(page), check = q.getByRole('button', { name: 'Check answer' });
  await check.focus(); await page.keyboard.press('Enter'); await expect(check).toBeFocused(); await expect(q.locator('[data-lp-error]')).toBeVisible();
  await q.getByRole('radio').nth(0).check();
  await expect(q.locator('[data-lp-error]')).toBeHidden(); await expect(q.locator('[data-lp-feedback]:visible')).toHaveCount(0);
  await check.focus(); await page.keyboard.press('Enter'); await expect(check).toBeFocused();
  const row = q.locator('.lp-choice').nth(0);
  await expect(row).toHaveAttribute('data-lp-mark', 'wrong');
  await expect(row.locator('[data-lp-mark-word]')).toHaveText('Not quite');
  await expect(row.locator('[data-lp-feedback]')).toHaveText(english.quiz[0].options[0].feedback);
  await expect(row).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  expect(await row.evaluate(el => el.querySelector('[data-lp-feedback]').getBoundingClientRect().top >= el.querySelector('input + span').getBoundingClientRect().bottom)).toBe(true);
  await expect(q.locator('[data-lp-feedback]:visible')).toHaveCount(1);
  await button(page, 'text').click(); await button(page, 'quiz').click(); await expect(row.locator('[data-lp-feedback]')).toBeVisible();
  await q.getByRole('radio').nth(1).check(); await expect(q.locator('[data-lp-feedback]:visible')).toHaveCount(0);
  await expect(q.locator('[data-lp-mark]')).toHaveCount(0);
  await check.click(); await check.click();
  await expect(q.locator('.lp-choice').nth(1)).toHaveAttribute('data-lp-mark', 'correct');
  await expect(q.locator('.lp-choice').nth(1)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(q.locator('[data-lp-mark-word]:visible')).toHaveText('Correct');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([
    'Choose an answer first.', `Not quite. ${english.quiz[0].options[0].feedback}`,
    'Showing Text, section 1.', 'Showing Quiz, section 1.',
    'Correct. He says he needs a pause and comes back.', 'Correct. He says he needs a pause and comes back.'
  ]);
  await page.locator('[data-lp-next]').click(); await page.locator('[data-lp-next]').click();
  await question(page).getByRole('radio').nth(2).check(); await question(page).getByRole('button').click();
  await expect(page.locator('[data-lp-quiz-summary]')).toHaveText('2 of 2 questions checked.');
});

test('hidden quiz and format controls ignore programmatic actions', async ({ page }) => {
  await open(page); await observe(page);
  await page.locator('[data-lp-check]').first().evaluate(el => el.click());
  await page.locator('[data-lp-question] input').first().evaluate(el => { el.checked = true; el.dispatchEvent(new Event('change')); });
  await expect(page.getByRole('status')).toHaveText('');
  expect(await page.evaluate(() => window.lpSaved)).toBeUndefined();
});

for (const [lang, content] of [['en', english], ['fr', french]]) {
  for (const format of formats) test(`${format} shows authored section content and passes axe (${lang})`, async ({ page }) => {
    await open(page, `/formats/${lang}.html`); await scan(page);
    for (let i = 0; i < content.points.length; i++) {
      {
        await button(page, format).click();
        await expect(point(page).getByRole('heading')).toHaveText(content.points[i].title);
        const view = point(page).locator(`[data-lp-view="${format}"]`);
        if (format === 'text') await expect(view.locator('p').first()).toHaveText(content.points[i].sentences.join(' '));
        if (format === 'audio') {
          await expect(view.locator('li')).toHaveText([content.points[i].title, ...content.points[i].sentences, ...(content.points[i].example ?? [])]);
          await expect(view.getByRole('button')).toHaveCount(0);
        }
        if (format === 'slides' || format === 'outline') await expect(view.locator('li')).toHaveText([...content.points[i].outline, ...(content.points[i].exampleOutline ? [content.points[i].exampleOutline] : [])]);
        await scan(page);
        if (format === 'quiz' && await question(page).count()) {
          await question(page).getByRole('button').click(); await scan(page);
          await question(page).getByRole('radio').nth(0).check(); await question(page).getByRole('button').click(); await scan(page);
          const authored = content.quiz.find(q => q.section === content.points[i].id);
          await question(page).getByRole('radio').nth(authored.options.findIndex(option => option.correct)).check();
          await question(page).getByRole('button').click(); await scan(page);
        }
      }
      if (i < content.points.length - 1) await page.locator('[data-lp-next]').click();
    }
    await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', lang);
    await expect(page.locator('[data-lp-summary]')).toContainText(content.summary);
  });

  test(`no JavaScript shows the whole text lesson (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage(); await page.goto(`/formats/${lang}.html`);
    await expect(page.locator('[data-lp-point]:visible')).toHaveCount(3);
    for (const [i, authored] of content.points.entries()) {
      const section = page.locator('[data-lp-point]').nth(i);
      await expect(section.getByRole('heading')).toHaveText(authored.title);
      await expect(section.locator('[data-lp-view="text"]')).toContainText(authored.sentences.join(' '));
      if (authored.example) await expect(section.locator('.lp-quote').first()).toHaveText(authored.example.join(' '));
    }
    await expect(page.getByRole('button')).toHaveCount(0); await expect(page.getByRole('status')).toHaveText('');
    await expect(page.locator('[data-lp-summary]')).toContainText(content.summary); await context.close();
    const audit = await browser.newContext(); await audit.route('**/patterns/formats/enhance.js', route => route.abort());
    const auditPage = await audit.newPage(); await auditPage.goto(`/formats/${lang}.html`); await scan(auditPage); await audit.close();
  });

  test(`320 CSS pixels with text spacing has no clipping in any format (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await open(page, `/formats/${lang}.html`);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    for (const format of formats) {
      await button(page, format).click();
      if (format === 'quiz') { await question(page).getByRole('radio').nth(0).check(); await question(page).getByRole('button').click(); }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.evaluate(() => [...document.querySelectorAll('p, button, h3, h4, li, label')].filter(el => el.getClientRects().length && !el.matches('[role="status"]')).filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map(el => el.textContent))).toEqual([]);
    }
  });
}

test('French announcements and feedback use authored French strings', async ({ page }) => {
  await open(page, '/formats/fr.html'); await observe(page);
  await button(page, 'quiz').click(); await question(page).getByRole('radio').nth(1).check(); await question(page).getByRole('button').click();
  await expect(question(page).locator('[data-lp-mark-word]:visible')).toHaveText('Bonne réponse');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Format affiché : Quiz, section 1.', 'Bonne réponse. Il annonce sa pause et revient à la discussion.']);
});

test('valid saved place restores without announcing or replacing server elements', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { format: 'audio', section: 2 }; });
  await open(page); await expect(point(page)).toHaveAttribute('data-lp-point', 'time-out');
  await expect(button(page, 'audio')).toHaveAttribute('aria-pressed', 'true');
  await expect(point(page).locator('[data-lp-view="audio"]')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('');
  await expect(page.locator('[data-lp-summary]')).toBeVisible();
});

for (const saved of [{ format: 'video', section: 1 }, { format: 'slides', section: 3 }, { format: 'quiz', section: 0.5 }, { format: 'text', section: 0, extra: true }]) {
  test(`invalid saved place is ignored: ${JSON.stringify(saved)}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, saved); await open(page);
    await expect(point(page)).toHaveAttribute('data-lp-point', 'stonewalling'); await expect(button(page, 'text')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('status')).toHaveText('');
  });
}

test('two instances have unique ids and independent place and quiz results', async ({ page }) => {
  await page.goto('/formats/two.html'); const roots = page.locator('[data-lp-pattern]');
  await expect(roots.first().locator('[data-lp-formats]')).toBeVisible();
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  await roots.first().locator('[data-lp-next]').click(); await roots.first().locator('[data-lp-format="quiz"]').click();
  await expect(roots.nth(1).locator('[data-lp-point]:visible')).toHaveAttribute('data-lp-point', 'stonewalling');
  await expect(roots.nth(1).locator('[data-lp-format="text"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(roots.nth(1).getByRole('status')).toHaveText('');
});

test('idempotency and destroy keep original text nodes and allow fresh enhancement', async ({ page }) => {
  await open(page); await observe(page);
  expect(await page.evaluate(() => { window.lpOriginal = document.querySelector('[data-lp-point]'); return window.lpEnhance() === window.lpInstances[0]; })).toBe(true);
  await button(page, 'quiz').click(); await question(page).getByRole('radio').nth(0).check(); await question(page).getByRole('button').click();
  await page.evaluate(() => { window.lpOld = window.lpInstances[0]; window.lpOld.destroy(); window.lpOld.destroy(); });
  await expect(page.locator('[data-lp-point]:visible')).toHaveCount(3); await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText(''); await expect(page.locator('[data-lp-mark]')).toHaveCount(0);
  expect(await page.evaluate(() => window.lpOriginal === document.querySelector('[data-lp-point]'))).toBe(true);
  await page.evaluate(() => { window.lpEnhance(); window.lpOld.destroy(); });
  await expect(page.locator('[data-lp-formats]')).toBeVisible();
  await observe(page); await button(page, 'slides').click();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Showing Slides, section 1.']);
});

test('planted missing and mismatched markup fail before enhancement changes the baseline', async ({ page }) => {
  await open(page);
  for (const selector of ['[data-lp-point]', '[data-lp-view="slides"]', '[data-lp-format="text"]', '[data-lp-next]', '[data-lp-question]', '[data-lp-check]', '[data-lp-error]', '[data-lp-feedback]', '[data-lp-mark-word]', '[data-lp-place]', '[data-lp-summary]', '[data-lp-quiz-summary]', '[role="status"]', 'fieldset', 'input', 'identity', 'format identity', 'question identity', 'option identity']) {
    await page.evaluate(kind => {
      window.lpInstances[0].destroy();
      if (kind === 'identity') document.querySelector('[data-lp-point]').dataset.lpPoint = 'unknown';
      else if (kind === 'format identity') document.querySelector('[data-lp-format]').dataset.lpFormat = 'unknown';
      else if (kind === 'question identity') document.querySelector('[data-lp-question]').dataset.lpQuestion = '99';
      else if (kind === 'option identity') document.querySelector('input').value = '99';
      else document.querySelector(kind).remove();
    }, selector);
    await expect(page.evaluate(() => window.lpEnhance())).rejects.toThrow(/formats markup/);
    await expect(page.locator('[data-lp-formats]')).toBeHidden();
    await page.goto('/formats/en.html'); await expect(page.locator('[data-lp-formats]')).toBeVisible();
  }
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/formats/enhance.js'); const { strings } = await import('/patterns/formats/strings.js');
    enhance(document.createElement('section'), { content, strings: strings.en });
  }, english)).rejects.toThrow(/formats markup/);
});

test('forced colours keeps pressed state, radio choices, marks and focus visible', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation is checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page); await button(page, 'quiz').click();
  await expect(button(page, 'quiz')).toHaveCSS('border-top-width', '2px');
  await question(page).getByRole('radio').nth(0).check(); await question(page).getByRole('button').click();
  await expect(question(page).locator('[data-lp-mark]')).toHaveCSS('border-top-style', 'double');
  await expect(question(page).locator('[data-lp-mark-word]:visible')).toHaveText('Not quite');
  await button(page, 'outline').focus(); await expect(button(page, 'outline')).toHaveCSS('outline-width', '2px');
  await scan(page);
});

for (const width of [1280, 390]) {
  test(`course scene, format icons and border selection at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await open(page);
    await expect(page.locator('.lp-formats-scene')).toContainText('Choose how to learn this');
    await expect(page.locator('.lp-formats-scene h3')).toHaveText(english.title);
    await expect(page.locator('.lp-formats-scene svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('[data-lp-format] svg')).toHaveCount(5);
    for (const format of formats) {
      await button(page, format).click(); await expect(button(page, format)).toHaveCSS('border-top-width', '2px');
      await expect(button(page, format)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(button(page, 'quiz')).toHaveCSS('transition-duration', '0s');
  });
}
