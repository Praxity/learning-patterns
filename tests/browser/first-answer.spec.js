import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const FIRST = '2026-10-06T09:05:00.000Z';
const END = '2026-10-07T09:40:00.000Z';
const checks = { specific: false, behaviour: false, view: false };
const seed = { first: { text: 'Stop interrupting me.', savedAt: FIRST }, now: { text: 'When you cut in, I lose my thread. What is happening for you?', savedAt: END }, checks: { ...checks, view: true } };

test('shared scene spans the journal card and centres its tile on the prompt', async ({ page }) => {
  await open(page);
  await expect(page.locator('.lp-scene-label')).toHaveCount(0);
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

for (const width of [1280, 390, 320]) {
  test(`journal timeline shares one axis and has no saved-entry rule at ${width}px with text spacing`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await open(page);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    await saveFirst(page);
    const geometry = await page.locator('[data-lp-course]').evaluate(el => {
      const rect = el.getBoundingClientRect();
      const line = getComputedStyle(el, '::before');
      const icon = el.querySelector('svg').getBoundingClientRect();
      const note = el.querySelector('p').getBoundingClientRect();
      const button = el.querySelector('button').getBoundingClientRect();
      return {
        lineX: rect.left + parseFloat(line.left) + parseFloat(line.borderLeftWidth) / 2,
        iconX: icon.left + icon.width / 2,
        top: line.top, bottom: line.bottom,
        iconTop: icon.top - rect.top, iconBottom: icon.bottom - rect.top, height: rect.height,
        noteX: note.left, buttonX: button.left
      };
    });
    expect(Math.abs(geometry.lineX - geometry.iconX)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.noteX - geometry.buttonX)).toBeLessThanOrEqual(1);
    expect(geometry.noteX).toBeGreaterThan(geometry.lineX);
    expect(geometry.top).toBe('0px'); expect(geometry.bottom).toBe('0px');
    expect(geometry.iconTop).toBeGreaterThan(0); expect(geometry.iconBottom).toBeLessThan(geometry.height);
    await expect(page.locator('.lp-first-answer-history')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('[data-lp-first-saved]')).toHaveCSS('border-left-width', '0px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('[data-lp-skip]').click(); await compare(page);
    await expect(page.locator('[data-lp-panel-first-card]')).toHaveCSS('border-left-width', '0px');
  });
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

for (const [lang, journal, day, end, note] of [
  ['en', 'Your journal', 'Day one', 'End of the course', 'It stays as you wrote it.'],
  ['fr', 'Votre journal', 'Premier jour', 'Fin du cours', "Elle reste telle que vous l'avez écrite."]
]) {
  test(`journal scene, dated entry and course timeline (${lang})`, async ({ page }) => {
    await open(page, `/first-answer/${lang}.html`);
    const scene = page.locator('.lp-scene');
    await expect(scene.locator('.lp-scene-label')).toHaveCount(0);
    await expect(scene.getByRole('heading')).toHaveCount(1);
    await expect(scene.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('[data-lp-first-step]').getByRole('heading')).toHaveText(day);
    expect(await page.locator('[data-lp-first-input]').evaluate(el => {
      const css = getComputedStyle(el); return [css.backgroundColor, css.padding, Number(parseFloat(css.lineHeight).toFixed(2))];
    })).toEqual(['rgb(255, 255, 255)', '16px 18px', 28.05]);
    await saveFirst(page);
    const saved = page.locator('[data-lp-first-saved]');
    await expect(saved.locator('.lp-first-answer-note')).toHaveCount(0);
    await expect(saved.locator('.lp-first-answer-date svg')).toHaveAttribute('aria-hidden', 'true');
    expect(await saved.evaluate(el => {
      const children = [...el.children]; return children.indexOf(el.querySelector('.lp-first-answer-date')) < children.indexOf(el.querySelector('[data-lp-first-quote]'));
    })).toBe(true);
    const timeline = page.locator('[data-lp-course]');
    await expect(timeline).toBeVisible();
    await expect(timeline.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(await timeline.evaluate(el => {
      const css = getComputedStyle(el, '::before'); return [css.borderInlineStartWidth, css.borderInlineStartStyle, css.borderInlineStartColor];
    })).toEqual(['2px', 'dashed', 'rgb(213, 217, 223)']);
    await page.locator('[data-lp-skip]').click();
    await expect(page.locator('[data-lp-end-heading]')).toHaveText(end);
    await expect(timeline).toBeHidden(); await compare(page);
    const card = page.locator('[data-lp-panel-first-card]');
    await expect(card.getByRole('heading')).toHaveText(day);
    await expect(card.locator('.lp-first-answer-note')).toHaveCount(0);
    await expect(card.locator('[data-lp-panel-first-date]')).toHaveText(await saved.locator('[data-lp-first-date]').textContent());
    await expect(card.locator('[data-lp-panel-first]')).toHaveText('Stop interrupting me.');
    expect(await card.evaluate(el => el.compareDocumentPosition(document.querySelector('fieldset')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  });
}

test('comparison locks the current answer and refuses another Compare activation', async ({ page }) => {
  await mount(page, ['both']); await observe(page);
  await saveFirst(page); await page.locator('[data-lp-skip]').click(); await compare(page);
  await expect(page.locator('[data-lp-now-input]')).toHaveAttribute('readonly', '');
  await expect(page.locator('[data-lp-compare]')).toBeHidden();
  await expect(page.locator('[data-lp-result] h4')).toBeFocused();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  await expect(page.locator('[data-lp-panel-now]')).toHaveCount(0);
  await expect(page.locator('[data-lp-panel-first-date]')).toContainText('Saved ');
  const before = await page.evaluate(() => window.lpSaved);
  await page.locator('[data-lp-compare]').evaluate(el => el.click());
  expect(await page.evaluate(() => window.lpSaved)).toEqual(before);
  expect(await page.evaluate(() => window.lpWrites)).toBe(2);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['First answer saved.', 'Compared. Tick what improved.']);
});

test('Try again unlocks the draft silently and saves only on the next Compare', async ({ page }) => {
  await mount(page, ['both']); await saveFirst(page); await page.locator('[data-lp-skip]').click(); await compare(page);
  await page.getByRole('checkbox').nth(2).check();
  const before = await page.evaluate(() => window.lpSaved);
  await observe(page);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('[data-lp-now-input]')).toBeEditable();
  await expect(page.locator('[data-lp-now-input]')).toBeFocused();
  await expect(page.locator('[data-lp-now-input]')).toHaveValue(before.now.text);
  await expect(page.locator('[data-lp-first-quote]')).toHaveText(before.first.text);
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  await expect(page.locator('[data-lp-compare]')).toBeVisible();
  await expect(page.locator('[data-lp-try-again]')).toBeHidden();
  await page.locator('[data-lp-now-input]').fill('A revised answer.');
  expect(await page.evaluate(() => window.lpSaved)).toEqual(before);
  expect(await page.evaluate(() => window.lpWrites)).toBe(3);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  await page.locator('[data-lp-compare]').click();
  expect(await page.evaluate(() => window.lpSaved)).toMatchObject({ first: before.first, now: { text: 'A revised answer.' }, checks: before.checks });
  await expect(page.locator('[data-lp-now-input]')).toHaveAttribute('readonly', '');
  await expect(page.locator('[data-lp-result]')).toBeVisible();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Compared. Tick what improved.']);
});

test('restoring now locks the comparison silently and reset clears the lock', async ({ page }) => {
  await mount(page, ['both'], seed); await observe(page);
  await expect(page.locator('[data-lp-now-input]')).toHaveAttribute('readonly', '');
  await expect(page.locator('[data-lp-now-input]')).toHaveValue(seed.now.text);
  await expect(page.locator('[data-lp-compare]')).toBeHidden();
  await expect(page.locator('[data-lp-try-again]')).toBeVisible();
  await expect(page.locator('[role="status"]')).toBeEmpty();
  await page.locator('[data-lp-restart]').click();
  await saveFirst(page); await page.locator('[data-lp-skip]').click();
  await expect(page.locator('[data-lp-now-input]')).toBeEditable();
  await expect(page.locator('[data-lp-compare]')).toBeVisible();
  await expect(page.locator('[data-lp-try-again]')).toBeHidden();
});

for (const [lang, legend, announcement, retry] of [
  ['en', 'Has your new answer improved in any of these ways?', 'Compared. Tick what improved.', 'Try again'],
  ['fr', "Votre nouvelle réponse s'est-elle améliorée sur l'un de ces points?", "Comparaison affichée. Cochez ce qui s'est amélioré.", 'Réessayer']
]) {
  test(`comparison uses the improvement question and quiet icon actions (${lang})`, async ({ page }) => {
    await open(page, `/first-answer/${lang}.html`); await saveFirst(page); await page.locator('[data-lp-skip]').click(); await compare(page);
    await expect(page.getByRole('group')).toHaveAccessibleName(legend);
    await expect(page.locator('[role="status"]')).toHaveText(announcement);
    await expect(page.locator('[data-lp-try-again]')).toHaveAccessibleName(retry);
    for (const selector of ['[data-lp-try-again]', '[data-lp-restart]']) {
      const action = page.locator(selector);
      await expect(action).toHaveClass('lp-button lp-button-quiet');
      await expect(action.locator('svg')).toHaveAttribute('aria-hidden', 'true');
      await expect(action.locator('svg')).toHaveAttribute('focusable', 'false');
    }
  });
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
  await expect(page.locator('[data-lp-skip]')).toBeFocused(); await expect(page.locator('[data-lp-first-quote]')).toHaveText('Stop interrupting me.');
  await expect(page.locator('[data-lp-first-saved] .lp-first-answer-note')).toHaveCount(0);
  await expect(first).not.toHaveAttribute('aria-invalid', 'true');
  await expect(save).toBeHidden();
  await page.keyboard.press('Enter'); await expect(page.locator('[data-lp-end-heading]')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-now-input]')).toBeFocused();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-now-input]')).toBeFocused();
  await expect(page.locator('[data-lp-now-input]')).toHaveAttribute('aria-describedby', 'example-now-error');
  await page.keyboard.type('Can I finish my thought?'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-compare]')).toBeHidden();
  await expect(page.locator('[data-lp-panel-first]')).toHaveText('Stop interrupting me.');
  await expect(page.locator('[data-lp-result] h4')).toBeFocused();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  await expect(page.locator('[data-lp-now-input]')).toHaveValue('Can I finish my thought?');
  await page.keyboard.press('Tab'); await expect(page.getByRole('checkbox').first()).toBeFocused(); await page.keyboard.press('Space');
  await expect(page.locator('[data-lp-summary]')).toHaveText('You ticked 1 of 3 checks for your answer now.');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-try-again]')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('[data-lp-now-input]')).toBeFocused();
  await page.keyboard.type(' A revision.');
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-compare]')).toBeFocused(); await page.keyboard.press('Enter');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-restart]')).toBeFocused(); await page.keyboard.press('Enter');
  await expect(first).toBeFocused(); await expect(first).toHaveValue('');
  await expect(page.locator('[data-lp-restart]')).toBeHidden(); await expect(page.locator('[data-lp-result]')).toBeHidden();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ first: null, now: null, checks });
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['First answer saved.', 'Compared. Tick what improved.', 'Compared. Tick what improved.', 'Started over.']);
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
  await page.locator('[data-lp-try-again]').click();
  await page.locator('[data-lp-now-input]').fill('Second try');
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  expect(await page.evaluate(() => window.lpSaved)).toEqual(before);
  await page.locator('[data-lp-compare]').click();
  const after = await page.evaluate(() => window.lpSaved);
  expect(after.first).toEqual(before.first); expect(after.checks).toEqual(before.checks); expect(after.now.text).toBe('Second try');
  await expect(page.locator('[data-lp-now-input]')).toHaveValue('Second try');
  await expect(page.locator('[data-lp-result]')).toHaveCount(1);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['First answer saved.', 'Compared. Tick what improved.', 'Compared. Tick what improved.']);
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

