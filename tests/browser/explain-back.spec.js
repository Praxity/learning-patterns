import { CAP_MESSAGES } from '../../lib/data-notice.js';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const examples = Object.fromEntries(await Promise.all(['en', 'fr'].map(async lang => [lang, JSON.parse(await readFile(new URL(`../../patterns/explain-back/examples/${lang}.json`, import.meta.url)))])));

for (const lang of ['en', 'fr']) test(`step focus follows layout and precedes hiding the old control (${lang})`, async ({ page }) => {
  await open(page, lang, [1, 1, 0], 'ok', true);
  await page.evaluate(() => {
    window.lpStepFocus = [];
    document.addEventListener('click', () => {
      window.lpLayoutReady = false;
      requestAnimationFrame(() => requestAnimationFrame(() => { window.lpLayoutReady = true; }));
    }, true);
    document.addEventListener('focusin', event => {
      if (!event.target.matches('h2')) return;
      window.lpStepFocus.push({
        layoutReady: window.lpLayoutReady,
        visible: event.target.getClientRects().length > 0,
        oldControlVisible: [...document.querySelectorAll('.lp-actions button')].every(button => button.getClientRects().length > 0)
      });
    });
  });
  const ready = page.getByRole('button', { name: lang === 'en' ? "I'm ready to explain it" : "Passer à l'explication", exact: true });
  const readAgain = page.getByRole('button', { name: lang === 'en' ? 'Read the text again' : 'Relire le texte', exact: true });
  await ready.click();
  await expect(page.locator('#example-task')).toBeFocused();
  await expect(ready).toBeHidden();
  await page.getByRole('textbox').fill('Preserved draft');
  await readAgain.click();
  await expect(page.locator('#example-lesson-stonewalling')).toBeFocused();
  await expect(readAgain).toBeHidden();
  expect(await page.evaluate(() => window.lpStepFocus)).toEqual([
    { layoutReady: true, visible: true, oldControlVisible: true },
    { layoutReady: true, visible: true, oldControlVisible: true }
  ]);
  await ready.click();
  await expect(page.locator('#example-task')).toBeFocused();
  await expect(page.getByRole('textbox')).toHaveValue('Preserved draft');
});

test('reading and explaining steps keep the draft and feedback, with heading focus', async ({ page }) => {
  await open(page, 'en', [1, 1, 0], 'ok', true);
  await expect(page.locator('.lp-explain-back-lesson')).toBeVisible();
  await expect(page.locator('.lp-box')).toBeHidden();
  await page.getByRole('button', { name: "I'm ready to explain it" }).click();
  await expect(page.locator('.lp-explain-back-lesson')).toBeHidden();
  await expect(page.locator('#example-task')).toBeFocused();
  await submit(page);
  const feedback = await page.locator('[data-lp-result]').textContent();
  await page.getByRole('button', { name: 'Read the text again' }).click();
  await expect(page.locator('#example-lesson-stonewalling')).toBeFocused();
  await expect(page.locator('.lp-box')).toBeHidden();
  await page.getByRole('button', { name: "I'm ready to explain it" }).click();
  await expect(page.locator('#example-task')).toBeFocused();
  await expect(page.getByRole('textbox')).toHaveValue('My explanation');
  await expect(page.locator('[data-lp-result]')).toHaveText(feedback);
  await expect(page.getByRole('button', { name: 'Read the text again' })).toBeVisible();
});

test('destroy restores the original server DOM after step switching and feedback', async ({ page }) => {
  await open(page, 'en', [1, 1, 0], 'ok', true);
  const original = await page.evaluate(async content => {
    const { render } = await import('/patterns/explain-back/render.js');
    const { strings } = await import('/patterns/explain-back/strings.js');
    const container = document.createElement('div');
    container.innerHTML = render(content, strings.en, { id: 'example', lang: 'en' });
    return container.firstElementChild.innerHTML;
  }, examples.en);
  await page.getByRole('button', { name: "I'm ready to explain it" }).click();
  await submit(page);
  await page.getByRole('button', { name: 'Read the text again' }).click();
  await page.evaluate(() => window.lpInstances[0].destroy());
  expect(await page.locator('[data-lp-pattern]').innerHTML()).toBe(original);
  await expect(page.locator('.lp-explain-back-lesson')).toBeVisible();
  await expect(page.locator('.lp-box')).toBeVisible();
});

