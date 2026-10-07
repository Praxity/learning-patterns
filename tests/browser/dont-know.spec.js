import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const english = JSON.parse(await readFile(new URL('../../patterns/dont-know/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/dont-know/examples/fr.json', import.meta.url)));
const mixed = ['unexpected-expenses', 'no-interest', 'dont-know', 'plan-spending-saving'];

test('shared scene spans the card and centres its tile on title and scoring', async ({ page }) => {
  await open(page);
  await expect(page.locator('.lp-scene-title')).toHaveText(english.title);
  await expect(page.locator('.lp-scene-sub')).toContainText("I don't know");
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

async function open(page, path = '/dont-know/en.html') {
  await page.goto(path);
  await page.waitForFunction(() => window.lpReady);
}
async function pick(root, values = mixed) {
  for (const [index, value] of values.entries()) await root.locator('fieldset').nth(index).locator(`input[value="${value}"]`).check();
}
async function observe(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    new MutationObserver(records => {
      for (const record of records) window.lpAnnouncements.push(record.target.textContent);
    }).observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}
const scan = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);

for (const [lang, title, label, number] of [
  ['en', 'Money basics', 'Quick check', 'Question 1 of 4'],
  ['fr', "Les bases de l'argent", 'Vérification rapide', 'Question 1 sur 4']
]) {
  test(`quiz card has a scene, numbered questions, explanation panels and a score ring (${lang})`, async ({ page }) => {
    await open(page, `/dont-know/${lang}.html`);
    const scene = page.locator('.lp-scene');
    await expect(scene.locator('.lp-scene-label')).toHaveCount(0);
    await expect(scene.getByRole('heading')).toHaveText(title);
    await expect(scene.locator('svg[aria-hidden="true"][focusable="false"]')).toHaveCount(1);
    await expect(page.locator('.lp-dont-know-question-number')).toHaveText(Array.from({ length: 4 }, (_, i) => number.replace('1', String(i + 1))));
    await pick(page); await page.locator('[data-lp-check]').click();
    const panels = page.locator('[data-lp-explanation]:visible');
    await expect(panels).toHaveCount(2);
    await expect(panels).toHaveClass(['lp-quote lp-dont-know-explanation', 'lp-quote lp-dont-know-explanation']);
    await expect(panels.locator('svg[aria-hidden="true"][focusable="false"]')).toHaveCount(2);
    const ring = page.locator('.lp-dont-know-score-ring');
    await expect(ring).toHaveAttribute('aria-hidden', 'true');
    await expect(ring).toHaveAttribute('focusable', 'false');
    await expect(ring.locator('.lp-dont-know-ring-fill')).toHaveAttribute('stroke-dashoffset', '75');
    await expect(page.locator('[data-lp-review] h3')).toHaveText(lang === 'en' ? 'Review' : 'À revoir');
    await expect(page.locator('[data-lp-review] li')).toHaveCount(2);
    await expect(page.locator('[data-lp-review] a svg[aria-hidden="true"]')).toHaveCount(2);
    const links = await page.locator('[data-lp-review] a').evaluateAll(els => els.map(el => el.getBoundingClientRect().top));
    expect(links[1]).toBeGreaterThan(links[0]);
  });
}

test('shared v2 styles give one card, sans stems, keyed full-width choices and accent selection', async ({ page }) => {
  await open(page);
  const root = page.locator('[data-lp-pattern]');
  await expect(root).toHaveClass('lp lp-dont-know');
  await expect(root).toHaveCSS('border-top-width', '1px');
  await expect(root).toHaveCSS('border-radius', '16px');
  for (const question of await page.locator('fieldset').all()) {
    await expect(question).toHaveCSS('border-top-width', '0px');
    await expect(question.locator('legend')).toHaveCSS('font-family', /Source Sans 3/);
    await expect(question.locator('legend')).toHaveCSS('font-size', '21px');
  }
  await page.locator('input').first().check();
  const selected = page.locator('label:has(input:checked)');
  await expect(selected).toHaveCSS('border-top-width', '2px');
  await expect(selected).toHaveCSS('border-top-color', 'rgb(44, 85, 201)');
  // A real 2px border with 1px less padding, no shadow ring (shared rule with Studio).
  await expect(selected).toHaveCSS('box-shadow', 'none');
  await expect(selected).toHaveCSS('padding-top', '9px');
  await expect(selected).toHaveCSS('background-color', 'rgb(238, 242, 253)');
  const keys = await page.locator('fieldset').first().locator('label').evaluateAll(rows => rows.map(row => {
    const input = row.querySelector('input');
    return [getComputedStyle(row, '::before').content, getComputedStyle(input).opacity];
  }));
  expect(keys).toEqual(Array.from({ length: 4 }, () => ['counter(lp-key, upper-alpha)', '0']));
  const sizes = await root.evaluate(el => [...el.querySelectorAll('.lp-choice')].map(row => [row.getBoundingClientRect().width, row.parentElement.getBoundingClientRect().width]));
  expect(sizes.every(([row, question]) => Math.abs(row - question) < 1)).toBe(true);
});

test('keyboard journey associates each unanswered error, focuses first missing radio and announces each result once', async ({ page }) => {
  await open(page); await observe(page);
  const questions = page.locator('fieldset');
  const check = page.locator('[data-lp-check]');
  await page.keyboard.press('Tab'); await expect(questions.nth(0).locator('input').first()).toBeFocused();
  // Select only the first question, then tab past the remaining radio groups.
  await page.keyboard.press('Space');
  for (let n = 0; n < 4; n++) await page.keyboard.press('Tab');
  await expect(check).toBeFocused(); await page.keyboard.press('Enter');
  await expect(questions.nth(1).locator('input').first()).toBeFocused();
  await expect(page.locator('[data-lp-error]')).toHaveText("3 questions unanswered. Choose an option, or I don't know.");
  for (let n = 1; n < 4; n++) {
    const fieldset = questions.nth(n);
    const id = await fieldset.getAttribute('aria-describedby');
    await expect(page.locator(`[id="${id}"]`)).toHaveText('Choose an answer');
    await expect(fieldset.locator('input').first()).toHaveAttribute('aria-describedby', id);
    await expect(fieldset.locator('[data-lp-question-error] svg[aria-hidden="true"]')).toHaveCount(1);
  }
  await expect(page.locator('[data-lp-error] svg[aria-hidden="true"]')).toHaveCount(1);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
  await page.keyboard.press('Space'); await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab'); await page.keyboard.press('Space');
  await page.keyboard.press('Tab'); await expect(check).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-lp-score]').first()).toBeFocused();
  await expect(page.locator('[data-lp-score]').first()).toHaveText('Score 1 out of 4.');
  await expect(check).toBeHidden();
  await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: english.questions[1].text, exact: true })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(questions.nth(1)).toBeFocused();
  await page.locator('[data-lp-score]').first().focus();
  for (let n = 0; n < 3; n++) await page.keyboard.press('Tab');
  await expect(page.locator('[data-lp-restart]')).toBeFocused();
  await page.keyboard.press('Enter'); await expect(questions.first().locator('input').first()).toBeFocused();
  await expect(page.locator('input:checked')).toHaveCount(0);
  await expect(page.locator('[data-lp-result]')).toBeHidden(); await expect(page.locator('[data-lp-restart]')).toBeHidden();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Score 1 out of 4.', 'Cleared.']);
});

