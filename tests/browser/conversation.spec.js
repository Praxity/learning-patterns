import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { BRANCHES, confidenceGate } from '../../proxy/logic/03-contract.js';
import { strings } from '../../patterns/conversation/strings.js';

const examples = Object.fromEntries(await Promise.all(['en', 'fr'].map(async lang => [lang, JSON.parse(await readFile(new URL(`../../patterns/conversation/examples/${lang}.json`, import.meta.url)))])));

async function open(page, lang = 'en', choice = 'acknowledge', confidence = 1, mode = 'ok') {
  await page.addInitScript(({ choice, confidence, mode }) => {
    window.lpTestCalls = [];
    if (mode === 'missing') window.lpAsk = null;
    else window.lpAsk = async (block, fields, options) => {
      window.lpTestCalls.push({ block, fields, slot: !!options.challengeSlot });
      if (mode === 'throws') throw new Error('Offline');
      if (mode === 'pending') await new Promise(resolve => { window.lpResolve = resolve; });
      return { branch: { choice, confidence } };
    };
  }, { choice, confidence, mode });
  await page.goto(`/conversation/${lang}.html`);
  await page.waitForFunction(() => window.lpReady);
  if (mode !== 'missing') await expect(page.locator('[data-lp-send]')).toBeEnabled();
}
async function submit(page, text = 'My reply') {
  await page.getByRole('textbox').fill(text);
  await page.locator('[data-lp-send]').click();
}
async function axe(page) {
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
}
async function observe(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    // Focus reads Michel's line once. The empty status region is for quiet nudges.
    document.addEventListener('focusin', event => { if (event.target.matches('[data-lp-michel]')) window.lpAnnouncements.push(event.target.textContent); });
    new MutationObserver(records => { for (const record of records) if (record.target.textContent) window.lpAnnouncements.push(record.target.textContent); })
      .observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}

