import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const open = async (page, lang = 'en') => { await page.goto(`/minutes/${lang}.html`); await page.waitForFunction(() => window.lpReady); };
const row = page => page.locator('[data-lp-section]').first();
const scan = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
async function observe(page) {
  await page.evaluate(() => {
    window.lpObserver?.disconnect(); window.lpAnnouncements = [];
    window.lpObserver = new MutationObserver(records => records.forEach(record => window.lpAnnouncements.push(record.target.textContent)));
    window.lpObserver.observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}
async function author(page) { await page.getByRole('button', { name: 'Author view', exact: true }).click(); }

test('course outline has a scene header, breakdowns, clock estimates, warnings and total', async ({ page }) => {
  await open(page);
  await expect(page.locator('.lp-scene-label')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('The four horsemen');
  await expect(page.locator('[data-lp-minutes]')).toHaveText(['1 min', '3 min', '4 min', '3 min', '17 min']);
  await expect(row(page).locator('[data-lp-breakdown]')).toHaveText('120 words, 0 questions');
  await expect(page.locator('[data-lp-warning]:visible')).toHaveCount(1);
  await expect(page.locator('[data-lp-summary]')).toHaveText('Total 28 min. 1 section over 15 minutes.');
  await expect(page.getByRole('status')).toHaveText('');
  await expect(page.locator('[data-lp-inputs]:visible')).toHaveCount(0);
  for (const svg of await page.locator('svg').all()) await expect(svg).toHaveAttribute('aria-hidden', 'true');
  await scan(page);
});

test('keyboard toggle preserves focus; typing updates silently and committing announces once', async ({ page }) => {
  await open(page); await observe(page);
  const toggle = page.getByRole('button', { name: 'Author view', exact: true });
  await page.keyboard.press('Tab'); await expect(toggle).toBeFocused();
  await page.keyboard.press('Space'); await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab'); const words = row(page).getByRole('spinbutton', { name: /Words/ }); await expect(words).toBeFocused();
  await expect(words).toHaveCSS('outline-style', 'solid');
  await words.fill('3200');
  await expect(row(page).locator('[data-lp-minutes]')).toHaveText('16 min');
  await expect(row(page).locator('[data-lp-warning]')).toBeVisible();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  await words.press('Tab');
  await expect(page.getByRole('status')).toHaveText('Total 43 min. 2 sections over 15 minutes.');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Total 43 min. 2 sections over 15 minutes.']);
  expect(await page.evaluate(() => window.lpSaved.sections.intro.words)).toBe(3200);
  const narration = row(page).getByRole('spinbutton', { name: /Narration/ });
  await narration.fill('1200'); await narration.press('Tab');
  await expect(row(page).locator('[data-lp-minutes]')).toHaveText('20 min');
  const questions = row(page).getByRole('spinbutton', { name: /Questions/ });
  await questions.fill('4'); await questions.press('Tab');
  await expect(row(page).locator('[data-lp-minutes]')).toHaveText('23 min');
  await scan(page);
  await toggle.focus(); await toggle.press('Enter'); await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-lp-inputs]:visible')).toHaveCount(0);
  expect(await page.evaluate(() => window.lpSaved.authorView)).toBe(false);
});

test('exactly 15 minutes is allowed and zero content estimates zero', async ({ page }) => {
  await open(page); await author(page);
  const words = row(page).getByRole('spinbutton', { name: /Words/ });
  await words.fill('3000'); await words.press('Tab');
  await expect(row(page).locator('[data-lp-minutes]')).toHaveText('15 min');
  await expect(row(page).locator('[data-lp-warning]')).toBeHidden();
  await words.fill('0'); await words.press('Tab');
  await row(page).getByRole('spinbutton', { name: /Narration/ }).fill('0');
  await row(page).getByRole('spinbutton', { name: /Narration/ }).press('Tab');
  await expect(row(page).locator('[data-lp-minutes]')).toHaveText('0 min');
});

test('invalid fields show local authored feedback, suppress estimates and preserve valid saved counts', async ({ page }) => {
  await open(page); await author(page); await observe(page);
  const input = row(page).getByRole('spinbutton', { name: /Words/ });
  for (const value of ['', '-1', '1.5', '9007199254740992', '1e3']) {
    await input.fill(value);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    const errorId = await input.getAttribute('aria-describedby');
    await expect(page.locator(`[id="${errorId}"]`)).toBeVisible();
    await expect(row(page).locator('[data-lp-minutes]')).toHaveText('No estimate until fixed');
    await expect(row(page).locator('[data-lp-warning]')).toBeHidden();
    await input.dispatchEvent('change');
    await expect(page.getByRole('status')).toHaveText('Fix the highlighted numbers to see the total.');
    expect(await page.evaluate(() => window.lpSaved.sections.intro.words)).toBe(120);
  }
  await scan(page);
  await input.fill('1200'); await input.press('Tab');
  await expect(input).not.toHaveAttribute('aria-invalid');
  await expect(row(page).locator('[data-lp-breakdown]')).toHaveText('1,200 words, 0 questions');
  await expect(row(page).locator('[data-lp-minutes]')).toHaveText('6 min');
  await scan(page);
});

test('overflowing section and course estimates show errors and never save invalid counts', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const { render } = await import('/patterns/minutes/render.js');
    const { enhance } = await import('/patterns/minutes/enhance.js');
    const { strings } = await import('/patterns/minutes/strings.js');
    const content = { title: 'Boundary course', rates: { readingWordsPerMinute: 200, minutesPerQuestion: Number.MAX_SAFE_INTEGER },
      sections: ['one', 'two'].map(id => ({ id, title: id, words: 0, questions: 0, narrationSeconds: 0 })) };
    window.lpInstances[0].destroy();
    document.querySelector('main').innerHTML = render(content, strings.en, { id: 'boundary', lang: 'en' });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, state: { read: () => null, write: value => window.lpSaved = value } });
  });
  await author(page);
  const first = page.locator('[data-lp-section]').first().locator('[data-lp-field="questions"]');
  await first.fill('2'); await first.press('Tab');
  await expect(first).toHaveAttribute('aria-invalid', 'true');
  await expect(row(page).locator('[data-lp-minutes]')).toHaveText('No estimate until fixed');
  await expect(row(page).locator('[data-lp-error="questions"]')).toHaveText('These counts make the estimate too large. Enter smaller numbers.');
  expect(await page.evaluate(() => window.lpSaved.sections.one.questions)).toBe(0);
  await first.fill('1'); await first.press('Tab');
  await expect(first).not.toHaveAttribute('aria-invalid');
  const second = page.locator('[data-lp-section]').nth(1).locator('[data-lp-field="questions"]');
  await second.fill('1'); await second.press('Tab');
  await expect(page.locator('input[aria-invalid="true"]')).toHaveCount(6);
  await expect(page.locator('[data-lp-summary]')).toHaveText('Fix the highlighted numbers to see the total.');
  expect(await page.evaluate(() => window.lpSaved.sections.two.questions)).toBe(0);
  await second.fill('0'); await second.press('Tab');
  await expect(page.locator('input[aria-invalid="true"]')).toHaveCount(0);
});

