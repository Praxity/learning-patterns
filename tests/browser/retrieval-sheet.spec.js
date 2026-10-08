import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const english = JSON.parse(await readFile(new URL('../../patterns/retrieval-sheet/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/retrieval-sheet/examples/fr.json', import.meta.url)));
const root = page => page.locator('[data-lp-pattern="retrieval-sheet"]').first();
const side = (page, value) => root(page).locator(`[data-lp-side="${value}"]`);
const scan = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);

async function open(page, path = '/retrieval-sheet/en.html') {
  await page.clock.install({ time: new Date(2026, 9, 6, 23, 45) });
  await page.goto(path); await page.waitForFunction(() => window.lpReady);
}
async function observe(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    new MutationObserver(records => {
      for (const record of records) window.lpAnnouncements.push(record.target.textContent);
    }).observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}

for (const width of [1280, 390]) {
  test(`paper preview has a scene header, writing space and authored content (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await open(page);
    await expect(root(page).locator('.lp-scene-label')).toHaveCount(0);
    await expect(root(page).locator('.lp-scene-title')).toHaveText(english.title);
    await expect(root(page).locator('.lp-scene-icon svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(side(page, 'front')).toBeVisible(); await expect(side(page, 'back')).toBeHidden();
    await expect(side(page, 'front').locator('li > p')).toHaveText(english.questions.map(row => row.question));
    await expect(side(page, 'front').locator('.lp-retrieval-sheet-space')).toHaveCount(6);
    for (const space of await side(page, 'front').locator('.lp-retrieval-sheet-space').all()) {
      expect(await space.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(40);
    }
    const paper = await side(page, 'front').boundingBox();
    expect(paper.height / paper.width).toBeGreaterThanOrEqual(297 / 210 - .01);
    expect(await side(page, 'front').evaluate(el => getComputedStyle(el).boxShadow)).not.toBe('none');
    await root(page).getByRole('tab', { name: 'Back', exact: true }).click();
    await expect(side(page, 'back').locator('li > p')).toHaveText(english.questions.map(row => row.answer));
  });
}

test('keyboard journey uses automatic tabs with arrows, Home and End and keeps announcements quiet', async ({ page }) => {
  await open(page); await observe(page);
  await page.evaluate(() => {
    window.lpTabFocus = [];
    document.querySelector('[data-lp-tabs]').addEventListener('focus', event => {
      window.lpTabFocus.push({ name: event.target.textContent, selected: event.target.getAttribute('aria-selected') });
    }, true);
  });
  const front = root(page).getByRole('tab', { name: 'Front', exact: true });
  const back = root(page).getByRole('tab', { name: 'Back', exact: true });
  await expect(root(page).getByLabel('Test myself on')).toHaveValue('2026-10-13');
  await expect(front).toHaveAttribute('aria-selected', 'true'); await expect(back).toHaveAttribute('tabindex', '-1');
  await front.focus(); await page.keyboard.press('ArrowRight');
  await expect(back).toBeFocused(); await expect(back).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => window.lpTabFocus)).toEqual([{ name: 'Front', selected: 'true' }, { name: 'Back', selected: 'true' }]);
  await expect(side(page, 'back')).toBeVisible(); await expect(side(page, 'front')).toBeHidden();
  await page.keyboard.press('Tab'); await expect(side(page, 'back')).toBeFocused();
  await back.focus(); await page.keyboard.press('ArrowRight'); await expect(front).toBeFocused();
  await page.keyboard.press('ArrowLeft'); await expect(back).toBeFocused();
  await page.keyboard.press('Home'); await expect(front).toBeFocused();
  await page.keyboard.press('End'); await expect(back).toBeFocused();
  await page.keyboard.press('Space'); await expect(back).toBeFocused();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ date: '2026-10-13', side: 'back' });
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  expect(await back.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
});

test('tab selection and panel switch finish before focus with no later selection mutations', async ({ page }) => {
  await open(page);
  await root(page).getByRole('tab', { name: 'Front', exact: true }).focus();
  await page.evaluate(() => {
    window.lpTabFocus = []; window.lpTabMutations = [];
    window.lpTabObserver = new MutationObserver(records => window.lpTabMutations.push(...records.map(record => record.attributeName)));
    window.lpTabObserver.observe(document.querySelector('[data-lp-tabs]'), { attributes: true, subtree: true, attributeFilter: ['aria-selected', 'tabindex'] });
    document.querySelector('[data-lp-tabs]').addEventListener('focus', event => {
      // Discard selection changes that finished before this focus event.
      window.lpTabObserver.takeRecords();
      const tab = event.target;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      window.lpTabFocus.push({ name: tab.textContent, selected: tab.getAttribute('aria-selected'), tabindex: tab.getAttribute('tabindex'), hidden: panel.hidden });
    }, true);
  });
  for (const [key, name] of [['ArrowRight', 'Back'], ['ArrowRight', 'Front'], ['ArrowLeft', 'Back'], ['Home', 'Front'], ['End', 'Back']]) {
    await page.keyboard.press(key);
    await expect(root(page).getByRole('tab', { name, exact: true })).toBeFocused();
  }
  expect(await page.evaluate(() => window.lpTabFocus)).toEqual(['Back', 'Front', 'Back', 'Front', 'Back'].map(name => ({ name, selected: 'true', tabindex: '0', hidden: false })));
  expect(await page.evaluate(() => window.lpTabMutations)).toEqual([]);
});

test('date changes update both printed headers, copy state and announce once without moving focus', async ({ page }) => {
  await open(page); await observe(page);
  const date = root(page).getByLabel('Test myself on');
  await expect(date).not.toHaveAttribute('aria-describedby');
  await date.fill('2028-02-29'); await date.dispatchEvent('change');
  await expect(date).toBeFocused();
  await expect(root(page).locator('time')).toHaveText(['February 29, 2028', 'February 29, 2028']);
  for (const time of await root(page).locator('time').all()) await expect(time).toHaveAttribute('datetime', '2028-02-29');
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ date: '2028-02-29', side: 'front' });
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Test yourself on February 29, 2028.']);
  await page.evaluate(() => { window.lpSaved.date = '2020-01-01'; });
  await root(page).getByRole('tab', { name: 'Back', exact: true }).click();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ date: '2028-02-29', side: 'back' });
});

test('empty and out-of-range date edits show local errors and keep the last valid state', async ({ page }) => {
  await open(page); await observe(page);
  const date = root(page).getByLabel('Test myself on');
  await date.fill(''); await date.dispatchEvent('change');
  await expect(date).toHaveAttribute('aria-invalid', 'true');
  const errorId = await date.getAttribute('aria-describedby');
  await expect(page.locator(`[id="${errorId}"]`)).toBeVisible();
  await expect(root(page).locator('[data-lp-date-error]')).toHaveText('Choose a valid date.');
  await expect(root(page).getByRole('button', { name: 'Print the sheet' })).toBeDisabled();
  await expect(root(page).locator('time').first()).toHaveAttribute('datetime', '2026-10-13');
  expect(await page.evaluate(() => window.lpSaved)).toBeUndefined();
  await date.evaluate(el => { el.value = '10000-01-01'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(date).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => window.lpSaved)).toBeUndefined();
  await date.fill('2026-10-20'); await date.dispatchEvent('change');
  await expect(date).not.toHaveAttribute('aria-invalid');
  await expect(date).not.toHaveAttribute('aria-describedby');
  await expect(root(page).locator('[data-lp-date-error]')).toBeHidden();
  await expect(root(page).getByRole('button', { name: 'Print the sheet' })).toBeEnabled();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Choose a valid date.', 'Test yourself on October 20, 2026.']);
});

test('restores an exact saved date and side without an announcement', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { date: '2025-01-02', side: 'back' }; });
  await open(page);
  await expect(side(page, 'back')).toBeVisible(); await expect(side(page, 'front')).toBeHidden();
  await expect(root(page).getByLabel('Test myself on')).toHaveValue('2025-01-02');
  await expect(root(page).locator('time')).toHaveText(['January 2, 2025', 'January 2, 2025']);
  await expect(root(page).getByRole('status')).toHaveText('');
  expect(await page.evaluate(() => window.lpSaved)).toBeUndefined();
});

for (const [name, value] of Object.entries({
  null: null, array: [], empty: {}, impossibleDate: { date: '2026-02-29', side: 'back' },
  unknownSide: { date: '2026-10-13', side: 'other' }, extraField: { date: '2026-10-13', side: 'back', extra: 1 }
})) {
  test(`ignores planted invalid saved state as a whole: ${name}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, value);
    await open(page);
    await expect(root(page).getByLabel('Test myself on')).toHaveValue('2026-10-13');
    await expect(side(page, 'front')).toBeVisible(); await expect(side(page, 'back')).toBeHidden();
    await expect(root(page).getByRole('status')).toHaveText('');
  });
}