for (const [lang, content, correct, wrong, answer, unknown, counts] of [
  ['en', english, 'Correct', 'Not quite', 'Correct answer', "You chose I don't know", '2 right, 1 wrong, 1 "I don\'t know"'],
  ['fr', french, 'Correct', 'Pas tout à fait', 'Bonne réponse', 'Vous avez choisi « Je ne sais pas »', '2 bonnes réponses, 1 mauvaise réponse, 1 « Je ne sais pas »']
]) {
  test(`results mark choices in place, explain only gaps and link back to questions (${lang})`, async ({ page }) => {
    await open(page, `/dont-know/${lang}.html`); await observe(page);
    await expect(page.locator('[data-lp-pattern]')).toHaveAttribute('lang', lang);
    await expect(page.locator('[data-lp-restart]')).toBeHidden();
    for (const fieldset of await page.locator('fieldset').all()) await expect(fieldset.locator('label').last()).toHaveText(lang === 'en' ? "I don't know" : 'Je ne sais pas');
    await pick(page); await page.locator('[data-lp-check]').click();
    const result = page.locator('[data-lp-result]');
    await expect(result.locator('[data-lp-counts]')).toHaveText(counts);
    await expect(page.locator('[data-lp-group]')).toHaveCount(0);
    await expect(page.locator('[data-lp-check]')).toBeHidden();
    await expect(page.locator('input:disabled')).toHaveCount(16);
    await expect(page.locator('input:checked')).toHaveCount(4);
    const questions = page.locator('fieldset');
    for (const index of [0, 3]) {
      await expect(questions.nth(index).locator('label:has(input:checked)')).toHaveAttribute('data-lp-mark', 'correct');
      await expect(questions.nth(index).locator('.lp-choice-mark')).toHaveText(correct);
      await expect(questions.nth(index).locator('[data-lp-explanation]')).toBeHidden();
    }
    await expect(questions.nth(1).locator('label:has(input:checked)')).toHaveAttribute('data-lp-mark', 'wrong');
    await expect(questions.nth(1).locator('label:has(input:checked) .lp-choice-mark')).toHaveText(wrong);
    await expect(questions.nth(2).locator('label:has(input:checked) .lp-choice-mark.lp-neutral')).toHaveText(unknown);
    await expect(questions.nth(2).locator('label:has(input:checked)')).not.toHaveAttribute('data-lp-mark');
    for (const index of [1, 2]) {
      await expect(questions.nth(index).locator(`label:has(input[value="${content.questions[index].correct}"])`)).toHaveAttribute('data-lp-mark', 'correct');
      await expect(questions.nth(index).locator(`label:has(input[value="${content.questions[index].correct}"]) .lp-choice-mark`)).toHaveText(answer);
      await expect(questions.nth(index).locator('[data-lp-explanation]')).toHaveText(content.questions[index].explanation);
    }
    await expect(page.locator('.lp-choice-mark')).toHaveCount(6);
    await expect(page.locator('.lp-choice-mark svg[aria-hidden="true"][focusable="false"]')).toHaveCount(6);
    const links = result.getByRole('link');
    await expect(links).toHaveText([content.questions[1].text, content.questions[2].text]);
    for (const index of [1, 2]) {
      await links.nth(index - 1).click();
      await expect(questions.nth(index)).toBeFocused();
    }
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([lang === 'en' ? 'Score 1 out of 4.' : 'Score de 1 sur 4.']);
  });

  test(`no JavaScript provides native radios and every correct option and explanation (${lang})`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage(); await page.goto(`/dont-know/${lang}.html`);
    await expect(page.getByRole('radio')).toHaveCount(16);
    await page.getByRole('radio').first().check(); await expect(page.getByRole('radio').first()).toBeChecked();
    await page.locator('summary').click(); await expect(page.locator('details')).toHaveAttribute('open', '');
    for (const q of content.questions) {
      await expect(page.locator('details')).toContainText(q.options.find(o => o.id === q.correct).text);
      await expect(page.locator('details')).toContainText(q.explanation);
    }
    await expect(page.locator('[data-lp-flow]')).toBeHidden(); await context.close();
  });

  test(`axe on unchanged server HTML with native answers open (${lang})`, async ({ page }) => {
    // axe needs scripting enabled. Block enhancement to audit the same native baseline.
    await page.route('**/dont-know/enhance.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export function enhance() { return { destroy() {} }; }' }));
    await open(page, `/dont-know/${lang}.html`);
    await scan(page); await page.locator('summary').click(); await scan(page);
  });

  test(`320 CSS pixels with text spacing has no scroll, clipping or overlap (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await open(page, `/dont-know/${lang}.html`);
    await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
    for (const stage of ['initial', 'error', 'result']) {
      if (stage === 'error') await page.locator('[data-lp-check]').click();
      if (stage === 'result') { await pick(page); await page.locator('[data-lp-check]').click(); }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const problems = await page.evaluate(() => [...document.querySelectorAll('p, label, legend, button, li, h2, h3')].filter(el => el.getClientRects().length && !el.matches('[role="status"]')).flatMap(el => {
        const failures = [];
        if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) failures.push(el.textContent);
        const children = [...el.children].filter(child => child.getClientRects().length);
        for (let i = 1; i < children.length; i++) {
          const a = children[i - 1].getBoundingClientRect(), b = children[i].getBoundingClientRect();
          if (Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1) failures.push('overlap: ' + el.textContent);
        }
        return failures;
      }));
      expect(problems).toEqual([]);
    }
  });
}

for (const path of ['/dont-know/en.html', '/dont-know/fr.html', '/dont-know/two.html']) {
  test(`axe at load, unanswered errors, mixed results and reset: ${path}`, async ({ page }) => {
    await open(page, path); await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-check]').click();
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) { await pick(root); await root.locator('[data-lp-check]').click(); }
    await scan(page);
    for (const root of await page.locator('[data-lp-pattern]').all()) await root.locator('[data-lp-restart]').click();
    await scan(page);
  });
}

test('all wrong, all unknown and all right omit zero counts and unnecessary review links', async ({ page }) => {
  await open(page);
  await expect(page.locator('.lp-scene-sub')).toHaveText('A right answer scores a point. A wrong answer costs a point. "I don\'t know" costs nothing.');
  for (const [values, summary, counts, reviews, explanations, offset] of [
    [english.questions.map(q => q.options.find(o => o.id !== q.correct).id), 'Score −4 out of 4.', '4 wrong', 4, 4, '100'],
    [english.questions.map(() => 'dont-know'), 'Score 0 out of 4.', '4 "I don\'t know"', 4, 4, '100'],
    [english.questions.map(q => q.correct), 'Score 4 out of 4.', '4 right', 0, 0, '0']
  ]) {
    await pick(page, values); await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-score]').first()).toHaveText(summary);
    await expect(page.locator('[data-lp-counts]')).toHaveText(counts);
    await expect(page.locator('[data-lp-result] a')).toHaveCount(reviews);
    await expect(page.locator('[data-lp-review]')).toHaveCount(reviews ? 1 : 0);
    await expect(page.locator('[data-lp-explanation]:visible')).toHaveCount(explanations);
    await expect(page.locator('.lp-dont-know-ring-fill')).toHaveAttribute('stroke-dashoffset', offset);
    await page.locator('[data-lp-restart]').click();
  }
});

test('authored fractional points reach the rule and total; feedback preserves hostile text and literal placeholders', async ({ page }) => {
  await open(page);
  await page.evaluate(async content => {
    const { render } = await import('/patterns/dont-know/render.js');
    const { enhance } = await import('/patterns/dont-know/enhance.js');
    const { strings } = await import('/patterns/dont-know/strings.js');
    window.lpInstances[0].destroy();
    content.points = { right: 2, wrong: -0.5, unknown: 0.25 };
    content.questions[1].options[0].text = '<img src=x onerror=alert(1)> {option} & "quoted"';
    content.questions[1].explanation = '<script>alert(1)</script> {total}';
    document.querySelector('main').innerHTML = render(content, strings.en, { id: 'authored', lang: 'en' });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
  }, english);
  await expect(page.locator('.lp-scene-sub')).toHaveText('A right answer scores 2 points. A wrong answer costs 0.5 points. "I don\'t know" scores 0.25 points.');
  await pick(page); await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-score]').first()).toHaveText('Score 3.75 out of 8.');
  await expect(page.locator('.lp-dont-know-ring-fill')).toHaveAttribute('stroke-dashoffset', '53.125');
  await expect(page.locator('fieldset').nth(1).locator('label:has(input:checked)')).toContainText('<img src=x onerror=alert(1)> {option} & "quoted"');
  await expect(page.locator('fieldset').nth(1).locator('[data-lp-explanation]')).toHaveText('<script>alert(1)</script> {total}');
  await expect(page.locator('[data-lp-pattern] img, [data-lp-pattern] script')).toHaveCount(0);
});

test('reset uses a quiet button and theme tokens reach controls and focus', async ({ page }) => {
  await open(page); await pick(page); await page.locator('[data-lp-check]').click();
  await page.mouse.move(0, 0);
  const restart = page.locator('[data-lp-restart]');
  await expect(restart).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(restart).toHaveCSS('min-height', '44px');
  await page.locator('[data-lp-pattern]').evaluate(el => { el.style.setProperty('--lp-accent', '#123456'); el.style.setProperty('--lp-focus', '#654321'); });
  await expect(restart).toHaveCSS('color', 'rgb(85, 92, 103)'); await expect(restart).toHaveCSS('border-color', 'rgba(0, 0, 0, 0)');
  await expect(restart).toHaveCSS('text-decoration-line', 'none');
  await expect(restart.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  await restart.focus();
  await expect(restart).toHaveCSS('outline-color', 'rgb(101, 67, 33)');
  await expect(restart).toHaveCSS('outline-style', 'solid');
  await expect(restart).toHaveCSS('outline-width', '2px');
  await restart.click();
  await page.keyboard.press('Tab');
  for (const control of [page.locator('input').first(), page.locator('[data-lp-check]')]) {
    await control.focus();
    const target = await control.getAttribute('type') === 'radio' ? control.locator('..') : control;
    await expect(target).toHaveCSS('outline-color', 'rgb(101, 67, 33)');
    await expect(target).toHaveCSS('outline-style', 'solid');
    await expect(target).toHaveCSS('outline-width', '2px');
  }
});

test('decorative score rings stay bounded for zero, negative and exceeded authored totals', async ({ page }) => {
  for (const [points, expected, offset] of [
    [{ right: 0, wrong: -1, unknown: 0 }, 'Score 0 out of 0.', '100'],
    [{ right: -1, wrong: -2, unknown: 0 }, 'Score 0 out of −4.', '100'],
    [{ right: 1, wrong: -1, unknown: 2 }, 'Score 8 out of 4.', '0']
  ]) {
    await open(page);
    await page.evaluate(async ({ content, points }) => {
      const { render } = await import('/patterns/dont-know/render.js');
      const { enhance } = await import('/patterns/dont-know/enhance.js');
      const { strings } = await import('/patterns/dont-know/strings.js');
      window.lpInstances[0].destroy();
      content.points = points;
      document.querySelector('main').innerHTML = render(content, strings.en, { id: 'bounded', lang: 'en' });
      enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
    }, { content: english, points });
    await pick(page, english.questions.map(() => 'dont-know'));
    await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-score]')).toHaveText(expected);
    await expect(page.locator('.lp-dont-know-ring-fill')).toHaveAttribute('stroke-dashoffset', offset);
    await expect(page.locator('[role="status"]')).toHaveText(expected);
  }
});

test('answers lock on submit; Start over clears marks, explanations and host state', async ({ page }) => {
  await open(page); await observe(page);
  await page.locator('input').first().check();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: { q1: mixed[0] }, shown: false });
  await pick(page); await page.locator('[data-lp-check]').click();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: { q1: mixed[0], q2: mixed[1], q3: mixed[2], q4: mixed[3] }, shown: true });
  await expect(page.locator('input:disabled')).toHaveCount(16);
  await expect(page.locator('[data-lp-score]').first()).toBeFocused();
  await page.locator('[data-lp-check]').evaluate(button => button.click());
  await expect(page.locator('.lp-choice-mark')).toHaveCount(6);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Score 1 out of 4.']);
  await page.locator('[data-lp-restart]').click();
  await expect(page.locator('input:disabled, input:checked, [data-lp-mark], .lp-choice-mark')).toHaveCount(0);
  await expect(page.locator('[data-lp-explanation]:visible')).toHaveCount(0);
  await expect(page.locator('[data-lp-result]')).toBeEmpty();
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  await expect(page.locator('[data-lp-restart]')).toBeHidden();
  await expect(page.locator('[data-lp-check]')).toBeVisible();
  await expect(page.locator('input').first()).toBeFocused();
  expect(await page.evaluate(() => window.lpSaved)).toEqual({ picks: {}, shown: false });
  await pick(page); await page.locator('[data-lp-check]').click();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Score 1 out of 4.', 'Cleared.', 'Score 1 out of 4.']);
});

for (const shown of [false, true]) {
  test(`valid saved picks restore shown=${shown} silently`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, { picks: Object.fromEntries(english.questions.map((q, i) => [q.id, mixed[i]])), shown });
    await open(page); await expect(page.locator('input:checked')).toHaveCount(4);
    await expect(page.locator('[role="status"]')).toHaveText('');
    if (shown) {
      await expect(page.locator('[data-lp-result]')).toContainText('Score 1 out of 4.');
      await expect(page.locator('[data-lp-restart]')).toBeVisible();
      await expect(page.locator('input:disabled')).toHaveCount(16);
      await expect(page.locator('.lp-choice-mark')).toHaveCount(6);
      await expect(page.locator('[data-lp-explanation]:visible')).toHaveCount(2);
      await expect(page.locator('[data-lp-check]')).toBeHidden();
      await expect(page.locator('[data-lp-score]').first()).not.toBeFocused();
    }
    else { await expect(page.locator('[data-lp-result]')).toBeHidden(); await expect(page.locator('[data-lp-restart]')).toBeHidden(); }
  });
}

for (const seed of [{ picks: { q1: 'bad' }, shown: false }, { picks: { q1: 'unexpected-expenses' }, shown: true }]) {
  test(`invalid saved state is ignored: ${JSON.stringify(seed)}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, seed); await open(page);
    await expect(page.locator('input:checked')).toHaveCount(0); await expect(page.locator('[data-lp-result]')).toBeHidden();
    await expect(page.locator('[data-lp-restart]')).toBeHidden(); await expect(page.locator('[role="status"]')).toHaveText('');
  });
}

