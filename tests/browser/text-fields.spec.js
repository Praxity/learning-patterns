import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function mount(page, name, lang, delayed = false, failConfig = false) {
  const content = JSON.parse(await readFile(new URL(`../../patterns/${name}/examples/${lang}.json`, import.meta.url)));
  await page.goto(`/${name}/${lang}.html`);
  await page.waitForFunction(() => window.lpReady);
  await page.evaluate(async ({ name, lang, content, delayed, failConfig }) => {
    window.lpInstances.forEach(instance => instance.destroy());
    const { render } = await import(`/patterns/${name}/render.js`);
    const { enhance } = await import(`/patterns/${name}/enhance.js`);
    const { strings } = await import(`/patterns/${name}/strings.js`);
    document.querySelector('main').innerHTML = render(content, strings[lang], { id: 'field', lang });
    window.textCalls = [];
    const ask = Object.assign(async (...args) => {
      window.textCalls.push(args);
      if (name === 'live-feedback') return Object.fromEntries(content.criteria.map(item => [item.id, { noul: 1 }]));
      if (name === 'course-lookup') return { lookup: { choice: content.entries[0].id, confidence: 1, probabilities: Object.fromEntries([...content.entries.map(item => item.id), 'none'].map((id, i) => [id, i === 0 ? 1 : 0])) } };
      if (name === 'misconception') return { misconception: { choice: 'rereading', confidence: 1 } };
      if (name === 'conversation') return { branch: { choice: 'acknowledge', confidence: 1 } };
      if (name === 'journal') return { situation: { noul: 1 }, action: { noul: 1 }, next_step: { noul: 0 }, when: { noul: 0 }, distress: { noul: 0 } };
      return { stonewalling: { noul: 1 }, pause: { noul: 1 }, return: { noul: 0 } };
    }, { config: async () => {
      if (delayed) await new Promise(resolve => { window.resolveTextConfig = resolve; });
      if (failConfig) throw new Error('Offline');
      return { provider: 'mock', dataNotice: { en: 'Test notice', fr: 'Avis' } };
    } });
    window.textInstance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings[lang], ask });
  }, { name, lang, content, delayed, failConfig });
  if (name === 'explain-back') {
    await page.getByRole('button', { name: lang === 'en' ? /^I'm ready to explain it$/ : /^Passer à l[’']explication$/ }).click();
    // Focus reaches the task heading after layout; typing before then is lost in Firefox.
    await expect(page.locator('#field-task')).toBeFocused();
  }
}

for (const lang of ['en', 'fr']) {
  for (const [name, limit, action] of [
    ['misconception', 1500, '[data-lp-check]'], ['explain-back', 1500, '[data-lp-check]'],
    ['journal', 1500, '[data-lp-save]'], ['conversation', 1200, '[data-lp-send]'],
    ['live-feedback', 1200, null], ['course-lookup', 500, null],
    ['first-answer', 2000, '[data-lp-save-first]'], ['write-distractors', 2000, '[data-lp-check]']
  ]) test(`${name} preserves oversized text and links an error (${lang})`, async ({ page }) => {
    await mount(page, name, lang);
    const input = page.getByRole('textbox').first(), draft = 'x'.repeat(limit + 1);
    await input.fill(draft);
    if (action) await page.locator(action).click();
    else if (name === 'course-lookup') await input.press('Enter');
    const error = page.locator(name === 'write-distractors' ? '[data-lp-answer-error]' : name === 'first-answer' ? '[data-lp-first-error]' : '[data-lp-error]');
    await expect(error).toBeVisible();
    if (['misconception', 'explain-back', 'conversation'].includes(name)) {
      await expect(error.locator('svg[aria-hidden="true"]')).toHaveCount(1);
      await input.fill('');
      await page.locator(action).click();
      await expect(error.locator('svg[aria-hidden="true"]')).toHaveCount(1);
      await input.fill(draft);
      await page.locator(action).click();
    }
    await expect(error).toContainText(lang === 'en' ? 'characters or fewer' : 'caractères ou moins');
    await expect(input).toHaveValue(draft);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    expect((await input.getAttribute('aria-describedby')).split(' ')).toContain(await error.getAttribute('id'));
    expect(await page.evaluate(() => window.textCalls)).toEqual([]);
  });
}
for (const [name, action] of [['misconception', '[data-lp-check]'], ['explain-back', '[data-lp-check]'], ['conversation', '[data-lp-send]'], ['journal', '[data-lp-suggest]']]) {
  for (const failConfig of [false, true]) test(`${name} accepts an early press while config is pending, failure=${failConfig}`, async ({ page }) => {
    await mount(page, name, 'en', true, failConfig);
    await page.getByRole('textbox').fill('A draft long enough to check.');
    const button = page.locator(action);
    await expect(button).toBeEnabled();
    await button.click();
    await button.click();
    expect(await page.evaluate(() => window.textCalls.length)).toBe(0);
    await page.evaluate(() => window.resolveTextConfig());
    if (failConfig) {
      await expect(page.locator('[data-lp-notice]')).toBeHidden();
      await expect(page.locator(name === 'conversation' ? '[data-lp-offline]' : name === 'journal' ? '[data-lp-questions]' : '[data-lp-fallback]')).toBeVisible();
      expect(await page.evaluate(() => window.textCalls.length)).toBe(0);
    } else {
      await expect.poll(() => page.evaluate(() => window.textCalls.length)).toBe(1);
      if (name === 'misconception' || name === 'explain-back' || name === 'journal') await expect(page.locator('[data-lp-result]')).toBeVisible();
      else await expect(page.locator('[data-lp-you]')).toHaveCount(1);
    }
  });
}

