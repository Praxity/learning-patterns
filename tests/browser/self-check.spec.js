import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const english = JSON.parse(await readFile(new URL('../../patterns/self-check/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/self-check/examples/fr.json', import.meta.url)));
for (const [lang, content] of [['en', english], ['fr', french]]) test(`every checkbox keeps its native label and name on Tab (${lang})`, async ({ page }) => {
  await open(page, `/self-check/${lang}.html`);
  await page.locator('textarea').fill('A message about the report.');
  await page.locator('[data-lp-check]').click();
  const boxes = page.getByRole('checkbox');
  await expect(boxes).toHaveCount(content.parts.length);
  for (const [index, part] of content.parts.entries()) {
    const box = boxes.nth(index);
    await expect(box).toBeFocused();
    await expect(box).toHaveAccessibleName(part.label);
    await expect(box.locator('..')).not.toHaveAttribute('role');
    await page.keyboard.press('Tab');
  }
  const box = boxes.first();
  const row = box.locator('..');
  expect(await row.ariaSnapshot()).toContain(`checkbox "${content.parts[0].label}"`);
  await row.locator('span').first().click(); await expect(box).toBeChecked();
  await box.focus(); await page.keyboard.press('Space'); await expect(box).not.toBeChecked();
});

test('shared scene spans the card and centres its tile on the task', async ({ page }) => {
  await open(page);
  await expect(page.locator('.lp-scene-label')).toHaveCount(0);
  await expect(page.locator('.lp-scene-title')).toHaveText(english.task);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.locator('.lp-scene').evaluate(el => {
      const scene = el.getBoundingClientRect(), card = el.parentElement.getBoundingClientRect();
      const tile = el.querySelector('.lp-scene-icon').getBoundingClientRect(), text = el.querySelector('div').getBoundingClientRect();
      return [scene.left - card.left, card.right - scene.right, tile.top + tile.height / 2 - text.top - text.height / 2];
    });
    for (const difference of geometry) expect(Math.abs(difference)).toBeLessThanOrEqual(1);
  }
});