test('two instances have unique ids and independent radio names, errors and results', async ({ page }) => {
  await open(page, '/dont-know/two.html');
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  await pick(roots.first()); await roots.first().locator('[data-lp-check]').click();
  await expect(roots.nth(1).locator('input:checked')).toHaveCount(0); await expect(roots.nth(1).locator('[data-lp-result]')).toBeHidden();
  await roots.nth(1).locator('[data-lp-check]').click();
  await expect(roots.first().locator('[data-lp-result]')).toBeVisible();
  await expect(roots.nth(1).locator('[data-lp-question-error]:visible')).toHaveCount(4);
});

test('enhance twice returns one instance; destroy removes listeners and safely restores fallback', async ({ page }) => {
  await open(page); expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await observe(page); await pick(page); await page.locator('[data-lp-check]').click();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Score 1 out of 4.']);
  await page.evaluate(() => window.lpInstances[0].destroy());
  await expect(page.locator('[data-lp-flow]')).toBeHidden(); await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  const before = await page.evaluate(() => window.lpSaved);
  await page.locator('input').first().check(); expect(await page.evaluate(() => window.lpSaved)).toEqual(before);
  await page.evaluate(() => { window.lpEnhance(); window.lpInstances[0].destroy(); });
  await expect(page.locator('[data-lp-flow]')).toBeVisible();
  expect(await page.evaluate(() => window.lpEnhance() === window.lpEnhance())).toBe(true);
  await expect(page.locator('input:disabled')).toHaveCount(16);
  await expect(page.locator('.lp-choice-mark')).toHaveCount(6);
  await expect(page.locator('[role="status"]')).toHaveText('');
  await page.locator('[data-lp-restart]').click();
  await pick(page); await page.locator('[data-lp-check]').click(); await expect(page.locator('.lp-choice-mark')).toHaveCount(6);
});

