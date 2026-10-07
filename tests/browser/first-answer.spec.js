import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const FIRST = '2026-10-06T09:05:00.000Z';
const END = '2026-10-07T09:40:00.000Z';
const checks = { specific: false, behaviour: false, view: false };
const seed = { first: { text: 'Stop interrupting me.', savedAt: FIRST }, now: { text: 'When you cut in, I lose my thread. What is happening for you?', savedAt: END }, checks: { ...checks, view: true } };

async function open(page, path = '/first-answer/en.html') {
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
async function saveFirst(root) {
  await root.locator('[data-lp-first-input]').fill('Stop interrupting me.');
  await root.locator('[data-lp-save-first]').click();
}
async function compare(root) {
  await root.locator('[data-lp-now-input]').fill('When you cut in, I lose my thread. What is happening for you?');
  await root.locator('[data-lp-compare]').click();
}
async function scan(page) {
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
}
// Exercise optional render placements through the exported interface, without new demo routes.
async function mount(page, stages, value = undefined, mode = '') {
  await open(page);
  await page.evaluate(async ({ stages, value, mode }) => {
    const { render } = await import('../patterns/first-answer/render.js');
    const { enhance } = await import('../patterns/first-answer/enhance.js');
    const { strings } = await import('../patterns/first-answer/strings.js');
    const content = { prompt: 'What would you say to a colleague who keeps interrupting you?', checks: [{ id: 'specific', label: 'More specific' }, { id: 'behaviour', label: 'Describes the behaviour, not the person' }, { id: 'view', label: 'Asks for their view' }] };
    window.lpInstances.forEach(instance => instance.destroy());
    document.querySelector('main').innerHTML = '<h1>Your first answer comes back</h1>' + stages.map((stage, index) => render(content, strings.en, { id: `stage-${index}`, lang: 'en', stage })).join('');
    window.lpSaved = value; window.lpWrites = 0; window.lpFailRead = mode === 'read'; window.lpFailWrite = mode === 'write';
    const state = {
      read() { if (window.lpFailRead) throw new Error('read failed'); return window.lpSaved; },
      write(next) { window.lpWrites++; if (window.lpFailWrite) throw new Error('write failed'); window.lpSaved = next; }
    };
    window.lpInstances = [...document.querySelectorAll('[data-lp-pattern]')].map(root => enhance(root, { content, strings: strings.en, ...(mode === 'none' ? {} : { state }) }));
    window.lpEnhance = () => enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, state });
  }, { stages, value, mode });
}

test('keyboard journey links blank errors and announces successful submissions once without moving feedback focus', async ({ page }) => {
  await open(page); await observe(page);
  const first = page.locator('[data-lp-first-input]'); const save = page.locator('[data-lp-save-first]');
  await page.keyboard.press('Tab'); await expect(first).toBeFocused();
  await page.keyboard.press('Tab'); await expect(save).toBeFocused(); await page.keyboard.press('Enter');
  await expect(first).toBeFocused(); await expect(first).toHaveAttribute('aria-invalid', 'true');
  const errorId = await first.getAttribute('aria-describedby');
  await expect(page.locator(`[id="${errorId}"]`)).toHaveText('Write an answer first.');
  await page.keyboard.type('Stop interrupting me.');
  // Feedback changes on submission, not typing.
  await expect(page.locator('[data-lp-first-error]')).toBeVisible();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(save).toBeFocused(); await expect(page.locator('[data-lp-first-quote]')).toHaveText('Stop interrupting me.');
  await expect(page.locator('[data-lp-first-date]')).toContainText('It stays as you wrote it.');
  await expect(first).not.toHaveAttribute('aria-invalid', 'true');
  await expect(save).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-skip]')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('[data-lp-end-heading]')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-now-input]')).toBeFocused();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-now-input]')).toBeFocused();
  await expect(page.locator('[data-lp-now-input]')).toHaveAttribute('aria-describedby', 'example-now-error');
  await page.keyboard.type('Can I finish my thought?'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-compare]')).toBeFocused();
  await expect(page.locator('[data-lp-panel-first]')).toHaveText('Stop interrupting me.');
  await expect(page.locator('[data-lp-panel-now]')).toHaveText('Can I finish my thought?');
  await page.keyboard.press('Tab'); await expect(page.getByRole('checkbox').first()).toBeFocused(); await page.keyboard.press('Space');
  await expect(page.locator('[data-lp-summary]')).toHaveText('You ticked 1 of 3 checks for your answer now.');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-restart]')).toBeFocused(); await page.keyboard.press('Enter');
  await expect(first).toBeFocused(); await expect(first).toHaveValue('');
  await expect(page.locator('[data-lp-restart]')).toBeHidden(); await expect(page.locator('[data-lp-result]')).toBeHidden();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ first: null, now: null, checks });
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['First answer saved.', 'Compared. Tick what changed.', 'Started over.']);
});

