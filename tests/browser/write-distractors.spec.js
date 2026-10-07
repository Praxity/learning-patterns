import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const english = JSON.parse(await readFile(new URL('../../patterns/write-distractors/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/write-distractors/examples/fr.json', import.meta.url)));
const draft = (text, misconception, custom = '') => ({ text, misconception, custom });

async function open(page, lang = 'en') {
  await page.goto(`/write-distractors/${lang}.html`);
  await page.waitForFunction(() => window.lpReady);
}
async function fill(root, custom = false) {
  const rows = root.locator('[data-lp-option]');
  await rows.nth(0).locator('textarea').fill('Yes, breaks slow you down.');
  await rows.nth(0).locator('select').selectOption('push-through');
  await rows.nth(1).locator('textarea').fill('Yes, breaks make you lose your place.');
  await rows.nth(1).locator('select').selectOption(custom ? 'other' : 'phone');
  if (custom) await rows.nth(1).locator('input').fill('Breaks disrupt focus');
}
async function scan(page) {
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
}
async function observe(page) {
  await page.evaluate(() => {
    window.lpStatusObserver?.disconnect();
    window.lpAnnouncements = [];
    window.lpStatusObserver = new MutationObserver(records => {
      for (const record of records) window.lpAnnouncements.push(record.target.textContent);
    });
    window.lpStatusObserver.observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}

test('controls reveal in place, custom field toggles and selected labels wrap', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-lp-flow]')).toBeVisible();
  await expect(page.locator('[data-lp-fallback]')).toBeHidden();
  await expect(page.locator('fieldset')).toHaveCount(2);
  await expect(page.locator('textarea').first()).toHaveAttribute('maxlength', '300');
  const row = page.locator('fieldset').first();
  await expect(row.locator('input')).toBeHidden();
  await row.locator('select').selectOption('other');
  await expect(row.locator('input')).toBeVisible();
  await expect(row.locator('input')).toHaveAttribute('maxlength', '120');
  await row.locator('input').fill('My tag');
  await row.locator('select').selectOption('phone');
  await expect(row.locator('input')).toBeHidden();
  await expect(row.locator('[data-lp-selected]')).toHaveText(`Targets: ${english.misconceptions[2].label}`);
  await row.locator('select').selectOption('other');
  await expect(row.locator('input')).toHaveValue('My tag');
});

test('empty submit announces field count, links each error and focuses first textarea', async ({ page }) => {
  await open(page); await observe(page);
  await page.locator('[data-lp-compare]').click();
  await expect(page.locator('textarea').first()).toBeFocused();
  await expect(page.locator('[role="status"]')).toHaveText('4 fields need attention.');
  const inputs = page.locator('[aria-invalid="true"]');
  await expect(inputs).toHaveCount(4);
  for (const input of await inputs.all()) {
    const id = await input.getAttribute('aria-describedby');
    await expect(page.locator(`[id="${id}"]`)).toBeVisible();
  }
  await page.locator('textarea').first().fill('Draft');
  await expect(page.locator('textarea').first()).not.toHaveAttribute('aria-invalid');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['4 fields need attention.']);
  await expect(page.locator('[data-lp-clear]')).toBeHidden();
});

test('keyboard-only error, custom tag, comparison, repeated announcement and clear', async ({ page }) => {
  await open(page); await observe(page);
  const texts = page.locator('textarea'), selects = page.locator('select');
  await page.keyboard.press('Tab'); await expect(texts.nth(0)).toBeFocused();
  await page.keyboard.press('Tab'); await expect(selects.nth(0)).toBeFocused();
  await page.keyboard.press('Tab'); await expect(texts.nth(1)).toBeFocused();
  await page.keyboard.press('Tab'); await expect(selects.nth(1)).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-compare]')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(texts.nth(0)).toBeFocused();
  await page.keyboard.type('Yes, keep pushing.'); await page.keyboard.press('Tab');
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab');
  await page.keyboard.type('Yes, pauses disrupt focus.'); await page.keyboard.press('Tab');
  await page.keyboard.press('End'); await page.keyboard.press('Tab');
  await expect(page.locator('input').nth(1)).toBeFocused();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.locator('input').nth(1)).toBeFocused();
  await expect(page.locator('[role="status"]')).toHaveText('1 field needs attention.');
  await page.keyboard.type('Breaks disrupt focus'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-compare]')).toBeFocused();
  const coverage = await page.locator('[data-lp-coverage]').innerText();
  await expect(page.locator('[role="status"]')).toHaveText(coverage);
  await expect(page.locator('[data-lp-result]')).toContainText('Yours adds it.');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-clear]')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(texts.nth(0)).toBeFocused();
  for (const field of await page.locator('textarea, select, input').all()) await expect(field).toHaveValue('');
  await expect(page.locator('[data-lp-result]')).toBeHidden(); await expect(page.locator('[data-lp-clear]')).toBeHidden();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['4 fields need attention.', '1 field needs attention.', coverage, coverage, 'Options cleared.']);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ options: [draft('', ''), draft('', '')], shown: false });
});

