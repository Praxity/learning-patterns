import { test, expect } from '@playwright/test';

// Shared look (lib/base.css) under a host page like praxity.io: headings in a display face, no
// font synthesis and no italic face loaded.
const HOST = 'h1, h2, h3 { font-family: Georgia, serif; } html { font-synthesis: none; }';

// Conversation's role is scenario content: it changes what a good reply is.
const HEADER_EXCEPTIONS = { conversation: '.lp-scene-sub' };

test('shared small text, errors and hidden text use the accessibility defaults', async ({ page }) => {
  await open(page, '/test-out/en.html');
  await expect(page.locator('[data-lp-intro]')).toHaveCSS('font-size', '16px');
  const error = page.locator('[data-lp-question-error]').first();
  await error.evaluate(el => { el.hidden = false; });
  await expect(error).toHaveCSS('font-size', '17px');
  const status = page.locator('[role="status"]');
  await expect(status).toHaveCSS('margin', '0px');
  await expect(status).toHaveCSS('user-select', 'none');
});

async function checkHeader(page, name) {
  const scene = page.locator('[data-lp-pattern] .lp-scene');
  await expect(scene.locator('.lp-scene-title')).toHaveCount(1);
  const exception = HEADER_EXCEPTIONS[name];
  if (exception) {
    await expect(scene.locator(exception)).toHaveCount(1);
    await expect(scene.locator(exception)).toBeVisible();
    const role = await scene.locator(exception).innerText();
    expect(role.trim()).not.toBe('');
  } else {
    await expect(scene.locator('.lp-scene-sub')).toHaveCount(0);
  }
  const extraText = await scene.evaluate((header, exception) => {
    const allowed = [header.querySelector('.lp-scene-title'), exception && header.querySelector(exception)].filter(Boolean);
    const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT);
    const extra = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      // Decorative icons and conversation's avatar are hidden from the reading order.
      if (node.textContent.trim() && !node.parentElement.closest('[aria-hidden="true"]') && !allowed.some(element => element.contains(node))) extra.push(node.textContent.trim());
    }
    return extra;
  }, exception);
  expect(extraText).toEqual([]);
}

async function open(page, path, host = false) {
  await page.goto(path);
  await page.waitForFunction(() => window.lpReady);
  if (host) await page.addStyleTag({ content: HOST });
}

for (const lang of ['en', 'fr']) test(`scene headers hold one title, with the named conversation role exception (${lang})`, async ({ page }) => {
  for (const name of ['answer-with-confidence', 'conversation', 'dont-know', 'first-answer', 'highlight', 'retrieval-sheet', 'test-out', 'write-distractors']) {
    await open(page, `/${name}/${lang}.html`);
    await checkHeader(page, name);
    if (name === 'conversation') await expect(page.locator('.lp-scene-sub')).toHaveText(lang === 'en' ? 'Your colleague' : 'Votre collègue');
  }
});

test('the header guard rejects added subtitles, including beyond the conversation exception', async ({ page }) => {
  test.setTimeout(15000);
  for (const name of ['dont-know', 'conversation']) for (const location of ['nested', 'direct', 'text']) {
    await open(page, `/${name}/en.html`);
    await page.locator('[data-lp-pattern] .lp-scene').evaluate((scene, location) => {
      if (location === 'text') scene.append('Extra subtitle');
      else (location === 'nested' ? scene.querySelector('div') : scene).insertAdjacentHTML('beforeend', '<p>Extra subtitle</p>');
    }, location);
    await expect(checkHeader(page, name)).rejects.toThrow();
  }
});