for (const path of ['/first-answer/en.html', '/first-answer/fr.html', '/first-answer/two.html']) {
  test(`axe at load, saved, end and comparison: ${path}`, async ({ page }) => {
    await open(page, path); await scan(page);
    // The scaffold demo shares one host adapter; second instance sees its saved first.
    for (const root of await page.locator('[data-lp-pattern]').all()) await saveFirst(root);
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) {
      if (await root.locator('[data-lp-skip]').isVisible()) await root.locator('[data-lp-skip]').click();
    }
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await compare(root);
    await scan(page);
  });
}

test('comparing twice preserves first and checks, replaces only now, and repeats one announcement', async ({ page }) => {
  await open(page); await observe(page); await saveFirst(page); await page.locator('[data-lp-skip]').click(); await compare(page);
  await page.getByRole('checkbox').nth(2).check();
  const before = await page.evaluate(() => window.lpSaved);
  await page.locator('[data-lp-now-input]').fill('Second try');
  await expect(page.locator('[data-lp-panel-now]')).toHaveText(before.now.text);
  expect(await page.evaluate(() => window.lpSaved)).toEqual(before);
  await page.locator('[data-lp-compare]').click();
  const after = await page.evaluate(() => window.lpSaved);
  expect(after.first).toEqual(before.first); expect(after.checks).toEqual(before.checks); expect(after.now.text).toBe('Second try');
  await expect(page.locator('[data-lp-panel-now]')).toHaveText('Second try');
  await expect(page.locator('[data-lp-result]')).toHaveCount(1);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['First answer saved.', 'Compared. Tick what changed.', 'Compared. Tick what changed.']);
});

test('2000 characters accepted; programmatically overlong text refused without writing', async ({ page }) => {
  await mount(page, ['both']);
  await expect(page.locator('[data-lp-first-input]')).toHaveAttribute('maxlength', '2000');
  await page.locator('[data-lp-first-input]').evaluate(el => { el.value = 'x'.repeat(2001); });
  await page.locator('[data-lp-save-first]').click();
  await expect(page.locator('[data-lp-first-error]')).toHaveText('Keep your answer to 2000 characters or fewer.');
  expect(await page.evaluate(() => window.lpWrites)).toBe(0);
  await page.locator('[data-lp-first-input]').fill('x'.repeat(2000)); await page.locator('[data-lp-save-first]').click();
  expect((await page.evaluate(() => window.lpSaved)).first.text.length).toBe(2000);
});

for (const [lang, savedNote, summary] of [['en', 'It stays as you wrote it.', 'You ticked 1 of 3 checks for your answer now.'], ['fr', "Elle reste telle que vous l'avez écrite.", 'Vous avez coché 1 des 3 critères pour votre réponse maintenant.']]) {
  test(`restore valid state silently with localized dates (${lang})`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, seed);
    await open(page, `/first-answer/${lang}.html`);
    await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', lang);
    await expect(page.locator('[role="status"]')).toBeEmpty();
    await expect(page.locator('[data-lp-end-step]')).toBeVisible(); await expect(page.locator('[data-lp-skip]')).toBeHidden();
    await expect(page.locator('[data-lp-first-date]')).toContainText(savedNote);
    await expect(page.locator('[data-lp-panel-first]')).toHaveText(seed.first.text);
    await expect(page.locator('[data-lp-panel-now]')).toHaveText(seed.now.text);
    await expect(page.getByRole('checkbox').nth(2)).toBeChecked();
    await expect(page.locator('[data-lp-summary]')).toHaveText(summary);
    const dates = await page.evaluate(({ lang, first, now }) => [first, now].map(date => new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))), { lang, first: FIRST, now: END });
    await expect(page.locator('[data-lp-panel-first-date]')).toHaveText(dates[0]); await expect(page.locator('[data-lp-panel-now-date]')).toHaveText(dates[1]);
    await scan(page);
  });
}