test('hidden author fields ignore programmatic input and change events', async ({ page }) => {
  await open(page); await observe(page);
  await row(page).locator('input').first().evaluate(input => {
    input.value = '3200'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(row(page).locator('[data-lp-minutes]')).toHaveText('1 min');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  expect(await page.evaluate(() => window.lpSaved)).toBeUndefined();
});

for (const lang of ['en', 'fr']) {
  test(`axe at outline, author, changed and invalid stages (${lang})`, async ({ page }) => {
    await open(page, lang); await scan(page);
    await page.locator('[data-lp-toggle]').click(); await scan(page);
    const input = row(page).locator('input').first(); await input.fill('3200'); await input.press('Tab'); await scan(page);
    await input.fill('-1'); await input.press('Tab'); await scan(page);
  });
  test(`no JavaScript keeps all estimates and hides author controls (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage(); await page.goto(`/minutes/${lang}.html`);
    await expect(page.locator('[data-lp-minutes]')).toHaveText(['1 min', '3 min', '4 min', '3 min', '17 min']);
    await expect(page.getByRole('button')).toHaveCount(0); await expect(page.getByRole('spinbutton')).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveText(''); await context.close();
    const audit = await browser.newContext(); await audit.route('**/patterns/minutes/enhance.js', route => route.abort());
    const auditPage = await audit.newPage(); await auditPage.goto(`/minutes/${lang}.html`); await scan(auditPage); await audit.close();
  });
  test(`400% equivalent 320 CSS pixels with text spacing keeps inputs and chips readable (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await open(page, lang);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    await page.locator('[data-lp-toggle]').click();
    await row(page).locator('input').first().fill('-1'); await row(page).locator('input').first().press('Tab');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => [...document.querySelectorAll('p, button, label, h2, h3, [data-lp-minutes]')].filter(el => el.getClientRects().length && !el.matches('[role="status"]')).filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map(el => el.textContent))).toEqual([]);
  });
}