for (const name of ['answer-with-confidence', 'change-one-detail', 'dont-know', 'first-answer', 'highlight', 'hint-ladder', 'if-then-plan', 'mark-colleague', 'retrieval-sheet', 'test-out', 'write-distractors']) {
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


const multi = ['estimate-magnitude', 'prolific-questions'];

for (const name of ['draw-your-guess', 'estimate-magnitude', 'prolific-questions', 'self-check', 'split-by-proportion']) {
  for (const lang of ['en', 'fr']) test(`scenario context precedes a larger question without a scene (${name}, ${lang})`, async ({ page, browserName }) => {
    await open(page, `/${name}/${lang}.html`, true);
    await expect(page.locator('.lp-scene')).toHaveCount(0);
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const forced of browserName === 'chromium' ? ['none', 'active'] : ['none']) {
        await page.emulateMedia({ forcedColors: forced });
        const layout = await page.locator('[data-lp-pattern]').evaluate((root, name) => {
          const context = root.querySelector('.lp-context');
          const question = root.querySelector(name === 'self-check' ? 'h2.lp-stem' : 'legend.lp-stem');
          const lead = root.querySelector(':scope > .lp-heading') || question.querySelector('h2') || question;
          const field = root.querySelector(name === 'self-check' ? 'textarea' : 'fieldset');
          return {
            headingColor: getComputedStyle(question.querySelector('h2') || question).color,
            canvasText: (() => {
              const probe = document.createElement('span');
              probe.style.color = 'CanvasText';
              root.append(probe);
              const color = getComputedStyle(probe).color;
              probe.remove();
              return color;
            })(),
            questionSize: parseFloat(getComputedStyle(question.querySelector('h2') || question).fontSize),
            leadSize: parseFloat(getComputedStyle(lead).fontSize),
            contextSize: parseFloat(getComputedStyle(context.querySelector('p') || context).fontSize),
            contextWeight: getComputedStyle(context).fontWeight,
            composerGap: name === 'self-check' ? root.querySelector('.lp-self-check-composer').getBoundingClientRect().top - question.getBoundingClientRect().bottom : null,
            contextBottom: context.getBoundingClientRect().bottom,
            fieldTop: field.getBoundingClientRect().top,
            firstTop: root.firstElementChild.getBoundingClientRect().top - root.getBoundingClientRect().top,
            padding: parseFloat(getComputedStyle(root).paddingTop) + parseFloat(getComputedStyle(root).borderTopWidth),
            overflow: document.documentElement.scrollWidth > innerWidth
          };
        }, name);
        if (forced === 'active') expect(layout.headingColor).toBe(layout.canvasText);
        // A title over several questions is the largest text; its questions step down to 19px.
        expect(layout.leadSize).toBe(21);
        expect(layout.questionSize).toBe(multi.includes(name) ? 19 : 21);
        expect(layout.questionSize).toBeGreaterThan(layout.contextSize);
        expect(layout.contextWeight).toBe('400');
        if (name === 'self-check') expect(layout.composerGap).toBeCloseTo(12, 0);
        expect(layout.contextBottom).toBeLessThanOrEqual(layout.fieldTop);
        expect(layout.firstTop).toBeCloseTo(layout.padding, 0);
        expect(layout.overflow).toBe(false);
      }
    }
  });
}

async function expectQuestionLargest(page, name) {
  const sizes = await page.locator('[data-lp-pattern]').evaluate((root, name) => {
    const question = root.querySelector(name === 'self-check' ? 'h2.lp-stem' : 'legend.lp-stem');
    const lead = root.querySelector(':scope > .lp-heading') || question.querySelector('h2') || question;
    const questionSize = parseFloat(getComputedStyle(lead).fontSize);
    const larger = [...root.querySelectorAll('*')].filter(element => {
      if (element.closest('.lp-visually-hidden') || getComputedStyle(element).visibility !== 'visible') return false;
      return [...element.childNodes].some(node => {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) return false;
        const range = document.createRange();
        range.selectNode(node);
        return [...range.getClientRects()].some(rect => rect.width > 0 && rect.height > 0);
      }) && parseFloat(getComputedStyle(element).fontSize) > questionSize;
    }).map(element => element.textContent.trim());
    return { questionSize, larger };
  }, name);
  expect(sizes.questionSize).toBe(21);
  expect(sizes.larger).toEqual([]);
}

for (const name of ['draw-your-guess', 'estimate-magnitude', 'prolific-questions', 'self-check', 'split-by-proportion']) {
  for (const lang of ['en', 'fr']) test(`top heading stays largest after Check (${name}, ${lang})`, async ({ page }) => {
    await open(page, `/${name}/${lang}.html`, true);
    if (name === 'self-check') {
      await page.getByRole('textbox').fill('My draft');
    } else if (name === 'prolific-questions') {
      for (const fact of await page.locator('[data-lp-fact]').all()) await fact.getByRole('radio').first().check();
    } else {
      for (const slider of await page.getByRole('slider').all()) {
        await slider.focus();
        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowRight');
      }
    }
    await page.locator('[data-lp-check]').click();
    if (name === 'self-check') await page.locator('[data-lp-show]').click();
    await expect(page.locator('[data-lp-result]')).toBeVisible();
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expectQuestionLargest(page, name);
    }
  });
}

for (const lang of ['en', 'fr']) test(`question stays largest with the no-JS answer open (split-by-proportion, ${lang})`, async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`/split-by-proportion/${lang}.html`);
    await page.locator('[data-lp-fallback] summary').click();
    await expect(page.locator('[data-lp-fallback] h3')).toBeVisible();
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await expectQuestionLargest(page, 'split-by-proportion');
    }
  } finally {
    await context.close();
  }
});

for (const name of ['draw-your-guess', 'split-by-proportion']) test(`legend heading keeps stem type under host heading rules (${name})`, async ({ page }) => {
  await open(page, `/${name}/en.html`, true);
  await page.addStyleTag({ content: '.lp h2 { font-size: 2rem; margin-top: 2em; letter-spacing: .2em; }' });
  const heading = page.locator('legend.lp-stem > h2.lp-heading');
  await expect(heading).toHaveCSS('font-size', '21px');
  await expect(heading).toHaveCSS('margin-top', '0px');
  expect(await heading.evaluate(el => getComputedStyle(el).letterSpacing)).toBe(await heading.locator('..').evaluate(el => getComputedStyle(el).letterSpacing));
});