for (const [lang, placeholder, instruction] of [
  ['en', 'Hi Sam,\n\nType your message here…', 'Tick each part your answer includes.'],
  ['fr', 'Bonjour Sam,\n\nÉcrivez votre message ici…', 'Cochez chaque élément présent dans votre réponse.']
]) {
  test(`composer labels size to content and recipient stays on one line (${lang})`, async ({ page }) => {
    await open(page, `/self-check/${lang}.html`);
    await page.evaluate(() => document.fonts.ready);
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const geometry = await page.locator('.lp-self-check-composer').evaluate(el => {
        const keys = [...el.querySelectorAll('.lp-self-check-meta-key')];
        const widths = keys.map(key => key.getBoundingClientRect().width);
        const textWidths = keys.map(key => { const range = document.createRange(); range.selectNodeContents(key); return range.getBoundingClientRect().width; });
        const recipient = el.querySelector('.lp-self-check-recipient');
        const range = document.createRange(); range.selectNodeContents(recipient.lastChild);
        return { widths, textWidths, recipientLines: range.getClientRects().length, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      expect(geometry.widths[0]).toBeCloseTo(geometry.widths[1], 0);
      expect(geometry.widths[0]).toBeCloseTo(Math.max(...geometry.textWidths), 0);
      expect(geometry.recipientLines).toBe(1);
      expect(geometry.overflow).toBe(false);
    }
  });

  test(`placeholder is authored, empty, labelled and has 4.5:1 contrast (${lang})`, async ({ page }) => {
    await open(page, `/self-check/${lang}.html`);
    await expect(page.getByRole('textbox')).toHaveAccessibleName(lang === 'fr' ? 'Votre réponse' : 'Your answer');
    await expect(page.getByRole('textbox')).toHaveAttribute('placeholder', placeholder);
    await expect(page.getByRole('textbox')).toHaveValue('');
    const contrast = await page.getByRole('textbox').evaluate(el => {
      const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      const placeholder = getComputedStyle(el, '::placeholder');
      const text = luminance(placeholder.color), background = luminance(getComputedStyle(el).backgroundColor);
      return { ratio: (Math.max(text, background) + .05) / (Math.min(text, background) + .05), opacity: placeholder.opacity };
    });
    expect(contrast.ratio).toBeGreaterThanOrEqual(4.5); expect(contrast.opacity).toBe('1');
    await page.locator('[data-lp-check]').click();
    await expect(page.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('textbox').fill('Draft');
    await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-ticks] legend')).toContainText(instruction);
    await expect(page.locator('[data-lp-ticks] .lp-small')).toHaveCount(0);
  });
}

for (const forcedColors of ['none', 'active']) {
  test(`answer focus outlines the whole composer (${forcedColors})`, async ({ page, browserName }) => {
    test.skip(forcedColors === 'active' && browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
    await page.emulateMedia({ forcedColors });
    await open(page);
    await page.getByRole('textbox').focus();
    const styles = await page.locator('.lp-self-check-composer').evaluate(el => {
      const css = getComputedStyle(el), textarea = getComputedStyle(el.querySelector('textarea'));
      const probe = document.createElement('span'); probe.style.color = 'Highlight'; el.append(probe);
      const highlight = getComputedStyle(probe).color; probe.remove();
      return { width: css.outlineWidth, style: css.outlineStyle, offset: css.outlineOffset, color: css.outlineColor, radius: css.borderRadius, fieldStyle: textarea.outlineStyle, highlight };
    });
    expect(styles.width).toBe('2px'); expect(styles.style).toBe('solid'); expect(styles.offset).toBe('2px');
    expect(styles.radius).toBe('10px'); expect(styles.fieldStyle).toBe('none');
    expect(styles.color).toBe(forcedColors === 'active' ? styles.highlight : 'rgb(44, 85, 201)');
    await page.getByRole('textbox').blur();
    await expect(page.locator('.lp-self-check-composer')).toHaveCSS('outline-style', 'none');
  });
}

test('feedback badges and number keys stay at the first line of long part labels', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const { render } = await import('/patterns/self-check/render.js');
    const { enhance } = await import('/patterns/self-check/enhance.js');
    const { strings } = await import('/patterns/self-check/strings.js');
    const content = { task: 'Write a message.', context: { to: 'Sam', initials: 'S', subject: 'Report' }, model: 'Tuesday', parts: [{ id: 'date', label: 'Name the report, explain the late sales data and ask your manager to approve a new deadline of Tuesday', evidence: null, missed: 'Ask for Tuesday.' }] };
    window.lpInstances[0].destroy();
    document.querySelector('main').innerHTML = render(content, strings.en, { id: 'long', lang: 'en' });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
  });
  await ticks(page); await page.locator('[data-lp-show]').click();
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const positions = await page.locator('.lp-self-check-legend-item').evaluate(el => {
      const label = el.querySelector('.lp-self-check-legend-label');
      const key = el.querySelector(':scope > .lp-self-check-ann-n');
      const badge = el.querySelector('.lp-self-check-legend-status');
      return { label: label.getBoundingClientRect().top, key: key.getBoundingClientRect().top, badge: badge.getBoundingClientRect().top };
    });
    expect(Math.abs(positions.key - positions.label)).toBeLessThanOrEqual(4);
    expect(Math.abs(positions.badge - positions.label)).toBeLessThanOrEqual(4);
    const summary = await page.locator('.lp-self-check-result-head').evaluate(el => ({
      ring: el.querySelector('svg').getBoundingClientRect().top,
      title: el.querySelector('h3').getBoundingClientRect().top
    }));
    expect(Math.abs(summary.ring - summary.title)).toBeLessThanOrEqual(1);
  }
});

async function open(page, path = '/self-check/en.html') {
  await page.goto(path);
  await page.waitForFunction(() => window.lpReady);
}

