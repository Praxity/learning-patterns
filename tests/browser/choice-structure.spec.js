import { test, expect } from '@playwright/test';

for (const pattern of ['dont-know', 'test-out', 'prolific-questions']) {
  for (const lang of ['en', 'fr']) {
    test(`${pattern} unanswered links scroll the legend before focusing its first option (${lang})`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 600 });
      if (pattern === 'test-out') {
        await page.addInitScript(() => { window.lpSeed = { picks: {}, shown: false, step: 3 }; });
      }
      await page.goto(`/${pattern}/${lang}.html`);
      await page.waitForFunction(() => window.lpReady);
      // Capture scroll and focus order through the real pattern interface.
      await page.evaluate(() => {
        window.questionFocus = [];
        const scroll = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = function (...args) {
          if (this.tagName === 'LEGEND') window.questionFocus.push('legend');
          return scroll.apply(this, args);
        };
        document.addEventListener('focusin', event => {
          if (event.target.matches('input[type=radio]')) window.questionFocus.push('option');
        });
      });
      await page.locator('[data-lp-check]:visible').click();
      const links = page.locator('[data-lp-error] a');
      await expect(links).toHaveCount(3);
      const targets = await links.evaluateAll(els => els.map(el => el.hash.slice(1)));
      for (const id of targets) {
        const target = page.locator(`[id="${id}"]`);
        await expect(target.locator('[data-lp-question-error]')).toBeAttached();
        if (pattern === 'dont-know') await expect(target.locator('[data-lp-question-error]')).toContainText(lang === 'en' ? "I don't know" : 'Je ne sais pas');
      }
      const first = page.locator(`[id="${targets[0]}"] input`).first();
      await expect(first).toBeFocused();
      expect(await page.evaluate(() => window.questionFocus)).toEqual(['legend', 'option']);
      for (let i = 0; i < targets.length; i++) {
        await page.evaluate(() => { window.questionFocus = []; });
        await links.nth(i).click();
        const target = page.locator(`[id="${targets[i]}"]`);
        await expect(target.locator('input').first()).toBeFocused();
        expect((await target.locator('legend').boundingBox()).y).toBeGreaterThanOrEqual(0);
        const events = await page.evaluate(() => window.questionFocus);
        expect(events[0]).toBe('legend');
        if (i > 0) expect(events).toEqual(['legend', 'option']);
      }
    });
  }
}
