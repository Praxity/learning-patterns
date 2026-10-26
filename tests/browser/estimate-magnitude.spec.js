import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { strings } from '../../patterns/estimate-magnitude/strings.js';
import { format, numberText, render } from '../../patterns/estimate-magnitude/render.js';
import { frenchTypography } from '../../lib/html.js';

const examples = Object.fromEntries(await Promise.all(['en', 'fr'].map(async lang => [lang, JSON.parse(await readFile(new URL(`../../patterns/estimate-magnitude/examples/${lang}.json`, import.meta.url), 'utf8'))])));

async function open(page, lang = 'en') {
  await page.goto(`/estimate-magnitude/${lang}.html`);
  await expect(page.locator('[data-lp-check]')).toBeVisible();
}

async function openContent(page, content, lang = 'en') {
  const fonts = [400, 600].map(weight => `@font-face { font-family: "Source Sans 3"; font-weight: ${weight}; font-display: swap; src: url(/fonts/source-sans-3-latin-${weight}-normal.woff2) format("woff2"); }`).join('');
  await page.route('**/estimate-magnitude/fixture.html', route => route.fulfill({
    contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Estimate magnitude</title><link rel="stylesheet" href="/lib/base.css"><link rel="stylesheet" href="/patterns/estimate-magnitude/pattern.css"><style>${fonts}</style></head><body>
      ${render(content, strings[lang], { id: 'fixture', lang })}
      <script type="module">
        import { enhance } from '/patterns/estimate-magnitude/enhance.js';
        import { strings } from '/patterns/estimate-magnitude/strings.js';
        enhance(document.querySelector('[data-lp-pattern]'), { content: ${JSON.stringify(content)}, strings: strings.${lang} });
      </script></body></html>`
  }));
  await page.goto('/estimate-magnitude/fixture.html');
  await expect(page.locator('[data-lp-check]')).toBeVisible();
  expect(await page.evaluate(async () => {
    const faces = await Promise.all([400, 600].map(weight => document.fonts.load(`${weight} 15px "Source Sans 3"`)));
    await document.fonts.ready;
    return faces.every(loaded => loaded.length && loaded.every(face => face.status === 'loaded'));
  })).toBe(true);
}

async function setByKeyboard(page) {
  const bands = page.getByRole('slider');
  await bands.nth(0).focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Tab');
  await expect(bands.nth(1)).toBeFocused();
  await page.keyboard.press('Home');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Tab');
  await expect(bands.nth(2)).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-check]')).toBeFocused();
}

for (const lang of ['en', 'fr']) for (const scale of ['default', 'wide', 'edge']) {
  test(`numbered axis fits before and after Check, including text spacing (${lang}, ${scale})`, async ({ page }) => {
    const content = structuredClone(examples[lang]);
    if (scale !== 'default') {
      content.ratio = 1000;
      content.questions.forEach(question => { question.answer = scale === 'wide' ? 1e12 : 5e6; });
    }
    const expected = scale !== 'default'
      ? (lang === 'en' ? ['1', '1K', '1M', '1B', '1T'] : ['1', '1\u00a0k', '1\u00a0M', '1\u00a0G', '1\u00a0T']).slice(0, scale === 'wide' ? 5 : 4)
      : lang === 'en' ? ['1', '10', '100', '1K', '10K', '100K'] : ['1', '10', '100', '1\u00a0k', '10\u00a0k', '100\u00a0k'];
    for (const [width, spacing] of [[1280, false], [320, false], [320, true]]) {
      await page.setViewportSize({ width, height: 900 });
      await openContent(page, content, lang);
      await page.addStyleTag({ content: 'body { margin: 0; padding: 1rem; }' });
      await page.evaluate(() => document.fonts.ready);
      if (spacing) await page.addStyleTag({ content: '.lp, .lp * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } .lp p { margin-bottom: 2em !important; }' });
      const fits = async checked => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        for (const question of await page.locator('[data-lp-question]').all()) {
          const labels = question.locator('.lp-estimate-magnitude-axis-label');
          await expect(labels).toHaveText(expected);
          expect(await labels.count()).toBeLessThanOrEqual(6);
          for (const label of await labels.all()) await expect(label).toHaveAttribute('aria-hidden', 'true');
          expect(await question.evaluate((element, checked) => {
            const card = element.closest('[data-lp-pattern]').getBoundingClientRect();
            const scale = element.querySelector('.lp-estimate-magnitude-scale').getBoundingClientRect();
            const axis = [...element.querySelectorAll('.lp-estimate-magnitude-axis-label')];
            const labels = axis.map(label => {
              const range = document.createRange();
              range.selectNodeContents(label);
              return range.getBoundingClientRect();
            });
            const inside = bounds => bounds.left >= card.left && bounds.right <= card.right;
            if (!labels.every(inside)) return false;
            if (labels.some((bounds, index) => index && bounds.left < labels[index - 1].right)) return false;
            const major = element.querySelector('.lp-estimate-magnitude-tick-major');
            const minor = element.querySelector('.lp-estimate-magnitude-tick:not(.lp-estimate-magnitude-tick-major)');
            if (major.getBoundingClientRect().height <= minor.getBoundingClientRect().height) return false;
            const line = element.querySelector('[data-lp-line]').getBoundingClientRect();
            if (labels.some(bounds => bounds.top <= line.top + line.height / 2)) return false;
            const ticks = [...element.querySelectorAll('.lp-estimate-magnitude-tick-major')];
            if (labels.some((bounds, index) => {
              const label = axis[index];
              if (index === 0) return Math.abs(bounds.left - line.left) > 1;
              if (label.style.left === '100%') return Math.abs(bounds.right - line.right) > 1;
              const tick = ticks[ticks.length <= 6 ? index : index * 3].getBoundingClientRect();
              return Math.abs((bounds.left + bounds.right) / 2 - tick.left) > 1;
            })) return false;
            if (axis.some(label => getComputedStyle(label).fontSize !== getComputedStyle(element.querySelector('[data-lp-value]')).fontSize)) return false;
            if (labels.some(bounds => bounds.bottom > scale.bottom)) return false;
            if (checked) {
              const answer = element.querySelector('[data-lp-answer]');
              if (answer.textContent !== '' || answer.children.length) return false;
              const diamond = answer.getBoundingClientRect();
              const at = Number(answer.style.getPropertyValue('--lp-estimate-magnitude-at')) / 100;
              if (Math.abs(diamond.left + diamond.width / 2 - (line.left + line.width * at)) > 1) return false;
              if (Math.abs(diamond.top + diamond.height / 2 - (line.top + line.height / 2)) > 1) return false;
            }
            return true;
          }, checked)).toBe(true);
        }
      };
      await fits(false);
      for (const band of await page.getByRole('slider').all()) await band.press('End');
      await page.locator('[data-lp-check]').click();
      await expect(page.locator('[data-lp-try-again]')).toBeFocused();
      await fits(true);
    }
  });
}

for (const lang of ['en', 'fr']) {
  const instructions = lang === 'en' ? {
    10: 'Slide each range to hold your estimate. Each range is limited to ten times its low end.',
    100: 'Slide each range to hold your estimate. Each range is limited to 100 times its low end.',
    1000: 'Slide each range to hold your estimate. Each range is limited to 1,000 times its low end.'
  } : {
    10: 'Faites glisser chaque plage pour y inclure votre estimation. Chaque plage est limitée à dix fois sa borne inférieure.',
    100: 'Faites glisser chaque plage pour y inclure votre estimation. Chaque plage est limitée à 100 fois sa borne inférieure.',
    1000: /^Faites glisser chaque plage pour y inclure votre estimation\. Chaque plage est limitée à 1[\u00a0\u202f]000 fois sa borne inférieure\.$/
  };

  test(`keyboard, validation, checked ranges, one announcement and Try again (${lang})`, async ({ page }) => {
    await open(page, lang);
    await expect(page.locator('[data-lp-instructions]')).toHaveText(instructions[10]);
    const bands = page.getByRole('slider');
    const status = page.getByRole('status');
    await expect(status).toHaveText('');
    await expect(page.locator('[data-lp-fallback]')).toBeHidden();
    for (const [index, question] of examples[lang].questions.entries()) {
      await expect(bands.nth(index)).toHaveAccessibleName(format(strings[lang].band, { number: index + 1 }));
      await expect(page.getByRole('group', { name: frenchTypography(question.question, lang) })).toHaveCount(1);
      await expect(bands.nth(index)).toHaveAttribute('aria-valuetext', new RegExp(question.unit));
    }
    await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-check]')).toBeFocused();
    await expect(page.locator('[data-lp-error]:visible')).toHaveCount(3);
    await expect(bands.first()).toHaveAttribute('aria-invalid', 'true');
    await expect(status).toHaveText(frenchTypography(format(strings[lang].missingMany, { questions: lang === 'fr' ? '1, 2 et 3' : '1, 2 and 3' }), lang));
    await setByKeyboard(page);
    await expect(page.locator('[data-lp-error]:visible')).toHaveCount(0);
    await expect(bands.first()).not.toHaveAttribute('aria-invalid');
    await page.evaluate(() => {
      window.rangeAnnouncements = 0;
      window.rangeObserver = new MutationObserver(records => { window.rangeAnnouncements += records.length; });
      window.rangeObserver.observe(document.querySelector('[role="status"]'), { childList: true });
    });
    await page.keyboard.press('Enter');
    const summary = frenchTypography(format(strings[lang].summary, { count: 3, total: 3 }), lang);
    await expect(page.locator('[data-lp-result]')).toHaveText(summary);
    await expect(status).toHaveText(summary);
    await expect.poll(() => page.evaluate(() => window.rangeAnnouncements)).toBe(1);
    await expect(page.locator('[data-lp-try-again]')).toBeFocused();
    await expect(page.locator('[data-lp-check]')).toBeHidden();
    await expect(page.locator('[data-lp-feedback]:visible')).toHaveCount(3);
    for (let index = 0; index < 3; index++) {
      await expect(bands.nth(index)).toBeDisabled();
      await expect(bands.nth(index)).toHaveAttribute('aria-valuetext', new RegExp(lang === 'fr' ? ' à .*Dans votre plage' : ' to .*Caught'));
      await expect(page.locator('[data-lp-feedback]').nth(index)).toContainText(examples[lang].questions[index].source);
    }
    const original = await bands.first().getAttribute('aria-valuenow');
    await page.locator('[data-lp-line]').first().click({ position: { x: 1, y: 22 }, force: true });
    await expect(bands.first()).toHaveAttribute('aria-valuenow', original);
    const firstNode = await bands.first().elementHandle();
    await page.locator('[data-lp-try-again]').focus();
    await page.keyboard.press('Enter');
    await expect(bands.first()).toBeFocused();
    await expect(page.locator('[data-lp-try-again]')).toBeHidden();
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    await expect(page.locator('[data-lp-feedback]:visible')).toHaveCount(0);
    await expect(page.locator('[data-lp-answer]:visible')).toHaveCount(0);
    await expect(status).toHaveText(frenchTypography(strings[lang].cleared, lang));
    await expect.poll(() => page.evaluate(() => window.rangeAnnouncements)).toBe(2);
    expect(await firstNode.evaluate(node => node === document.querySelector('[data-lp-band]'))).toBe(true);
    await expect(bands.first()).toBeEnabled();
    await expect(bands.first()).toHaveAttribute('aria-valuenow', '4');
    await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-error]:visible')).toHaveCount(3);
  });

  test(`no JavaScript exposes answers with sources and hides sliders (${lang})`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto(`${baseURL}/estimate-magnitude/${lang}.html`);
      await expect(page.getByRole('slider')).toHaveCount(0);
      await expect(page.locator('[data-lp-check]')).toBeHidden();
      await expect(page.locator('[data-lp-instructions]')).toBeHidden();
      await expect(page.locator('[data-lp-fallback]')).not.toHaveAttribute('open');
      for (const [index, question] of examples[lang].questions.entries()) {
        await expect(page.locator('[data-lp-question] legend').nth(index)).toBeVisible();
        await expect(page.locator('[data-lp-question] legend').nth(index)).toHaveText(frenchTypography(question.question, lang));
      }
      await page.locator('[data-lp-fallback] summary').click();
      for (const question of examples[lang].questions) {
        await expect(page.locator('[data-lp-fallback]')).toContainText(frenchTypography(question.question, lang));
        await expect(page.locator('[data-lp-fallback]')).toContainText(question.source);
      }
      await expect(page.locator('[data-lp-fallback] li')).toHaveCount(3);
      await expect(page.getByRole('status')).toHaveText('');
    } finally { await context.close(); }
  });

  test(`320 px reflow, forced colours, reduced motion and accessibility (${lang})`, async ({ page, browserName }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce', ...(browserName === 'chromium' ? { forcedColors: 'active' } : {}) });
    await open(page, lang);
    const fits = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('[data-lp-pattern]').evaluate(root => root.scrollWidth <= root.clientWidth)).toBe(true);
    };
    await fits();
    await expect(page.getByRole('slider').first()).toBeVisible();
    await setByKeyboard(page);
    const before = await new AxeBuilder({ page }).include('[data-lp-pattern]').analyze();
    expect(before.violations).toEqual([]);
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-lp-try-again]')).toBeFocused();
    await fits();
    const after = await new AxeBuilder({ page }).include('[data-lp-pattern]').analyze();
    expect(after.violations).toEqual([]);
    await page.locator('[data-lp-try-again]').click();
    await expect(page.getByRole('slider').first()).toBeFocused();
    await fits();
    await page.addStyleTag({ content: '.lp, .lp * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } .lp p { margin-bottom: 2em !important; }' });
    await setByKeyboard(page);
    await fits();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-lp-try-again]')).toBeFocused();
    await fits();
    await expect(page.locator('[data-lp-answer]')).toHaveText(['', '', '']);
  });

  for (const ratio of [10, 100, 1000]) {
    test(`configured ratio ${ratio} changes instructions, bands and scoring (${lang})`, async ({ page }) => {
      const content = { ...structuredClone(examples[lang]), ratio };
      content.questions.forEach(question => { question.answer = content.ratio; });
      await openContent(page, content, lang);
      await expect(page.locator('[data-lp-instructions]')).toHaveText(instructions[ratio]);
      for (const [index, band] of (await page.getByRole('slider').all()).entries()) {
        await band.press('Home');
        const label = format(strings[lang].range, { low: '1', high: numberText(content.ratio, lang) });
        await expect(band).toHaveAttribute('aria-valuetext', frenchTypography(`${label} ${content.questions[index].unit}`, lang));
      }
      await page.locator('[data-lp-check]').click();
      await expect(page.locator('[data-lp-result]')).toHaveText(frenchTypography(format(strings[lang].summary, { count: 3, total: 3 }), lang));
    });
  }
}

for (const lang of ['en', 'fr']) for (const ratio of [10, 100, 1000]) {
  test(`labels fit at every band position at 320 px with text spacing, ratio ${ratio} (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    const content = { ...structuredClone(examples[lang]), ratio };
    content.questions.forEach(question => { question.answer = 1e12; });
    await openContent(page, content, lang);
    await page.addStyleTag({ content: '.lp, .lp * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }' });
    for (const band of await page.getByRole('slider').all()) await band.press('Home');
    const fits = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('[data-lp-pattern]').evaluate(root => {
        const card = root.getBoundingClientRect();
        return [...root.querySelectorAll('[data-lp-value]')].every(label => {
          const range = document.createRange();
          range.selectNodeContents(label);
          const bounds = range.getBoundingClientRect();
          return bounds.left >= card.left && bounds.right <= card.right;
        });
      })).toBe(true);
      for (const question of await page.locator('[data-lp-question]').all()) {
        const legend = await question.locator('legend').boundingBox();
        const bounds = await question.locator('[data-lp-value]').boundingBox();
        expect(bounds.y).toBeGreaterThanOrEqual(legend.y + legend.height);
      }
    };
    const first = page.getByRole('slider').first();
    const last = Number(await first.getAttribute('aria-valuemax'));
    for (let position = 0; position <= last; position++) {
      if (position) await first.press('ArrowRight');
      await expect(first).toHaveAttribute('aria-valuenow', String(position));
      await fits();
    }
    await first.press('End');
    await fits();
    await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-try-again]')).toBeFocused();
    await fits();
    await expect(page.locator('[data-lp-answer]')).toHaveText(['', '', '']);
  });
}

