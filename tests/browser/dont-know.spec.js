import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const english = JSON.parse(await readFile(new URL('../../patterns/dont-know/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/dont-know/examples/fr.json', import.meta.url)));
const mixed = ['unexpected-expenses', 'no-interest', 'dont-know', 'plan-spending-saving'];

async function open(page, path = '/dont-know/en.html') {
  await page.goto(path);
  await page.waitForFunction(() => window.lpReady);
}
async function pick(root, values = mixed) {
  for (const [index, value] of values.entries()) await root.locator('fieldset').nth(index).locator(`input[value="${value}"]`).check();
}
async function observe(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    new MutationObserver(records => {
      for (const record of records) window.lpAnnouncements.push(record.target.textContent);
    }).observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}
const scan = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);

test('keyboard journey associates each unanswered error, focuses first missing radio and announces each result once', async ({ page }) => {
  await open(page); await observe(page);
  const questions = page.locator('fieldset');
  const check = page.locator('[data-lp-check]');
  await page.keyboard.press('Tab'); await expect(questions.nth(0).locator('input').first()).toBeFocused();
  // Select only the first question, then tab past the remaining radio groups.
  await page.keyboard.press('Space');
  for (let n = 0; n < 4; n++) await page.keyboard.press('Tab');
  await expect(check).toBeFocused(); await page.keyboard.press('Enter');
  await expect(questions.nth(1).locator('input').first()).toBeFocused();
  await expect(page.locator('[data-lp-error]')).toHaveText("3 questions unanswered. Choose an option, or I don't know.");
  for (let n = 1; n < 4; n++) {
    const fieldset = questions.nth(n);
    const id = await fieldset.getAttribute('aria-describedby');
    await expect(page.locator(`[id="${id}"]`)).toHaveText('Choose an answer');
    await expect(fieldset.locator('input').first()).toHaveAttribute('aria-describedby', id);
  }
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  await page.keyboard.press('Space'); await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab'); await page.keyboard.press('Space');
  await page.keyboard.press('Tab'); await expect(check).toBeFocused(); await page.keyboard.press('Enter');
  await expect(check).toBeFocused();
  await expect(page.locator('[data-lp-result] > p').first()).toHaveText('Score 1 out of 4.');
  await page.keyboard.press('Enter'); await expect(check).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-restart]')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(questions.first().locator('input').first()).toBeFocused();
  await expect(page.locator('input:checked')).toHaveCount(0);
  await expect(page.locator('[data-lp-result]')).toBeHidden(); await expect(page.locator('[data-lp-restart]')).toBeHidden();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Score 1 out of 4.', 'Score 1 out of 4.', 'Answers cleared.']);
});