async function open(page, lang = 'en', values = [1, 1, 0], mode = 'ok', reading = false) {
  await page.addInitScript(({ values, mode }) => {
    const answers = Object.fromEntries(['stonewalling', 'pause', 'return'].map((id, index) => [id, { noul: values[index] }]));
    window.lpTestCalls = [];
    if (mode === 'missing') window.lpAsk = null;
    else window.lpAsk = async (block, fields, options) => {
      window.lpTestCalls.push({ block, fields, slot: !!options.challengeSlot });
      if (mode === 'ip_daily' || mode === 'budget') {
        throw Object.assign(new Error('Daily cap'), { type: 'budget', reason: mode });
      }
      if (mode === 'throws') throw new Error('Offline');
      if (mode === 'pending') await new Promise(resolve => { window.lpResolve = resolve; });
      return answers;
    };
  }, { values, mode });
  await page.goto(`/explain-back/${lang}.html`);
  await page.waitForFunction(() => window.lpReady);
  if (mode !== 'missing') await expect(page.locator('[data-lp-check]')).toBeEnabled();
  const ready = page.getByRole('button', { name: lang === 'fr' ? "Passer \u00e0 l'explication" : "I'm ready to explain it" });
  if (!reading && await ready.isVisible()) {
    await ready.click();
    await expect(page.locator('#example-task')).toBeFocused();
  }
}
async function submit(page) {
  await page.getByRole('textbox').fill('My explanation');
  await page.locator('[data-lp-check]').click();
}
async function axe(page) {
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
}
async function observe(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    new MutationObserver(records => { for (const record of records) window.lpAnnouncements.push(record.target.textContent); })
      .observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}