test('repeated enhancement keeps markup and destroy restores both native sides and removes listeners', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await page.evaluate(() => { window.lpOriginalPage = document.querySelector('[data-lp-side="front"]'); });
  await root(page).getByRole('tab', { name: 'Back', exact: true }).click();
  expect(await page.evaluate(() => window.lpOriginalPage === document.querySelector('[data-lp-side="front"]'))).toBe(true);
  await page.evaluate(() => { window.lpInstances[0].destroy(); window.lpInstances[0].destroy(); });
  await expect(side(page, 'front')).toBeVisible(); await expect(side(page, 'back')).toBeVisible();
  await expect(root(page).locator('[data-lp-controls]')).toBeHidden();
  await expect(root(page).locator('[data-lp-print-controls]')).toBeHidden();
  await expect(side(page, 'front')).not.toHaveAttribute('role');
  await root(page).locator('[data-lp-tab="front"]').evaluate(el => el.click());
  expect(await page.evaluate(() => window.lpSaved.side)).toBe('back');
  await page.evaluate(() => { window.lpInstances[0] = window.lpEnhance(); });
  await expect(side(page, 'back')).toBeVisible(); await expect(side(page, 'front')).toBeHidden();
});

test('malformed markup is rejected before partially revealing controls or attaching listeners', async ({ page }) => {
  await open(page);
  const results = await page.evaluate(async content => {
    const { render } = await import('/patterns/retrieval-sheet/render.js');
    const { enhance } = await import('/patterns/retrieval-sheet/enhance.js');
    const { strings } = await import('/patterns/retrieval-sheet/strings.js');
    return ['[data-lp-controls]', '[data-lp-tabs]', '[data-lp-date]', '[data-lp-date-error]', '[data-lp-print-controls]', '[data-lp-print]', '[role="status"]', '[data-lp-tab="front"]', '[data-lp-side="back"]', '[data-lp-print-date]'].map(selector => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = render(content, strings.en, { id: 'guard', lang: 'en' });
      const sheet = wrapper.firstElementChild; sheet.querySelector(selector).remove();
      try { enhance(sheet, { content, strings: strings.en }); return { selector, error: null }; }
      catch (error) { return { selector, error: error.message, revealed: !!sheet.querySelector('[data-lp-controls]:not([hidden])') }; }
    });
  }, english);
  for (const result of results) {
    expect(result.error).toMatch(/retrieval-sheet markup/); expect(result.revealed).toBe(false);
  }
});