test('French estimates, field feedback and committed announcements use authored French', async ({ page }) => {
  await open(page, 'fr'); await observe(page);
  await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('.lp-scene-label')).toHaveCount(0);
  await page.getByRole('button', { name: 'Vue auteur' }).click();
  const input = row(page).getByRole('spinbutton', { name: /Mots/ });
  await input.fill('3200'); await input.press('Tab');
  await expect(row(page).locator('[data-lp-warning]')).toHaveText('Plus de 15 minutes');
  await expect(page.getByRole('status')).toHaveText('Total de 43 min. 2 sections de plus de 15 minutes.');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Total de 43 min. 2 sections de plus de 15 minutes.']);
  await input.fill('-1'); await input.press('Tab');
  await expect(row(page).locator('[data-lp-error="words"]')).toHaveText('Entrez un nombre entier de 0 ou plus.');
});

test('valid saved author inputs and toggle restore silently; host mutations cannot change current state', async ({ page }) => {
  await page.addInitScript(() => {
    window.lpSeed = { authorView: true, sections: {
      intro: { words: 3200, questions: 0, narrationSeconds: 60 }, horsemen: { words: 450, questions: 0, narrationSeconds: 180 },
      identify: { words: 150, questions: 4, narrationSeconds: 0 }, pause: { words: 220, questions: 1, narrationSeconds: 90 },
      reflection: { words: 300, questions: 3, narrationSeconds: 840 }
    } };
  });
  await open(page); await expect(page.locator('[data-lp-toggle]')).toHaveAttribute('aria-pressed', 'true');
  await expect(row(page).locator('[data-lp-minutes]')).toHaveText('16 min'); await expect(page.getByRole('status')).toHaveText('');
  await page.evaluate(() => window.lpSeed.sections.intro.words = 0);
  await page.locator('[data-lp-toggle]').click();
  await page.evaluate(() => window.lpSaved.sections.intro.words = 0);
  await page.locator('[data-lp-toggle]').click();
  expect(await page.evaluate(() => window.lpSaved.sections.intro.words)).toBe(3200);
});

test('invalid saved state is ignored as a whole', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { authorView: true, sections: { intro: { words: -1, questions: 0, narrationSeconds: 60 } } }; });
  await open(page); await expect(page.locator('[data-lp-toggle]')).toHaveAttribute('aria-pressed', 'false');
  await expect(row(page).locator('[data-lp-minutes]')).toHaveText('1 min'); await expect(page.getByRole('status')).toHaveText('');
});

test('two instances have independent inputs, estimates, toggles and unique ids', async ({ page }) => {
  await open(page, 'two'); const roots = page.locator('[data-lp-pattern]');
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  await roots.first().locator('[data-lp-toggle]').click();
  await roots.first().locator('input').first().fill('3200'); await roots.first().locator('input').first().press('Tab');
  await expect(roots.nth(1).locator('[data-lp-toggle]')).toHaveAttribute('aria-pressed', 'false');
  await expect(roots.nth(1).locator('[data-lp-minutes]').first()).toHaveText('1 min');
  await expect(roots.nth(1).getByRole('status')).toHaveText(''); await scan(page);
});

