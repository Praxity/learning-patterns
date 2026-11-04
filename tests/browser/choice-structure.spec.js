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
      const links = page.locator('[data-lp-error] li button');
      await expect(links).toHaveCount(3);
      const targets = await links.evaluateAll(els => els.map(el => el.closest('li').dataset.lpQuestionTarget));
      for (const id of targets) {
        const target = page.locator(`[id="${id}"]`);
        await expect(target.locator('[data-lp-question-error]')).toBeAttached();
        if (pattern === 'dont-know') await expect(target.locator('[data-lp-question-error]')).toContainText(lang === 'en' ? "I don't know" : 'Je ne sais pas');
      }
      const first = page.locator(`[id="${targets[0]}"] input`).first();
      await expect(first).toBeFocused();
      expect((await page.evaluate(() => window.questionFocus)).at(-1)).toBe('option');
      for (let i = 0; i < targets.length; i++) {
        await page.evaluate(() => { window.questionFocus = []; });
        await links.nth(i).click();
        const target = page.locator(`[id="${targets[i]}"]`);
        await expect(target.locator('input').first()).toBeFocused();
        // Sub-pixel rounding can leave the legend a fraction of a pixel above the viewport.
        expect((await target.locator('legend').boundingBox()).y).toBeGreaterThanOrEqual(-1);
        const events = await page.evaluate(() => window.questionFocus);
        if (i > 0) expect(events.at(-1)).toBe('option');
      }
    });
  }
}

for (const pattern of ['dont-know', 'test-out', 'prolific-questions']) {
  test(`${pattern} answering one error preserves the remaining errors`, async ({ page }) => {
    if (pattern === 'test-out') {
      await page.addInitScript(() => { window.lpSeed = { picks: {}, shown: false, step: 3 }; });
    }
    await page.goto(`/${pattern}/en.html`);
    await page.waitForFunction(() => window.lpReady);
    await page.locator('[data-lp-check]:visible').click();
    const summary = page.locator('[data-lp-error]');
    const entries = summary.locator('li :is(a, button)');
    await expect(entries).toHaveCount(3);
    const ids = await entries.evaluateAll(els => els.map(el => el.closest('li').dataset.lpQuestionTarget || el.hash.slice(1)));
    // Accept the old anchors too, so the original code fails on lost errors after answering.
    for (const [i, id] of ids.entries()) {
      await entries.first().click();
      const fact = page.locator(`[id="${id}"]`);
      await fact.locator('input').first().check();
      await expect(fact.locator('[data-lp-question-error]')).toBeHidden();
      await expect(fact.locator('[aria-invalid]')).toHaveCount(0);
      await expect(entries).toHaveCount(2 - i);
      for (const remaining of ids.slice(i + 1)) {
        const unanswered = page.locator(`[id="${remaining}"]`);
        // test-out panels can be hidden; their messages and ARIA must stay set.
        await expect(unanswered.locator('[data-lp-question-error]')).not.toHaveAttribute('hidden');
        await expect(unanswered.locator('input').first()).toHaveAttribute('aria-invalid', 'true');
        const described = pattern === 'test-out' ? unanswered.locator('input').first() : unanswered;
        await expect(described).toHaveAttribute('aria-describedby', await unanswered.locator('[data-lp-question-error]').getAttribute('id'));
      }
      if (i < 2) {
        await expect(summary).toBeVisible();
        await expect(summary.locator('p.lp-error-text > svg')).toHaveCount(1);
      }
    }
    await expect(summary).toBeHidden();
    await expect(page.locator('[role="status"]')).toHaveText('');
  });
}