for (const lang of ['en', 'fr']) {
  test(`reading step, explanation heading focus and configured notice (${lang})`, async ({ page }) => {
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await open(page, lang, [1, 1, 0], 'ok', true);
    await expect(page.locator('.lp-box')).toBeHidden();
    const ready = page.getByRole('button', { name: lang === 'fr' ? "Passer \u00e0 l'explication" : "I'm ready to explain it" });
    await ready.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#example-task')).toBeFocused();
    await expect(page.locator('.lp-explain-back-lesson')).toBeHidden();
    await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', lang);
    await expect(page.locator('.lp-explain-back-lesson h2')).toHaveText(examples[lang].ideas.map(idea => idea.heading));
    await expect(page.locator('.lp-box > h2')).toHaveText(examples[lang].task);
    await expect(page.getByRole('textbox')).toHaveAttribute('maxlength', '1500');
    await expect(page.locator('[data-lp-notice]')).toContainText(lang === 'fr' ? 'Votre réponse reste' : 'Your answer stays');
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    await expect(page.locator('[data-lp-fallback]')).toBeHidden();
    await expect(page.locator('[data-lp-model]')).toBeHidden();
    await expect(page.locator('[role="status"]')).toBeEmpty();
    expect(requests.filter(url => /api\/patterns|challenges.cloudflare/.test(url))).toEqual([]);
    await axe(page);
  });

  test(`all found opens the authored model and announces once (${lang})`, async ({ page }) => {
    await open(page, lang, [1, 1, 1]); await observe(page); await submit(page);
    await expect(page.locator('[data-lp-result] .lp-choice')).toHaveCount(3);
    await expect(page.locator('[data-lp-mark="correct"]')).toHaveCount(3);
    await expect(page.locator('[data-lp-model]')).toHaveAttribute('open', '');
    await expect(page.locator('[data-lp-model] p')).toHaveText(examples[lang].model);
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([lang === 'fr' ? 'Idées clés : 3 sur 3' : '3 of 3 key ideas']);
    expect(await page.evaluate(() => window.lpTestCalls)).toEqual([{ block: '07-explain-back', fields: { answer: 'My explanation' }, slot: true }]);
    await axe(page);
  });

  test(`partial and unsure rows use authored hints and lesson focus links (${lang})`, async ({ page }) => {
    await open(page, lang, [1, 0, .5]); await observe(page); await submit(page);
    const rows = page.locator('[data-lp-result] .lp-choice');
    await expect(rows.nth(0)).toContainText(examples[lang].ideas[0].met);
    await expect(rows.nth(1)).toContainText(examples[lang].ideas[1].missed);
    await expect(rows.nth(2)).toContainText(examples[lang].ideas[2].unsure);
    await expect(rows.nth(1)).toHaveAttribute('data-lp-mark', 'missing');
    await expect(rows.nth(2)).toHaveAttribute('data-lp-mark', 'unsure');
    await expect(page.locator('[data-lp-model]')).toBeHidden();
    expect(await page.evaluate(() => window.lpAnnouncements)).toHaveLength(1);
    await axe(page);
    await page.locator('[data-lp-reread="2"]').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#example-lesson-return')).toBeFocused();
    expect(await page.evaluate(() => window.lpAnnouncements)).toHaveLength(1);
  });

  for (const mode of ['missing', 'throws']) {
    test(`self-check fallback when ask ${mode} (${lang})`, async ({ page }) => {
      await open(page, lang, [1, 1, 1], mode);
      if (mode === 'throws') { await observe(page); await submit(page); }
      await expect(page.locator('[data-lp-check]')).toBeHidden();
      await expect(page.locator('[data-lp-fallback]')).toBeVisible();
      await expect(page.getByRole('checkbox')).toHaveCount(3);
      await expect(page.locator('[data-lp-model]')).toHaveAttribute('open', '');
      await page.getByRole('checkbox').first().check();
      await expect(page.getByRole('checkbox').first()).toBeChecked();
      await expect(page.locator('[data-lp-model] p')).toHaveText(examples[lang].model);
      if (mode === 'throws') expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([pageFallback(lang)]);
      await axe(page);
    });
  }
}
function pageFallback(lang) { return lang === 'fr' ? "La vérification automatique est indisponible. Cochez les idées dans votre explication." : "Automatic checking is unavailable. Tick the ideas in your explanation."; }

test('keyboard journey validates empty text, submits and rereads without result focus jumps', async ({ page }) => {
  await open(page); await observe(page);
  await page.getByRole('textbox').focus(); await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-check]')).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox')).toBeFocused();
  await expect(page.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('textbox')).toHaveAttribute('aria-describedby', /example-error/);
  await page.keyboard.type('My explanation'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-result]')).toBeVisible();
  await expect(page.locator('[data-lp-check]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Read the text again' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-reread]')).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.locator('#example-lesson-return')).toBeFocused();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Write an explanation first.', '2 of 3 key ideas']);
});

test('typing preserves feedback and does not announce or send until the next submit', async ({ page }) => {
  await open(page); await submit(page); await observe(page);
  await page.getByRole('textbox').fill('Revised explanation');
  await expect(page.locator('[data-lp-result]')).toContainText('2 of 3 key ideas');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  expect(await page.evaluate(() => window.lpTestCalls.length)).toBe(1);
  await page.locator('[data-lp-check]').click();
  expect(await page.evaluate(() => window.lpTestCalls.length)).toBe(2);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['2 of 3 key ideas']);
});

test('edits while pending discard the judgment and allow a new check', async ({ page }) => {
  await open(page, 'en', [1, 1, 1], 'pending'); await submit(page);
  await page.getByRole('textbox').fill('Different explanation');
  await page.evaluate(() => window.lpResolve());
  await expect(page.locator('[data-lp-check]')).toBeEnabled();
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  await expect(page.locator('[role="status"]')).toBeEmpty();
});

