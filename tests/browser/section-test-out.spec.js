import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const english = JSON.parse(await readFile(new URL('../../patterns/test-out/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/test-out/examples/fr.json', import.meta.url)));
const mixed = ['attendees', 'decide', 'invite', 'next-meeting'];
async function open(page, path = '/test-out/en.html') {
  await page.goto(path); await page.waitForFunction(() => window.lpReady);
}
async function pick(root, values = mixed) {
  for (const [index, value] of values.entries()) await root.locator('fieldset').nth(index).locator(`input[value="${value}"]`).check();
}
async function observe(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    new MutationObserver(records => records.forEach(record => window.lpAnnouncements.push(record.target.textContent)))
      .observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}
const scan = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
async function authored(page, content) {
  await page.evaluate(async content => {
    window.lpInstances[0].destroy();
    const { render } = await import('/patterns/test-out/render.js');
    const { enhance } = await import('/patterns/test-out/enhance.js');
    const { strings } = await import('/patterns/test-out/strings.js');
    document.querySelector('main').innerHTML = render(content, strings.en, { id: 'authored', lang: 'en' });
    const root = document.querySelector('[data-lp-pattern]');
    window.lpInstances = [enhance(root, { content, strings: strings.en })];
    window.lpEnhance = () => enhance(root, { content, strings: strings.en });
  }, content);
}

test('scene and course outline sit beside keyed questions and stack in a narrow container', async ({ page }) => {
  await open(page);
  await expect(page.locator('.lp-test-out-scene')).toContainText('Placement check');
  await expect(page.locator('.lp-test-out-scene')).toContainText('Meetings: a refresher');
  await expect(page.locator('.lp-test-out-scene svg[aria-hidden="true"]')).toHaveCount(1);
  await expect(page.locator('[data-lp-section-status]')).toHaveText(['To do', 'To do', 'To do', 'To do']);
  const outline = page.locator('.lp-test-out-outline'), questions = page.locator('.lp-test-out-questions');
  expect((await outline.boundingBox()).x).toBeLessThan((await questions.boundingBox()).x);
  await page.locator('input').first().check();
  const row = page.locator('label:has(input:checked)');
  await expect(row).toHaveCSS('border-top-color', 'rgb(44, 85, 201)');
  await expect(row).toHaveCSS('border-top-width', '1px');
  await expect(row).toHaveCSS('box-shadow', 'rgb(44, 85, 201) 0px 0px 0px 1px inset');
  expect(await row.evaluate(el => getComputedStyle(el, '::before').content)).toBe('counter(lp-key, upper-alpha)');
  await page.locator('[data-lp-pattern]').evaluate(el => el.style.width = '300px');
  expect((await outline.boundingBox()).y).toBeLessThan((await questions.boundingBox()).y);
  expect((await outline.boundingBox()).x).toBe((await questions.boundingBox()).x);
});

test('keyboard errors are associated; submit retains focus and announces the summary once', async ({ page }) => {
  await open(page); await observe(page);
  await page.keyboard.press('Tab'); await expect(page.locator('input').first()).toBeFocused();
  await page.keyboard.press('Space');
  for (let n = 0; n < 4; n++) await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-check]')).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-question-error]:visible')).toHaveCount(3);
  await expect(page.locator('[data-lp-check]')).toBeFocused();
  for (const fieldset of (await page.locator('fieldset').all()).slice(1)) {
    const id = await fieldset.getAttribute('aria-describedby');
    await expect(page.locator(`[id="${id}"]`)).toHaveText('Choose an answer');
    await expect(fieldset.locator('input').first()).toHaveAttribute('aria-describedby', id);
    await expect(fieldset.locator('input').first()).toHaveAttribute('aria-invalid', 'true');
  }
  await page.locator('[data-lp-check]').press('Enter');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['3 questions unanswered. Choose an answer for each.']);
  await pick(page); await page.locator('[data-lp-check]').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-check]')).toBeFocused();
  await expect(page.locator('[data-lp-check]')).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['3 questions unanswered. Choose an answer for each.', 'You can skip 2 of 4 sections.']);
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-restart]')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('input').first()).toBeFocused();
  await expect(page.locator('input:disabled, input:checked, [data-lp-mark], .lp-choice-mark')).toHaveCount(0);
  await expect(page.locator('[data-lp-section-status]')).toHaveText(['To do', 'To do', 'To do', 'To do']);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: {}, shown: false });
});