test('missing and mismatched markup fail loudly', async ({ page }) => {
  await open(page);
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/dont-know/enhance.js');
    const { strings } = await import('/patterns/dont-know/strings.js');
    enhance(document.createElement('section'), { content, strings: strings.en });
  }, english)).rejects.toThrow('Missing dont-know markup');
  for (const violation of ['missing-radio', 'wrong-value', 'wrong-question', 'missing-error', 'duplicate-name', 'missing-target', 'missing-tabindex', 'missing-label', 'missing-explanation']) {
    await open(page);
    await page.evaluate(kind => {
      window.lpInstances[0].destroy();
      if (kind === 'missing-tabindex') document.querySelector('fieldset').removeAttribute('tabindex');
      if (kind === 'missing-target') document.querySelector('fieldset').removeAttribute('id');
      if (kind === 'missing-label') document.querySelector('label').replaceWith(document.querySelector('input'));
      if (kind === 'missing-explanation') document.querySelector('[data-lp-explanation]').remove();
      if (kind === 'missing-radio') document.querySelector('input').remove();
      if (kind === 'wrong-value') document.querySelector('input').value = 'bad';
      if (kind === 'wrong-question') document.querySelector('fieldset').dataset.lpQuestion = 'bad';
      if (kind === 'missing-error') document.querySelector('[data-lp-question-error]').remove();
      if (kind === 'duplicate-name') document.querySelectorAll('fieldset')[1].querySelectorAll('input').forEach(el => el.name = document.querySelector('input').name);
    }, violation);
    await expect(page.evaluate(() => window.lpEnhance())).rejects.toThrow(/Invalid dont-know|Missing dont-know/);
  }
});