for (const [lang, answerLabel, empty, check, show, whole, summary, restart] of [
  ['en', 'Your answer', 'Write your answer first.', 'Check my answer', 'Show feedback', 'Whole answer', 'You ticked 1 of 2 parts.', 'Start over'],
  ['fr', 'Votre réponse', "Écrivez d'abord votre réponse.", 'Vérifier ma réponse', 'Afficher la rétroaction', "Toute la réponse", 'Éléments cochés : 1 sur 2.', 'Recommencer']
]) test(`general answer without email context supports the complete journey (${lang})`, async ({ page }) => {
  await open(page, `/self-check/${lang}.html`);
  const content = lang === 'en'
    ? { task: 'Explain why the report needs another day.', model: 'The data arrived late.', parts: [{ id: 'reason', label: 'Reason', missed: 'Explain the delay.', evidence: 'The data arrived late.' }, { id: 'tone', label: 'Tone', missed: 'Avoid blame.', evidence: null }] }
    : { task: 'Expliquez pourquoi le rapport exige une journée de plus.', model: 'Les données sont arrivées en retard.', parts: [{ id: 'reason', label: 'Raison', missed: 'Expliquez le retard.', evidence: 'Les données sont arrivées en retard.' }, { id: 'tone', label: 'Ton', missed: 'Évitez le blâme.', evidence: null }] };
  await page.evaluate(async ({ content, lang }) => {
    const { render } = await import('/patterns/self-check/render.js');
    const { enhance } = await import('/patterns/self-check/enhance.js');
    const { strings } = await import('/patterns/self-check/strings.js');
    window.lpInstances[0].destroy();
    document.querySelector('main').innerHTML = render(content, strings[lang], { id: 'general', lang });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings[lang] });
  }, { content, lang });
  await expect(page.locator('.lp-scene-title')).toHaveText(content.task);
  await expect(page.locator('.lp-self-check-meta-list, .lp-self-check-recipient, .lp-self-check-avatar, .lp-scene-icon')).toHaveCount(0);
  const answer = page.getByRole('textbox', { name: answerLabel, exact: true });
  await expect(answer).not.toHaveAttribute('placeholder');
  const scan = async () => {
    await page.waitForFunction(() => [...document.getAnimations()].every(animation => animation.playState !== 'running' && !animation.pending));
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  };
  await scan();
  await page.getByRole('button', { name: check, exact: true }).click();
  await expect(answer).toBeFocused();
  await expect(page.locator('[data-lp-error]')).toHaveText(empty);
  await answer.fill(content.model);
  await page.getByRole('button', { name: check, exact: true }).click();
  await expect(page.getByRole('checkbox').first()).toBeFocused();
  await page.keyboard.press('Space');
  await scan();
  await page.getByRole('button', { name: show, exact: true }).click();
  await expect(page.locator('.lp-self-check-pane').first().locator('figcaption')).toHaveText(answerLabel);
  await expect(page.locator('.lp-self-check-pane').first().locator('p')).toHaveText(content.model);
  await expect(page.locator('.lp-self-check-legend')).toContainText(whole);
  await expect(page.getByRole('status')).toHaveText(summary);
  await scan();
  await page.getByRole('button', { name: restart, exact: true }).click();
  await expect(answer).toHaveValue('');
  await expect(answer).toBeFocused();
});

async function ticks(page) {
  await page.getByRole('textbox').fill('My draft');
  await page.getByRole('button', { name: 'Check my answer', exact: true }).click();
}

async function observeStatus(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    new MutationObserver(records => {
      for (const record of records) window.lpAnnouncements.push(record.target.textContent);
    }).observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}

