import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const english = JSON.parse(await readFile(new URL('../../patterns/test-out/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/test-out/examples/fr.json', import.meta.url)));
const mixed = ['attendees', 'wait', 'actions'];
async function open(page, path = '/test-out/en.html') {
  await page.goto(path); await page.waitForFunction(() => window.lpReady);
}
async function pick(root, values = mixed) {
  await root.locator('[data-lp-start]').click();
  for (const [index, value] of values.entries()) {
    await root.locator('fieldset').nth(index).locator(`input[value="${value}"]`).check();
    if (index < values.length - 1) await root.locator('[data-lp-next]:visible').click();
  }
}
async function review(page) { await page.locator('[data-lp-review] > summary').click(); }
async function observe(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    new MutationObserver(records => records.forEach(record => {
      // Clearing stale feedback produces no speech.
      if (record.target.textContent) window.lpAnnouncements.push(record.target.textContent);
    }))
      .observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}
async function scan(page) {
  // Axe checks each completed panel, rather than sampling its entrance opacity.
  await page.waitForFunction(() => [...document.querySelectorAll('[data-lp-pattern]')].every(root => root.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running')));
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
}
async function authored(page, content) {
  await page.evaluate(async content => {
    window.lpInstances[0].destroy();
    const { render } = await import('/patterns/test-out/render.js');
    const { enhance } = await import('/patterns/test-out/enhance.js');
    const { strings } = await import('/patterns/test-out/strings.js');
    document.querySelector('main').innerHTML = render(content, strings.en, { id: 'authored', lang: 'en' });
    const root = document.querySelector('[data-lp-pattern]');
    window.lpInstances = [enhance(root, { content, strings: strings.en })];
    window.lpEnhance = () => enhance(root, { content, strings: strings.en });
  }, content);
}

test('repeating a course plan announces each result once and leaves progress to heading focus', async ({ page }) => {
  await open(page); await observe(page);
  for (let attempt = 0; attempt < 2; attempt++) {
    await pick(page); await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-outline-heading]')).toBeFocused();
    if (attempt === 0) {
      await page.locator('[data-lp-restart]').click();
      await expect(page.getByRole('status')).toHaveText('');
    }
  }
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['You can skip 2 of 3 sections.', 'You can skip 2 of 3 sections.']);
});

for (const [lang, headings] of [
  ['en', ['Question 1 of 3: Writing an agenda', 'Question 2 of 3: Running the discussion', 'Question 3 of 3: Decisions and follow-up']],
  ['fr', ['Question 1 sur 3 : Préparer un ordre du jour', 'Question 2 sur 3 : Animer la discussion', 'Question 3 sur 3 : Les décisions et le suivi']]
]) {
  test(`owner request: counters carry section titles (${lang})`, async ({ page }) => {
    await open(page, `/test-out/${lang}.html`);
    await page.evaluate(() => window.lpInstances[0].destroy());
    await expect(page.locator('[data-lp-panel-heading]')).toHaveText(headings);
    await page.evaluate(() => window.lpEnhance());
    await page.locator('[data-lp-start]').click();
    for (const heading of headings) {
      await expect(page.locator('[data-lp-panel-heading]:visible')).toHaveText(heading);
      await expect(page.locator('[data-lp-panel-heading]:visible')).toBeFocused();
      await expect(page.locator('[role="status"]')).toHaveText('');
      await expect(page.locator('[data-lp-panel="question"]:visible > p, [data-lp-panel="question"]:visible > h3:not([data-lp-panel-heading])')).toHaveCount(0);
      await page.locator('fieldset:visible input').first().check();
      if (heading !== headings.at(-1)) await page.locator('[data-lp-next]:visible').click();
    }
  });

  test(`owner request: no question progress bar (${lang})`, async ({ page }) => {
    await open(page, `/test-out/${lang}.html`);
    await page.evaluate(() => window.lpInstances[0].destroy());
    await expect(page.locator('.lp-test-out-progress, [role="progressbar"]')).toHaveCount(0);
    await page.evaluate(() => window.lpEnhance());
    await page.locator('[data-lp-start]').click();
    await expect(page.locator('.lp-test-out-progress, [role="progressbar"]')).toHaveCount(0);
  });

  test(`owner request: result contains three sections (${lang})`, async ({ page }) => {
    const content = lang === 'en' ? english : french;
    await open(page, `/test-out/${lang}.html`);
    await pick(page, content.questions.map(q => q.correct));
    await page.locator('[data-lp-check]').click();
    await expect(page.locator('.lp-test-out-outline-list > li')).toHaveCount(3);
    await expect(page.locator('[data-lp-section-status]')).toHaveText(lang === 'en' ? ['Skip', 'Skip', 'Skip'] : ['Passer', 'Passer', 'Passer']);
    await expect(page.locator('[data-lp-result]')).toHaveText(lang === 'en' ? 'You can skip 3 of 3 sections.' : 'Sections que vous pouvez passer : 3 sur 3.');
  });
}

