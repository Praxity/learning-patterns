import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { confidenceGate } from '../../proxy/logic/06-misconceptions.js';
import { strings } from '../../patterns/misconception/strings.js';

const examples = Object.fromEntries(await Promise.all(['en', 'fr'].map(async lang => [lang, JSON.parse(await readFile(new URL(`../../patterns/misconception/examples/${lang}.json`, import.meta.url)))])));

async function open(page, lang = 'en', choice = 'correct', confidence = 1, mode = 'ok') {
  await page.addInitScript(({ choice, confidence, mode }) => {
    window.lpTestCalls = [];
    if (mode === 'missing') window.lpAsk = null;
    else window.lpAsk = async (block, fields, options) => {
      window.lpTestCalls.push({ block, fields, slot: !!options.challengeSlot });
      if (mode === 'throws') throw new Error('Offline');
      if (mode === 'pending') await new Promise(resolve => { window.lpResolve = resolve; });
      return { misconception: { choice, confidence } };
    };
  }, { choice, confidence, mode });
  await page.goto(`/misconception/${lang}.html`);
  await page.waitForFunction(() => window.lpReady);
  await expect(page.locator('[data-lp-check]')).toBeEnabled();
}
async function submit(page) {
  await page.getByRole('textbox').fill('My answer');
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
  test(`quiz title labels three-line answer, notice and no feedback on load (${lang})`, async ({ page }) => {
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await open(page, lang);
    await expect(page.getByRole('textbox')).toHaveAccessibleName(examples[lang].question);
    await expect(page.getByRole('textbox')).toHaveAttribute('rows', '3');
    await expect(page.getByRole('textbox')).toHaveAttribute('maxlength', '1500');
    await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', lang);
    await expect(page.locator('[data-lp-notice]')).toContainText(lang === 'fr' ? 'Votre réponse reste' : 'Your answer stays');
    for (const selector of ['[data-lp-result]', '[data-lp-model]', '[data-lp-fallback]', '[data-lp-challenge]']) await expect(page.locator(selector)).toBeHidden();
    await expect(page.locator('[role="status"]')).toBeEmpty();
    expect(requests.filter(url => /api\/patterns|challenges.cloudflare/.test(url))).toEqual([]);
    await axe(page);
  });

  const cases = [
    ['key idea', 'correct', 1, 'keyIdea'],
    ['unsure key idea', 'correct', confidenceGate('@cf/cloudflare/clef') - .0001, 'unsureKeyIdea'],
    ['no match', 'none', 1, 'noMatch'],
    ['low-confidence no match', 'none', 0, 'noMatch'],
    ...examples[lang].misconceptions.flatMap(item => [[item.id, item.id, 1, 'known'], [`unsure ${item.id}`, item.id, 0, 'unsure']])
  ];
  for (const [name, choice, confidence, field] of cases) {
    test(`authored ${name} result and one announcement (${lang})`, async ({ page }) => {
      await open(page, lang, choice, confidence); await observe(page); await submit(page);
      const item = examples[lang].misconceptions.find(item => item.id === choice);
      const expected = field === 'known' ? item.why : field === 'unsure' ? examples[lang].unsureMisconception.replaceAll('{idea}', item.idea).replaceAll('{why}', item.why) : examples[lang][field];
      await expect(page.locator('[data-lp-result]')).toContainText(expected);
      if (field === 'known') {
        await expect(page.locator('[data-lp-result] h3')).toHaveText(item.label);
        await expect(page.locator('[data-lp-result] h3')).toHaveCSS('color', 'rgb(162, 74, 7)');
      } else await expect(page.locator('[data-lp-result] h3')).toHaveCount(0);
      if (field === 'keyIdea') await expect(page.locator('[data-lp-result] .lp-met .lp-icon')).toHaveCount(1);
      await expect(page.locator('[data-lp-model]')).toHaveAttribute('open', '');
      await expect(page.locator('[data-lp-model] p')).toHaveText(examples[lang].model);
      await expect(page.locator('[data-lp-fallback]')).toBeHidden();
      expect(await page.evaluate(() => window.lpAnnouncements)).toHaveLength(1);
      expect(await page.evaluate(() => window.lpTestCalls)).toEqual([{ block: '06-misconceptions', fields: { answer: 'My answer' }, slot: true }]);
      await axe(page);
    });
  }

  for (const mode of ['missing', 'throws']) {
    test(`submit reveals self-check when ask ${mode} (${lang})`, async ({ page }) => {
      await open(page, lang, 'correct', 1, mode); await observe(page);
      await expect(page.locator('[data-lp-fallback]')).toBeHidden();
      await submit(page);
      await expect(page.locator('[data-lp-fallback] legend')).toContainText(strings[lang].common);
      await expect(page.locator('[data-lp-fallback] legend')).toContainText(strings[lang].fallback);
      await expect(page.getByRole('checkbox')).toHaveCount(4);
      await page.getByRole('checkbox').first().check();
      await expect(page.getByRole('checkbox').first()).toBeChecked();
      await expect(page.locator('[data-lp-model] p')).toHaveText(examples[lang].model);
      await expect(page.getByRole('textbox')).toHaveValue('My answer');
      expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([strings[lang].fallback]);
      await expect(page.locator('[data-lp-notice]')).toBeHidden();
      await axe(page);
    });
  }
}

