import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const english = JSON.parse(await readFile(new URL('../../patterns/highlight/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/highlight/examples/fr.json', import.meta.url)));
const englishKey = JSON.parse(await readFile(new URL('../../patterns/highlight/examples/en-key.json', import.meta.url)));
const frenchKey = JSON.parse(await readFile(new URL('../../patterns/highlight/examples/fr-key.json', import.meta.url)));

test('scene has a title and centred file tile, with one task instruction', async ({ page }) => {
  for (const [lang, content, label] of [['en', english, 'Read and highlight'], ['fr', french, 'Lisez et surlignez']]) {
    await open(page, `/highlight/${lang}.html`);
    await expect(page.locator('.lp-scene-label')).toHaveCount(0);
    await expect(page.locator('.lp-stem')).toContainText(content.question);
    await expect(page.locator('.lp-run-in').filter({ hasText: lang === 'en' ? 'Highlight the passage that answers the question.' : 'Surlignez le passage qui répond à la question.' })).toHaveCount(0);
    await expect(page.locator('.lp-scene-title')).toHaveText(content.title);
    await expect(page.locator('.lp-scene-icon svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const geometry = await page.locator('.lp-scene').evaluate(el => {
        const scene = el.getBoundingClientRect(), card = el.parentElement.getBoundingClientRect();
        const tile = el.querySelector('.lp-scene-icon').getBoundingClientRect(), text = el.querySelector('div').getBoundingClientRect();
        return [scene.left - card.left, card.right - scene.right, tile.top + tile.height / 2 - text.top - text.height / 2];
      });
      for (const difference of geometry) expect(Math.abs(difference)).toBeLessThanOrEqual(1);
    }
  }
});
const chunk = (page, id) => page.locator(`[data-lp-chunk="${id}"]`);
const feedback = (page, id) => chunk(page, id).locator('+ [data-lp-feedback]');

async function open(page, path = '/highlight/en.html') {
  await page.goto(path); await page.waitForFunction(() => window.lpReady);
}

async function observeStatus(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    new MutationObserver(records => {
      for (const record of records) window.lpAnnouncements.push(record.target.textContent);
    }).observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}

// Mount the second authored example through the same public render/enhance interface.
async function mount(page, content, lang = 'en') {
  await page.evaluate(async ({ content, lang }) => {
    window.lpInstances[0].destroy();
    const { render } = await import('/patterns/highlight/render.js');
    const { enhance } = await import('/patterns/highlight/enhance.js');
    const { strings } = await import('/patterns/highlight/strings.js');
    const old = document.querySelector('[data-lp-pattern]');
    old.outerHTML = render(content, strings[lang], { id: 'mounted', lang });
    const root = document.querySelector('[data-lp-pattern]');
    let saved;
    const state = { read: () => saved, write: value => { saved = value; window.lpSaved = value; } };
    const instance = enhance(root, { content, strings: strings[lang], state });
    window.lpInstances = [instance];
    window.lpEnhance = () => enhance(root, { content, strings: strings[lang], state });
  }, { content, lang });
}

test('keyboard passage has one tab stop, complete roving navigation, silent toggles and a focus ring', async ({ page }) => {
  await open(page); await observeStatus(page);
  const chunks = page.locator('[data-lp-chunk]');
  await expect(page.locator('[data-lp-chunk][tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press('Tab'); await expect(chunks.first()).toBeFocused();
  const instructions = await chunks.first().getAttribute('aria-describedby');
  await expect(page.locator('[data-lp-passage]')).toHaveAttribute('aria-describedby', instructions);
  await expect(page.locator(`[id="${instructions}"]`)).toContainText('Click or tap');
  const outline = await chunks.first().evaluate(el => {
    const css = getComputedStyle(el); return [css.outlineWidth, css.outlineStyle, css.outlineOffset];
  });
  expect(outline).toEqual(['2px', 'solid', '2px']);
  for (const [key, index] of [['ArrowRight', 1], ['ArrowDown', 2], ['ArrowLeft', 1], ['ArrowUp', 0], ['ArrowLeft', english.paragraphs.flat().length - 1], ['Home', 0], ['End', english.paragraphs.flat().length - 1], ['ArrowRight', 0]]) {
    await page.keyboard.press(key); await expect(chunks.nth(index)).toBeFocused();
    await expect(page.locator('[data-lp-chunk][tabindex="0"]')).toHaveCount(1);
  }
  await page.keyboard.press('Space'); await expect(chunks.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-lp-count]')).toHaveText('1 of 1 marked');
  await page.keyboard.press('Enter'); await expect(chunks.first()).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('a'); await expect(chunks.first()).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-lp-count]')).toHaveText('0 of 1 marked');
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-check]')).toBeFocused();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
});