test('shared scene and clean outline lead to one keyed question at a time', async ({ page }) => {
  await open(page);
  await expect(page.locator('.lp-scene-label')).toHaveCount(0);
  await expect(page.locator('.lp-scene')).toContainText('Meetings: a refresher');
  await expect(page.locator('.lp-scene svg[aria-hidden="true"]')).toHaveCount(1);
  await expect(page.locator('[data-lp-outline-heading]')).toHaveText("What you'll cover");
  await expect(page.locator('[data-lp-section-status]:visible')).toHaveCount(0);
  await expect(page.locator('fieldset:visible')).toHaveCount(0);
  await expect(page.locator('[data-lp-intro]')).toHaveText('Answer the questions to see which sections you can skip.');
  await page.locator('[data-lp-start]').click();
  await expect(page.locator('fieldset:visible')).toHaveCount(1);
  await expect(page.locator('[data-lp-panel-heading]:visible')).toHaveText('Question 1 of 3: Writing an agenda');
  await expect(page.locator('[data-lp-panel-heading]:visible')).toBeFocused();
  await page.locator('input').first().check();
  const row = page.locator('label:has(input:checked)');
  await expect(row).toHaveCSS('border-top-color', 'rgb(44, 85, 201)');
  await expect(row).toHaveCSS('border-top-width', '2px');
  await expect(row).toHaveCSS('box-shadow', 'none');
  expect(await row.evaluate(el => getComputedStyle(el, '::before').content)).toBe('counter(lp-key, upper-alpha) / ""');
});

test('keyboard validates only this panel, Back keeps picks, changes announce once and reset returns to outline', async ({ page }) => {
  await open(page); await observe(page);
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-start]')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab'); await expect(page.locator('input').first()).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-back]:visible')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-next]:visible')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-question-error]:visible')).toHaveCount(1);
  await expect(page.locator('[data-lp-next]:visible')).toBeFocused();
  // Only the radios carry the message; describing the fieldset as well made VoiceOver say it twice.
  const fieldset = page.locator('fieldset').first(), id = await fieldset.locator('input').first().getAttribute('aria-describedby');
  await expect(page.locator(`[id="${id}"]`)).toHaveText('Choose an answer');
  await expect(fieldset).not.toHaveAttribute('aria-describedby');
  for (const radio of await fieldset.locator('input').all()) await expect(radio).toHaveAttribute('aria-describedby', id);
  await expect(fieldset.locator('input').first()).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Choose an answer']);
  await fieldset.locator('input').first().check();
  await expect(fieldset.locator('input').first()).not.toHaveAttribute('aria-invalid');
  await page.locator('[data-lp-next]:visible').click();
  await expect(page.locator('[data-lp-panel-heading]:visible')).toBeFocused();
  await page.locator('[data-lp-back]:visible').click();
  await expect(fieldset.locator('input').first()).toBeChecked();
  await page.locator('[data-lp-back]:visible').click();
  await expect(page.locator('[data-lp-outline-heading]')).toBeFocused();
  await pick(page); await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-outline-heading]')).toBeFocused();
  expect((await page.evaluate(() => window.lpAnnouncements)).filter(x => x === 'You can skip 2 of 3 sections.')).toHaveLength(1);
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-review] > summary')).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-restart]')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('[data-lp-outline-heading]')).toBeFocused();
  await expect(page.locator('input:disabled, input:checked, [data-lp-mark], .lp-choice-mark')).toHaveCount(0);
  await expect(page.locator('[data-lp-section-status]:visible')).toHaveCount(0);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: {}, shown: false, step: 0 });
});