test('two instances have unique ids, independent tabs and dates', async ({ page }) => {
  await open(page, '/retrieval-sheet/two.html');
  const second = page.locator('[data-lp-pattern]').nth(1);
  await root(page).getByRole('tab', { name: 'Back', exact: true }).click();
  await root(page).getByLabel('Test myself on').fill('2026-10-20');
  await root(page).getByLabel('Test myself on').dispatchEvent('change');
  await expect(second.locator('[data-lp-side="front"]')).toBeVisible();
  await expect(second.getByLabel('Test myself on')).toHaveValue('2026-10-13');
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id));
  expect(new Set(ids).size).toBe(ids.length);
});

test('printing calls the host print dialog and announces once without moving focus', async ({ page }) => {
  await open(page); await observe(page);
  await page.evaluate(() => { window.lpPrintCalls = 0; window.print = () => { window.lpPrintCalls++; }; });
  const button = root(page).getByRole('button', { name: 'Print the sheet' });
  await button.focus(); await button.press('Enter'); await expect(button).toBeFocused();
  expect(await page.evaluate(() => window.lpPrintCalls)).toBe(1);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Print dialog opened.']);
});

test('a print button targets its own sheet and afterprint restores document printing', async ({ page }) => {
  await open(page, '/retrieval-sheet/two.html');
  await page.evaluate(() => { window.print = () => {}; });
  const second = page.locator('[data-lp-pattern]').nth(1);
  await second.getByRole('button', { name: 'Print the sheet' }).click();
  await page.emulateMedia({ media: 'print' });
  await expect(root(page)).toBeHidden(); await expect(second).toBeVisible();
  await expect(second.locator('[data-lp-side="front"]')).toBeVisible();
  await expect(second.locator('[data-lp-side="back"]')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(root(page)).toBeVisible(); await expect(second).toBeVisible();
  await page.emulateMedia({ media: 'screen' });
  await expect(second.locator('[data-lp-side="back"]')).toBeHidden();
});

for (const lang of ['en', 'fr']) {
  test(`axe at load, back and changed date (${lang})`, async ({ page }) => {
    await open(page, `/retrieval-sheet/${lang}.html`); await scan(page);
    await root(page).locator('[data-lp-tab="back"]').click(); await scan(page);
    await root(page).locator('[data-lp-date]').fill('2028-02-29');
    await root(page).locator('[data-lp-date]').dispatchEvent('change'); await scan(page);
    await root(page).locator('[data-lp-date]').fill('');
    await root(page).locator('[data-lp-date]').dispatchEvent('change'); await scan(page);
  });

  test(`no JavaScript shows questions and answers in order and prints (${lang})`, async ({ browser, browserName }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage(); await page.goto(`/retrieval-sheet/${lang}.html`);
    const content = lang === 'fr' ? french : english;
    await expect(root(page)).toHaveAttribute('lang', lang);
    await expect(side(page, 'front')).toBeVisible(); await expect(side(page, 'back')).toBeVisible();
    await expect(side(page, 'front').locator('li > p')).toHaveText(content.questions.map(row => row.question));
    await expect(side(page, 'back').locator('li > p')).toHaveText(content.questions.map(row => row.answer));
    await expect(root(page).getByRole('button')).toHaveCount(0);
    if (browserName === 'chromium') {
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('h1')).toBeHidden();
      await expect(side(page, 'front')).toBeVisible(); await expect(side(page, 'back')).toBeVisible();
    }
    await context.close();
    const audit = await browser.newContext();
    await audit.route('**/patterns/retrieval-sheet/enhance.js', route => route.abort());
    const auditPage = await audit.newPage(); await auditPage.goto(`/retrieval-sheet/${lang}.html`);
    await scan(auditPage); await audit.close();
  });

  test(`320 CSS px with text spacing has no overflow or clipped text (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await open(page, `/retrieval-sheet/${lang}.html`);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    for (const value of ['front', 'back']) {
      await root(page).locator(`[data-lp-tab="${value}"]`).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await root(page).evaluate(el => [...el.querySelectorAll('p, button, h2, h3, time')]
        .filter(el => el.getClientRects().length && !el.matches('[role="status"]'))
        .filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map(el => el.textContent))).toEqual([]);
    }
  });
}

test('French date, labels, authored answers and announcement use French', async ({ page }) => {
  await open(page, '/retrieval-sheet/fr.html'); await observe(page);
  await expect(root(page).locator('.lp-scene-label')).toHaveCount(0);
  await root(page).getByLabel('Me tester le').fill('2028-02-29');
  await root(page).getByLabel('Me tester le').dispatchEvent('change');
  await expect(root(page).locator('time')).toHaveText(['29 février 2028', '29 février 2028']);
  await root(page).getByRole('tab', { name: 'Verso', exact: true }).click();
  await expect(side(page, 'back').locator('li > p')).toHaveText(french.questions.map(row => row.answer));
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Testez vos connaissances le 29 février 2028.']);
});

test('forced colours keeps the active tab and keyboard focus visible', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation is Chromium only.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page);
  const back = root(page).getByRole('tab', { name: 'Back', exact: true });
  await back.focus(); await back.press('Enter');
  await expect(back).toHaveCSS('border-bottom-width', '3px');
  await expect(back).toHaveCSS('border-bottom-style', 'solid');
  await expect(back).toBeFocused(); await scan(page);
});

for (const format of ['A4', 'Letter']) {
  for (const lang of ['en', 'fr']) {
    test(`printing ${lang} on ${format} makes two pages in order with no chrome`, async ({ page, browserName }, testInfo) => {
      test.skip(browserName !== 'chromium', 'PDF generation is Chromium only.');
      await open(page, `/retrieval-sheet/${lang}.html`);
      await root(page).locator('[data-lp-tab="back"]').click();
      await root(page).locator('[data-lp-date]').fill('2028-02-29');
      await root(page).locator('[data-lp-date]').dispatchEvent('change');
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('h1')).toBeHidden();
      await expect(root(page).locator('.lp-scene')).toBeHidden();
      await expect(root(page).locator('[data-lp-controls]')).toBeHidden();
      await expect(side(page, 'front')).toBeVisible(); await expect(side(page, 'back')).toBeVisible();
      await expect(side(page, 'front')).toHaveCSS('box-shadow', 'none');
      await expect(side(page, 'front')).toHaveCSS('color', 'rgb(0, 0, 0)');
      await expect(side(page, 'front')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
      const pdf = testInfo.outputPath(`${lang}-${format}.pdf`);
      await page.pdf({ path: pdf, format, printBackground: false });
      const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
      expect(info).toMatch(/Pages:\s+2\b/);
      const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
      const pages = text.split('\f').filter(value => value.trim());
      expect(pages).toHaveLength(2);
      const content = lang === 'fr' ? french : english;
      for (const row of content.questions) {
        expect(pages[0].replace(/\s+/g, ' ')).toContain(row.question);
        expect(pages[1].replace(/\s+/g, ' ')).toContain(row.answer.replace(/\u00a0/g, ' '));
      }
      expect(text).not.toContain(lang === 'fr' ? 'À emporter' : 'Take it with you');
      expect(text).not.toContain(lang === 'fr' ? 'Imprimer la feuille' : 'Print the sheet');
      expect(pages[0]).toContain(lang === 'fr' ? '29 février 2028' : 'February 29, 2028');
      expect(pages[1]).toContain(lang === 'fr' ? '29 février 2028' : 'February 29, 2028');
    });
  }
}