test('evidence check puts authored and default feedback in place, locks marks, announces once without focus movement', async ({ page }) => {
  await open(page); await mount(page, { ...english, maxMarks: 2 }); await observeStatus(page);
  await chunk(page, 'actions').click(); await chunk(page, 'withdraw').click();
  await page.locator('[data-lp-check]').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-check]')).toBeHidden(); await expect(page.locator('[data-lp-restart]')).toBeFocused();
  await expect(feedback(page, 'actions')).toHaveText(english.paragraphs.flat().find(c => c.id === 'actions').note);
  await expect(feedback(page, 'withdraw')).toHaveText("This doesn't answer the question.");
  await expect(feedback(page, 'ignored')).toHaveText('Missed');
  await expect(chunk(page, 'ignored')).toHaveAttribute('data-lp-outcome', 'missed');
  await expect(feedback(page, 'overwhelmed')).toBeHidden();
  await expect(page.locator('[data-lp-summary]')).toHaveText('Passages that answer the question: 0 of 1.');
  await expect(page.locator('[data-lp-chunk][aria-disabled="true"]')).toHaveCount(english.paragraphs.flat().length);
  const saved = { marked: ['withdraw', 'actions'], shown: true };
  expect(await page.evaluate(() => window.lpSaved)).toEqual(saved);
  // Send an actual pointer event despite Playwright's aria-disabled actionability guard.
  await chunk(page, 'ignored').click({ force: true }); await chunk(page, 'ignored').focus();
  await page.keyboard.press('Space'); await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.lpSaved)).toEqual(saved);
  await expect(page.locator('[data-lp-check]')).toBeHidden();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Passages that answer the question: 0 of 1.']);
  await page.locator('[data-lp-restart]').click();
  await expect(page.locator('[data-lp-chunk]').first()).toBeFocused();
  await expect(page.locator('[data-lp-summary]')).toBeHidden();
  await expect(page.locator('[data-lp-chunk][aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('[data-lp-check]')).toBeVisible();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ marked: [], shown: false });
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Passages that answer the question: 0 of 1.']);
  await chunk(page, 'ignored').click(); await page.locator('[data-lp-check]').click();
  await expect(feedback(page, 'ignored')).toHaveText('This answers it');
  await expect(chunk(page, 'ignored')).toHaveAttribute('data-lp-outcome', 'correct');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Passages that answer the question: 0 of 1.', 'Passages that answer the question: 1 of 1.']);
});

test('pointer toggles preserve server passage nodes, count marks and use a warm clone highlighter', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { window.lpPassage = document.querySelector('[data-lp-passage]'); window.lpChunk = document.querySelector('[data-lp-chunk]'); });
  await chunk(page, 'ignored').click(); await expect(page.locator('[data-lp-count]')).toHaveText('1 of 1 marked');
  const style = await chunk(page, 'ignored').evaluate(el => {
    const css = getComputedStyle(el); return { background: css.backgroundColor, clone: css.boxDecorationBreak || css.webkitBoxDecorationBreak };
  });
  expect(style).toEqual({ background: 'rgb(255, 228, 154)', clone: 'clone' });
  await chunk(page, 'ignored').click(); await expect(page.locator('[data-lp-count]')).toHaveText('0 of 1 marked');
  await page.locator('[data-lp-check]').click();
  expect(await page.evaluate(() => window.lpPassage === document.querySelector('[data-lp-passage]') && window.lpChunk === document.querySelector('[data-lp-chunk]'))).toBe(true);
});