for (const [lang, content, correct, wrong, answer, summary, statuses] of [
  ['en', english, 'Correct', 'Not quite', 'Correct answer', 'You can skip 2 of 3 sections.', ['Take it', 'Skip', 'Skip']],
  ['fr', french, 'Correct', 'Pas tout à fait', 'Bonne réponse', 'Sections que vous pouvez passer : 2 sur 3.', ['À suivre', 'Passer', 'Passer']]
]) {
  test(`in-place marks, explanations and credited outline (${lang})`, async ({ page }) => {
    await open(page, `/test-out/${lang}.html`); await observe(page); await pick(page); await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', lang);
    await expect(page.locator('[data-lp-result]')).toHaveText(summary);
    await expect(page.locator('[data-lp-section-status]')).toHaveText(statuses);
    await expect(page.locator('[data-lp-section-status].lp-met svg[aria-hidden="true"]')).toHaveCount(2);
    await expect(page.locator('[data-lp-review]')).toBeVisible();
    await expect(page.locator('fieldset:visible')).toHaveCount(0);
    await expect(page.locator('[data-lp-credit]')).toHaveCount(0);
    await expect(page.locator('[data-lp-outline-heading]')).toHaveText(lang === 'en' ? 'Your course plan' : 'Votre parcours');
    await review(page);
    await expect(page.locator('input:disabled')).toHaveCount(9);
    await expect(page.locator('.lp-choice-mark')).toHaveCount(5);
    const qs = page.locator('fieldset');
    await expect(qs.nth(2).locator('label:has(input:checked)')).toHaveAttribute('data-lp-mark', 'correct');
    await expect(qs.nth(2).locator('.lp-choice-mark')).toHaveText(correct);
    await expect(qs.nth(2).locator('[data-lp-explanation]')).toBeHidden();
    for (const n of [0, 1]) {
      await expect(qs.nth(n).locator('label:has(input:checked)')).toHaveAttribute('data-lp-mark', 'wrong');
      await expect(qs.nth(n).locator('label:has(input:checked) .lp-choice-mark')).toHaveText(wrong);
      await expect(qs.nth(n).locator(`label:has(input[value="${content.questions[n].correct}"]) .lp-choice-mark`)).toHaveText(answer);
      await expect(qs.nth(n).locator('[data-lp-explanation]')).toHaveText(content.questions[n].explanation);
    }
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([summary]);
    expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: Object.fromEntries(content.questions.map((q, i) => [q.id, mixed[i]])), shown: true, step: 4 });
  });

  test(`native answers without JavaScript (${lang})`, async ({ browser, browserName }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage(); await page.goto(`/test-out/${lang}.html`);
    await expect(page.getByRole('radio')).toHaveCount(9); await page.getByRole('radio').first().check();
    await page.locator('[data-lp-fallback] > summary').click();
    for (const q of content.questions) {
      await expect(page.locator('[data-lp-fallback]')).toContainText(q.options.find(o => o.id === q.correct).text);
      await expect(page.locator('[data-lp-fallback]')).toContainText(q.explanation);
    }
    await expect(page.locator('[data-lp-start]')).toBeHidden();
    if (process.env.LP_SHOTS_DIR && browserName === 'chromium') {
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.screenshot({ path: `${process.env.LP_SHOTS_DIR}/${lang}-${width}-no-js.png`, fullPage: true });
      }
    }
    await context.close();
  });

  test(`axe native baseline, errors, result and reset (${lang})`, async ({ page }) => {
    await page.route('**/test-out/enhance.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export function enhance() { return { destroy() {} }; }' }));
    await open(page, `/test-out/${lang}.html`); await scan(page); await page.locator('[data-lp-fallback] > summary').click(); await scan(page);
    await page.unroute('**/test-out/enhance.js'); await open(page, `/test-out/${lang}.html`); await scan(page);
    await page.locator('[data-lp-start]').click(); await page.locator('[data-lp-next]:visible').click(); await scan(page); await page.locator('[data-lp-back]:visible').click(); await pick(page); await page.locator('[data-lp-check]').click(); await scan(page); await review(page); await scan(page);
    await page.locator('[data-lp-restart]').click(); await scan(page);
  });

  test(`400% reflow equivalent with text spacing (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await open(page, `/test-out/${lang}.html`);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    for (const stage of ['initial', 'error', 'result']) {
      if (stage === 'error') { await page.locator('[data-lp-start]').click(); await page.locator('[data-lp-next]:visible').click(); }
      if (stage === 'result') { await page.locator('[data-lp-back]:visible').click(); await pick(page); await page.locator('[data-lp-check]').click(); await review(page); }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const clipped = await page.evaluate(() => [...document.querySelectorAll('p, label, legend, button, li, h2, h3')]
        .filter(el => el.getClientRects().length && !el.matches('[role="status"]') && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)).map(el => el.textContent));
      expect(clipped).toEqual([]);
    }
  });
}

test('all right, all wrong, advanced credit and author refusal', async ({ page }) => {
  await open(page);
  for (const [values, count] of [
    [english.questions.map(q => q.correct), 3],
    [english.questions.map(q => q.options.find(o => o.id !== q.correct).id), 0],
    [['attendees', 'wait', 'actions'], 2]
  ]) {
    await pick(page, values); await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-result]')).toHaveText(`You can skip ${count} of 3 sections.`);
    await page.locator('[data-lp-restart]').click();
  }
  await authored(page, { ...english, allowTestOut: false });
  await expect(page.locator('[data-lp-start]')).toHaveCount(0);
  await expect(page.locator('fieldset:visible')).toHaveCount(0);
  await expect(page.locator('[data-lp-section-status]:visible')).toHaveCount(0);
  await expect(page.locator('[data-lp-intro]')).toContainText('You need to take every section in this course.');
  await scan(page);
});

test('French summary uses singular for one skippable section', async ({ page }) => {
  await open(page, '/test-out/fr.html');
  await pick(page, ['outcomes', 'wait', 'next-meeting']);
  await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-result]')).toHaveText('Sections que vous pouvez passer : 1 sur 3.');
});

test('reduced motion applies and new scene colours meet contrast', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await open(page);
  await expect(page.locator('.lp-choice').first()).toHaveCSS('transition-duration', '0s');
  const [ink, paper] = await page.locator('.lp-scene-icon svg').evaluate(el => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]);
  const luminance = rgb => rgb.match(/\d+/g).slice(0, 3).map(Number).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
  expect((luminance(paper) + .05) / (luminance(ink) + .05)).toBeGreaterThanOrEqual(3);
});

test('panels slide horizontally for 240ms, and reduced motion switches instantly', async ({ page }) => {
  await open(page);
  const sample = await page.evaluate(() => {
    document.querySelector('[data-lp-start]').click();
    const panel = document.querySelector('[data-lp-panel-heading]').parentElement;
    const animation = panel.getAnimations()[0];
    // Capture entry in the same task as the click, before the 240 ms entrance can finish.
    animation.pause();
    return { from: animation.effect.getKeyframes()[0], duration: animation.effect.getTiming().duration };
  });
  const panel = page.locator('[data-lp-panel-heading]').first().locator('..');
  await expect(panel).toHaveCSS('animation-duration', '0.24s');
  expect(sample.duration).toBe(240);
  expect(sample.from.opacity).toBe('0'); expect(sample.from.transform).toContain('translateX');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(panel).toHaveCSS('animation-name', 'none');
});

test('narrow French feedback sits below option text without squeezing it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 }); await open(page, '/test-out/fr.html');
  await pick(page); await page.locator('[data-lp-check]').click();
  await review(page);
  for (const row of await page.locator('[data-lp-mark]').all()) {
    const text = await row.locator(':scope > span:not(.lp-choice-mark)').boundingBox();
    const mark = await row.locator('.lp-choice-mark').boundingBox();
    expect(mark.y).toBeGreaterThanOrEqual(text.y + text.height);
  }
});

test('two questions group under their section, and hostile content stays literal', async ({ page }) => {
  await open(page);
  const content = structuredClone(english);
  content.questions.push({ ...content.questions[0], id: 'agenda-two', text: '<img src=x onerror=alert(1)> {section}', explanation: '<script>alert(1)</script>' });
  content.sections[0].title = '<b>{section}</b>';
  await authored(page, content);
  await expect(page.locator('[data-lp-section="1"] fieldset')).toHaveCount(2);
  await page.locator('[data-lp-start]').click();
  await expect(page.locator('[data-lp-panel-heading]:visible')).toHaveText('Question 1 of 4: <b>{section}</b>');
  await page.locator('[data-lp-back]:visible').click();
  await pick(page, ['outcomes', 'attendees', 'invite', 'actions']); await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-section-status]').first()).toHaveText('Take it');
  await expect(page.locator('[data-lp-result]')).toHaveText('You can skip 2 of 3 sections.');
  await review(page);
  await expect(page.locator('[data-lp-question="agenda-two"] [data-lp-explanation]')).toHaveText('<script>alert(1)</script>');
  await expect(page.locator('[data-lp-pattern] img, [data-lp-pattern] script, [data-lp-pattern] b')).toHaveCount(0);
});

for (const shown of [false, true]) {
  test(`saved picks restore silently shown=${shown}`, async ({ page }) => {
    await page.addInitScript(value => window.lpSeed = value, { picks: Object.fromEntries(english.questions.map((q, i) => [q.id, mixed[i]])), shown, step: shown ? 4 : 2 });
    await open(page); await expect(page.locator('input:checked')).toHaveCount(3); await expect(page.locator('[role="status"]')).toHaveText('');
    await expect(page.locator('[data-lp-result]')).toBeVisible({ visible: shown });
    await expect(page.locator('input:disabled')).toHaveCount(shown ? 9 : 0);
    if (!shown) { await expect(page.locator('[data-lp-panel-heading]:visible')).toHaveText('Question 2 of 3: Running the discussion'); await expect(page.locator('fieldset:visible')).toHaveCount(1); }
    if (shown) await expect(page.locator('[data-lp-result]')).toHaveText('You can skip 2 of 3 sections.');
  });
}

test('a restored late panel returns to an earlier unanswered question before scoring', async ({ page }) => {
  await page.addInitScript(() => window.lpSeed = { picks: { 'follow-up': 'actions' }, shown: false, step: 3 });
  await open(page); await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-panel-heading]:visible')).toHaveText('Question 1 of 3: Writing an agenda');
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: { 'follow-up': 'actions' }, shown: false, step: 1 });
});

test('invalid state, independent instances, idempotent enhancement and destroy', async ({ page }) => {
  await page.addInitScript(() => window.lpSeed = { picks: { agenda: 'missing' }, shown: true, step: 4 });
  await open(page, '/test-out/two.html');
  await expect(page.locator('input:checked')).toHaveCount(0);
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await pick(roots.first()); await roots.first().locator('[data-lp-check]').click();
  await expect(roots.nth(1).locator('input:checked')).toHaveCount(0);
  await expect(roots.nth(1).locator('[data-lp-result]')).toBeHidden(); await scan(page);
  await page.evaluate(() => { window.lpInstances[0].destroy(); window.lpInstances[0].destroy(); });
  await expect(roots.first().locator('[data-lp-start]')).toBeHidden(); await expect(roots.first().locator('fieldset:visible')).toHaveCount(3); await expect(roots.first().locator('[data-lp-fallback]')).toBeVisible();
  await expect(roots.first().locator('[data-lp-mark]')).toHaveCount(0);
  const before = await page.evaluate(() => window.lpSaved); await roots.first().locator('input').first().check();
  expect(await page.evaluate(() => window.lpSaved)).toEqual(before);
  await page.evaluate(() => window.lpEnhance());
  await expect(roots.first().locator('[data-lp-result]')).toHaveText('You can skip 2 of 3 sections.');
  await expect(roots.first().locator('[role="status"]')).toHaveText('');
});

test('missing and mismatched markup fail loudly before enhancement', async ({ page }) => {
  await open(page);
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/test-out/enhance.js'); const { strings } = await import('/patterns/test-out/strings.js');
    enhance(document.createElement('section'), { content, strings: strings.en });
  }, english)).rejects.toThrow('Missing test-out markup');
  for (const violation of ['radio', 'value', 'question', 'error', 'name', 'label', 'explanation', 'outline', 'status', 'id', 'tabindex', 'panel', 'heading']) {
    await open(page); await page.evaluate(kind => {
      window.lpInstances[0].destroy(); const first = document.querySelector('input'), fieldset = document.querySelector('fieldset');
      if (kind === 'panel') document.querySelector('[data-lp-panel="question"]').removeAttribute('data-lp-panel');
      if (kind === 'heading') document.querySelector('[data-lp-panel-heading]').remove();
      if (kind === 'radio') first.remove(); if (kind === 'value') first.value = 'bad';
      if (kind === 'question') fieldset.dataset.lpQuestion = 'bad';
      if (kind === 'error') document.querySelector('[data-lp-question-error]').remove();
      if (kind === 'name') document.querySelectorAll('fieldset')[1].querySelectorAll('input').forEach(el => el.name = first.name);
      if (kind === 'label') first.closest('label').replaceWith(first);
      if (kind === 'explanation') document.querySelector('[data-lp-explanation]').remove();
      if (kind === 'outline') document.querySelector('[data-lp-section-status]').remove();
      if (kind === 'status') document.querySelector('[data-lp-section-status]').dataset.lpSectionStatus = '99';
      if (kind === 'id') fieldset.removeAttribute('id'); if (kind === 'tabindex') fieldset.removeAttribute('tabindex');
    }, violation);
    await expect(page.evaluate(() => window.lpEnhance())).rejects.toThrow(/Invalid test-out|Missing test-out/);
  }
});

test('forced colours keep marks, keyboard focus and quiet reset visible', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page); await pick(page); await page.locator('[data-lp-check]').click();
  if (process.env.LP_SHOTS_DIR) {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({ path: `${process.env.LP_SHOTS_DIR}/en-${width}-forced-colours.png`, fullPage: true });
    }
  }
  await review(page);
  await expect(page.locator('[data-lp-mark]').first()).toHaveCSS('border-style', 'double');
  await page.locator('[data-lp-restart]').press('Tab'); await page.locator('[data-lp-restart]').focus();
  await expect(page.locator('[data-lp-restart]')).toHaveCSS('outline-width', '2px');
  await page.locator('[data-lp-restart]').click(); await page.locator('[data-lp-start]').click(); await page.keyboard.press('Tab'); await page.locator('input').first().focus();
  await expect(page.locator('label').first()).toHaveCSS('outline-width', '2px');
});

for (const width of [1280, 390, 320]) {
  test('owner audit: two statuses align with the first title line at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await open(page);
    await page.locator('[data-lp-start]').click();
    await expect(page.locator('[data-lp-panel="question"]:visible > p.lp-small')).toHaveCount(0);
    await page.locator('[data-lp-back]:visible').click();
    await pick(page); await page.locator('[data-lp-check]').click();
    for (const row of await page.locator('.lp-test-out-outline-row').all()) {
      const difference = await row.evaluate(el => el.querySelector('.lp-run-in').getBoundingClientRect().top - el.querySelector('[data-lp-section-status]').getBoundingClientRect().top);
      expect(Math.abs(difference)).toBeLessThanOrEqual(1);
    }
    await page.locator('[data-lp-restart]').click();
    await expect(page.locator('[data-lp-outline-heading]')).toHaveText("What you'll cover");
  });
}
