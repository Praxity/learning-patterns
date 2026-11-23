import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const COMPONENTS = ['buttons', 'choice', 'feedback', 'progress', 'text-response'];

for (const name of COMPONENTS) for (const lang of ['en', 'fr']) {
  test(`${name} example passes axe and reflows at 320 pixels (${lang})`, async ({ page }) => {
    await page.goto(`/components/${name}/${lang}.html`);
    await expect(page.locator(`[data-lp-component="${name}"]`).first()).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 320, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
}