for (const [lang, content, singular, plural] of [
  ['en', english, 'You can mark one passage. Unmark it first.', 'You can mark up to 2 passages. Unmark one first.'],
  ['fr', french, "Vous pouvez marquer un seul passage. Enlevez d'abord sa marque.", "Vous pouvez marquer jusqu'à 2 passages. Enlevez d'abord une marque."]
]) {
  for (const max of [1, 2]) {
    test(`mark cap refuses pointer and keyboard additions, announces once and clears on removal (${lang}, ${max})`, async ({ page }) => {
      await open(page); await mount(page, { ...content, maxMarks: max }, lang);
      await page.evaluate(() => { window.lpWrites = []; window.lpInstances[0].destroy(); });
      await page.evaluate(async ({ content, lang }) => {
        const { enhance } = await import('/patterns/highlight/enhance.js'); const { strings } = await import('/patterns/highlight/strings.js');
        window.lpInstances = [enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings[lang], state: { read: () => null, write: value => window.lpWrites.push(value) } })];
      }, { content: { ...content, maxMarks: max }, lang });
      await observeStatus(page);
      await chunk(page, 'withdraw').click();
      if (max === 2) await chunk(page, 'actions').click();
      await expect(page.locator('[data-lp-count]')).toHaveText(lang === 'en' ? `${max} of ${max} marked` : `Passages marqués : ${max} sur ${max}`);
      const writes = await page.evaluate(() => window.lpWrites.length);
      await chunk(page, 'ignored').click(); await chunk(page, 'ignored').focus();
      const message = max === 1 ? singular : plural;
      await expect(page.locator('[data-lp-limit]')).toHaveText(message);
      await expect(chunk(page, 'ignored')).toBeFocused();
      await page.keyboard.press('Space'); await page.keyboard.press('Enter');
      await expect(chunk(page, 'ignored')).toHaveAttribute('aria-pressed', 'false');
      expect(await page.evaluate(() => window.lpWrites.length)).toBe(writes);
      expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([message]);
      const placement = await page.locator('[data-lp-limit]').evaluate(el => el.previousElementSibling.hasAttribute('data-lp-passage'));
      expect(placement).toBe(true);
      await chunk(page, 'withdraw').click();
      await expect(page.locator('[data-lp-limit]')).toBeHidden(); await expect(page.locator('[role="status"]')).toBeEmpty();
      await chunk(page, 'ignored').click(); await expect(chunk(page, 'ignored')).toHaveAttribute('aria-pressed', 'true');
      await chunk(page, 'withdraw').click(); await expect(page.locator('[data-lp-limit]')).toBeVisible();
      await page.locator('[data-lp-restart]').click(); await expect(page.locator('[data-lp-limit]')).toBeHidden();
      await expect(page.locator('[data-lp-count]')).toHaveText(lang === 'en' ? `0 of ${max} marked` : `Passages marqués : 0 sur ${max}`);
    });
  }
}

test('mode defaults enforce target count for evidence and target count plus one for key ideas', async ({ page }) => {
  for (const [content, max] of [[english, 1], [englishKey, 5]]) {
    await open(page); await mount(page, content);
    const all = page.locator('[data-lp-chunk]');
    for (let i = 0; i <= max; i++) await all.nth(i).click();
    await expect(page.locator('[data-lp-chunk][aria-pressed="true"]')).toHaveCount(max);
    await expect(all.nth(max)).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-lp-count]')).toHaveText(`${max} of ${max} marked`);
  }
});

test('over-limit saved state is ignored both before and after grading', async ({ page }) => {
  for (const shown of [false, true]) {
    await page.addInitScript(value => { window.lpSeed = value; }, { marked: ['ignored', 'actions'], shown });
    await open(page);
    await expect(page.locator('[data-lp-chunk][aria-pressed="true"]')).toHaveCount(0);
    await expect(page.locator('[data-lp-summary]')).toBeHidden(); await expect(page.locator('[role="status"]')).toBeEmpty();
  }
});