for (const [lang, savedNote, summary] of [['en', 'It stays as you wrote it.', 'You ticked 1 of 3 checks for your answer now.'], ['fr', "Elle reste telle que vous l'avez écrite.", 'Critères cochés pour votre réponse actuelle : 1 sur 3.']]) {
  test(`restore valid state silently with localized dates (${lang})`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, seed);
    await open(page, `/first-answer/${lang}.html`);
    await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', lang);
    await expect(page.locator('[role="status"]')).toBeEmpty();
    await expect(page.locator('[data-lp-end-step]')).toBeVisible(); await expect(page.locator('[data-lp-skip]')).toBeHidden();
    await expect(page.locator('[data-lp-first-saved] .lp-first-answer-note')).toHaveCount(0);
    await expect(page.locator('[data-lp-panel-first]')).toHaveText(seed.first.text);
    await expect(page.locator('[data-lp-now-input]')).toHaveValue(seed.now.text);
    await expect(page.getByRole('checkbox').nth(2)).toBeChecked();
    await expect(page.locator('[data-lp-summary]')).toHaveText(summary);
    const date = await page.evaluate(({ lang, first }) => new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(first)), { lang, first: FIRST });
    await expect(page.locator('[data-lp-panel-first-date]')).toHaveText(`${lang === 'en' ? 'Saved' : 'Enregistrée le'} ${date}`);
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
  await expect(page.locator('[data-lp-now-input]')).toHaveValue(compared.now.text);
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
  await expect(page.locator('[data-lp-panel-note]')).toBeHidden();
  await expect(page.locator('[data-lp-panel-first-card] .lp-first-answer-date')).toBeHidden();
  await page.getByRole('checkbox').nth(2).check(); await page.locator('[data-lp-restart]').click();
  await expect(page.locator('[data-lp-now-input]')).toBeFocused(); await expect(page.locator('[data-lp-now-input]')).toHaveValue('');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Compared. Tick what improved.', 'Started over.']);
});