for (const lang of ['en', 'fr']) {
  test(`opening chat, composer, configured notice and no typing feedback (${lang})`, async ({ page }) => {
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await open(page, lang); await observe(page);
    await expect(page.locator('[data-lp-michel]')).toHaveText(examples[lang].opening);
    await expect(page.getByRole('textbox')).toHaveAccessibleName(strings[lang].reply.replace('{name}', examples[lang].person.name));
    await expect(page.getByRole('textbox')).toHaveAttribute('maxlength', '1200');
    await expect(page.locator('[data-lp-notice]')).toContainText(lang === 'fr' ? 'Votre réponse reste' : 'Your answer stays');
    await expect(page.locator('[data-lp-script]')).toBeHidden();
    await expect(page.locator('[data-lp-debrief]')).toBeHidden();
    await expect(page.locator('[data-lp-choices]')).not.toHaveAttribute('open');
    await page.getByRole('textbox').fill('A draft');
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
    expect(requests.filter(url => /api\/patterns|challenges.cloudflare/.test(url))).toEqual([]);
    await axe(page);
  });

  for (const branch of BRANCHES) {
    test(`typed ${branch} at both rounds, authored debrief and one announcement (${lang})`, async ({ page }) => {
      await open(page, lang, branch); await observe(page); await submit(page);
      await expect(page.locator('[data-lp-michel]').last()).toHaveText(examples[lang].branches[branch].line);
      await expect(page.locator('[data-lp-michel]').last()).toBeFocused();
      await expect(page.locator('[data-lp-chat] [data-lp-you]')).toHaveText('YouMy reply'.replace('You', strings[lang].you));
      await expect(page.getByRole('textbox')).toHaveValue('');
      await expect(page.locator('[data-lp-debrief]')).toBeHidden();
      expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([examples[lang].branches[branch].line]);
      await submit(page, 'My second reply');
      await expect(page.locator('[data-lp-michel]').last()).toHaveText(examples[lang].branches[branch].endings[branch]);
      await expect(page.locator('[data-lp-michel]').last()).toBeFocused();
      await expect(page.locator('[data-lp-flow]')).toBeHidden();
      // The same move at both rounds is named once.
      await expect(page.locator('[data-lp-debrief] li')).toHaveCount(1);
      await expect(page.locator('[data-lp-debrief] li').first()).toContainText(examples[lang].branches[branch].move);
      await expect(page.locator('[data-lp-debrief] li').last()).toContainText(examples[lang].branches[branch].debrief);
      expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([examples[lang].branches[branch].line, examples[lang].branches[branch].endings[branch]]);
      expect(await page.evaluate(() => window.lpTestCalls)).toEqual([
        { block: '03-branch', fields: { node: 'opening', reply: 'My reply' }, slot: true },
        { block: '03-branch', fields: { node: branch, reply: 'My second reply' }, slot: true }
      ]);
      if (branch === 'attack') await expect(page.locator('[data-lp-note]').last()).toHaveText(examples[lang].stageNotes['attack:attack']);
      await axe(page);
    });
  }

  for (const [kind, branch, confidence, field] of [['unsure', 'defend', 0, 'unsure'], ['off-script', 'off_script', 1, 'offScript']]) {
    test(`${kind} opens replies without taking a round (${lang})`, async ({ page }) => {
      await open(page, lang, branch, confidence); await observe(page); await submit(page);
      await expect(page.locator('[data-lp-hint]')).toHaveText(examples[lang][field]);
      await expect(page.locator('[data-lp-choices]')).toHaveAttribute('open', '');
      await expect(page.locator('[data-lp-michel]')).toHaveCount(1);
      await expect(page.locator('[data-lp-you]')).toHaveCount(0);
      await expect(page.getByRole('textbox')).toHaveValue('My reply');
      expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([examples[lang][field]]);
      await page.locator('[data-lp-branch="acknowledge"]').click();
      await expect(page.locator('[data-lp-michel]')).toHaveCount(2);
      await expect(page.locator('[data-lp-hint]')).toBeHidden();
      await expect(page.locator('[data-lp-choices]')).not.toHaveAttribute('open');
      await submit(page);
      await expect(page.locator('[data-lp-michel]')).toHaveCount(2);
      await expect(page.locator('[data-lp-hint]')).toHaveText(examples[lang][field]);
      await expect(page.locator('[data-lp-debrief]')).toBeHidden();
      await axe(page);
    });
  }

  for (const mode of ['missing', 'throws']) {
    test(`complete conversation when ask ${mode} (${lang})`, async ({ page }) => {
      await open(page, lang, 'acknowledge', 1, mode);
      if (mode === 'throws') await submit(page);
      await expect(page.locator('[data-lp-composer]')).toBeHidden();
      await expect(page.locator('[data-lp-offline]')).toHaveText(strings[lang].fallback);
      await expect(page.locator('[data-lp-choices]')).toHaveAttribute('open', '');
      await page.locator('[data-lp-branch="defend"]').click();
      await page.locator('[data-lp-branch="acknowledge"]').click();
      await expect(page.locator('[data-lp-michel]').last()).toHaveText(examples[lang].branches.defend.endings.acknowledge);
      await expect(page.locator('[data-lp-debrief]')).toBeVisible();
      await page.locator('[data-lp-restart]').click();
      await expect(page.locator('[data-lp-michel]')).toHaveCount(1);
      await expect(page.locator('[data-lp-michel]')).toBeFocused();
      await expect(page.locator('[data-lp-debrief]')).toBeHidden();
      await expect(page.locator('[data-lp-branch]')).toHaveCount(5);
      expect(await page.evaluate(() => window.lpTestCalls.length)).toBe(mode === 'missing' ? 0 : 1);
      await axe(page);
    });
  }

  test(`320 px, text spacing and reduced motion (${lang})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page, lang, 'attack');
    await submit(page); await submit(page);
    await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('.lp-conversation-bubble, [data-lp-restart]').evaluateAll(els => els.filter(el => el.clientWidth + 1 < el.scrollWidth).map(el => el.className))).toEqual([]);
      expect(await page.locator('[data-lp-restart]').evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
    }
    await page.locator('[data-lp-restart]').click();
    await page.getByRole('textbox').fill('A reply');
    await page.locator('[data-lp-choices] summary').click();
    expect(await page.locator('[data-lp-branch]').evaluateAll(els => els.filter(el => el.clientWidth + 1 < el.scrollWidth).map(el => el.className))).toEqual([]);
    await axe(page);
  });
}

test('all 25 branch paths work through chips with no model', async ({ page }) => {
  await open(page, 'en', 'acknowledge', 1, 'missing');
  for (const first of BRANCHES) for (const second of BRANCHES) {
    await page.locator(`[data-lp-branch="${first}"]`).click();
    await expect(page.locator('[data-lp-branch]').first()).toContainText(examples.en.examples[first].acknowledge);
    await page.locator(`[data-lp-branch="${second}"]`).click();
    await expect(page.locator('[data-lp-michel]').last()).toHaveText(examples.en.branches[first].endings[second]);
    await page.locator('[data-lp-restart]').click();
  }
  expect(await page.evaluate(() => window.lpTestCalls)).toEqual([]);
});

test('keyboard reaches composer after Michel, opens chips instantly and restarts', async ({ page }) => {
  await open(page); await observe(page);
  await page.getByRole('textbox').focus(); await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-send]')).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox')).toBeFocused();
  await expect(page.locator('[data-lp-error]')).toBeVisible();
  await submit(page);
  await expect(page.locator('[data-lp-michel]').last()).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('textbox')).toBeFocused();
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-choices] summary')).toBeFocused();
  await page.keyboard.press('Enter'); await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-branch]').first()).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('[data-lp-michel]').last()).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-restart]')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('[data-lp-michel]')).toBeFocused();
});

test('pending edits discard results; restart and destroy cancel pending turns', async ({ page }) => {
  await open(page, 'en', 'attack', 1, 'pending');
  await submit(page); await page.getByRole('textbox').fill('Revised reply');
  await page.evaluate(() => window.lpResolve());
  await expect(page.locator('[data-lp-send]')).not.toHaveAttribute('aria-disabled');
  await expect(page.locator('[data-lp-michel]')).toHaveCount(1);
  await page.locator('[data-lp-send]').click(); await page.locator('[data-lp-restart]').click();
  await page.evaluate(() => window.lpResolve());
  await expect(page.locator('[data-lp-michel]')).toHaveCount(1);
  await submit(page);
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await page.evaluate(() => { window.lpInstances[0].destroy(); window.lpInstances[0].destroy(); window.lpResolve(); });
  await expect(page.locator('[data-lp-script]')).toBeVisible();
  await expect(page.locator('[data-lp-flow]')).toBeHidden();
  await page.evaluate(() => window.lpEnhance());
  await expect(page.locator('[data-lp-script]')).toBeHidden();
});

test('saved valid turns restore; invalid saved state is ignored', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { draft: 'Next reply', conversation: { node: 'defend', round: 1, history: [{ branch: 'defend', reply: 'Saved reply' }], end: false } }; });
  await open(page);
  await expect(page.locator('[data-lp-michel]').last()).toHaveText(examples.en.branches.defend.line);
  await expect(page.getByRole('textbox')).toHaveValue('Next reply');
  await expect(page.locator('[role="status"]')).toBeEmpty();
  await page.getByRole('textbox').fill('Another draft');
  expect(await page.evaluate(() => window.lpSaved.draft)).toBe('Another draft');
  await page.addInitScript(() => { window.lpSeed = { draft: 'Invalid', conversation: { node: 'defend', round: 2, history: [], end: true } }; });
  await page.reload(); await page.waitForFunction(() => window.lpReady);
  await expect(page.locator('[data-lp-michel]')).toHaveCount(1);
  await expect(page.getByRole('textbox')).toHaveValue('');
});

test('failed configuration and invalid answers open the complete fallback', async ({ page }) => {
  for (const mode of ['config', 'invalid']) {
    await open(page);
    await page.evaluate(async ({ content, mode }) => {
      window.lpInstances[0].destroy();
      const { enhance } = await import('/patterns/conversation/enhance.js');
      const { strings } = await import('/patterns/conversation/strings.js');
      const { noticeConfig } = await import('/lib/data-notice.js');
      const ask = Object.assign(async () => ({ branch: { choice: 'invented', confidence: 1 } }), { config: async () => {
        if (mode === 'config') throw new Error('No config');
        return { provider: 'clef', model: '@cf/cloudflare/clef', siteKey: '', ...noticeConfig('clef') };
      } });
      window.lpInstances[0] = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, ask });
    }, { content: examples.en, mode });
    if (mode === 'invalid') await submit(page);
    await expect(page.locator('[data-lp-composer]')).toBeHidden();
    await expect(page.locator('[data-lp-branch]')).toHaveCount(5);
    await expect(page.locator('[data-lp-offline]')).toBeVisible();
  }
});

test('configured model chooses its own gate and public data notice', async ({ page }) => {
  for (const model of ['jev', '@cf/cloudflare/clef-flash', '@cf/cloudflare/clef']) {
    await open(page);
    await page.evaluate(async ({ content, model, gate }) => {
      window.lpInstances[0].destroy();
      const { enhance } = await import('/patterns/conversation/enhance.js');
      const { strings } = await import('/patterns/conversation/strings.js');
      const { noticeConfig } = await import('/lib/data-notice.js');
      const ask = Object.assign(async () => ({ branch: { choice: 'pause', confidence: gate } }), { config: async () => ({ provider: model === 'jev' ? 'jev' : 'clef', model, siteKey: '', ...noticeConfig(model === 'jev' ? 'jev' : 'clef') }) });
      window.lpInstances[0] = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, ask });
    }, { content: examples.en, model, gate: confidenceGate(model) });
    await expect(page.locator('[data-lp-notice]')).toContainText(model === 'jev' ? 'TypeSafe (US)' : 'Cloudflare Workers AI');
    await submit(page);
    await expect(page.locator('[data-lp-michel]').last()).toHaveText(examples.en.branches.pause.line);
  }
});

test('shared client requests clearance only on submission and renders it inline', async ({ page }) => {
  await open(page);
  await page.evaluate(async content => {
    window.lpInstances[0].destroy();
    const { enhance } = await import('/patterns/conversation/enhance.js');
    const { strings } = await import('/patterns/conversation/strings.js');
    const { createAsk } = await import('/lib/ask.js');
    const { noticeConfig } = await import('/lib/data-notice.js');
    window.lpNetworkCalls = []; window.lpWidget = null;
    window.turnstile = { render(slot, options) { slot.textContent = 'Verification'; window.lpWidget = { slot, options }; return 'test'; }, remove() {} };
    const ask = createAsk({ fetch: async (url, options) => {
      window.lpNetworkCalls.push(url);
      if (url.endsWith('/config')) return Response.json({ siteKey: 'test', provider: 'clef', model: '@cf/cloudflare/clef', ...noticeConfig('clef') });
      if (!options.headers['x-turnstile-token']) return Response.json({ reason: 'turnstile' }, { status: 403 });
      return Response.json({ answers: { branch: { choice: 'acknowledge', confidence: 1 } } });
    } });
    window.lpInstances[0] = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, ask });
  }, examples.en);
  await expect(page.locator('[data-lp-send]')).toBeEnabled();
  await expect(page.locator('[data-lp-notice]')).toContainText('Cloudflare Workers AI');
  await expect(page.locator('[data-lp-challenge]')).toBeHidden();
  expect(await page.evaluate(() => window.lpNetworkCalls)).toEqual(['/api/patterns/config']);
  await submit(page);
  await expect(page.locator('[data-lp-challenge]')).toBeVisible();
  expect(await page.evaluate(() => window.lpWidget.slot === document.querySelector('[data-lp-challenge]'))).toBe(true);
  await page.evaluate(() => window.lpWidget.options.callback('test-token'));
  await expect(page.locator('[data-lp-challenge]')).toBeHidden();
  await expect(page.locator('[data-lp-michel]').last()).toHaveText(examples.en.branches.acknowledge.line);
  expect(await page.evaluate(() => window.lpNetworkCalls)).toEqual(['/api/patterns/config', '/api/patterns/ask', '/api/patterns/ask']);
});

test('forced colours preserve bubbles and visible keyboard focus', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page); await submit(page);
  await expect(page.locator('[data-lp-michel]').last()).toHaveCSS('border-style', 'solid');
  await expect(page.locator('[data-lp-you]')).toHaveCSS('border-style', 'dashed');
  await page.getByRole('textbox').focus();
  await expect(page.locator('.lp-conversation-composer')).toHaveCSS('outline-style', 'solid');
  await expect(page.locator('.lp-conversation-composer')).toHaveCSS('outline-width', '2px');
});

test('two instances have independent turns and unique prefixed IDs', async ({ page }) => {
  await page.goto('/conversation/two.html'); await page.waitForFunction(() => window.lpReady);
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id));
  expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  await roots.first().getByRole('textbox').fill('One'); await roots.first().locator('[data-lp-send]').click();
  await expect(roots.nth(1).locator('[data-lp-michel]')).toHaveCount(1);
  await expect(roots.nth(1).getByRole('textbox')).toHaveValue('');
});

test('without JavaScript a static script offers all branches, endings and debriefs', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const lang of ['en', 'fr']) {
    await page.goto(`${baseURL}/conversation/${lang}.html`);
    await expect(page.locator('[data-lp-flow]')).toBeHidden();
    await expect(page.locator('[data-lp-script]')).toBeVisible();
    await page.locator('[data-lp-script] > details').first().locator(':scope > summary').click();
    const second = page.locator('[data-lp-static-end]').first();
    await second.locator('summary').click();
    await expect(second).toContainText(examples[lang].branches.acknowledge.endings.acknowledge);
    await expect(second).toContainText(examples[lang].branches.acknowledge.debrief);
    await expect(page.locator('[data-lp-static-end]')).toHaveCount(25);
  }
  await context.close();
});

test('capture requested states in English and French', async ({ page, browserName }) => {
  test.skip(!process.env.LP_SHOTS || browserName !== 'chromium', 'Screenshots run once in Chromium when requested.');
  await mkdir(process.env.LP_SHOTS, { recursive: true });
  for (const lang of ['en', 'fr']) for (const width of [1280, 390]) for (const stage of ['opening', 'round-one', 'unsure', 'end', 'without-model']) {
    await page.setViewportSize({ width, height: 1000 });
    await open(page, lang, stage === 'unsure' ? 'defend' : 'acknowledge', stage === 'unsure' ? 0 : 1, stage === 'without-model' ? 'missing' : 'ok');
    if (['round-one', 'unsure', 'end'].includes(stage)) await submit(page, examples[lang].examples.opening.acknowledge);
    if (stage === 'end') await submit(page, examples[lang].examples.acknowledge.acknowledge);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(process.env.LP_SHOTS, `${lang}-${width}-${stage}.png`), fullPage: true });
  }
});