test('limit feedback clears on check and destroy, and missing limit markup fails before enhancement', async ({ page }) => {
  await open(page); await observeStatus(page);
  await chunk(page, 'withdraw').click(); await chunk(page, 'ignored').click();
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-limit]')).toBeHidden();
  await expect(page.locator('[role="status"]')).toHaveText('Passages that answer the question: 0 of 1.');
  await page.locator('[data-lp-restart]').click();
  await chunk(page, 'withdraw').click(); await chunk(page, 'ignored').click();
  await page.evaluate(() => window.lpInstances[0].destroy());
  await expect(page.locator('[data-lp-limit]')).toBeHidden(); await expect(page.locator('[role="status"]')).toBeEmpty();
  await page.evaluate(() => document.querySelector('[data-lp-limit]').remove());
  await expect(page.evaluate(() => window.lpEnhance())).rejects.toThrow('Missing highlight markup: [data-lp-limit]');
  await expect(page.locator('[data-lp-flow]')).toBeHidden();
});

test('graded marks keep yellow non-targets, tint found targets and leave missed targets unhighlighted', async ({ page }) => {
  await open(page); await mount(page, englishKey);
  await chunk(page, 'withdraw').click(); await chunk(page, 'overwhelmed').click(); await page.locator('[data-lp-check]').click();
  const style = id => chunk(page, id).evaluate(el => { const css = getComputedStyle(el); return [css.backgroundColor, css.textDecorationLine, css.textDecorationStyle, css.textDecorationColor]; });
  expect(await style('overwhelmed')).toEqual(['rgb(255, 228, 154)', 'none', 'solid', 'rgb(22, 24, 29)']);
  expect(await style('withdraw')).toEqual(['rgb(230, 244, 238)', 'underline', 'solid', 'rgb(18, 112, 79)']);
  expect(await style('ignored')).toEqual(['rgba(0, 0, 0, 0)', 'underline', 'dashed', 'rgb(162, 74, 7)']);
  expect(await feedback(page, 'overwhelmed').evaluate(el => { const css = getComputedStyle(el); return [css.color, css.backgroundColor, css.fontSize]; })).toEqual(['rgb(22, 24, 29)', 'rgb(247, 248, 250)', '17px']);
  await expect(feedback(page, 'overwhelmed').locator('svg')).toHaveAttribute('aria-hidden', 'true');
});

for (const [lang, content, correct, wrong, missed, summary] of [
  ['en', englishKey, 'Key idea', 'Not a key idea', 'Missed', 'You found 1 of 4 key ideas.'],
  ['fr', frenchKey, 'Idée clé', "Ce n'est pas une idée clé", 'Manqué', 'Vous avez trouvé 1 des 4 idées clés.']
]) {
  test(`key mode has inline success, neutral authored notes and dashed missed targets (${lang})`, async ({ page }) => {
    await open(page); await mount(page, content, lang);
    await chunk(page, 'withdraw').click(); await chunk(page, 'overwhelmed').click(); await page.locator('[data-lp-check]').click();
    await expect(feedback(page, 'withdraw')).toHaveText(correct);
    await expect(feedback(page, 'overwhelmed')).toHaveText(`${wrong} ${content.paragraphs.flat().find(c => c.id === 'overwhelmed').note}`);
    await expect(feedback(page, 'ignored')).toHaveText(missed);
    await expect(page.locator('[data-lp-summary]')).toHaveText(summary);
    expect(await chunk(page, 'ignored').evaluate(el => getComputedStyle(el).textDecorationStyle)).toBe('dashed');
    for (const id of ['withdraw', 'overwhelmed', 'ignored']) await expect(feedback(page, id).locator('svg')).toHaveAttribute('aria-hidden', 'true');
  });
}