for (const [lang, content, correct, wrong, answer, summary, statuses] of [
  ['en', english, 'Correct', 'Not quite', 'Correct answer', 'You can skip 2 of 4 sections.', ['To do', 'Credited from Running the discussion', 'Passed, you can skip it', 'To do']],
  ['fr', french, 'Correct', 'Pas tout à fait', 'Bonne réponse', 'Vous pouvez passer 2 sections sur 4.', ['À faire', 'Créditée grâce à Animer la discussion', 'Réussie, vous pouvez la passer', 'À faire']]
]) {
  test(`in-place marks, explanations and credited outline (${lang})`, async ({ page }) => {
    await open(page, `/test-out/${lang}.html`); await observe(page); await pick(page); await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', lang);
    await expect(page.locator('[data-lp-result]')).toHaveText(summary);
    await expect(page.locator('[data-lp-section-status]')).toHaveText(statuses);
    await expect(page.locator('[data-lp-section-status].lp-met svg[aria-hidden="true"]')).toHaveCount(2);
    await expect(page.locator('input:disabled')).toHaveCount(12);
    await expect(page.locator('.lp-choice-mark')).toHaveCount(7);
    const qs = page.locator('fieldset');
    await expect(qs.nth(2).locator('label:has(input:checked)')).toHaveAttribute('data-lp-mark', 'correct');
    await expect(qs.nth(2).locator('.lp-choice-mark')).toHaveText(correct);
    await expect(qs.nth(2).locator('[data-lp-explanation]')).toBeHidden();
    for (const n of [0, 1, 3]) {
      await expect(qs.nth(n).locator('label:has(input:checked)')).toHaveAttribute('data-lp-mark', 'wrong');
      await expect(qs.nth(n).locator('label:has(input:checked) .lp-choice-mark')).toHaveText(wrong);
      await expect(qs.nth(n).locator(`label:has(input[value="${content.questions[n].correct}"]) .lp-choice-mark`)).toHaveText(answer);
      await expect(qs.nth(n).locator('[data-lp-explanation]')).toHaveText(content.questions[n].explanation);
    }
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([summary]);
    expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: Object.fromEntries(content.questions.map((q, i) => [q.id, mixed[i]])), shown: true });
  });

  test(`native answers without JavaScript (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage(); await page.goto(`/test-out/${lang}.html`);
    await expect(page.getByRole('radio')).toHaveCount(12); await page.getByRole('radio').first().check();
    await page.locator('summary').click();
    for (const q of content.questions) {
      await expect(page.locator('details')).toContainText(q.options.find(o => o.id === q.correct).text);
      await expect(page.locator('details')).toContainText(q.explanation);
    }
    await expect(page.locator('[data-lp-flow]')).toBeHidden(); await context.close();
  });

  test(`axe native baseline, errors, result and reset (${lang})`, async ({ page }) => {
    await page.route('**/test-out/enhance.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export function enhance() { return { destroy() {} }; }' }));
    await open(page, `/test-out/${lang}.html`); await scan(page); await page.locator('summary').click(); await scan(page);
    await page.unroute('**/test-out/enhance.js'); await open(page, `/test-out/${lang}.html`); await scan(page);
    await page.locator('[data-lp-check]').click(); await scan(page); await pick(page); await page.locator('[data-lp-check]').click(); await scan(page);
    await page.locator('[data-lp-restart]').click(); await scan(page);
  });

  test(`400% reflow equivalent with text spacing (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await open(page, `/test-out/${lang}.html`);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    for (const stage of ['initial', 'error', 'result']) {
      if (stage === 'error') await page.locator('[data-lp-check]').click();
      if (stage === 'result') { await pick(page); await page.locator('[data-lp-check]').click(); }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const clipped = await page.evaluate(() => [...document.querySelectorAll('p, label, legend, button, li, h2, h3')]
        .filter(el => el.getClientRects().length && !el.matches('[role="status"]') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)).map(el => el.textContent));
      expect(clipped).toEqual([]);
    }
  });
}