for (const [lang, content, labels, counts] of [
  ['en', english, ['Wrong: review these first', "I don't know: gaps to fill", 'Right'], '2 right, 1 wrong, 1 "I don\'t know".'],
  ['fr', french, ["Mauvaises réponses : à revoir d'abord", 'Je ne sais pas : notions à apprendre', 'Bonnes réponses'], 'Bonnes réponses : 2, mauvaises réponses : 1, « Je ne sais pas » : 1.']
]) {
  test(`results show summary, counts, wrong explanation and choice, gaps, then right (${lang})`, async ({ page }) => {
    await open(page, `/dont-know/${lang}.html`); await observe(page);
    await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', lang);
    await expect(page.locator('[data-lp-restart]')).toBeHidden();
    for (const fieldset of await page.locator('fieldset').all()) await expect(fieldset.locator('label').last()).toHaveText(lang === 'en' ? "I don't know" : 'Je ne sais pas');
    await pick(page); await page.locator('[data-lp-check]').click();
    const result = page.locator('[data-lp-result]');
    await expect(result.locator(':scope > p').nth(1)).toHaveText(counts);
    await expect(result.getByRole('heading')).toHaveCount(3);
    for (const [index, label] of labels.entries()) await expect(result.getByRole('heading').nth(index)).toHaveAccessibleName(label);
    const groups = result.locator('[data-lp-group]');
    await expect(groups.nth(0)).toContainText(content.questions[1].text);
    const chosen = content.questions[1].options[0].text;
    await expect(groups.nth(0)).toContainText(lang === 'en' ? `You chose "${chosen}".` : `Vous avez choisi « ${chosen} ».`);
    await expect(groups.nth(0)).toContainText(content.questions[1].explanation);
    await expect(groups.nth(1)).toContainText(content.questions[2].text);
    await expect(groups.nth(1)).toContainText(content.questions[2].explanation);
    await expect(groups.nth(2).locator('li')).toHaveText([content.questions[0].text, content.questions[3].text]);
    await expect(result.locator('[aria-hidden="true"]')).toHaveCount(3);
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([lang === 'en' ? 'Score 1 out of 4.' : 'Score de 1 sur 4.']);
  });

  test(`no JavaScript provides native radios and every correct option and explanation (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage(); await page.goto(`/dont-know/${lang}.html`);
    await expect(page.getByRole('radio')).toHaveCount(16);
    await page.getByRole('radio').first().check(); await expect(page.getByRole('radio').first()).toBeChecked();
    await page.locator('summary').click(); await expect(page.locator('details')).toHaveAttribute('open', '');
    for (const q of content.questions) {
      await expect(page.locator('details')).toContainText(q.options.find(o => o.id === q.correct).text);
      await expect(page.locator('details')).toContainText(q.explanation);
    }
    await expect(page.locator('[data-lp-flow]')).toBeHidden(); await context.close();
  });

  test(`axe on unchanged server HTML with native answers open (${lang})`, async ({ page }) => {
    // axe needs scripting enabled. Block enhancement to audit the same native baseline.
    await page.route('**/dont-know/enhance.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export function enhance() { return { destroy() {} }; }' }));
    await open(page, `/dont-know/${lang}.html`);
    await scan(page); await page.locator('summary').click(); await scan(page);
  });

  test(`320 CSS pixels with text spacing has no scroll, clipping or overlap (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await open(page, `/dont-know/${lang}.html`);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    for (const stage of ['initial', 'error', 'result']) {
      if (stage === 'error') await page.locator('[data-lp-check]').click();
      if (stage === 'result') { await pick(page); await page.locator('[data-lp-check]').click(); }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const problems = await page.evaluate(() => [...document.querySelectorAll('p, label, legend, button, li, h2, h3')].filter(el => el.getClientRects().length && !el.matches('[role="status"]')).flatMap(el => {
        const failures = [];
        if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) failures.push(el.textContent);
        const children = [...el.children].filter(child => child.getClientRects().length);
        for (let i = 1; i < children.length; i++) {
          const a = children[i - 1].getBoundingClientRect(), b = children[i].getBoundingClientRect();
          if (Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1) failures.push('overlap: ' + el.textContent);
        }
        return failures;
      }));
      expect(problems).toEqual([]);
    }
  });
}

for (const path of ['/dont-know/en.html', '/dont-know/fr.html', '/dont-know/two.html']) {
  test(`axe at load, unanswered errors, mixed results and reset: ${path}`, async ({ page }) => {
    await open(page, path); await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-check]').click();
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) { await pick(root); await root.locator('[data-lp-check]').click(); }
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-restart]').click();
    await scan(page);
  });
}

test('all wrong uses true minus; empty groups say None; all unknown and all right are separate', async ({ page }) => {
  await open(page);
  await expect(page.locator('.lp-dont-know-rule')).toHaveText("Right +1, wrong −1, I don't know 0.");
  for (const [values, summary, empty] of [
    [english.questions.map(q => q.options.find(o => o.id !== q.correct).id), 'Score −4 out of 4.', [1, 2]],
    [english.questions.map(() => 'dont-know'), 'Score 0 out of 4.', [0, 2]],
    [english.questions.map(q => q.correct), 'Score 4 out of 4.', [0, 1]]
  ]) {
    await pick(page, values); await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-result] > p').first()).toHaveText(summary);
    for (const index of empty) await expect(page.locator('[data-lp-group]').nth(index).locator('p')).toHaveText('None.');
  }
});