for (const [name, limit] of [['live-feedback', 1200], ['course-lookup', 500]]) {
  test(`${name} announces a length error once per crossing and clears it`, async ({ page }) => {
    await mount(page, name, 'en');
    await expect(page.locator('[data-lp-notice]')).toBeVisible();
    await page.evaluate(() => {
      window.statusWrites = [];
      const status = document.querySelector('[role="status"]');
      window.statusObserver = new MutationObserver(records => {
        for (const record of records) window.statusWrites.push(record.target.textContent);
      });
      window.statusObserver.observe(status, { childList: true, characterData: true, subtree: true });
    });
    const input = page.getByRole('textbox').first();
    await input.fill('x'.repeat(limit + 3));
    await expect(page.locator('[data-lp-error]')).toBeVisible();
    await input.fill('x'.repeat(limit + 2));
    await input.fill('x'.repeat(limit + 1));
    // Let both automatic typing-pause checks run while the error is already shown.
    await page.waitForTimeout(2000);
    expect(await page.evaluate(() => window.statusWrites.filter(text => text.includes('characters or fewer')).length)).toBe(1);
    await input.fill('short');
    await expect(page.locator('[data-lp-error]')).toBeHidden();
    await expect(page.locator('[role="status"]')).toBeEmpty();
    await input.fill('x'.repeat(limit + 1));
    await expect(page.locator('[data-lp-error]')).toBeVisible();
    expect(await page.evaluate(() => window.statusWrites.filter(text => text.includes('characters or fewer')).length)).toBe(2);
    await page.evaluate(() => window.statusObserver.disconnect());
  });
}
test('journal announces the fallback when an early suggestion waits for failed config', async ({ page }) => {
  await mount(page, 'journal', 'en', true, true);
  await page.getByRole('textbox').fill('A draft long enough to check.');
  await page.locator('[data-lp-suggest]').click();
  await page.evaluate(() => window.resolveTextConfig());
  const { strings } = await import('../../patterns/journal/strings.js');
  await expect(page.locator('[role="status"]')).toHaveText(strings.en.fallback);
});

for (const [name, limit] of [['live-feedback', 1200], ['course-lookup', 500]]) {
  test(`${name} clears previous results when the draft is oversized`, async ({ page }) => {
    await mount(page, name, 'en');
    await expect(page.locator('[data-lp-notice]')).toBeVisible();
    const input = page.getByRole('textbox').first();
    await input.fill('A complete answer long enough to check.');
    if (name === 'course-lookup') await input.press('Enter');
    if (name === 'live-feedback') await expect(page.locator('[data-lp-complete]')).toBeVisible();
    else await expect(page.locator('[data-lp-result]')).toBeVisible();
    await input.fill('x'.repeat(limit + 1));
    if (name === 'live-feedback') {
      await expect(page.locator('[data-lp-complete]')).toBeHidden();
      await expect(page.locator('[data-lp-criterion][data-lp-mark="done"]')).toHaveCount(0);
    } else await expect(page.locator('[data-lp-result]')).toBeHidden();
    await input.fill('Another complete answer long enough to check.');
    if (name === 'course-lookup') await input.press('Enter');
    if (name === 'live-feedback') {
      await expect(page.locator('[data-lp-complete]')).toBeVisible();
      await expect(page.locator('[data-lp-criterion]')).toHaveCount(4);
    } else await expect(page.locator('[data-lp-result]')).toBeVisible();
  });
}

for (const [name, action] of [['misconception', '[data-lp-check]'], ['explain-back', '[data-lp-check]'], ['conversation', '[data-lp-send]'], ['journal', '[data-lp-suggest]']]) {
  test(`${name} preserves edits made during the config wait without submitting stale text`, async ({ page }) => {
    await mount(page, name, 'en', true);
    const input = page.getByRole('textbox');
    await input.fill('A draft long enough to check.');
    await page.locator(action).click();
    await input.fill('An edited draft long enough to check.');
    await page.evaluate(() => window.resolveTextConfig());
    await expect(page.locator(action)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(input).toHaveValue('An edited draft long enough to check.');
    expect(await page.evaluate(() => window.textCalls)).toEqual([]);
  });
}