test('keyboard submits empty error, result and native model disclosure without focus jumps', async ({ page }) => {
  await open(page); await observe(page);
  await page.getByRole('textbox').focus(); await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-check]')).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox')).toBeFocused();
  await expect(page.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('textbox')).toHaveAttribute('aria-describedby', /example-error/);
  await page.keyboard.type('My answer'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-result]')).toBeVisible();
  await expect(page.locator('[data-lp-check]')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-model] summary')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('[data-lp-model]')).not.toHaveAttribute('open', '');
  expect(await page.evaluate(() => window.lpAnnouncements)).toHaveLength(2);
  await axe(page);
});

test('typing keeps feedback and makes no request or announcement until resubmitted', async ({ page }) => {
  await open(page); await submit(page); await observe(page);
  await page.getByRole('textbox').fill('Revised answer');
  await expect(page.locator('[data-lp-result]')).toContainText(examples.en.keyIdea);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  expect(await page.evaluate(() => window.lpTestCalls.length)).toBe(1);
  await page.locator('[data-lp-check]').click();
  expect(await page.evaluate(() => window.lpTestCalls.length)).toBe(2);
  expect(await page.evaluate(() => window.lpAnnouncements)).toHaveLength(1);
});

test('pending edits discard judgment, retain focus and guard duplicate submissions', async ({ page }) => {
  await open(page, 'en', 'correct', 1, 'pending');
  await page.getByRole('textbox').fill('My answer');
  await page.locator('[data-lp-check]').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-check]')).toBeFocused();
  await expect(page.locator('[data-lp-check]')).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.lpTestCalls.length)).toBe(1);
  await page.getByRole('textbox').fill('Different answer'); await page.evaluate(() => window.lpResolve());
  await expect(page.locator('[data-lp-check]')).not.toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  await expect(page.locator('[role="status"]')).toBeEmpty();
});

test('failed config and invalid Choice select fallback without inventing feedback', async ({ page }) => {
  await open(page);
  await page.evaluate(async content => {
    window.lpInstances[0].destroy();
    const { enhance } = await import('/patterns/misconception/enhance.js');
    const { strings } = await import('/patterns/misconception/strings.js');
    const ask = Object.assign(async () => { throw new Error('Must not send'); }, { config: async () => { throw new Error('No config'); } });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, ask });
  }, examples.en);
  await expect(page.locator('[data-lp-check]')).toBeEnabled(); await submit(page);
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await open(page, 'en', 'invented', 1); await submit(page);
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await expect(page.locator('[data-lp-result]')).toBeEmpty();
});

test('shared client gets model-specific gate and notice, verifies inline only on demand', async ({ page }) => {
  await open(page);
  await page.evaluate(async content => {
    window.lpInstances[0].destroy();
    const { enhance } = await import('/patterns/misconception/enhance.js');
    const { strings } = await import('/patterns/misconception/strings.js');
    const { createAsk } = await import('/lib/ask.js');
    const { noticeConfig } = await import('/lib/data-notice.js');
    window.lpNetworkCalls = []; window.lpWidget = null;
    window.turnstile = { render(slot, options) { slot.textContent = 'Verification'; window.lpWidget = { slot, options }; return 'test'; }, remove() {} };
    const ask = createAsk({ fetch: async (url, options) => {
      window.lpNetworkCalls.push(url);
      if (url.endsWith('/config')) return Response.json({ siteKey: 'test', provider: 'jev', model: 'jev-1.13.0', ...noticeConfig('jev') });
      if (!options.headers['x-turnstile-token']) return Response.json({ reason: 'turnstile' }, { status: 403 });
      return Response.json({ answers: { misconception: { choice: 'correct', confidence: .5 } } });
    } });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, ask });
  }, examples.en);
  await expect(page.locator('[data-lp-check]')).toBeEnabled();
  await expect(page.locator('[data-lp-notice]')).toContainText('TypeSafe (US)');
  await expect(page.locator('[data-lp-challenge]')).toBeHidden(); await submit(page);
  await expect(page.locator('[data-lp-challenge]')).toBeVisible();
  expect(await page.evaluate(() => window.lpWidget.slot === document.querySelector('[data-lp-challenge]'))).toBe(true);
  await page.evaluate(() => window.lpWidget.options.callback('test-token'));
  await expect(page.locator('[data-lp-result]')).toHaveText(examples.en.unsureKeyIdea);
  await expect(page.locator('[data-lp-challenge]')).toBeHidden();
  expect(await page.evaluate(() => window.lpNetworkCalls)).toEqual(['/api/patterns/config', '/api/patterns/ask', '/api/patterns/ask']);
});