for (const [lang, content] of [['en', english], ['fr', french]]) {
  test(`no JavaScript is plain article plus native answer and all authored notes (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage();
    await page.goto(`/highlight/${lang}.html`);
    await expect(page.locator('[data-lp-passage]')).toHaveText(content.paragraphs.map(p => p.map(c => c.text).join(' ')).join(' '));
    await expect(page.locator('[data-lp-chunk][role]')).toHaveCount(0);
    await expect(page.locator('[data-lp-flow]')).toBeHidden();
    await page.locator('summary').click(); await expect(page.locator('details')).toHaveAttribute('open', '');
    await expect(page.locator('details')).toContainText(content.paragraphs.flat().find(c => c.id === 'ignored').text);
    for (const c of content.paragraphs.flat().filter(c => c.note)) await expect(page.locator('details')).toContainText(c.note);
    await context.close();
  });

  test(`320 CSS pixels, text spacing and 400 percent zoom preserve article and feedback (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await open(page, `/highlight/${lang}.html`);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    await chunk(page, 'actions').click(); await page.locator('[data-lp-check]').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const problems = await page.evaluate(() => [...document.querySelectorAll('.lp-highlight p, .lp-highlight button, .lp-highlight h2')].filter(el => el.getClientRects().length && !el.matches('[role="status"]')).filter(el => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).map(el => el.textContent));
    expect(problems).toEqual([]);
    // CSS zoom at a 1280px viewport leaves the same 320 CSS-pixel reading width.
    await page.setViewportSize({ width: 1280, height: 1000 }); await page.addStyleTag({ content: 'html{zoom:4}' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(feedback(page, 'actions')).toBeVisible(); await expect(page.locator('[data-lp-summary]')).toBeVisible();
  });
}

test('French language and evidence feedback use French words and authored notes', async ({ page }) => {
  await open(page, '/highlight/fr.html'); await mount(page, { ...french, maxMarks: 2 }, 'fr');
  await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('.lp-stem')).toContainText(french.question);
  await chunk(page, 'ignored').click(); await chunk(page, 'overwhelmed').click(); await page.locator('[data-lp-check]').click();
  await expect(feedback(page, 'ignored')).toHaveText('Ce passage répond à la question');
  await expect(feedback(page, 'overwhelmed')).toHaveText(french.paragraphs.flat().find(c => c.id === 'overwhelmed').note);
  await expect(page.locator('[data-lp-summary]')).toHaveText('Passages qui répondent à la question : 1 sur 1.');
});

for (const shown of [false, true]) {
  test(`valid saved marks restore shown=${shown} without status or focus movement`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, { marked: ['ignored'], shown });
    await open(page);
    await expect(chunk(page, 'ignored')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-lp-count]')).toHaveText('1 of 1 marked');
    if (shown) { await expect(feedback(page, 'ignored')).toHaveText('This answers it'); await expect(page.locator('[data-lp-summary]')).toBeVisible(); }
    else await expect(page.locator('[data-lp-summary]')).toBeHidden();
    await expect(page.locator('[role="status"]')).toHaveText('');
    expect(await page.evaluate(() => document.activeElement.tagName)).toBe('BODY');
  });
}

test('invalid saved marks are ignored and repeated enhance returns the same instance', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { marked: ['unknown'], shown: true }; }); await open(page);
  await expect(page.locator('[data-lp-chunk][aria-pressed="true"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.lpEnhance() === window.lpEnhance())).toBe(true);
  await observeStatus(page); await page.locator('[data-lp-check]').click();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Passages that answer the question: 0 of 1.']);
});

test('destroy restores fallback and removes listeners; re-enhance survives repeated old destroy', async ({ page }) => {
  await open(page); await chunk(page, 'ignored').click(); await page.locator('[data-lp-check]').click();
  await page.evaluate(() => { window.lpOldInstance = window.lpInstances[0]; window.lpOldInstance.destroy(); });
  await expect(page.locator('[data-lp-flow]')).toBeHidden(); await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await expect(page.locator('[data-lp-passage]')).not.toHaveAttribute('aria-describedby');
  await expect(page.locator('[data-lp-chunk][role], [data-lp-chunk][tabindex], [data-lp-chunk][aria-pressed], [data-lp-chunk][aria-disabled], [data-lp-chunk][data-lp-outcome]')).toHaveCount(0);
  await expect(page.locator('[data-lp-feedback]:not([hidden])')).toHaveCount(0);
  await expect(page.locator('[role="status"]')).toHaveText('');
  await page.evaluate(() => { window.lpSaved = null; document.querySelector('[data-lp-check]').click(); });
  expect(await page.evaluate(() => window.lpSaved)).toBe(null);
  await page.evaluate(() => { window.lpEnhance(); window.lpOldInstance.destroy(); });
  await expect(page.locator('[data-lp-flow]')).toBeVisible(); await observeStatus(page);
  await page.locator('[data-lp-restart]').click(); await page.locator('[data-lp-check]').click();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Passages that answer the question: 0 of 1.']);
});

