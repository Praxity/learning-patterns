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
  if (name === 'explain-back') await page.getByRole('button', { name: lang === 'en' ? "I'm ready to explain it" : "Passer à l'explication", exact: true }).click();
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