test('idempotent enhancement and destruction keep the outline and remove old listeners', async ({ page }) => {
  await open(page); await observe(page); expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await author(page); const input = row(page).locator('input').first(); await input.fill('3200'); await input.press('Tab');
  expect(await page.evaluate(() => window.lpAnnouncements.length)).toBe(1);
  await page.evaluate(() => { window.lpOld = window.lpInstances[0]; window.lpOld.destroy(); window.lpOld.destroy(); });
  await expect(page.locator('[data-lp-toggle]')).toBeHidden(); await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await expect(row(page).locator('[data-lp-minutes]')).toHaveText('16 min'); await expect(page.getByRole('status')).toHaveText('');
  await input.evaluate(el => { el.value = '0'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await expect(row(page).locator('[data-lp-minutes]')).toHaveText('16 min');
  await page.evaluate(() => { window.lpEnhance(); window.lpOld.destroy(); });
  await expect(page.locator('[data-lp-toggle]')).toHaveAttribute('aria-pressed', 'true');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('3200');
  await observe(page); await input.fill('120'); await input.press('Tab');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Total 28 min. 1 section over 15 minutes.']);
});

test('destroying an invalid draft leaves a usable outline with the last valid estimates', async ({ page }) => {
  await open(page); await author(page);
  const input = row(page).locator('input').first();
  await input.fill('1200'); await input.press('Tab');
  await input.fill('-1'); await input.press('Tab');
  await expect(row(page).locator('[data-lp-minutes]')).toHaveText('No estimate until fixed');
  await page.evaluate(() => window.lpInstances[0].destroy());
  await expect(row(page).locator('[data-lp-minutes]')).toHaveText('6 min');
  await expect(page.locator('[data-lp-summary]')).toHaveText('Total 33 min. 1 section over 15 minutes.');
  await expect(page.getByRole('spinbutton')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('');
});

test('planted missing and mismatched markup errors occur before controls are revealed', async ({ page }) => {
  await open(page);
  const result = await page.evaluate(async () => {
    const { enhance } = await import('/patterns/minutes/enhance.js');
    const { strings } = await import('/patterns/minutes/strings.js');
    const original = document.querySelector('[data-lp-pattern]');
    const content = { title: 'A course', rates: { readingWordsPerMinute: 200, minutesPerQuestion: 0.75 }, sections: [...original.querySelectorAll('[data-lp-section]')].map(el => ({ id: el.dataset.lpSection, title: 'Section', words: 0, questions: 0, narrationSeconds: 0 })) };
    const outcomes = [];
    for (const kind of ['empty', 'identity', 'count', 'field count', 'field identity', 'field type', '[role="status"]', '[data-lp-toggle]', '[data-lp-instruction]', '[data-lp-summary]', '[data-lp-inputs]', '[data-lp-minutes]', '[data-lp-breakdown]', '[data-lp-warning]', '[data-lp-error="words"] span', '[data-lp-error="words"]']) {
      const root = original.cloneNode(true); root.querySelector('[data-lp-toggle]').hidden = true;
      if (kind === 'empty') root.replaceChildren();
      else if (kind === 'identity') root.querySelector('[data-lp-section]').dataset.lpSection = 'other';
      else if (kind === 'count') root.querySelector('[data-lp-section]').remove();
      else if (kind === 'field count') root.querySelector('input').remove();
      else if (kind === 'field identity') root.querySelector('input').dataset.lpField = 'other';
      else if (kind === 'field type') root.querySelector('input').type = 'text';
      else root.querySelector(kind).remove();
      try { enhance(root, { content, strings: strings.en }); outcomes.push({ kind, error: '' }); }
      catch (error) { outcomes.push({ kind, error: error.message, hidden: root.querySelector('[data-lp-toggle]')?.hidden ?? true }); }
    }
    return outcomes;
  });
  for (const outcome of result) { expect(outcome.error, outcome.kind).toMatch(/minutes markup/); expect(outcome.hidden, outcome.kind).toBe(true); }
});

test('forced colours preserves readable chips, warning words and keyboard focus', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Chromium emulates forced colours');
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' }); await open(page); await author(page);
  await row(page).locator('input').first().focus(); await expect(row(page).locator('input').first()).toHaveCSS('outline-style', 'solid');
  await expect(page.locator('[data-lp-warning]:visible')).toHaveText('Over 15 minutes'); await scan(page);
});

for (const lang of ['en', 'fr']) {
  test('owner audit: counts appear once and return after destroy (' + lang + ')', async ({ page }) => {
    await open(page, lang);
    await expect(page.locator('[data-lp-breakdown]:visible')).toHaveCount(5);
    await page.locator('[data-lp-toggle]').click();
    await expect(page.locator('[data-lp-breakdown]:visible')).toHaveCount(0);
    await expect(page.locator('[data-lp-inputs]:visible')).toHaveCount(5);
    await page.locator('[data-lp-toggle]').click();
    await expect(page.locator('[data-lp-breakdown]:visible')).toHaveCount(5);
    await page.locator('[data-lp-toggle]').click();
    await page.evaluate(() => window.lpInstances[0].destroy());
    await expect(page.locator('[data-lp-breakdown]:visible')).toHaveCount(5);
    await expect(page.locator('[data-lp-inputs]:visible')).toHaveCount(0);
  });
}
for (const width of [1280, 390, 320]) {
  test('owner audit: time badge stays beside the first title line at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await open(page, 'fr');
    const positions = await row(page).evaluate(el => {
      const title = el.querySelector('h3').getBoundingClientRect(), chip = el.querySelector('[data-lp-minutes]').getBoundingClientRect();
      return { titleTop: title.top, chipTop: chip.top, titleRight: title.right, chipLeft: chip.left };
    });
    expect(Math.abs(positions.titleTop - positions.chipTop)).toBeLessThanOrEqual(1);
    expect(positions.titleRight).toBeLessThanOrEqual(positions.chipLeft);
  });
}