test('message scene, live meter and annotated comparison use authored content', async ({ page }) => {
  await open(page); await observeStatus(page);
  await expect(page.getByRole('textbox')).toHaveAccessibleName('Your answer');
  await expect(page.locator('.lp-self-check-composer')).toContainText('Sam, your manager');
  await expect(page.locator('.lp-self-check-composer')).toContainText('Client report');
  await ticks(page);
  await expect(page.locator('[data-lp-meter]')).toHaveText('0 of 6');
  await expect(page.locator('[data-lp-meter] svg')).toHaveAttribute('aria-hidden', 'true');
  await page.getByRole('checkbox').nth(1).check();
  await expect(page.locator('[data-lp-meter]')).toHaveText('1 of 6');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  await page.locator('[data-lp-show]').click();
  await expect(page.locator('.lp-self-check-pane').first()).toContainText('My draft');
  await expect(page.locator('.lp-self-check-pane-model mark')).toHaveCount(5);
  await expect(page.locator('mark[data-lp-included="true"]')).toContainText('The sales data arrived three days late');
  await expect(page.locator('.lp-self-check-legend')).toContainText('Whole answer');
  await expect(page.locator('[data-lp-result]')).toHaveClass(/lp-reveal/);
  await page.setViewportSize({ width: 1280, height: 900 });
  const wide = await page.locator('.lp-self-check-pane').evaluateAll(panes => panes.map(p => p.getBoundingClientRect().top));
  expect(wide[0]).toBe(wide[1]);
  await page.setViewportSize({ width: 390, height: 900 });
  const narrow = await page.locator('.lp-self-check-pane').evaluateAll(panes => panes.map(p => p.getBoundingClientRect().top));
  expect(narrow[1]).toBeGreaterThan(narrow[0]);
});

test('destroy keeps root and controls, removes listeners and restores server sections', async ({ page }) => {
  await open(page); await ticks(page); await page.locator('[data-lp-show]').click();
  const before = await page.evaluate(() => {
    window.lpOriginalRoot = document.querySelector('[data-lp-pattern]');
    window.lpOriginalAnswer = document.querySelector('textarea');
    window.lpInstances[0].destroy();
    const saved = JSON.stringify(window.lpSaved);
    document.querySelector('[data-lp-check]').click();
    document.querySelector('textarea').dispatchEvent(new Event('input'));
    return saved;
  });
  expect(await page.evaluate(() => window.lpOriginalRoot === document.querySelector('[data-lp-pattern]'))).toBe(true);
  expect(await page.evaluate(() => window.lpOriginalAnswer === document.querySelector('textarea'))).toBe(true);
  expect(await page.evaluate(() => JSON.stringify(window.lpSaved))).toBe(before);
  await expect(page.locator('[data-lp-check]')).toBeHidden();
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await expect(page.locator('[data-lp-result]')).toBeEmpty();
});

test('comparison escapes draft text and summaries cover one missing part and all included', async ({ page }) => {
  await open(page); await ticks(page);
  const draft = '<img src=x onerror=alert(1)> & my message';
  await page.getByRole('textbox').fill(draft);
  for (const box of await page.getByRole('checkbox').all()) await box.check();
  await page.getByRole('checkbox').nth(4).uncheck(); await page.locator('[data-lp-show]').click();
  await expect(page.locator('.lp-self-check-result-head')).toContainText("One part to add. Check that Tuesday works.");
  await expect(page.locator('.lp-self-check-pane').first().locator('p')).toHaveText(draft);
  await expect(page.locator('.lp-self-check-pane img')).toHaveCount(0);
  await expect(page.locator('mark[data-lp-included="false"]')).toHaveCount(1);
  await expect(page.locator('.lp-self-check-legend-hint')).toHaveCount(1);
  await page.getByRole('checkbox').nth(4).check(); await page.locator('[data-lp-show]').click();
  await expect(page.locator('.lp-self-check-result-head')).toContainText('Compare your wording with the model answer.');
  await expect(page.locator('mark[data-lp-included="true"]')).toHaveCount(5);
  await expect(page.locator('.lp-self-check-legend-hint')).toHaveCount(0);
});

