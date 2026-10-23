import { test, expect } from '@playwright/test';

// Shared look (lib/base.css) under a host page like praxity.io: headings in a display face, no
// font synthesis and no italic face loaded.
const HOST = 'h1, h2, h3 { font-family: Georgia, serif; } html { font-synthesis: none; }';

// Conversation's role is scenario content: it changes what a good reply is.
const HEADER_EXCEPTIONS = { conversation: '.lp-scene-sub' };

async function checkHeader(page, name) {
  const scene = page.locator('[data-lp-pattern] .lp-scene');
  await expect(scene.locator('.lp-scene-title')).toHaveCount(1);
  const title = await scene.locator('.lp-scene-title').innerText();
  const exception = HEADER_EXCEPTIONS[name];
  if (exception) {
    await expect(scene.locator(exception)).toHaveCount(1);
    await expect(scene.locator(exception)).toBeVisible();
    const role = await scene.locator(exception).innerText();
    expect(role.trim()).not.toBe('');
    await expect(scene.locator(':scope > div > *')).toHaveText([title, role]);
  } else {
    await expect(scene.locator(':scope > div > *')).toHaveText([title]);
    await expect(scene.locator('.lp-scene-sub')).toHaveCount(0);
  }
}

async function open(page, path, host = false) {
  await page.goto(path);
  await page.waitForFunction(() => window.lpReady);
  if (host) await page.addStyleTag({ content: HOST });
}

for (const lang of ['en', 'fr']) test(`scene headers hold one title, with the named conversation role exception (${lang})`, async ({ page }) => {
  for (const name of ['conversation', 'dont-know', 'first-answer', 'highlight', 'retrieval-sheet', 'self-check', 'test-out', 'write-distractors']) {
    await open(page, `/${name}/${lang}.html`);
    await checkHeader(page, name);
    if (name === 'conversation') await expect(page.locator('.lp-scene-sub')).toHaveText(lang === 'en' ? 'Your colleague' : 'Votre collègue');
  }
});

test('the header guard rejects added subtitles, including beyond the conversation exception', async ({ page }) => {
  test.setTimeout(15000);
  for (const name of ['dont-know', 'conversation']) {
    await open(page, `/${name}/en.html`);
    await page.locator('[data-lp-pattern] .lp-scene > div').evaluate(div => div.insertAdjacentHTML('beforeend', '<p>Extra subtitle</p>'));
    await expect(checkHeader(page, name)).rejects.toThrow();
  }
});

for (const name of ['dont-know', 'first-answer', 'highlight', 'retrieval-sheet', 'test-out', 'write-distractors']) {
  test(`headings inside the pattern keep the body face when the host styles headings (${name})`, async ({ page }) => {
    await open(page, `/${name}/en.html`, true);
    const families = await page.locator('.lp').evaluateAll(roots => roots.flatMap(root => [...root.querySelectorAll('h1, h2, h3, h4, h5, h6, .lp-scene-title, .lp-run-in')].map(el => getComputedStyle(el).fontFamily)));
    expect(families.length).toBeGreaterThan(0);
    for (const family of families) expect(family).toMatch(/^"Source Sans 3"/);
  });
}

test('emphasis is synthesised when the host turns font synthesis off', async ({ page }) => {
  await open(page, '/dont-know/en.html', true);
  const synthesis = await page.locator('.lp-stem').first().evaluate(stem => {
    const em = stem.ownerDocument.createElement('em');
    em.textContent = 'really';
    stem.append(em);
    return getComputedStyle(em).fontSynthesisStyle;
  });
  expect(synthesis).toBe('auto');
});

test('a section straight under the scene header draws no second rule', async ({ page }) => {
  await open(page, '/highlight/en.html');
  const borders = await page.locator('.lp-scene').evaluate(scene => ['<div class="lp-section"><p>Step</p></div>', '<div><div class="lp-section"><p>Step</p></div></div>'].map(markup => {
    scene.insertAdjacentHTML('afterend', markup);
    const added = scene.nextElementSibling;
    const width = getComputedStyle(added.matches('.lp-section') ? added : added.firstElementChild).borderTopWidth;
    added.remove();
    return width;
  }));
  expect(borders).toEqual(['0px', '0px']);
});

test('the select arrow is drawn 14px inside the border', async ({ page }) => {
  await open(page, '/write-distractors/en.html');
  const style = await page.locator('select.lp-input').first().evaluate(el => {
    const css = getComputedStyle(el);
    return [css.appearance, css.paddingRight, css.backgroundImage.startsWith('url("data:image/svg+xml')];
  });
  expect(style).toEqual(['none', '40px', true]);
});

test('an invalid select keeps room for the drawn arrow', async ({ page }) => {
  await open(page, '/write-distractors/en.html');
  // The 2px error border takes 1px of the 40px end padding, as the choice rows do.
  expect(await page.locator('select.lp-input').first().evaluate(el => { el.setAttribute('aria-invalid', 'true'); return getComputedStyle(el).paddingRight; })).toBe('39px');
});

test('forced colours bring back the native select arrow', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Only Chromium emulates forced colours.');
  await page.emulateMedia({ forcedColors: 'active' });
  await open(page, '/write-distractors/en.html');
  expect(await page.locator('select.lp-input').first().evaluate(el => [getComputedStyle(el).appearance, getComputedStyle(el).backgroundImage])).toEqual(['auto', 'none']);
});

test('a locked choice row shows no hover or pointer', async ({ page }) => {
  // Reduced motion removes the colour transition, so styles read straight after the hover are final.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, '/dont-know/en.html');
  for (const [index, value] of ['unexpected-expenses', 'no-interest', 'dont-know'].entries()) await page.locator('fieldset').nth(index).locator(`input[value="${value}"]`).check();
  await page.locator('[data-lp-check]').click();
  const row = page.locator('fieldset').first().locator('label:has(input[value="planned-holidays"])');
  await row.hover();
  expect(await row.evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).borderTopColor, getComputedStyle(el).cursor, getComputedStyle(el.querySelector('input')).cursor])).toEqual(['rgb(255, 255, 255)', 'rgb(213, 217, 223)', 'default', 'default']);
  // A locked row the learner chose, with no mark ("I don't know"), keeps its selection under the pointer.
  const chosen = page.locator('fieldset').nth(2).locator('label:has(input[value="dont-know"])');
  await chosen.hover();
  expect(await chosen.evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).borderTopColor])).toEqual(['rgb(238, 242, 253)', 'rgb(44, 85, 201)']);
});

test('a checkbox outside a choice row gets the 3px focus ring', async ({ page }) => {
  await open(page, '/dont-know/en.html');
  await page.locator('.lp-stem').first().evaluate(stem => stem.insertAdjacentHTML('afterend', '<button type="button" data-before>Before</button><input type="checkbox" aria-label="Bare" data-bare>'));
  await page.locator('[data-before]').focus();
  await page.keyboard.press('Tab');
  const bare = page.locator('[data-bare]');
  await expect(bare).toBeFocused();
  expect(await bare.evaluate(el => { const css = getComputedStyle(el); return [css.outlineWidth, css.outlineStyle, css.outlineColor]; })).toEqual(['3px', 'solid', 'rgb(44, 85, 201)']);
});