test('quiet reset and forced colours preserve focus rings and button distinction', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page); await pick(page); await page.locator('[data-lp-check]').click();
  await expect(page.locator('[data-lp-mark]').first()).toHaveCSS('border-style', 'double');
  await page.locator('[data-lp-restart]').focus();
  await expect(page.locator('[data-lp-restart]')).toHaveCSS('text-decoration-line', 'underline');
  await page.locator('[data-lp-restart]').click();
  // Programmatic question focus inherits the current input modality. Exercise keyboard focus.
  await page.keyboard.press('Tab');
  for (const locator of [page.locator('input').first(), page.locator('[data-lp-check]'), page.locator('fieldset').first()]) {
    await locator.focus();
    const target = await locator.getAttribute('type') === 'radio' ? locator.locator('..') : locator;
    const style = await target.evaluate(el => { const css = getComputedStyle(el); return [css.outlineWidth, css.outlineStyle, css.outlineOffset, css.outlineColor]; });
    expect(style.slice(0, 3)).toEqual(['2px', 'solid', '2px']); expect(style[3]).not.toBe('rgba(0, 0, 0, 0)');
  }
  await expect(page.locator('[data-lp-check]')).toHaveCSS('border-style', 'solid');
  await pick(page); await page.locator('[data-lp-check]').click();
  await page.locator('[data-lp-restart]').focus();
  await expect(page.locator('[data-lp-restart]')).toHaveCSS('outline-width', '2px');
});