test('reduced motion stops the shared feedback reveal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page); await ticks(page); await page.locator('[data-lp-show]').click();
  await expect(page.locator('[data-lp-result]')).toBeVisible();
  expect(await page.locator('[data-lp-result]').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('keyboard-only journey, error association, focus and one mutation per announcement', async ({ page }) => {
  await open(page); await observeStatus(page);
  const answer = page.getByRole('textbox');
  await page.keyboard.press('Tab'); await expect(answer).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Check my answer', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(answer).toBeFocused(); await expect(answer).toHaveAttribute('aria-invalid', 'true');
  const errorId = await answer.getAttribute('aria-describedby');
  await expect(page.locator(`[id="${errorId}"]`)).toHaveText('Write your answer first.');
  await page.keyboard.type('A message to my manager.');
  await expect(answer).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[data-lp-error]')).toBeHidden();
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  const boxes = page.getByRole('checkbox'); await expect(boxes.first()).toBeFocused();
  await page.keyboard.press('Space');
  for (let index = 0; index < 6; index++) await page.keyboard.press('Tab');
  const show = page.getByRole('button', { name: 'Show feedback' });
  await expect(show).toBeFocused(); await page.keyboard.press('Enter'); await expect(show).toBeFocused();
  await expect(page.locator('[data-lp-result]')).toContainText('You ticked 1 of 6 parts.');
  await expect(page.locator('[data-lp-result]')).toContainText('Included');
  await expect(page.locator('[data-lp-result]')).toContainText('To add');
  await page.keyboard.press('Enter'); await expect(show).toBeFocused();
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Start over' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(answer).toBeFocused();
  await expect(answer).toHaveValue(''); await expect(page.locator('[data-lp-ticks]')).toBeHidden();
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  await expect(page.locator('input:checked')).toHaveCount(0);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['You ticked 1 of 6 parts.', 'You ticked 1 of 6 parts.', 'Answer cleared.']);
});

for (const [lang, content, included, notIncluded] of [
  ['en', english, 'Included', 'To add'],
  ['fr', french, 'Inclus', 'À ajouter']
]) {
  test(`feedback names every part and puts missed hints on their own line (${lang})`, async ({ page }) => {
    await open(page, `/self-check/${lang}.html`);
    await page.getByRole('textbox').fill('Draft'); await page.locator('[data-lp-check]').click();
    await page.getByRole('checkbox').first().check(); await page.locator('[data-lp-show]').click();
    const rows = page.locator('[data-lp-result] li');
    await expect(rows).toHaveCount(content.parts.length);
    for (const [index, part] of content.parts.entries()) {
      const row = rows.nth(index);
      await expect(row.locator('.lp-self-check-legend-label')).toContainText(part.label);
      await expect(row.locator('.lp-self-check-legend-status')).toHaveText(index === 0 ? included : notIncluded);
      await expect(row.locator('.lp-self-check-legend-hint')).toHaveCount(index === 0 ? 0 : 1);
      if (index !== 0) await expect(row.locator('.lp-self-check-legend-hint')).toHaveText(part.missed);
      await expect(row.locator('.lp-self-check-ann-n')).toHaveText(String(index + 1));
      await expect(row.locator('[aria-hidden="true"]')).toHaveCount(2);
    }
  });
}

test('Start over is hidden initially and after reset, and available from the checklist', async ({ page }) => {
  await open(page); await observeStatus(page);
  const restart = page.locator('[data-lp-restart]');
  await expect(restart).toBeHidden();
  await page.locator('[data-lp-check]').click();
  await expect(restart).toBeHidden();
  await ticks(page); await expect(restart).toBeVisible();
  await restart.click();
  await expect(restart).toBeHidden(); await expect(page.locator('[data-lp-ticks]')).toBeHidden();
  await expect(page.getByRole('textbox')).toHaveValue(''); await expect(page.getByRole('textbox')).toBeFocused();
  await ticks(page); await page.locator('[data-lp-show]').click();
  await expect(restart).toBeVisible(); await restart.click();
  await expect(restart).toBeHidden(); await expect(page.locator('[data-lp-result]')).toBeHidden();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Answer cleared.', 'You ticked 0 of 6 parts.', 'Answer cleared.']);
});

test('Start over is a quiet text button with an icon, the same target size and focus ring', async ({ page }) => {
  await open(page); await ticks(page);
  await page.mouse.move(0, 0);
  const restart = page.locator('[data-lp-restart]');
  const style = await restart.evaluate(el => {
    const css = getComputedStyle(el);
    return { background: css.backgroundColor, color: css.color, border: css.borderColor, underline: css.textDecorationLine, minHeight: css.minHeight, height: el.getBoundingClientRect().height };
  });
  expect(style).toMatchObject({ background: 'rgba(0, 0, 0, 0)', color: 'rgb(85, 92, 103)', border: 'rgba(0, 0, 0, 0)', underline: 'none', minHeight: '44px' });
  expect(style.height).toBeGreaterThanOrEqual(44);
  await expect(restart.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  await expect(restart).toHaveAccessibleName('Start over');
  for (const name of ['check', 'show', 'restart']) {
    const button = page.locator(`[data-lp-${name}]`);
    if (name !== 'restart') {
      // Wait for the hover transition to finish before checking its exact final colour.
      await expect(button).toHaveCSS('background-color', 'rgb(44, 85, 201)');
      await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)');
    }
    await button.focus();
    const outline = await button.evaluate(el => { const css = getComputedStyle(el); return [css.outlineWidth, css.outlineStyle, css.outlineOffset, css.outlineColor]; });
    expect(outline).toEqual(['2px', 'solid', '2px', 'rgb(44, 85, 201)']);
  }
  // Theme overrides reach the quiet button too.
  await page.locator('[data-lp-pattern]').evaluate(el => el.style.setProperty('--lp-ink-2', '#123456'));
  expect(await restart.evaluate(el => getComputedStyle(el).color)).toBe('rgb(18, 52, 86)');
});

for (const path of ['/self-check/en.html', '/self-check/fr.html', '/self-check/two.html']) {
  test(`axe at load, checklist and feedback: ${path}`, async ({ page }) => {
    await open(page, path);
    const scan = async () => {
      await page.waitForFunction(() => [...document.querySelectorAll('[data-lp-pattern]')].flatMap(root => root.getAnimations({ subtree: true })).every(animation => animation.playState !== 'running' && !animation.pending));
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    };
    await scan();
    for (const root of await page.locator('[data-lp-pattern]').all()) {
      await root.getByRole('textbox').fill('Draft'); await root.locator('[data-lp-check]').click();
    }
    await scan();
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-show]').click();
    await scan();
  });
}