test('all right, all wrong, advanced credit and author refusal', async ({ page }) => {
  await open(page);
  for (const [values, count] of [
    [english.questions.map(q => q.correct), 4],
    [english.questions.map(q => q.options.find(o => o.id !== q.correct).id), 0],
    [['attendees', 'decide', 'wait', 'actions'], 3]
  ]) {
    await pick(page, values); await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-result]')).toHaveText(`You can skip ${count} of 4 sections.`);
    await page.locator('[data-lp-restart]').click();
  }
  await authored(page, { ...english, allowTestOut: false }); await pick(page, english.questions.map(q => q.correct)); await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-result]')).toHaveText('You can skip 0 of 4 sections.');
  await expect(page.locator('[data-lp-section-status]')).toHaveText(['To do', 'To do', 'To do', 'To do']);
  await expect(page.locator('[data-lp-policy]')).toContainText('The author requires every section.');
  await expect(page.locator('[data-lp-mark="correct"]')).toHaveCount(4); await scan(page);
});

test('French summary uses singular for one skippable section', async ({ page }) => {
  await open(page, '/test-out/fr.html');
  await pick(page, ['outcomes', 'decide', 'wait', 'next-meeting']);
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-result]')).toHaveText('Vous pouvez passer 1 section sur 4.');
});

test('reduced motion applies and new scene colours meet contrast', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page);
  await expect(page.locator('.lp-choice').first()).toHaveCSS('transition-duration', '0s');
  const [ink, paper] = await page.locator('.lp-test-out-icon').evaluate(el => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]);
  const luminance = rgb => rgb.match(/\d+/g).slice(0, 3).map(Number).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
  expect((luminance(paper) + .05) / (luminance(ink) + .05)).toBeGreaterThanOrEqual(3);
});

test('two questions group under their section, and hostile content stays literal', async ({ page }) => {
  await open(page);
  const content = structuredClone(english);
  content.questions.push({ ...content.questions[0], id: 'agenda-two', text: '<img src=x onerror=alert(1)> {section}', explanation: '<script>alert(1)</script>' });
  content.sections[0].title = '<b>{section}</b>';
  await authored(page, content);
  await expect(page.locator('[data-lp-section="1"] fieldset')).toHaveCount(2);
  await pick(page, ['outcomes', 'attendees', 'record', 'invite', 'actions']); await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-section-status]').first()).toHaveText('To do');
  await expect(page.locator('[data-lp-result]')).toHaveText('You can skip 3 of 4 sections.');
  await expect(page.locator('[data-lp-question="agenda-two"] [data-lp-explanation]')).toHaveText('<script>alert(1)</script>');
  await expect(page.locator('[data-lp-pattern] img, [data-lp-pattern] script, [data-lp-pattern] b')).toHaveCount(0);
});

for (const shown of [false, true]) {
  test(`saved picks restore silently shown=${shown}`, async ({ page }) => {
    await page.addInitScript(value => window.lpSeed = value, { picks: Object.fromEntries(english.questions.map((q, i) => [q.id, mixed[i]])), shown });
    await open(page); await expect(page.locator('input:checked')).toHaveCount(4); await expect(page.locator('[role="status"]')).toHaveText('');
    await expect(page.locator('[data-lp-result]')).toBeVisible({ visible: shown });
    await expect(page.locator('input:disabled')).toHaveCount(shown ? 12 : 0);
    if (shown) await expect(page.locator('[data-lp-result]')).toHaveText('You can skip 2 of 4 sections.');
  });
}