test('two instances have unique IDs and independent roving marks and status', async ({ page }) => {
  await open(page, '/highlight/two.html');
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  await chunk(roots.first(), 'ignored').click(); await roots.first().locator('[data-lp-check]').click();
  await expect(roots.nth(1).locator('[data-lp-count]')).toHaveText('0 of 1 marked');
  await expect(roots.nth(1).locator('[role="status"]')).toHaveText('');
  await expect(roots.nth(1).locator('[data-lp-chunk][aria-disabled]')).toHaveCount(0);
  for (const root of await roots.all()) await expect(root.locator('[data-lp-chunk][tabindex="0"]')).toHaveCount(1);
});

test('missing and reordered or mismatched passage markup throws before partial enhancement', async ({ page }) => {
  await open(page);
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/highlight/enhance.js'); const { strings } = await import('/patterns/highlight/strings.js');
    enhance(document.createElement('section'), { content, strings: strings.en });
  }, english)).rejects.toThrow('Missing highlight markup: [data-lp-passage]');
  for (const violation of ['missing', 'identity', 'feedback', 'text', 'order']) {
    await open(page); await page.evaluate(violation => {
      window.lpInstances[0].destroy(); const first = document.querySelector('[data-lp-chunk]');
      if (violation === 'missing') first.remove();
      if (violation === 'identity') first.dataset.lpChunk = 'unknown';
      if (violation === 'feedback') first.nextElementSibling.remove();
      if (violation === 'text') first.textContent = 'Other text';
      if (violation === 'order') first.parentElement.append(first);
    }, violation);
    await expect(page.evaluate(() => window.lpEnhance())).rejects.toThrow('Invalid highlight passage markup');
    await expect(page.locator('[data-lp-flow]')).toBeHidden();
  }
});

for (const path of ['/highlight/en.html', '/highlight/fr.html', '/highlight/two.html']) {
  test(`axe at initial, marked and result stages: ${path}`, async ({ page }) => {
    await open(page, path);
    const scan = async () => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await scan();
    for (const root of await page.locator('[data-lp-pattern]').all()) await chunk(root, 'ignored').click();
    await scan();
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-check]').click();
    await scan();
  });
}

test('key mode axe passes when missed and wrong marks are shown', async ({ page }) => {
  await open(page); await mount(page, englishKey); await chunk(page, 'overwhelmed').click(); await page.locator('[data-lp-check]').click();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
});

test('forced colours distinguishes marks, missed targets and visible keyboard focus', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page);
  await chunk(page, 'withdraw').click();
  expect(await chunk(page, 'withdraw').evaluate(el => getComputedStyle(el).textDecorationLine)).toContain('underline');
  expect(await chunk(page, 'withdraw').evaluate(el => getComputedStyle(el).borderStyle)).toBe('solid');
  expect(await chunk(page, 'withdraw').evaluate(el => getComputedStyle(el).borderWidth)).toBe('1px');
  await chunk(page, 'withdraw').focus();
  expect(await chunk(page, 'withdraw').evaluate(el => getComputedStyle(el).outlineWidth)).toBe('2px');
  await page.locator('[data-lp-check]').click();
  expect(await chunk(page, 'withdraw').evaluate(el => getComputedStyle(el).textDecorationLine)).toBe('none');
  await expect(feedback(page, 'withdraw').locator('svg')).toHaveAttribute('aria-hidden', 'true');
  expect(await chunk(page, 'ignored').evaluate(el => getComputedStyle(el).textDecorationStyle)).toBe('dashed');
  await expect(feedback(page, 'ignored')).toHaveText('Missed');
  await page.locator('[data-lp-restart]').focus();
  expect(await page.locator('[data-lp-restart]').evaluate(el => getComputedStyle(el).outlineWidth)).toBe('2px');
  await page.locator('[data-lp-restart]').click(); await chunk(page, 'ignored').click(); await page.locator('[data-lp-check]').click();
  expect(await chunk(page, 'ignored').evaluate(el => getComputedStyle(el).textDecorationStyle)).toBe('solid');
  await expect(feedback(page, 'ignored')).toHaveText('This answers it');
});