test('editing answers or ticks preserves feedback, next submit replaces it and saves each change', async ({ page }) => {
  await open(page); await ticks(page);
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: 'Show feedback' }).click();
  const before = await page.locator('[data-lp-result]').innerHTML();
  await page.getByRole('textbox').fill('Edited draft');
  await page.getByRole('checkbox').nth(1).check();
  expect(await page.locator('[data-lp-result]').innerHTML()).toBe(before);
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ answer: 'Edited draft', ticked: ['work_deadline', 'reason'], shown: true });
  await page.getByRole('button', { name: 'Show feedback' }).click();
  await expect(page.locator('.lp-self-check-result-head h3')).toHaveText('You ticked 2 of 6 parts.');
  await expect(page.locator('[data-lp-result] > ol')).toHaveCount(1);
  await page.getByRole('button', { name: 'Start over' }).click();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ answer: '', ticked: [], shown: false });
});

for (const [lang, content] of [['en', english], ['fr', french]]) {
  test(`no JavaScript: native details contains all hints and model (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`/self-check/${lang}.html`);
    await expect(page.getByRole('textbox')).toHaveAttribute('rows', '5');
    await expect(page.getByRole('textbox')).toHaveAttribute('placeholder', lang === 'en' ? 'Hi Sam,\n\nType your message here…' : 'Bonjour Sam,\n\nÉcrivez votre message ici…');
    await page.locator('summary').click(); await expect(page.locator('details')).toHaveAttribute('open', '');
    for (const part of content.parts) await expect(page.locator('details')).toContainText(part.missed);
    for (const part of content.parts) await expect(page.locator('details')).toContainText(part.label);
    await expect(page.locator('details')).toContainText(content.model);
    await expect(page.locator('[data-lp-flow]')).toBeHidden();
    await context.close();
  });

  test(`320px and WCAG text spacing without overflow or overlap (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await open(page, `/self-check/${lang}.html`);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    await page.getByRole('textbox').fill('Draft'); await page.locator('[data-lp-check]').click(); await page.locator('[data-lp-show]').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // The status region is deliberately clipped for screen readers. Check visible text.
    const problems = await page.evaluate(() => [...document.querySelectorAll('p, label, legend, button, li, h2')].filter(el => el.getClientRects().length && !el.matches('.lp-visually-hidden')).flatMap(el => {
      const failures = [];
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) failures.push(el.textContent);
      const children = [...el.children].filter(child => child.getClientRects().length);
      for (let i = 1; i < children.length; i++) {
        // Inline annotation spans can wrap. Compare their painted fragments, not the enclosing rectangles.
        for (const a of children[i - 1].getClientRects()) for (const b of children[i].getClientRects()) {
          if (Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1) failures.push('overlap: ' + el.textContent);
        }
      }
      return failures;
    }));
    expect(problems).toEqual([]);
  });
}