test('one unanswered question uses the singular message in English and French', async ({ page }) => {
  for (const [lang, text] of [['en', "1 question unanswered. Choose an option, or I don't know."], ['fr', '1 question sans réponse. Choisissez une option ou « Je ne sais pas ».']]) {
    await open(page, `/dont-know/${lang}.html`);
    await pick(page, mixed.slice(0, 3));
    await page.locator('[data-lp-check]').click();
    await expect(page.locator('[data-lp-error]')).toHaveText(text);
  }
});

for (const width of [1280, 390, 320]) {
  test('owner audit: score and review links align with their first line at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await open(page);
    await pick(page); await page.locator('[data-lp-check]').click();
    const difference = await page.locator('.lp-dont-know-result-head').evaluate(el => el.querySelector('[data-lp-score]').getBoundingClientRect().top - el.querySelector('svg').getBoundingClientRect().top);
    expect(Math.abs(difference)).toBeLessThanOrEqual(1);
    for (const link of await page.locator('[data-lp-review] a').all()) {
      const offset = await link.evaluate(el => el.querySelector('svg').getBoundingClientRect().top - el.querySelector('span').getBoundingClientRect().top);
      expect(offset).toBeGreaterThanOrEqual(0); expect(offset).toBeLessThanOrEqual(5);
    }
  });
}