test('saved drafts and native ticks restore, invalid state is ignored', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { answer: 'Saved answer', ticked: ['rereading'] }; });
  await open(page, 'en', 'correct', 1, 'missing'); await page.locator('[data-lp-check]').click();
  await expect(page.getByRole('textbox')).toHaveValue('Saved answer');
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await page.getByRole('checkbox').nth(1).check();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ answer: 'Saved answer', ticked: ['rereading', 'highlighting'] });
  await page.addInitScript(() => { window.lpSeed = { answer: 'Bad state', ticked: ['unknown'] }; });
  await open(page, 'en', 'correct', 1, 'missing');
  await expect(page.getByRole('textbox')).toHaveValue('');
});

test('idempotent enhancement, destroy cancels checks and restores native fallback', async ({ page }) => {
  await open(page, 'en', 'correct', 1, 'pending');
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await submit(page);
  await page.evaluate(() => { window.lpInstances[0].destroy(); window.lpInstances[0].destroy(); window.lpResolve(); });
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await expect(page.locator('[data-lp-model]')).toHaveAttribute('open', '');
  await expect(page.locator('[data-lp-result]')).toBeEmpty();
  await expect(page.locator('[data-lp-check]')).toBeHidden();
  await page.getByRole('textbox').fill('After destroy');
  expect(await page.evaluate(() => window.lpSaved.answer)).toBe('My answer');
  await page.evaluate(() => window.lpEnhance());
  await expect(page.locator('[data-lp-check]')).toBeEnabled();
});

for (const lang of ['en', 'fr']) {
  test(`320 px reflow, text spacing, instant reveals and reduced motion (${lang})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const mode of ['ok', 'missing']) {
      await open(page, lang, 'rereading', 1, mode); await submit(page);
      for (const width of [1280, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
        const overflow = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth).map(el => ({ tag: el.tagName, class: el.className, width: el.clientWidth, cssWidth: getComputedStyle(el).width, max: getComputedStyle(el).maxInlineSize, parent: el.parentElement.clientWidth })) }));
        expect(overflow.document, JSON.stringify(overflow)).toBeLessThanOrEqual(width);
        expect(await page.locator('.lp-choice, .lp-button, .lp-input').evaluateAll(elements => elements.filter(el => el.clientWidth + 1 < el.scrollWidth).map(el => el.className))).toEqual([]);
        expect(await page.locator('[data-lp-check]').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
        expect(await page.locator('[data-lp-model] p').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
      }
      await axe(page);
    }
  });
}

test('forced colours preserve icon text, native ticks and focus', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page, 'en', 'rereading'); await submit(page);
  await expect(page.locator('[data-lp-result] h3')).toHaveText(examples.en.misconceptions[0].label);
  for (const target of [page.locator('[data-lp-check]'), page.locator('[data-lp-model] summary')]) {
    await target.focus(); await expect(target).toHaveCSS('outline-width', '2px'); await expect(target).toHaveCSS('outline-style', 'solid');
  }
  await open(page, 'en', 'correct', 1, 'missing'); await submit(page);
  await page.getByRole('checkbox').first().check();
  await expect(page.locator('.lp-choice').first()).toHaveCSS('border-width', '2px');
});

test('two instances keep unique IDs and independent answers', async ({ page }) => {
  await page.goto('/misconception/two.html'); await page.waitForFunction(() => window.lpReady);
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id));
  expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  await expect(roots.first().locator('[data-lp-check]')).toBeEnabled();
  await roots.first().getByRole('textbox').fill('One answer'); await roots.first().locator('[data-lp-check]').click();
  await expect(roots.nth(1).getByRole('textbox')).toHaveValue('');
  await expect(roots.nth(1).locator('[data-lp-result]')).toBeHidden();
});

test('without JavaScript both languages have answer, model and working checklist', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const lang of ['en', 'fr']) {
    await page.goto(`${baseURL}/misconception/${lang}.html`);
    await expect(page.getByRole('textbox')).toBeVisible();
    await expect(page.locator('[data-lp-check]')).toBeHidden();
    await page.getByRole('checkbox').first().check(); await expect(page.getByRole('checkbox').first()).toBeChecked();
    await expect(page.locator('[data-lp-model] p')).toHaveText(examples[lang].model);
  }
  await context.close();
});

test('capture requested English and French states', async ({ page, browserName }) => {
  test.skip(!process.env.LP_SHOTS || browserName !== 'chromium', 'Screenshots run once in Chromium when requested.');
  await mkdir(process.env.LP_SHOTS, { recursive: true });
  for (const lang of ['en', 'fr']) for (const width of [1280, 390]) for (const stage of ['initial', 'key-idea', 'misconception', 'not-sure', 'fallback']) {
    await page.setViewportSize({ width, height: 1000 });
    await open(page, lang, stage === 'key-idea' ? 'correct' : 'rereading', stage === 'not-sure' ? 0 : 1, stage === 'fallback' ? 'missing' : 'ok');
    if (stage !== 'initial') {
      await page.getByRole('textbox').fill(stage === 'key-idea' ? examples[lang].model : lang === 'en' ? 'Yes. Rereading builds memory.' : 'Oui. Relire renforce la mémoire.');
      await page.locator('[data-lp-check]').click();
      await expect(page.locator('[data-lp-model]')).toBeVisible();
    }
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(process.env.LP_SHOTS, `${lang}-${width}-${stage}.png`), fullPage: true });
  }
});