for (const lang of ['en', 'fr', 'two']) {
  test(`axe at load, field errors, custom input and results (${lang})`, async ({ page }) => {
    await open(page, lang); await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-compare]').click();
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await fill(root, true);
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-compare]').click();
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-clear]').click();
    await scan(page);
  });
}

for (const [lang, content] of [['en', english], ['fr', french]]) {
  test(`authored options, same-target labels, language and summary (${lang})`, async ({ page }) => {
    await open(page, lang); await fill(page, true); await page.locator('[data-lp-compare]').click();
    await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', lang);
    const author = page.locator('[data-lp-author] li');
    await expect(author).toHaveCount(4);
    for (const [index, item] of content.authorOptions.entries()) {
      await expect(author.nth(index)).toContainText(item.text);
      await expect(author.nth(index)).toContainText(content.misconceptions.find(target => target.id === item.misconception).label);
    }
    const yours = page.locator('[data-lp-yours] li');
    await expect(yours.nth(0)).toContainText(lang === 'en' ? 'Targets the same misconception' : 'Cible la même idée fausse');
    await expect(yours.nth(1)).toContainText(lang === 'en' ? 'do not cover' : 'ne couvrent pas');
    await expect(yours.locator('[aria-hidden="true"]')).toHaveCount(2);
    await expect(page.locator('[data-lp-summary]')).toContainText(lang === 'en' ? 'Compared 2 wrong options.' : '2 mauvaises réponses comparées.');
  });

  test(`native no-JavaScript baseline (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage(); await page.goto(`/write-distractors/${lang}.html`);
    await expect(page.locator('[data-lp-pattern]')).toContainText(content.question);
    await expect(page.locator('[data-lp-pattern]')).toContainText(content.rightAnswer);
    await page.keyboard.press('Tab'); await expect(page.locator('summary')).toBeFocused();
    await page.keyboard.press('Enter'); await expect(page.locator('details')).toHaveAttribute('open', '');
    for (const item of content.authorOptions) await expect(page.locator('details')).toContainText(item.text);
    for (const item of content.misconceptions) await expect(page.locator('details')).toContainText(item.label);
    await expect(page.locator('[data-lp-flow]')).toBeHidden(); await expect(page.locator('[role="status"]')).toHaveText('');
    // axe schedules script callbacks, which cannot run with JavaScript disabled.
    // Scan an exact copy of the baseline DOM, with its scripts removed.
    const baseline = await page.evaluate(() => {
      const clone = document.documentElement.cloneNode(true);
      for (const script of clone.querySelectorAll('script')) script.remove();
      return '<!doctype html>' + clone.outerHTML;
    });
    const auditContext = await browser.newContext();
    const auditPage = await auditContext.newPage();
    await auditPage.goto(page.url()); await auditPage.setContent(baseline); await scan(auditPage);
    await auditContext.close(); await context.close();
  });

  test(`320px reflow and text spacing, all visible labels readable (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await open(page, lang);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    await page.locator('[data-lp-compare]').click();
    const check = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.evaluate(() => [...document.querySelectorAll('p, label, legend, button, li, h2')].filter(el => el.getClientRects().length && !el.matches('[role="status"]')).flatMap(el => {
        const failures = [];
        if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) failures.push(el.textContent);
        const children = [...el.children].filter(child => child.getClientRects().length);
        for (let i = 1; i < children.length; i++) {
          const a = children[i - 1].getBoundingClientRect(), b = children[i].getBoundingClientRect();
          if (Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1) failures.push('overlap: ' + el.textContent);
        }
        return failures;
      }))).toEqual([]);
    };
    await check(); await fill(page, true); await check();
    await page.locator('[data-lp-compare]').click(); await check();
    await page.locator('select').first().selectOption('phone');
    await expect(page.locator('[data-lp-selected]').first()).toContainText(content.misconceptions[2].label); await check();
  });
}