test('pending check keeps keyboard focus and refuses duplicate submissions', async ({ page }) => {
  await open(page, 'en', [1, 1, 1], 'pending');
  await page.getByRole('textbox').fill('My explanation');
  await page.locator('[data-lp-check]').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-check]')).toBeFocused();
  await expect(page.locator('[data-lp-check]')).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.lpTestCalls.length)).toBe(1);
  await page.evaluate(() => window.lpResolve());
  await expect(page.locator('[data-lp-result]')).toBeVisible();
  await expect(page.locator('[data-lp-check]')).toBeFocused();
});

test('failed configuration selects the fallback without sending an answer', async ({ page }) => {
  await open(page);
  await page.evaluate(async content => {
    window.lpInstances[0].destroy();
    const { enhance } = await import('/patterns/explain-back/enhance.js');
    const { strings } = await import('/patterns/explain-back/strings.js');
    const ask = Object.assign(async () => { throw new Error('Must not send'); }, { config: async () => { throw new Error('No configuration'); } });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, ask });
  }, examples.en);
  await page.getByRole('button', { name: "I'm ready to explain it" }).click();
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await expect(page.locator('[data-lp-check]')).toBeHidden();
  await expect(page.locator('[role="status"]')).toBeEmpty();
});

test('shared client renders the configured provider notice and completes inline clearance', async ({ page }) => {
  await open(page);
  await page.evaluate(async content => {
    window.lpInstances[0].destroy();
    const { enhance } = await import('/patterns/explain-back/enhance.js');
    const { strings } = await import('/patterns/explain-back/strings.js');
    const { createAsk } = await import('/lib/ask.js');
    const { noticeConfig } = await import('/lib/data-notice.js');
    window.lpNetworkCalls = []; window.lpWidget = null;
    window.turnstile = {
      render(slot, options) { slot.textContent = 'Verification'; window.lpWidget = { slot, options }; return 'test'; },
      remove() {}
    };
    const ask = createAsk({ fetch: async (url, options) => {
      window.lpNetworkCalls.push({ url, options });
      if (url.endsWith('/config')) return Response.json({ siteKey: 'test', provider: 'jev', ...noticeConfig('jev') });
      if (!options.headers['x-turnstile-token']) return Response.json({ reason: 'turnstile' }, { status: 403 });
      return Response.json({ answers: { stonewalling: { noul: 1 }, pause: { noul: 1 }, return: { noul: 1 } } });
    } });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, ask });
  }, examples.en);
  await expect(page.locator('[data-lp-check]')).toBeEnabled();
  await page.getByRole('button', { name: "I'm ready to explain it" }).click();
  // Hiding the lesson moves the check button up the page, so wait for the step switch before clicking it.
  await expect(page.locator('.lp-explain-back-lesson')).toBeHidden();
  await expect(page.locator('[data-lp-notice]')).toHaveText('Your answer is sent to a decision model; the service does not store it or use it for training.');
  await expect(page.locator('[data-lp-challenge]')).toBeHidden();
  await submit(page);
  await expect(page.locator('[data-lp-challenge]')).toBeVisible();
  expect(await page.evaluate(() => window.lpWidget.slot === document.querySelector('[data-lp-challenge]'))).toBe(true);
  await page.evaluate(() => window.lpWidget.options.callback('test-token'));
  await expect(page.locator('[data-lp-result]')).toContainText('3 of 3 key ideas');
  await expect(page.locator('[data-lp-challenge]')).toBeHidden();
  expect(await page.evaluate(() => window.lpNetworkCalls.map(call => call.url))).toEqual(['/api/patterns/config', '/api/patterns/ask', '/api/patterns/ask']);
});

test('saved drafts and native ticks restore', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { answer: 'Saved draft', ticked: ['pause'] }; });
  await open(page, 'en', [1, 1, 1], 'missing');
  await expect(page.locator('.lp-explain-back-lesson')).toBeHidden();
  await expect(page.getByRole('textbox')).toHaveValue('Saved draft');
  await expect(page.getByRole('checkbox').nth(1)).toBeChecked();
  await page.getByRole('checkbox').nth(2).check();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ answer: 'Saved draft', ticked: ['pause', 'return'] });
  await page.evaluate(() => { window.lpInstances[0].destroy(); window.lpSeed = null; });
  await expect(page.locator('[role="status"]')).toBeEmpty();
});