for (const value of [{}, 'not JSON', { ...seed, checks: { ...checks, view: 'yes' } }, { ...seed, first: { text: 'Stop.', savedAt: 'yesterday' } }]) {
  test(`invalid state visibly reported and no write until reset: ${JSON.stringify(value)}`, async ({ page }) => {
    await mount(page, ['both'], value); await observe(page);
    await expect(page.locator('[data-lp-storage-error]')).toHaveText("Your saved answers couldn't be read. Start over to replace them.");
    await expect(page.locator('[data-lp-first-quote]')).toBeHidden();
    await saveFirst(page); expect(await page.evaluate(() => window.lpWrites)).toBe(0);
    expect(await page.evaluate(() => window.lpSaved)).toEqual(value);
    await expect(page.locator('[role="status"]')).toBeEmpty();
    await scan(page);
    await page.locator('[data-lp-restart]').click(); await expect(page.locator('[data-lp-first-input]')).toBeFocused();
    await expect(page.locator('[data-lp-storage-error]')).toBeHidden(); await saveFirst(page);
    expect((await page.evaluate(() => window.lpSaved)).first.text).toBe('Stop interrupting me.');
  });
}

test('thrown host reads block writes; a deliberate reset recovers', async ({ page }) => {
  await mount(page, ['both'], seed, 'read'); await saveFirst(page);
  expect(await page.evaluate(() => window.lpWrites)).toBe(0); expect(await page.evaluate(() => window.lpSaved)).toEqual(seed);
  await expect(page.locator('[data-lp-storage-error]')).toBeVisible();
  await page.evaluate(() => { window.lpFailRead = false; });
  await page.locator('[data-lp-restart]').click(); await saveFirst(page);
  expect((await page.evaluate(() => window.lpSaved)).first.text).toBe('Stop interrupting me.');
});

test('failed save, compare, checkbox and reset preserve record and expose visible errors', async ({ page }) => {
  await mount(page, ['both'], undefined, 'write'); await observe(page); await saveFirst(page);
  await expect(page.locator('[data-lp-first-input]')).toBeVisible();
  await expect(page.locator('[data-lp-storage-error]')).toHaveText("Your answers couldn't be saved. Nothing changed. Try again.");
  await expect(page.locator('[role="status"]')).toHaveText("Your answers couldn't be saved. Nothing changed. Try again.");
  await page.evaluate(() => { window.lpFailWrite = false; }); await saveFirst(page);
  const first = await page.evaluate(() => window.lpSaved);
  await page.locator('[data-lp-skip]').click(); await page.evaluate(() => { window.lpFailWrite = true; }); await compare(page);
  expect(await page.evaluate(() => window.lpSaved)).toEqual(first); await expect(page.locator('[data-lp-result]')).toBeHidden();
  await page.evaluate(() => { window.lpFailWrite = false; }); await page.locator('[data-lp-compare]').click();
  const compared = await page.evaluate(() => window.lpSaved);
  await page.evaluate(() => { window.lpFailWrite = true; }); await page.getByRole('checkbox').first().click();
  await expect(page.getByRole('checkbox').first()).not.toBeChecked(); expect(await page.evaluate(() => window.lpSaved)).toEqual(compared);
  await page.locator('[data-lp-restart]').click(); expect(await page.evaluate(() => window.lpSaved)).toEqual(compared);
  await expect(page.locator('[data-lp-panel-first]')).toHaveText(compared.first.text);
  await expect(page.locator('[data-lp-panel-now]')).toHaveText(compared.now.text);
  await page.evaluate(() => { window.lpFailWrite = false; }); await page.locator('[data-lp-restart]').click();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ first: null, now: null, checks });
});

test('end only allows a current answer with no saved first; reset focuses current textarea', async ({ page }) => {
  await mount(page, ['end']); await observe(page);
  await expect(page.locator('[data-lp-skip]')).toHaveCount(0); await expect(page.locator('[data-lp-missing]')).toBeVisible();
  await expect(page.locator('[data-lp-now-input]')).toBeVisible(); await scan(page); await compare(page);
  expect((await page.evaluate(() => window.lpSaved)).first).toBeNull();
  await expect(page.locator('[data-lp-panel-first]')).toHaveText("Your first answer wasn't saved, so there's nothing to compare yet.");
  await expect(page.locator('[data-lp-panel-first-date]')).toBeEmpty(); await expect(page.getByRole('checkbox')).toHaveCount(3); await scan(page);
  await page.getByRole('checkbox').nth(2).check(); await page.locator('[data-lp-restart]').click();
  await expect(page.locator('[data-lp-now-input]')).toBeFocused(); await expect(page.locator('[data-lp-now-input]')).toHaveValue('');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Compared. Tick what changed.', 'Started over.']);
});

test('first and end placements share state across course pages', async ({ page }) => {
  await mount(page, ['first']); await expect(page.locator('[data-lp-end-step]')).toHaveCount(0); await saveFirst(page);
  const saved = await page.evaluate(() => window.lpSaved); await mount(page, ['end'], saved);
  await expect(page.locator('[data-lp-first-step]')).toHaveCount(0); await expect(page.locator('[data-lp-missing]')).toBeHidden();
  await compare(page); expect((await page.evaluate(() => window.lpSaved)).first).toEqual(saved.first);
});