test('authored fractional points reach the rule and total; feedback preserves hostile text and literal placeholders', async ({ page }) => {
  await open(page);
  await page.evaluate(async content => {
    const { render } = await import('/patterns/dont-know/render.js');
    const { enhance } = await import('/patterns/dont-know/enhance.js');
    const { strings } = await import('/patterns/dont-know/strings.js');
    window.lpInstances[0].destroy();
    content.points = { right: 2, wrong: -0.5, unknown: 0.25 };
    content.questions[1].options[0].text = '<img src=x onerror=alert(1)> {option} & "quoted"';
    content.questions[1].explanation = '<script>alert(1)</script> {total}';
    document.querySelector('main').innerHTML = render(content, strings.en, { id: 'authored', lang: 'en' });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
  }, english);
  await expect(page.locator('.lp-dont-know-rule')).toHaveText("Right +2, wrong −0.5, I don't know +0.25.");
  await pick(page); await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-result] > p').first()).toHaveText('Score 3.75 out of 8.');
  await expect(page.locator('[data-lp-group="wrong"] li p')).toHaveText(['You chose "<img src=x onerror=alert(1)> {option} & "quoted"".','<script>alert(1)</script> {total}']);
  await expect(page.locator('[data-lp-pattern] img, [data-lp-pattern] script')).toHaveCount(0);
});

test('reset uses a secondary button and theme tokens reach controls and focus', async ({ page }) => {
  await open(page); await pick(page); await page.locator('[data-lp-check]').click();
  const restart = page.locator('[data-lp-restart]');
  await expect(restart).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(restart).toHaveCSS('min-height', '44px');
  await page.locator('[data-lp-pattern]').evaluate(el => { el.style.setProperty('--lp-accent', '#123456'); el.style.setProperty('--lp-focus', '#654321'); });
  await expect(restart).toHaveCSS('color', 'rgb(18, 52, 86)'); await expect(restart).toHaveCSS('border-color', 'rgb(18, 52, 86)');
  for (const control of [page.locator('input').first(), page.locator('[data-lp-check]'), restart]) {
    await control.focus();
    await expect(control).toHaveCSS('outline-color', 'rgb(101, 67, 33)');
    await expect(control).toHaveCSS('outline-style', 'solid');
    await expect(control).toHaveCSS('outline-width', '2px');
  }
});

test('changing a pick clears stale results and announcements wait for submission; host saves changes', async ({ page }) => {
  await open(page); await observe(page); await pick(page); await page.locator('[data-lp-check]').click();
  await page.locator('fieldset').nth(1).locator('input[value="longer-more-interest"]').check();
  await expect(page.locator('[data-lp-result]')).toBeHidden(); await expect(page.locator('[data-lp-restart]')).toBeHidden();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: { q1: mixed[0], q2: 'longer-more-interest', q3: mixed[2], q4: mixed[3] }, shown: false });
  await page.locator('[data-lp-check]').click(); await expect(page.locator('[role="status"]')).toHaveText('Score 3 out of 4.');
  await page.locator('[data-lp-restart]').click();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: {}, shown: false });
  expect((await page.evaluate(() => window.lpAnnouncements)).filter(Boolean)).toEqual(['Score 1 out of 4.', 'Score 3 out of 4.', 'Answers cleared.']);
});

for (const shown of [false, true]) {
  test(`valid saved picks restore shown=${shown} silently`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, { picks: Object.fromEntries(english.questions.map((q, i) => [q.id, mixed[i]])), shown });
    await open(page); await expect(page.locator('input:checked')).toHaveCount(4);
    await expect(page.locator('[role="status"]')).toHaveText('');
    if (shown) { await expect(page.locator('[data-lp-result]')).toContainText('Score 1 out of 4.'); await expect(page.locator('[data-lp-restart]')).toBeVisible(); }
    else { await expect(page.locator('[data-lp-result]')).toBeHidden(); await expect(page.locator('[data-lp-restart]')).toBeHidden(); }
  });
}