test('invalid saved state is ignored', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { answer: 'Invalid draft', ticked: ['unknown'] }; });
  await open(page, 'en', [1, 1, 1], 'missing');
  await expect(page.getByRole('textbox')).toHaveValue('');
  for (const checkbox of await page.getByRole('checkbox').all()) await expect(checkbox).not.toBeChecked();
});

test('enhance is idempotent; destroy restores markup and cancels pending work', async ({ page }) => {
  await open(page, 'en', [1, 1, 1], 'pending');
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await submit(page);
  await page.evaluate(() => { window.lpInstances[0].destroy(); window.lpInstances[0].destroy(); window.lpResolve(); });
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await expect(page.locator('[data-lp-result]')).toBeEmpty();
  await expect(page.locator('[data-lp-check]')).toBeHidden();
  await page.getByRole('textbox').fill('After destroy');
  expect(await page.evaluate(() => window.lpSaved.answer)).toBe('My explanation');
  await page.evaluate(() => window.lpEnhance());
  await expect(page.locator('[data-lp-check]')).toBeEnabled();
});

for (const lang of ['en', 'fr']) {
  test(`320 px reflow, text spacing and reduced motion (${lang})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, lang, [1, 0, .5]); await submit(page);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const clipped = await page.locator('.lp-choice, .lp-button, .lp-input').evaluateAll(elements => elements.filter(el => el.clientWidth + 1 < el.scrollWidth).map(el => el.className));
      expect(clipped).toEqual([]);
      expect(await page.locator('[data-lp-check]').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
    }
    await axe(page);
  });
}

test('forced colours preserve row marks and keyboard focus', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page, 'en', [1, 0, .5]); await submit(page);
  await expect(page.locator('[data-lp-mark="correct"]')).toHaveCSS('border-style', 'double');
  await expect(page.locator('[data-lp-mark="missing"]')).toHaveCSS('border-style', 'double');
  for (const target of [page.locator('[data-lp-check]'), page.locator('[data-lp-reread]').first()]) {
    await target.focus(); await expect(target).toHaveCSS('outline-width', '2px'); await expect(target).toHaveCSS('outline-style', 'solid');
  }
});

// Keys and text align to the row's top; choice-rows.spec.js checks the text is optically centred on the key.
test('choice keys and text align to the top of the row at wide and narrow widths', async ({ page }) => {
  await open(page, 'en', [1, 0, .5]); await submit(page); await page.evaluate(() => document.fonts.ready);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const alignments = await page.locator('[data-lp-result] .lp-choice').evaluateAll(rows => rows.map(row => {
      const key = row.querySelector('.lp-choice-key');
      return [getComputedStyle(key).alignSelf, getComputedStyle(key.nextElementSibling).alignSelf];
    }));
    expect(alignments).toEqual([['start', 'start'], ['start', 'start'], ['start', 'start']]);
  }
});

test('the error icon centres on the first line of its message at each width', async ({ page }) => {
  await open(page, 'en', [1, 1, 0]);
  await page.locator('[data-lp-check]').click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('[data-lp-error]')).toBeVisible();
    const offset = await page.locator('[data-lp-error]').evaluate(error => {
      const icon = error.querySelector('svg').getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(error.querySelector('span').firstChild);
      const line = range.getClientRects()[0];
      return Math.abs((icon.top + icon.height / 2) - (line.top + line.height / 2));
    });
    expect(offset).toBeLessThan(1);
  }
});

test('the reading step button fills the narrow row like the explanation step', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await open(page, 'en', [1, 1, 0], 'ok', true);
  const ready = await page.getByRole('button', { name: "I'm ready to explain it" }).boundingBox();
  const lesson = await page.locator('.lp-explain-back-lesson').boundingBox();
  expect(Math.abs(ready.width - lesson.width)).toBeLessThan(1);
});

test('feedback links are at least 24 px tall touch targets', async ({ page }) => {
  await open(page, 'en', [1, 0, 0.5]); await submit(page);
  const heights = await page.locator('[data-lp-reread]').evaluateAll(links => links.map(link => link.getBoundingClientRect().height));
  expect(heights).toHaveLength(2);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(24);
});

test('two instances keep independent state and unique prefixed IDs', async ({ page }) => {
  await page.goto('/explain-back/two.html'); await page.waitForFunction(() => window.lpReady);
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id));
  expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  await roots.first().getByRole('button', { name: "I'm ready to explain it" }).click();
  await roots.first().getByRole('textbox').fill('One explanation'); await roots.first().locator('[data-lp-check]').click();
  await expect(roots.nth(1).locator('.lp-explain-back-lesson')).toBeVisible();
  await roots.nth(1).getByRole('button', { name: "I'm ready to explain it" }).click();
  await expect(roots.nth(1).getByRole('textbox')).toHaveValue('');
  await expect(roots.nth(1).locator('[data-lp-result]')).toBeHidden();
});

test('without JavaScript the lesson, answer, checklist and model work in both languages', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const lang of ['en', 'fr']) {
    await page.goto(`${baseURL}/explain-back/${lang}.html`);
    await expect(page.locator('.lp-explain-back-lesson')).toBeVisible();
    await expect(page.locator('.lp-box')).toBeVisible();
    await expect(page.getByRole('textbox')).toBeVisible();
    await expect(page.getByRole('button')).toHaveCount(0);
    await expect(page.locator('[data-lp-check]')).toBeHidden();
    await page.getByRole('checkbox').first().check();
    await expect(page.getByRole('checkbox').first()).toBeChecked();
    await expect(page.locator('[data-lp-model] p')).toHaveText(examples[lang].model);
  }
  await context.close();
});

test('capture requested English and French states', async ({ page, browserName }) => {
  test.skip(!process.env.LP_SHOTS || browserName !== 'chromium', 'Screenshots run once in Chromium when requested.');
  await mkdir(process.env.LP_SHOTS, { recursive: true });
  for (const lang of ['en', 'fr']) for (const width of [1280, 390]) for (const stage of ['initial', 'partial', 'all-found', 'fallback']) {
    await page.setViewportSize({ width, height: 1000 });
    await open(page, lang, stage === 'all-found' ? [1, 1, 1] : [1, 1, 0], stage === 'fallback' ? 'missing' : 'ok');
    if (stage === 'partial' || stage === 'all-found') {
      await page.getByRole('textbox').fill(stage === 'all-found' ? examples[lang].model : examples[lang].ideas.slice(0, 2).map(idea => idea.label).join(' '));
      await page.locator('[data-lp-check]').click();
    }
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(process.env.LP_SHOTS, `${lang}-${width}-${stage}.png`), fullPage: true });
  }
});

for (const lang of ['en', 'fr']) for (const reason of ['ip_daily', 'budget']) test(`daily cap shows and announces once, keeps focus and a usable fallback (${lang}, ${reason})`, async ({ page }) => {
  await open(page, lang, [1, 1, 0], reason); await observe(page);
  const root = page.locator('[data-lp-pattern]').first();
  const input = root.getByRole('textbox');
  await input.fill('A complete draft for a live check');
  const trigger = root.locator('[data-lp-check]');
  await trigger.focus();
  await page.evaluate(() => {
    window.lpCapFocusMoves = 0;
    document.addEventListener('focusin', () => { window.lpCapFocusMoves++; });
  });
  await page.keyboard.press('Enter');
  const message = CAP_MESSAGES[reason][lang];
  await expect(root.locator('[data-lp-cap]')).toHaveText(message);
  await expect(root.locator('[data-lp-cap]')).toBeVisible();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.lpCapFocusMoves)).toBe(0);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([message]);
  await expect(root.locator('[data-lp-fallback]')).toBeVisible();
  expect(await root.evaluate(root => {
    const notice = root.querySelector('[data-lp-cap]');
    const fallback = root.querySelector('[data-lp-fallback]');
    return Boolean(notice.compareDocumentPosition(fallback) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  const box = root.locator('[data-lp-fallback] input').first();
  await box.check();
  await expect(box).toBeChecked();
});