test('right answer, duplicate and custom errors use the field and update only on submit', async ({ page }) => {
  await open(page); await observe(page); await fill(page);
  await page.locator('textarea').first().fill(english.rightAnswer.toUpperCase());
  await page.locator('[data-lp-compare]').click();
  await expect(page.locator('textarea').first()).toBeFocused();
  await expect(page.locator('[data-lp-text-error]').first()).toContainText('is the right answer');
  await page.locator('textarea').first().fill('Same'); await page.locator('textarea').nth(1).fill(' SAME ');
  await page.locator('[data-lp-compare]').click();
  await expect(page.locator('textarea').nth(1)).toBeFocused();
  await expect(page.locator('[data-lp-text-error]').nth(1)).toContainText('different');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['1 field needs attention.', '1 field needs attention.']);
});

test('draft state saves every field, submitted state is clean, edits hide stale results', async ({ page }) => {
  await open(page); await observe(page); await fill(page, true);
  const before = await page.evaluate(() => window.lpSaved);
  expect(before.shown).toBe(false); expect(before.options[1].custom).toBe('Breaks disrupt focus');
  await page.locator('textarea').first().fill('  A  B  '); await page.locator('[data-lp-compare]').click();
  expect((await page.evaluate(() => window.lpSaved)).options[0].text).toBe('A B');
  await page.locator('textarea').first().fill('');
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  expect((await page.evaluate(() => window.lpSaved)).shown).toBe(false);
  expect((await page.evaluate(() => window.lpAnnouncements)).length).toBe(1);
});

for (const shown of [false, true]) {
  test(`valid saved custom state restores with shown=${shown}, silently`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, { options: [draft('A', 'push-through'), draft('B', 'other', 'Focus lost')], shown });
    await open(page);
    await expect(page.locator('textarea').first()).toHaveValue('A');
    await expect(page.locator('input').nth(1)).toBeVisible(); await expect(page.locator('input').nth(1)).toHaveValue('Focus lost');
    await expect(page.locator('[role="status"]')).toHaveText('');
    if (shown) { await expect(page.locator('[data-lp-result]')).toContainText('Focus lost'); await expect(page.locator('[data-lp-clear]')).toBeVisible(); }
    else { await expect(page.locator('[data-lp-result]')).toBeHidden(); await expect(page.locator('[data-lp-clear]')).toBeHidden(); }
  });
}

test('invalid state is ignored', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { options: [{ text: 'Invalid', misconception: 'unknown', custom: '' }], shown: true }; });
  await open(page); await expect(page.locator('textarea').first()).toHaveValue('');
  await expect(page.locator('[data-lp-result]')).toBeHidden(); await expect(page.locator('[role="status"]')).toHaveText('');
});

test('two instances have unique IDs and independent fields and results', async ({ page }) => {
  await open(page, 'two');
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id));
  expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  await fill(roots.first()); await roots.first().locator('[data-lp-compare]').click();
  await expect(roots.nth(1).locator('textarea').first()).toHaveValue('');
  await expect(roots.nth(1).locator('[data-lp-result]')).toBeHidden();
  await expect(roots.nth(1).locator('[role="status"]')).toHaveText('');
});