test('invalid state, independent instances, idempotent enhancement and destroy', async ({ page }) => {
  await page.addInitScript(() => window.lpSeed = { picks: { agenda: 'missing' }, shown: true });
  await open(page, '/test-out/two.html');
  await expect(page.locator('input:checked')).toHaveCount(0);
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await pick(roots.first()); await roots.first().locator('[data-lp-check]').click();
  await expect(roots.nth(1).locator('input:checked')).toHaveCount(0);
  await expect(roots.nth(1).locator('[data-lp-result]')).toBeHidden(); await scan(page);
  await page.evaluate(() => { window.lpInstances[0].destroy(); window.lpInstances[0].destroy(); });
  await expect(roots.first().locator('[data-lp-flow]')).toBeHidden(); await expect(roots.first().locator('[data-lp-fallback]')).toBeVisible();
  await expect(roots.first().locator('[data-lp-mark]')).toHaveCount(0);
  const before = await page.evaluate(() => window.lpSaved); await roots.first().locator('input').first().check();
  expect(await page.evaluate(() => window.lpSaved)).toEqual(before);
  await page.evaluate(() => window.lpEnhance());
  await expect(roots.first().locator('[data-lp-result]')).toHaveText('You can skip 2 of 4 sections.');
  await expect(roots.first().locator('[role="status"]')).toHaveText('');
});

test('missing and mismatched markup fail loudly before enhancement', async ({ page }) => {
  await open(page);
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/test-out/enhance.js'); const { strings } = await import('/patterns/test-out/strings.js');
    enhance(document.createElement('section'), { content, strings: strings.en });
  }, english)).rejects.toThrow('Missing test-out markup');
  for (const violation of ['radio', 'value', 'question', 'error', 'name', 'label', 'explanation', 'outline', 'status', 'id', 'tabindex']) {
    await open(page); await page.evaluate(kind => {
      window.lpInstances[0].destroy(); const first = document.querySelector('input'), fieldset = document.querySelector('fieldset');
      if (kind === 'radio') first.remove(); if (kind === 'value') first.value = 'bad';
      if (kind === 'question') fieldset.dataset.lpQuestion = 'bad';
      if (kind === 'error') document.querySelector('[data-lp-question-error]').remove();
      if (kind === 'name') document.querySelectorAll('fieldset')[1].querySelectorAll('input').forEach(el => el.name = first.name);
      if (kind === 'label') first.closest('label').replaceWith(first);
      if (kind === 'explanation') document.querySelector('[data-lp-explanation]').remove();
      if (kind === 'outline') document.querySelector('[data-lp-section-status]').remove();
      if (kind === 'status') document.querySelector('[data-lp-section-status]').dataset.lpSectionStatus = '99';
      if (kind === 'id') fieldset.removeAttribute('id'); if (kind === 'tabindex') fieldset.removeAttribute('tabindex');
    }, violation);
    await expect(page.evaluate(() => window.lpEnhance())).rejects.toThrow(/Invalid test-out|Missing test-out/);
  }
});

test('forced colours keep marks, keyboard focus and quiet reset visible', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page); await pick(page); await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-mark]').first()).toHaveCSS('border-style', 'double');
  await page.locator('[data-lp-restart]').press('Tab'); await page.locator('[data-lp-restart]').focus();
  await expect(page.locator('[data-lp-restart]')).toHaveCSS('outline-width', '2px');
  await page.locator('[data-lp-restart]').click(); await page.keyboard.press('Tab'); await page.locator('input').first().focus();
  await expect(page.locator('label').first()).toHaveCSS('outline-width', '2px');
});