test('French root has French language and translated feedback', async ({ page }) => {
  await open(page, '/self-check/fr.html'); await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', 'fr');
  await page.getByRole('textbox').fill('Mon message'); await page.locator('[data-lp-check]').click();
  await page.getByRole('checkbox').first().check(); await page.locator('[data-lp-show]').click();
  await expect(page.locator('[data-lp-result]')).toContainText('Éléments cochés : 1 sur 6.');
  const model = await page.locator('.lp-self-check-pane-model p').evaluate(el => {
    const copy = el.cloneNode(true); copy.querySelectorAll('[aria-hidden="true"]').forEach(number => number.remove()); return copy.textContent;
  });
  expect(model).toBe(french.model);
});

for (const shown of [false, true]) {
  test(`valid saved state restores checklist and shown=${shown} without announcements`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, { answer: 'Saved answer', ticked: ['reason'], shown });
    await open(page); await expect(page.getByRole('textbox')).toHaveValue('Saved answer');
    await expect(page.getByRole('checkbox').nth(1)).toBeChecked(); await expect(page.locator('[data-lp-ticks]')).toBeVisible();
    await expect(page.locator('[data-lp-restart]')).toBeVisible();
    await expect(page.locator('[role="status"]')).toHaveText('');
    if (shown) await expect(page.locator('[data-lp-result]')).toContainText('You ticked 1 of 6 parts.');
    else await expect(page.locator('[data-lp-result]')).toBeHidden();
  });
}

test('invalid saved state is ignored', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { answer: 'Invalid', ticked: ['unknown'], shown: true }; });
  await open(page); await expect(page.getByRole('textbox')).toHaveValue('');
  await expect(page.locator('[data-lp-ticks]')).toBeHidden(); await expect(page.locator('[role="status"]')).toHaveText('');
  await expect(page.locator('[data-lp-restart]')).toBeHidden();
});

test('enhance is idempotent and destroy removes listeners and restores fallback', async ({ page }) => {
  await open(page); expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await observeStatus(page); await ticks(page); await page.locator('[data-lp-show]').click();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['You ticked 0 of 6 parts.']);
  await page.evaluate(() => window.lpInstances[0].destroy());
  await expect(page.locator('[data-lp-flow]')).toBeHidden(); await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await page.evaluate(() => window.lpEnhance()); await ticks(page); await page.locator('[data-lp-show]').click();
  await expect(page.locator('[data-lp-result] > ol')).toHaveCount(1);
});