for (const lang of ['en', 'fr']) {
  test(`checked labels follow a resize from 1280 to 320 px with text spacing (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const content = { ...structuredClone(examples[lang]), ratio: 1000 };
    content.questions.forEach(question => { question.answer = 1e12; });
    await openContent(page, content, lang);
    for (const band of await page.getByRole('slider').all()) await band.press('End');
    await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-try-again]')).toBeFocused();
    const fits = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('[data-lp-pattern]').evaluate(root => {
        const card = root.getBoundingClientRect();
        return [...root.querySelectorAll('[data-lp-value]')].every(label => {
          const range = document.createRange();
          range.selectNodeContents(label);
          const bounds = range.getBoundingClientRect();
          return bounds.left >= card.left && bounds.right <= card.right;
        });
      })).toBe(true);
      for (const answer of await page.locator('[data-lp-answer]').all()) {
        const distance = await answer.evaluate(element => {
          const track = element.parentElement.getBoundingClientRect();
          const diamond = element.getBoundingClientRect();
          const centre = diamond.left + diamond.width / 2;
          // 1e12 is 80% of the logarithmic track from 1 to 1e15.
          return Math.abs(centre - (track.left + track.width * .8));
        });
        expect(distance).toBeLessThanOrEqual(1);
      }
    };
    await fits();
    await page.setViewportSize({ width: 320, height: 900 });
    await page.addStyleTag({ content: '.lp, .lp * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } .lp p { margin-bottom: 2em !important; }' });
    await fits();
  });
}

for (const lang of ['en', 'fr']) {
  test(`pressing a wrapped range label grabs the band without moving it (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const content = { ...structuredClone(examples[lang]), ratio: 1000 };
    content.questions.forEach(question => { question.answer = 1e12; });
    await openContent(page, content, lang);
    await page.locator('[data-lp-pattern]').evaluate(root => { root.dir = 'rtl'; });
    const band = page.getByRole('slider').first();
    const label = page.locator('[data-lp-value]').first();
    const line = page.locator('[data-lp-line]').first();
    await expect(line).toHaveCSS('direction', 'ltr');
    await expect(label).toHaveCSS('text-align', 'start');
    const initialLabel = await label.boundingBox();
    const initialTrack = await line.boundingBox();
    expect(Math.abs(initialLabel.x + initialLabel.width / 2 - (initialTrack.x + initialTrack.width / 2))).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.addStyleTag({ content: '.lp, .lp * { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }' });
    await band.press('End');
    await expect(band).toHaveAttribute('aria-valuenow', '24');
    await expect(label).toHaveCSS('text-align', 'end');
    const range = await band.getAttribute('aria-valuetext');
    const bounds = await label.boundingBox();
    const track = await line.boundingBox();
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(band).toHaveAttribute('aria-valuenow', '24');
    await expect(band).toHaveAttribute('aria-valuetext', range);
    await expect(band).toBeFocused();
    await page.mouse.move(x - track.width / 5, y, { steps: 6 });
    await page.mouse.up();
    // Moving left by 20% of a fifteen-decade track moves the band down three decades.
    await expect(band).toHaveAttribute('aria-valuenow', '18');
    await band.press('Home');
    await expect(label).toHaveCSS('text-align', 'start');
  });
}