test('enhance twice, destroy twice, re-enhance: one listener and restored baseline', async ({ page }) => {
  await open(page); expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await observe(page); await fill(page); await page.locator('[data-lp-compare]').click();
  expect((await page.evaluate(() => window.lpAnnouncements)).length).toBe(1);
  await page.evaluate(() => window.lpInstances[0].destroy());
  await expect(page.locator('[data-lp-flow]')).toBeHidden(); await expect(page.locator('details')).toBeVisible();
  await page.evaluate(() => { window.lpEnhance(); window.lpInstances[0].destroy(); });
  await expect(page.locator('[data-lp-flow]')).toBeVisible();
  await observe(page); await fill(page); await page.locator('[data-lp-compare]').click();
  expect((await page.evaluate(() => window.lpAnnouncements)).length).toBe(1);
});

test('missing and mismatched markup throws, state adapter failures propagate', async ({ page }) => {
  await open(page);
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/write-distractors/enhance.js');
    const { strings } = await import('/patterns/write-distractors/strings.js');
    enhance(document.createElement('section'), { content, strings: strings.en });
  }, english)).rejects.toThrow('Missing write-distractors markup: [data-lp-fallback]');
  await page.evaluate(() => { window.lpInstances[0].destroy(); document.querySelector('fieldset').remove(); });
  await expect(page.evaluate(() => window.lpEnhance())).rejects.toThrow('Invalid write-distractors option count');
  await open(page);
  await expect(page.evaluate(async content => {
    window.lpInstances[0].destroy();
    const { enhance } = await import('/patterns/write-distractors/enhance.js');
    const { strings } = await import('/patterns/write-distractors/strings.js');
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, state: { read() { throw new Error('Host read failed'); }, write() {} } });
  }, english)).rejects.toThrow('Host read failed');
});

test('injected length violations are caught even beyond HTML maxlength', async ({ page }) => {
  await open(page); await fill(page, true);
  await page.locator('textarea').first().evaluate(el => { el.value = 'x'.repeat(301); });
  await page.locator('input').nth(1).evaluate(el => { el.value = 'y'.repeat(121); });
  await page.locator('[data-lp-compare]').click();
  await expect(page.locator('[data-lp-text-error]').first()).toContainText('300');
  await expect(page.locator('[data-lp-custom-error]').nth(1)).toContainText('120');
  await expect(page.locator('[role="status"]')).toHaveText('2 fields need attention.');
});

test('result text escapes hostile learner input and custom tags', async ({ page }) => {
  await open(page); await fill(page, true);
  await page.locator('textarea').first().fill('<img src=x onerror="window.lpInjected=true">');
  await page.locator('input').nth(1).fill('<script>window.lpInjected=true</script>');
  await page.locator('[data-lp-compare]').click();
  await expect(page.locator('[data-lp-result] img, [data-lp-result] script')).toHaveCount(0);
  await expect(page.locator('[data-lp-result]')).toContainText('<script>window.lpInjected=true</script>');
  expect(await page.evaluate(() => window.lpInjected)).toBeUndefined();
});

test('forced colours keeps focus rings and distinct secondary button', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page); await fill(page, true); await page.locator('[data-lp-compare]').click();
  for (const field of [page.locator('textarea').first(), page.locator('select').first(), page.locator('input').nth(1), page.locator('[data-lp-compare]'), page.locator('[data-lp-clear]')]) {
    await field.focus();
    const style = await field.evaluate(el => { const css = getComputedStyle(el); return [css.outlineWidth, css.outlineStyle, css.outlineOffset, css.outlineColor]; });
    expect(style.slice(0, 3)).toEqual(['2px', 'solid', '2px']); expect(style[3]).not.toBe('rgba(0, 0, 0, 0)');
  }
  const colors = await page.evaluate(() => {
    const probe = document.createElement('span'); document.body.append(probe);
    probe.style.color = 'ButtonText'; const text = getComputedStyle(probe).color;
    probe.style.color = 'ButtonFace'; const face = getComputedStyle(probe).color; probe.remove(); return { text, face };
  });
  const styles = await page.locator('[data-lp-flow] button').evaluateAll(elements => elements.map(el => {
    const css = getComputedStyle(el); return { color: css.color, background: css.backgroundColor, border: css.borderColor, style: css.borderStyle };
  }));
  expect(styles).toEqual([
    { color: colors.text, background: colors.face, border: colors.text, style: 'solid' },
    { color: colors.text, background: colors.face, border: colors.text, style: 'dashed' }
  ]);
});