test('first and end placements share state across course pages', async ({ page }) => {
  await mount(page, ['first']); await expect(page.locator('[data-lp-end-step]')).toHaveCount(0); await saveFirst(page);
  await expect(page.locator('[data-lp-save-first]')).toBeHidden(); await expect(page.locator('[data-lp-first-saved]')).toBeFocused();
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
  await roots.nth(1).locator('[data-lp-try-again]').click();
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
    return ['', render(content, strings.en, { id: 'bad', lang: 'en' }).replace('value="a"', 'value="unknown"'), render(content, strings.en, { id: 'bad', lang: 'en' }).replace('data-lp-panel-first-date', 'data-planted-missing-date')].map(markup => {
      const wrapper = document.createElement('div'); wrapper.innerHTML = markup;
      try { enhance(wrapper.firstElementChild || wrapper, { content, strings: strings.en }); return ''; } catch (error) { return error.message; }
    });
  });
  expect(failures[0]).toMatch(/markup|stage/); expect(failures[1]).toMatch(/checks markup/);
  expect(failures[2]).toContain('Missing first-answer markup: [data-lp-panel-first-date]');
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
    await expect(page.locator('[data-lp-now-input]')).toHaveAttribute('readonly', '');
  });
}

test('one activity box uses shared text, choice, readonly and quiet button styles', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 }); await open(page); await saveFirst(page); await page.locator('[data-lp-skip]').click(); await compare(page);
  await expect(page.locator('[data-lp-pattern]')).toHaveClass('lp lp-first-answer');
  await expect(page.locator('.lp-first-answer-panels, .lp-first-answer-panel')).toHaveCount(0);
  const styles = await page.evaluate(() => {
    const css = selector => getComputedStyle(document.querySelector(selector));
    return {
      stepBorder: css('[data-lp-first-step]').borderWidth,
      sectionBorder: css('[data-lp-end-step]').borderTopWidth,
      fieldsetBorder: css('fieldset').borderWidth,
      stemFont: css('.lp-scene-title').fontFamily,
      stemSize: css('.lp-scene-title').fontSize,
      dateSize: css('.lp-first-answer-date').fontSize,
      headingWeight: css('[data-lp-end-heading]').fontWeight,
      readonlyBackground: css('[data-lp-now-input]').backgroundColor
    };
  });
  expect(styles).toMatchObject({ stepBorder: '0px', sectionBorder: '1px', fieldsetBorder: '0px', stemSize: '19px', dateSize: '15px', headingWeight: '600', readonlyBackground: 'rgb(247, 248, 250)' });
  expect(styles.stemFont).toContain('Source Sans 3');
  await page.getByRole('checkbox').first().check();
  const choice = page.locator('.lp-choice').first();
  await expect.poll(() => choice.evaluate(el => [getComputedStyle(el).borderWidth, getComputedStyle(el).borderTopColor, getComputedStyle(el).backgroundColor])).toEqual(['2px', 'rgb(44, 85, 201)', 'rgb(238, 242, 253)']);
  await page.locator('[data-lp-pattern]').evaluate(el => el.style.setProperty('--lp-ink-2', '#123456'));
  const restart = page.locator('[data-lp-restart]');
  expect(await restart.evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color, getComputedStyle(el).borderTopColor, getComputedStyle(el).textDecorationLine, getComputedStyle(el).minHeight])).toEqual(['rgba(0, 0, 0, 0)', 'rgb(18, 52, 86)', 'rgba(0, 0, 0, 0)', 'none', '44px']);
});