test('stale instances cannot replace the first answer; reread preserves latest checks', async ({ page }) => {
  await mount(page, ['first', 'both']);
  const roots = page.locator('[data-lp-pattern]'); await saveFirst(roots.nth(0));
  await roots.nth(1).locator('[data-lp-first-input]').fill('Overwrite'); await roots.nth(1).locator('[data-lp-save-first]').click();
  expect((await page.evaluate(() => window.lpSaved)).first.text).toBe('Stop interrupting me.');
  await compare(roots.nth(1)); await roots.nth(1).getByRole('checkbox').nth(2).check();
  await roots.nth(0).locator('[data-lp-restart]').click();
  await roots.nth(1).locator('[data-lp-now-input]').fill('After reset'); await roots.nth(1).locator('[data-lp-compare]').click();
  expect(await page.evaluate(() => window.lpSaved)).toMatchObject({ first: null, now: { text: 'After reset' }, checks });
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
});

test('enhance twice keeps nodes and one listener; destroy restores baseline and can reenhance', async ({ page }) => {
  await mount(page, ['both']); await observe(page);
  expect(await page.evaluate(() => { window.lpTextarea = document.querySelector('[data-lp-first-input]'); return window.lpEnhance() === window.lpInstances[0]; })).toBe(true);
  await saveFirst(page); expect(await page.evaluate(() => window.lpWrites)).toBe(1);
  expect(await page.evaluate(() => window.lpTextarea === document.querySelector('[data-lp-first-input]'))).toBe(true);
  await page.evaluate(() => { window.lpInstances[0].destroy(); window.lpInstances[0].destroy(); });
  await expect(page.locator('[data-lp-fallback]')).toBeVisible(); await expect(page.locator('[data-lp-first-input]')).toBeVisible();
  await expect(page.locator('[data-lp-save-first]')).toBeHidden(); await expect(page.locator('[data-lp-end-step]')).toBeHidden();
  await page.locator('[data-lp-save-first]').evaluate(el => { el.click(); }); expect(await page.evaluate(() => window.lpWrites)).toBe(1);
  await page.evaluate(() => { window.lpInstances = [window.lpEnhance()]; });
  await expect(page.locator('[data-lp-first-quote]')).toHaveText('Stop interrupting me.');
});

test('no state adapter supports the complete interaction in memory', async ({ page }) => {
  await mount(page, ['both'], undefined, 'none'); await saveFirst(page); await page.locator('[data-lp-skip]').click(); await compare(page);
  await expect(page.locator('[data-lp-panel-first]')).toHaveText('Stop interrupting me.');
  await expect(page.locator('[data-lp-result]')).toBeVisible();
  await page.locator('[data-lp-restart]').click(); await expect(page.locator('[data-lp-first-input]')).toHaveValue('');
});

test('host becoming unreadable after load blocks comparison and retains saved first', async ({ page }) => {
  await mount(page, ['both']); await saveFirst(page); await page.locator('[data-lp-skip]').click();
  const saved = await page.evaluate(() => window.lpSaved); await page.evaluate(() => { window.lpFailRead = true; }); await compare(page);
  expect(await page.evaluate(() => window.lpSaved)).toEqual(saved); expect(await page.evaluate(() => window.lpWrites)).toBe(1);
  await expect(page.locator('[data-lp-storage-error]')).toBeVisible(); await expect(page.locator('[data-lp-first-quote]')).toHaveText(saved.first.text);
});

test('missing or mismatched server markup fails loudly through enhance', async ({ page }) => {
  await open(page);
  const failures = await page.evaluate(async () => {
    const { enhance } = await import('../patterns/first-answer/enhance.js');
    const { render } = await import('../patterns/first-answer/render.js');
    const { strings } = await import('../patterns/first-answer/strings.js');
    const content = { prompt: 'A', checks: [{ id: 'a', label: 'B' }] };
    return ['', render(content, strings.en, { id: 'bad', lang: 'en' }).replace('value="a"', 'value="unknown"')].map(markup => {
      const wrapper = document.createElement('div'); wrapper.innerHTML = markup;
      try { enhance(wrapper.firstElementChild || wrapper, { content, strings: strings.en }); return ''; } catch (error) { return error.message; }
    });
  });
  expect(failures[0]).toMatch(/markup|stage/); expect(failures[1]).toMatch(/checks markup/);
});

