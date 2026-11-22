import { test, expect } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';

const patterns = [];
for (const name of await readdir(new URL('../../patterns/', import.meta.url))) {
  const render = await readFile(new URL(`../../patterns/${name}/render.js`, import.meta.url), 'utf8');
  if (/<fieldset class="lp-choices/.test(render)) patterns.push(name);
}

const cases = [...patterns.map(name => ({ name, path: name })), { name: 'choice atom', path: 'atoms/choice' }];

for (const { name, path } of cases) for (const lang of ['en', 'fr']) {
  test(`${name} choice fieldsets reflow after resizing from 1280 to 320 pixels (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/${path}/${lang}.html`);
    if (name !== 'choice atom') await page.waitForFunction(() => window.lpReady);
    await page.evaluate(() => {
      for (const group of document.querySelectorAll('fieldset.lp-choices')) {
        for (let node = group; node; node = node.parentElement) {
          node.removeAttribute('hidden');
          if (node.tagName === 'DETAILS') node.open = true;
        }
      }
      return document.fonts.ready;
    });
    const groups = page.locator('fieldset.lp-choices');
    expect(await groups.count()).toBeGreaterThan(0);
    for (const group of await groups.all()) {
      await expect(group).toBeVisible();
    }
    await page.setViewportSize({ width: 320, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    for (const group of await groups.all()) {
      const overflow = await group.evaluate(el => {
        const box = el.getBoundingClientRect();
        return [...el.querySelectorAll('legend, .lp-choice')].map(child => {
          const rect = child.getBoundingClientRect();
          return Math.max(rect.right - box.right, box.left - rect.left);
        });
      });
      expect(Math.max(...overflow)).toBeLessThanOrEqual(1);
    }
  });
}