test('Chromium forced colours keeps focus rings, borders and quiet link actions', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced-colour emulation is checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page);
  await page.locator('[data-lp-save-first]').focus();
  expect(await page.locator('[data-lp-save-first]').evaluate(el => [getComputedStyle(el).outlineWidth, getComputedStyle(el).outlineStyle, getComputedStyle(el).outlineOffset])).toEqual(['2px', 'solid', '2px']);
  await saveFirst(page);
  await expect(page.locator('[data-lp-course] p')).toHaveText('In a course, the lessons happen here.');
  await page.addStyleTag({ content: '.lp-first-answer-timeline::before{display:none}' });
  await expect(page.locator('[data-lp-first-quote]')).toHaveText('Stop interrupting me.');
  await expect(page.locator('[data-lp-skip]')).toHaveText('Skip to the end of the course');
  for (const selector of ['[data-lp-skip]', '[data-lp-restart]']) {
    await page.locator(selector).focus();
    expect(await page.locator(selector).evaluate(el => [getComputedStyle(el).outlineWidth, getComputedStyle(el).outlineStyle, getComputedStyle(el).outlineOffset])).toEqual(['2px', 'solid', '2px']);
  }
  await page.locator('[data-lp-skip]').click(); await expect(page.locator('[data-lp-end-heading]')).toBeFocused();
  expect(await page.locator('[data-lp-end-heading]').evaluate(el => getComputedStyle(el).outlineWidth)).toBe('2px');
  const colors = await page.evaluate(() => {
    const span = document.createElement('span'); document.body.append(span); const result = {};
    for (const name of ['ButtonText', 'ButtonFace', 'Highlight', 'LinkText']) { span.style.color = name; result[name] = getComputedStyle(span).color; }
    span.remove(); return result;
  });
  for (const selector of ['[data-lp-compare]']) {
    await page.locator(selector).focus();
    const css = await page.locator(selector).evaluate(el => { const style = getComputedStyle(el); return [style.color, style.backgroundColor, style.borderColor, style.borderWidth, style.outlineColor]; });
    expect(css).toEqual([colors.ButtonText, colors.ButtonFace, colors.ButtonText, '1px', colors.Highlight]);
  }
  expect(await page.locator('[data-lp-compare]').evaluate(el => getComputedStyle(el).borderStyle)).toBe('solid');
  await compare(page);
  for (const selector of ['[data-lp-try-again]', '[data-lp-restart]']) {
    await page.locator(selector).focus();
    expect(await page.locator(selector).evaluate(el => [getComputedStyle(el).color, getComputedStyle(el).outlineColor, getComputedStyle(el).outlineWidth])).toEqual([colors.LinkText, colors.Highlight, '2px']);
  }
});

test('at the end of the course the first answer shows once, under the new answer', async ({ page }) => {
  await open(page);
  await saveFirst(page);
  await expect(page.locator('[data-lp-first-step]')).toBeVisible();
  await page.locator('[data-lp-skip]').click();
  await expect(page.locator('[data-lp-first-step]')).toBeHidden();
  await compare(page);
  await expect(page.getByText('Stop interrupting me.', { exact: true }).filter({ visible: true })).toHaveCount(1);
});