test('two instances have unique IDs and independent controls', async ({ page }) => {
  await open(page, '/self-check/two.html');
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id));
  expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  await roots.first().getByRole('textbox').fill('First draft'); await roots.first().locator('[data-lp-check]').click();
  await roots.first().getByRole('checkbox').first().check(); await roots.first().locator('[data-lp-show]').click();
  await expect(roots.nth(1).getByRole('textbox')).toHaveValue(''); await expect(roots.nth(1).locator('[data-lp-ticks]')).toBeHidden();
  await expect(roots.nth(1).locator('[role="status"]')).toHaveText('');
});

test('destroy is safe to repeat after another enhancement', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const old = window.lpInstances[0];
    old.destroy(); window.lpEnhance(); old.destroy();
  });
  await expect(page.locator('[data-lp-flow]')).not.toHaveAttribute('hidden', '');
  await expect(page.locator('[data-lp-check]')).toBeVisible();
  expect(await page.evaluate(() => window.lpEnhance() === window.lpEnhance())).toBe(true);
  await observeStatus(page); await ticks(page); await page.locator('[data-lp-show]').click();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['You ticked 0 of 6 parts.']);
});

test('missing or mismatched markup throws a useful error', async ({ page }) => {
  await open(page);
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/self-check/enhance.js');
    const { strings } = await import('/patterns/self-check/strings.js');
    enhance(document.createElement('section'), { content, strings: strings.en });
  }, english)).rejects.toThrow('Missing self-check markup: textarea');
  await page.evaluate(() => { window.lpInstances[0].destroy(); document.querySelector('input').remove(); });
  await expect(page.evaluate(() => window.lpEnhance())).rejects.toThrow('Invalid self-check parts markup');
});

test('forced colours keeps a 2px focus outline on buttons and checkboxes', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page); await ticks(page);
  await page.keyboard.press('Tab');
  for (const locator of [page.getByRole('checkbox').first(), page.locator('[data-lp-check]'), page.locator('[data-lp-show]'), page.locator('[data-lp-restart]')]) {
    await locator.focus();
    const outline = await locator.evaluate(el => { const css = getComputedStyle(el.matches('input') ? el.closest('.lp-choice') : el); return { width: css.outlineWidth, style: css.outlineStyle, offset: css.outlineOffset, color: css.outlineColor }; });
    expect(outline.width).toBe('2px'); expect(outline.style).toBe('solid'); expect(outline.offset).toBe('2px'); expect(outline.color).not.toBe('rgba(0, 0, 0, 0)');
  }
  const styles = await page.locator('[data-lp-pattern] button').evaluateAll(buttons => buttons.map(el => {
    const css = getComputedStyle(el);
    return { color: css.color, background: css.backgroundColor, borderColor: css.borderColor, borderStyle: css.borderStyle, borderWidth: css.borderWidth };
  }));
  // Resolve system colours in the active palette, without hardcoding a theme.
  const system = await page.evaluate(() => {
    const probe = document.createElement('span'); document.body.append(probe);
    const colors = {};
    for (const name of ['ButtonText', 'ButtonFace', 'LinkText']) { probe.style.color = name; colors[name] = getComputedStyle(probe).color; }
    probe.remove(); return colors;
  });
  // Primary buttons draw a system border; the quiet restart button reads as a link.
  for (const style of styles.slice(0, 2)) {
    expect(style.color).toBe(system.ButtonText); expect(style.background).toBe(system.ButtonFace);
    expect(style.borderColor).toBe(system.ButtonText); expect(style.borderWidth).toBe('1px'); expect(style.borderStyle).toBe('solid');
  }
  expect(styles[2].color).toBe(system.LinkText);
});