for (const seed of [{ picks: { q1: 'bad' }, shown: false }, { picks: { q1: 'unexpected-expenses' }, shown: true }]) {
  test(`invalid saved state is ignored: ${JSON.stringify(seed)}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, seed); await open(page);
    await expect(page.locator('input:checked')).toHaveCount(0); await expect(page.locator('[data-lp-result]')).toBeHidden();
    await expect(page.locator('[data-lp-restart]')).toBeHidden(); await expect(page.locator('[role="status"]')).toHaveText('');
  });
}

test('two instances have unique ids and independent radio names, errors and results', async ({ page }) => {
  await open(page, '/dont-know/two.html');
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  await pick(roots.first()); await roots.first().locator('[data-lp-check]').click();
  await expect(roots.nth(1).locator('input:checked')).toHaveCount(0); await expect(roots.nth(1).locator('[data-lp-result]')).toBeHidden();
  await roots.nth(1).locator('[data-lp-check]').click();
  await expect(roots.first().locator('[data-lp-result]')).toBeVisible();
  await expect(roots.nth(1).locator('[data-lp-question-error]:visible')).toHaveCount(4);
});

test('enhance twice returns one instance; destroy removes listeners and safely restores fallback', async ({ page }) => {
  await open(page); expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await observe(page); await pick(page); await page.locator('[data-lp-check]').click();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Score 1 out of 4.']);
  await page.evaluate(() => window.lpInstances[0].destroy());
  await expect(page.locator('[data-lp-flow]')).toBeHidden(); await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  const before = await page.evaluate(() => window.lpSaved);
  await page.locator('input').first().check(); expect(await page.evaluate(() => window.lpSaved)).toEqual(before);
  await page.evaluate(() => { window.lpEnhance(); window.lpInstances[0].destroy(); });
  await expect(page.locator('[data-lp-flow]')).toBeVisible();
  expect(await page.evaluate(() => window.lpEnhance() === window.lpEnhance())).toBe(true);
  await pick(page); await page.locator('[data-lp-check]').click(); await expect(page.locator('[data-lp-group]')).toHaveCount(3);
});

test('missing and mismatched markup fail loudly', async ({ page }) => {
  await open(page);
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/dont-know/enhance.js');
    const { strings } = await import('/patterns/dont-know/strings.js');
    enhance(document.createElement('section'), { content, strings: strings.en });
  }, english)).rejects.toThrow('Missing dont-know markup');
  for (const violation of ['missing-radio', 'wrong-value', 'wrong-question', 'missing-error', 'duplicate-name']) {
    await open(page);
    await page.evaluate(kind => {
      window.lpInstances[0].destroy();
      if (kind === 'missing-radio') document.querySelector('input').remove();
      if (kind === 'wrong-value') document.querySelector('input').value = 'bad';
      if (kind === 'wrong-question') document.querySelector('fieldset').dataset.lpQuestion = 'bad';
      if (kind === 'missing-error') document.querySelector('[data-lp-question-error]').remove();
      if (kind === 'duplicate-name') document.querySelectorAll('fieldset')[1].querySelectorAll('input').forEach(el => el.name = document.querySelector('input').name);
    }, violation);
    await expect(page.evaluate(() => window.lpEnhance())).rejects.toThrow(/Invalid dont-know|Missing dont-know/);
  }
});

test('secondary reset and forced colours preserve focus rings and button distinction', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page); await pick(page); await page.locator('[data-lp-check]').click();
  for (const locator of [page.locator('input').first(), page.locator('[data-lp-check]'), page.locator('[data-lp-restart]')]) {
    await locator.focus();
    const style = await locator.evaluate(el => { const css = getComputedStyle(el); return [css.outlineWidth, css.outlineStyle, css.outlineOffset, css.outlineColor]; });
    expect(style.slice(0, 3)).toEqual(['2px', 'solid', '2px']); expect(style[3]).not.toBe('rgba(0, 0, 0, 0)');
  }
  await expect(page.locator('[data-lp-check]')).toHaveCSS('border-style', 'solid');
  await expect(page.locator('[data-lp-restart]')).toHaveCSS('border-style', 'dashed');
});

test('one unanswered question uses the singular message in English and French', async ({ page }) => {
  for (const [lang, text] of [['en', "1 question unanswered. Choose an option, or I don't know."], ['fr', '1 question sans réponse. Choisissez une option ou « Je ne sais pas ».']]) {
    await open(page, `/dont-know/${lang}.html`);
    await pick(page, mixed.slice(0, 3));
    await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-error]')).toHaveText(text);
  }
});