for (const lang of ['en', 'fr']) {
  test(`no JavaScript keeps prompt, first textarea and saving note (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage();
    await page.goto(`/first-answer/${lang}.html`);
    await expect(page.getByRole('textbox')).toHaveCount(1); await expect(page.getByRole('textbox')).toHaveAttribute('maxlength', '2000');
    await page.getByRole('textbox').fill('My offline draft');
    await expect(page.locator('[data-lp-fallback]')).toHaveText(lang === 'en' ? 'Saving your answer needs JavaScript.' : 'JavaScript est nécessaire pour enregistrer votre réponse.');
    await expect(page.getByRole('button')).toHaveCount(0); await expect(page.locator('[role="status"]')).toBeEmpty();
    // Axe needs JavaScript. Audit the same server baseline with enhancement blocked.
    const auditContext = await browser.newContext(); const auditPage = await auditContext.newPage();
    await auditPage.route('**/enhance.js', route => route.abort());
    await auditPage.goto(`/first-answer/${lang}.html`);
    await expect(auditPage.getByRole('textbox')).toHaveCount(1);
    await expect(auditPage.getByRole('button')).toHaveCount(0); await scan(auditPage);
    await auditContext.close();
    await context.close();
  });
}

for (const lang of ['en', 'fr']) {
  test(`320px and text spacing have no overflow or clipped controls at every stage (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 }); await open(page, `/first-answer/${lang}.html`);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    const fits = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const bad = await page.locator('[data-lp-pattern] :is(button, textarea, fieldset, label, h2, h3)').evaluateAll(elements => elements.filter(el => {
        if (!el.getClientRects().length) return false;
        const rect = el.getBoundingClientRect();
        return rect.left < 0 || rect.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 2;
      }).map(el => el.outerHTML));
      expect(bad).toEqual([]);
    };
    await fits(); await saveFirst(page); await fits(); await page.locator('[data-lp-skip]').click(); await fits(); await compare(page); await fits();
    const panels = await page.locator('.lp-first-answer-panel').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().top)); expect(panels[1]).toBeGreaterThan(panels[0]);
  });
}

test('desktop comparison panels are side by side and theme tokens reach secondary buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 }); await open(page); await saveFirst(page); await page.locator('[data-lp-skip]').click(); await compare(page);
  const panels = await page.locator('.lp-first-answer-panel').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().top)); expect(panels[1]).toBe(panels[0]);
  await page.locator('[data-lp-pattern]').evaluate(el => el.style.setProperty('--lp-accent', '#123456'));
  const restart = page.locator('[data-lp-restart]');
  expect(await restart.evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color, getComputedStyle(el).borderColor])).toEqual(['rgba(0, 0, 0, 0)', 'rgb(18, 52, 86)', 'rgb(18, 52, 86)']);
});

test('Chromium forced colours keeps focus rings, borders and secondary distinction', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced-colour emulation is checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page); await saveFirst(page);
  for (const selector of ['[data-lp-save-first]', '[data-lp-skip]', '[data-lp-restart]']) {
    await page.locator(selector).focus();
    expect(await page.locator(selector).evaluate(el => [getComputedStyle(el).outlineWidth, getComputedStyle(el).outlineStyle, getComputedStyle(el).outlineOffset])).toEqual(['2px', 'solid', '2px']);
  }
  await page.locator('[data-lp-skip]').click(); await expect(page.locator('[data-lp-end-heading]')).toBeFocused();
  expect(await page.locator('[data-lp-end-heading]').evaluate(el => getComputedStyle(el).outlineWidth)).toBe('2px');
  const colors = await page.evaluate(() => {
    const span = document.createElement('span'); document.body.append(span); const result = {};
    for (const name of ['ButtonText', 'ButtonFace', 'Highlight']) { span.style.color = name; result[name] = getComputedStyle(span).color; }
    span.remove(); return result;
  });
  for (const selector of ['[data-lp-compare]', '[data-lp-restart]']) {
    await page.locator(selector).focus();
    const css = await page.locator(selector).evaluate(el => { const style = getComputedStyle(el); return [style.color, style.backgroundColor, style.borderColor, style.borderWidth, style.outlineColor]; });
    expect(css).toEqual([colors.ButtonText, colors.ButtonFace, colors.ButtonText, '1px', colors.Highlight]);
  }
  expect(await page.locator('[data-lp-compare]').evaluate(el => getComputedStyle(el).borderStyle)).toBe('solid');
  expect(await page.locator('[data-lp-restart]').evaluate(el => getComputedStyle(el).borderStyle)).toBe('dashed');
});