test('track taps and dragging select discrete bands without a keyboard', async ({ page }) => {
  await open(page);
  const band = page.getByRole('slider').first();
  const line = page.locator('[data-lp-line]').first();
  const track = await line.boundingBox();
  await line.click({ position: { x: 1, y: 22 } });
  await expect(band).toHaveAttribute('aria-valuenow', '0');
  await expect(band).toHaveAttribute('aria-valuetext', '1 to 10 staff');
  await expect(band).toBeFocused();
  const box = await band.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width + box.width, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(band).toHaveAttribute('aria-valuenow', await band.getAttribute('aria-valuemax'));
  await expect(band).toHaveAttribute('aria-valuetext', '50,000 to 500,000 staff');
  await page.locator('[data-lp-line]').nth(1).click({ position: { x: 1, y: 22 } });
  await page.locator('[data-lp-line]').nth(2).click({ position: { x: 1, y: 22 } });
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-result]')).toHaveText('You caught 0 of 3 answers in your ranges.');
  await expect(page.locator('[data-lp-feedback]').first()).toContainText('below your range');
  await expect(page.locator('[data-lp-feedback]').nth(1)).toContainText('above your range');
});

test('checked host state restores silently, destroy restores fallback', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { ranges: [0, 4, 8], touched: [true, true, true], shown: true }; });
  await page.goto('/estimate-magnitude/en.html');
  await expect(page.locator('[data-lp-result]')).toHaveText('You caught 3 of 3 answers in your ranges.');
  await expect(page.getByRole('status')).toHaveText('');
  // Wait past lock's two-frame focus work before checking the restored page.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
  await expect(page.locator('body')).toBeFocused();
  await page.evaluate(async () => {
    const { enhance } = await import('/patterns/estimate-magnitude/enhance.js');
    const { strings } = await import('/patterns/estimate-magnitude/strings.js');
    const root = document.querySelector('[data-lp-pattern]');
    // Repeated calls preserve the existing instance without reading another host's state.
    const existing = enhance(root, { content: {}, strings: strings.en });
    if (existing !== window.lpInstances[0]) throw new Error('Enhancement was not idempotent');
    existing.destroy(); existing.destroy();
  });
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await expect(page.getByRole('slider')).toHaveCount(0);
});

test('invalid host state is ignored and setting a range writes partial state', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { ranges: [999, 0, 0], touched: [true, true, true], shown: true }; });
  await open(page);
  await expect(page.locator('[data-lp-check]')).toBeVisible();
  await expect(page.getByRole('slider').first()).toHaveAttribute('aria-valuenow', '4');
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  await page.getByRole('slider').first().press('Home');
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ ranges: [0, 4, 4], touched: [true, false, false], shown: false });
});
