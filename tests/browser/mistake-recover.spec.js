import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { expectChoiceMarks } from './choice-marks.js';

const english = JSON.parse(await readFile(new URL('../../patterns/mistake-recover/examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('../../patterns/mistake-recover/examples/fr.json', import.meta.url)));
const TEXT_SPACING = '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';
// Authored text carries no-break spaces, and French rendering adds more. Compare words, not spaces.
const plain = value => value.replace(/\s+/g, ' ').trim();
const request = english.request, dana = english.colleague;

async function open(page, path = '/mistake-recover/en.html') {
  await page.goto(path);
  await page.waitForFunction(() => window.lpReady);
}
async function observe(page) {
  await page.evaluate(() => {
    window.lpAnnouncements = [];
    new MutationObserver(records => {
      for (const record of records) window.lpAnnouncements.push(record.target.textContent);
    }).observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
}
// Clearing the region is not speech, so empty entries are dropped.
const announcements = async page => (await page.evaluate(() => window.lpAnnouncements)).map(plain).filter(Boolean);
const saved = page => page.evaluate(() => window.lpSaved);
const scan = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
const item = (root, n) => root.locator(`[data-lp-item="${n}"]`);
const line = (root, n) => item(root, n).locator('[data-lp-status]');
const row = (section, value) => section.locator(`label:has(input[value="${value}"])`);
/** Tick these steps and check them. */
async function recover(section, values) {
  for (const value of values) await section.locator(`input[value="${value}"]`).check();
  await section.locator('[data-lp-check]').click();
}
const approve = section => section.locator('[data-lp-approve]').click();
const hold = section => section.locator('[data-lp-hold]').click();
// Replace the demo with other content through the public render and enhance interface.
async function mount(page, content, { lang = 'en', state } = {}) {
  await open(page, `/mistake-recover/${lang}.html`);
  await page.evaluate(async ({ content, lang, state }) => {
    const { render } = await import('/patterns/mistake-recover/render.js');
    const { enhance } = await import('/patterns/mistake-recover/enhance.js');
    const { strings } = await import('/patterns/mistake-recover/strings.js');
    window.lpInstances.forEach(instance => instance.destroy());
    document.querySelector('main').innerHTML = render(content, strings[lang], { id: 'custom', lang });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings[lang], state: state === undefined ? undefined : { read: () => state, write: () => {} } });
  }, { content, lang, state });
}

test('keyboard journey: approve, an empty check, recovery, the result and Start over', async ({ page }) => {
  await open(page); await observe(page);
  const first = item(page, 0);
  await expect(item(page, 1)).toBeHidden();
  for (const fallback of await page.locator('[data-lp-fallback]').all()) await expect(fallback).toBeHidden();
  await expect(line(page, 0)).toHaveText('Status: Waiting for your approval');
  await expect(first.locator('[data-lp-recover]')).toBeHidden();

  // Approve is the first stop. Approving states the cost on the status line, which takes focus.
  await page.keyboard.press('Tab'); await expect(first.locator('[data-lp-approve]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(line(page, 0)).toBeFocused();
  await expect(line(page, 0)).toHaveText(plain(`Status: ${request.approved}`));
  await expect(first.locator('[data-lp-decide]')).toBeHidden();
  await expect(item(page, 1)).toBeHidden();
  expect(await announcements(page)).toEqual([]);
  expect(await saved(page)).toEqual({ decision: 'approve', steps: [null, null] });

  // The next stop is the first step. Checking with none ticked names the problem and focuses it.
  await page.keyboard.press('Tab'); await expect(first.locator('input').first()).toBeFocused();
  for (let n = 0; n < 3; n++) await page.keyboard.press('Tab');
  await expect(first.locator('[data-lp-check]')).toBeFocused();
  await page.keyboard.press('Enter');
  const error = first.locator('[data-lp-error]');
  await expect(error).toBeVisible(); await expect(error).toHaveText('Choose at least one step');
  await expect(first.locator('fieldset')).toHaveAttribute('aria-describedby', `example-request-hint ${await error.getAttribute('id')}`);
  await expect(first.locator('input[aria-invalid="true"]')).toHaveCount(3);
  await expect(first.locator('input').first()).toBeFocused();
  expect(await announcements(page)).toEqual([]);

  // Tick the trap step "Change the supplier file" and Cancel, leave Call. The check marks each and
  // shows its reason; the status line changes and takes focus again, and the card ends.
  await page.keyboard.press('Space');
  await expect(error).toBeHidden();
  await expect(first.locator('fieldset')).toHaveAttribute('aria-describedby', 'example-request-hint');
  await expect(first.locator('[aria-invalid]')).toHaveCount(0);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Space');
  await first.locator('[data-lp-check]').focus(); await page.keyboard.press('Enter');
  await expect(line(page, 0)).toBeFocused();
  await expect(line(page, 0)).toHaveText(plain(`Status: ${request.stopped}`));
  await expect(row(first, 'update')).toHaveAttribute('data-lp-mark', 'wrong');
  await expect(row(first, 'call')).toHaveAttribute('data-lp-mark', 'missed');
  await expect(row(first, 'cancel')).toHaveAttribute('data-lp-mark', 'correct');
  for (const [n, step] of request.steps.entries()) await expect(first.locator('[data-lp-reason]').nth(n)).toHaveText(step.feedback);
  await expect(first.locator('input:disabled')).toHaveCount(3);
  await expect(first.locator('[data-lp-check]')).toBeHidden();
  await expectChoiceMarks(page);
  // Focus reads the line, then the region speaks the closing sentence once.
  const sentence = 'You approved the request and stopped the payment before it went out.';
  await expect(page.locator('[data-lp-summary]')).toHaveText(sentence);
  expect(await announcements(page)).toEqual([sentence]);
  await expect(item(page, 1)).toBeHidden();
  expect(await saved(page)).toEqual({ decision: 'approve', steps: [['update', 'cancel'], null] });

  await page.keyboard.press('Tab'); await expect(page.locator('[data-lp-restart]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(first.locator('[data-lp-approve]')).toBeFocused();
  await expect(page.locator('[data-lp-mark], input:checked, input:disabled')).toHaveCount(0);
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  await expect(first.locator('[data-lp-recover]')).toBeHidden();
  await expect(line(page, 0)).toHaveText('Status: Waiting for your approval');
  expect((await announcements(page)).at(-1)).toBe('Answers cleared.');
  expect(await saved(page)).toEqual({ decision: null, steps: [null, null] });
});

test('holding the request opens the payment the colleague approved, and recovering it ends the card', async ({ page }) => {
  await open(page); await observe(page);
  // Approve, then Hold, by keyboard. Hold reveals the colleague's payment, so Tab from the status line goes there next.
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  await expect(item(page, 0).locator('[data-lp-hold]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(line(page, 0)).toBeFocused();
  await expect(line(page, 0)).toHaveText(plain(`Status: ${request.held}`));
  await expect(item(page, 0).locator('[data-lp-recover]')).toBeHidden();
  const second = item(page, 1);
  await expect(second).toBeVisible();
  await expect(second.locator('h3')).toHaveText(dana.title);
  await expect(line(page, 1)).toHaveText(plain(`Status: ${dana.approved}`));
  await expect(second.locator('[data-lp-recover]')).toBeVisible();
  await page.keyboard.press('Tab'); await expect(second.locator('input').first()).toBeFocused();
  await expect(page.locator('[data-lp-result]')).toBeHidden();
  expect(await announcements(page)).toEqual([]);
  // Leaving out Cancel leaves the payment approved, in different words, so the check visibly did something.
  await recover(second, ['leave', 'tell']);
  await expect(line(page, 1)).toBeFocused();
  await expect(line(page, 1)).toHaveText(plain(`Status: ${dana.notStopped}`));
  await expect(row(second, 'cancel')).toHaveAttribute('data-lp-mark', 'missed');
  await expect(row(second, 'leave')).toHaveAttribute('data-lp-mark', 'wrong');
  const sentence = 'You held the request, and the payment Dana approved still goes out.';
  await expect(page.locator('[data-lp-summary]')).toHaveText(sentence);
  expect(await announcements(page)).toEqual([sentence]);
  expect(await saved(page)).toEqual({ decision: 'hold', steps: [null, ['leave', 'tell']] });
});

test('approving and leaving out Cancel: the payment still goes out', async ({ page }) => {
  await open(page); await observe(page);
  const first = item(page, 0);
  await approve(first);
  await recover(first, ['call']);
  await expect(line(page, 0)).toBeFocused();
  await expect(line(page, 0)).toHaveText(plain(`Status: ${request.notStopped}`));
  await expect(row(first, 'cancel')).toHaveAttribute('data-lp-mark', 'missed');
  const sentence = 'You approved the request, and the payment still goes out.';
  await expect(page.locator('[data-lp-summary]')).toHaveText(sentence);
  expect(await announcements(page)).toEqual([sentence]);
  expect(await saved(page)).toEqual({ decision: 'approve', steps: [['call'], null] });
});

for (const [lang, content, labels] of [
  ['en', english, { approve: 'If you approve', recover: 'How to recover', correct: 'Correct', wrong: 'Incorrect' }],
  ['fr', french, { approve: 'Si vous approuvez', recover: 'Comment rattraper l’erreur', correct: 'Correct', wrong: 'Incorrect' }]
]) {
  test(`no JavaScript shows the request's record, what approving does and how to recover (${lang})`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage(); await page.goto(`/mistake-recover/${lang}.html`);
    await expect(item(page, 0)).toBeVisible(); await expect(item(page, 1)).toBeHidden();
    await expect(page.locator('button:visible, [data-lp-status]:visible, [data-lp-recover]:visible, [data-lp-result]:visible')).toHaveCount(0);
    await expect(page.locator('dl dt:visible')).toHaveCount(4);
    const details = page.locator('details:visible');
    await expect(details).toHaveCount(2);
    await expect(page.locator('details[open]')).toHaveCount(0);
    await expect(page.locator('summary:visible')).toHaveText([labels.approve, labels.recover]);
    for (const summary of await page.locator('summary:visible').all()) await summary.click();
    await expect(details.nth(0).locator('p')).toHaveText(plain(content.request.approved));
    const steps = details.nth(1).locator('li');
    await expect(steps).toHaveCount(content.request.steps.length);
    for (const [s, step] of content.request.steps.entries()) {
      await expect(steps.nth(s).locator('.lp-choice-mark')).toHaveText(step.correct ? labels.correct : labels.wrong);
      await expect(steps.nth(s).locator('p').last()).toHaveText(plain(step.feedback));
    }
    await context.close();
  });

  test(`axe on unchanged server HTML with the disclosures open (${lang})`, async ({ page }) => {
    // axe needs scripting enabled. Block enhancement to audit the same native baseline.
    await page.route('**/mistake-recover/enhance.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export function enhance() { return { destroy() {} }; }' }));
    await open(page, `/mistake-recover/${lang}.html`);
    await scan(page);
    for (const summary of await page.locator('summary:visible').all()) await summary.click();
    await scan(page);
  });

  test(`320 CSS pixels with text spacing has no scroll or clipping at every stage (${lang})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 }); await open(page, `/mistake-recover/${lang}.html`);
    await page.addStyleTag({ content: TEXT_SPACING });
    for (const stage of ['initial', 'approved', 'error', 'result', 'held', 'colleague result']) {
      if (stage === 'approved') await approve(item(page, 0));
      if (stage === 'error') await item(page, 0).locator('[data-lp-check]').click();
      if (stage === 'result') await recover(item(page, 0), ['update', 'call']);
      if (stage === 'held') { await page.locator('[data-lp-restart]').click(); await hold(item(page, 0)); }
      if (stage === 'colleague result') await recover(item(page, 1), ['cancel', 'leave']);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), stage).toBe(true);
      const problems = await page.evaluate(() => {
        const card = document.querySelector('[data-lp-pattern]').getBoundingClientRect();
        return [...document.querySelectorAll('[data-lp-pattern] :is(p, label, legend, button, li, dt, dd, h2, h3, .lp-choice-mark, [data-lp-reason])')]
          .filter(el => el.getClientRects().length && !el.matches('[role="status"]') && !el.closest('.lp-visually-hidden'))
          .filter(el => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== 'inline' || el.getBoundingClientRect().right > card.right + 1 || el.getBoundingClientRect().left < card.left - 1)
          .map(el => el.textContent);
      });
      expect(problems, stage).toEqual([]);
    }
    // Cancel correct, Leave incorrect, Invoice and Tell missed.
    await expect(page.locator('[data-lp-mark]')).toHaveCount(4);
  });
}

for (const path of ['/mistake-recover/en.html', '/mistake-recover/fr.html', '/mistake-recover/two.html']) {
  test(`axe at load, after Approve, an empty check, recovery, the result, reset and the colleague's payment: ${path}`, async ({ page }) => {
    await open(page, path); await scan(page);
    const roots = await page.locator('[data-lp-pattern]').all();
    for (const root of roots) await approve(item(root, 0));
    await scan(page);
    for (const root of roots) await item(root, 0).locator('[data-lp-check]').click();
    await scan(page);
    for (const root of roots) await recover(item(root, 0), ['cancel', 'update']);
    await scan(page);
    for (const root of roots) { await root.locator('[data-lp-restart]').click(); await hold(item(root, 0)); }
    await scan(page);
    for (const root of roots) await recover(item(root, 1), ['cancel']);
    await scan(page);
  });
}

for (const width of [1280, 390]) test(`the status line and its marked steps stay in view after a check at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await open(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await approve(item(page, 0));
  await expect(line(page, 0)).toBeInViewport({ ratio: .95 });
  await recover(item(page, 0), ['cancel']);
  for (const locator of [line(page, 0), ...await item(page, 0).locator('[data-lp-mark]').all()]) await expect(locator).toBeInViewport({ ratio: .95 });
  await page.locator('[data-lp-restart]').click();
  await expect(page.locator('h2.lp-heading')).toBeInViewport();
  // Holding opens the colleague's payment below; the held request's line stays in view.
  await hold(item(page, 0));
  await expect(line(page, 0)).toBeInViewport({ ratio: .95 });
  await recover(item(page, 1), ['cancel']);
  for (const locator of [line(page, 1), ...await item(page, 1).locator('[data-lp-mark]').all()]) await expect(locator).toBeInViewport({ ratio: .95 });
});

for (const [name, seed, expected] of [
  ['request approved', { decision: 'approve', steps: [null, null] }, { visible: 1, recover: true, status: request.approved }],
  ['request held', { decision: 'hold', steps: [null, null] }, { visible: 2, recover: true, status: request.held }]
]) {
  test(`saved progress restores silently: ${name}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, seed);
    await open(page);
    await expect(page.locator('[data-lp-item]:visible')).toHaveCount(expected.visible);
    await expect(page.locator('[data-lp-mark]')).toHaveCount(0);
    await expect(line(page, 0)).toHaveText(plain(`Status: ${expected.status}`));
    await expect(page.locator('[data-lp-check]:visible')).toHaveCount(expected.recover ? 1 : 0);
    await expect(page.locator('[data-lp-result]')).toBeHidden();
    await expect(page.locator('[role="status"]')).toHaveText('');
    expect(await page.evaluate(() => document.activeElement === document.body && scrollY === 0)).toBe(true);
  });
}

test('a finished saved card restores its marks, sentence and Start over without speaking', async ({ page }) => {
  await page.addInitScript(value => { window.lpSeed = value; }, { decision: 'approve', steps: [['call'], null] });
  await open(page);
  await expect(page.locator('input:disabled')).toHaveCount(3);
  await expect(page.locator('input:checked')).toHaveCount(1);
  await expect(line(page, 0)).toHaveText(plain(`Status: ${request.notStopped}`));
  await expect(page.locator('[data-lp-summary]')).toHaveText('You approved the request, and the payment still goes out.');
  await expect(page.locator('[data-lp-restart]')).toBeVisible();
  await expect(page.locator('[role="status"]')).toHaveText('');
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
});

for (const seed of [{ decision: 'hold', steps: [['cancel'], null] }, { decision: 'approve', steps: [null, ['cancel']] }, { decision: 'approve', steps: [['nope'], null] }, { decisions: ['hold', null], steps: [null, null, null] }, { decision: null }, 'not an object']) {
  test(`invalid saved state is ignored: ${JSON.stringify(seed)}`, async ({ page }) => {
    await page.addInitScript(value => { window.lpSeed = value; }, seed); await open(page);
    await expect(page.locator('input:checked, input:disabled, [data-lp-mark]')).toHaveCount(0);
    await expect(item(page, 1)).toBeHidden();
    await expect(line(page, 0)).toHaveText('Status: Waiting for your approval');
    await expect(page.locator('[role="status"]')).toHaveText('');
  });
}

test('a double activation of a decision or a check makes one transition, one save and one announcement', async ({ page }) => {
  await open(page);
  await page.evaluate(async content => {
    const { render } = await import('/patterns/mistake-recover/render.js');
    const { enhance } = await import('/patterns/mistake-recover/enhance.js');
    const { strings } = await import('/patterns/mistake-recover/strings.js');
    window.lpInstances.forEach(instance => instance.destroy());
    document.querySelector('main').innerHTML = render(content, strings.en, { id: 'custom', lang: 'en' });
    window.lpWrites = [];
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, state: { read: () => undefined, write: value => window.lpWrites.push(value) } });
  }, english);
  await observe(page);
  const writes = () => page.evaluate(() => window.lpWrites);
  // Two clicks in one task, as a double click or a bouncing key delivers them.
  const twice = locator => locator.evaluate(button => { button.click(); button.click(); });
  await twice(item(page, 0).locator('[data-lp-approve]'));
  expect(await writes()).toEqual([{ decision: 'approve', steps: [null, null] }]);
  await item(page, 0).locator('input[value="cancel"]').check();
  await twice(item(page, 0).locator('[data-lp-check]'));
  expect((await writes()).slice(1)).toEqual([{ decision: 'approve', steps: [['cancel'], null] }]);
  // Cancel is marked correct and Call, left out, is marked as the correct answer.
  await expect(page.locator('[data-lp-mark]')).toHaveCount(2);
  expect(await announcements(page)).toEqual(['You approved the request and stopped the payment before it went out.']);
});

test('the pattern works in memory without a state adapter', async ({ page }) => {
  await mount(page, english);
  await hold(item(page, 0)); await recover(item(page, 1), ['cancel']);
  await expect(page.locator('[data-lp-summary]')).toHaveText('You held the request and stopped the payment Dana approved before it went out.');
});

test('worst-case authored text wraps inside the card at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const token = 'Q3-Supplier-Payment_Lakeside_Catering_Holdings_FINAL_v12_approved-by-finance.pdf';
  const content = structuredClone(english);
  content.title = `Approve ${token}`;
  content.request.summary = `Pay ${token}.`;
  content.request.checks[0] = { label: `Purchase order ${token}`.slice(0, 60), value: `${token} ${token}`.slice(0, 200) };
  content.request.steps[0].text = `Change the supplier file to match ${token}`;
  content.request.steps[0].feedback = `${token} ${'A long closing sentence about nothing in particular. '.repeat(5)}`.slice(0, 300);
  content.request.approved = `Approved. ${token}`;
  await mount(page, content, { state: { decision: 'approve', steps: [['update'], null] } });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const overflow = await page.evaluate(() => {
    const card = document.querySelector('[data-lp-pattern]').getBoundingClientRect();
    return Math.max(...[...document.querySelectorAll('[data-lp-pattern] *')].filter(el => el.getClientRects().length && !el.closest('.lp-visually-hidden')).map(el => el.getBoundingClientRect().right - card.right));
  });
  expect(overflow).toBeLessThanOrEqual(0);
});

test('two instances have unique ids and independent progress', async ({ page }) => {
  await open(page, '/mistake-recover/two.html');
  const ids = await page.locator('[id]').evaluateAll(els => els.map(el => el.id)); expect(new Set(ids).size).toBe(ids.length);
  const roots = page.locator('[data-lp-pattern]');
  await approve(item(roots.first(), 0));
  await expect(item(roots.nth(1), 0).locator('[data-lp-recover]')).toBeHidden();
  await expect(line(roots.nth(1), 0)).toHaveText('Status: Waiting for your approval');
  await approve(item(roots.nth(1), 0));
  await item(roots.nth(1), 0).locator('[data-lp-check]').click();
  await expect(roots.nth(1).locator('[data-lp-error]:visible')).toHaveCount(1);
  await expect(roots.first().locator('[data-lp-error]:visible')).toHaveCount(0);
  await expect(item(roots.nth(1), 0).locator('fieldset')).toHaveAttribute('aria-describedby', 'second-request-hint second-request-error');
});

test('enhance twice returns one instance; destroy restores the no-JavaScript view and can re-enhance', async ({ page }) => {
  await open(page); expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  const nodes = await page.locator('[data-lp-pattern] *').count();
  await hold(item(page, 0)); await recover(item(page, 1), ['cancel']);
  await page.evaluate(() => window.lpInstances[0].destroy());
  for (const fallback of await page.locator('[data-lp-fallback]').all()) await expect(fallback).toBeVisible();
  await expect(item(page, 0)).toBeVisible(); await expect(item(page, 1)).toBeHidden();
  await expect(page.locator('button:visible, [data-lp-status]:visible, [data-lp-recover]:visible')).toHaveCount(0);
  await expect(page.locator('input:checked, input:disabled, [data-lp-mark], [aria-invalid]')).toHaveCount(0);
  await expect(page.locator('[role="status"]')).toHaveText('');
  expect(await page.locator('[data-lp-pattern] *').count()).toBe(nodes);
  // Listeners are gone: a destroyed instance writes nothing.
  const before = await saved(page);
  for (const button of await page.locator('[data-lp-approve], [data-lp-hold]').all()) await button.evaluate(el => el.click());
  expect(await saved(page)).toEqual(before);
  // The page's adapter still holds the progress, so a new instance restores it.
  expect(await page.evaluate(() => { const instance = window.lpEnhance(); return instance === window.lpEnhance() && instance !== window.lpInstances[0]; })).toBe(true);
  await expect(line(page, 0)).toHaveText(plain(`Status: ${request.held}`));
  await expect(line(page, 1)).toHaveText(plain(`Status: ${dana.stopped}`));
  await expect(page.locator('[data-lp-summary]')).toHaveText('You held the request and stopped the payment Dana approved before it went out.');
});

test('missing and mismatched markup fail loudly', async ({ page }) => {
  await open(page);
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/mistake-recover/enhance.js');
    const { strings } = await import('/patterns/mistake-recover/strings.js');
    enhance(document.createElement('section'), { content, strings: strings.en });
  }, english)).rejects.toThrow('Missing mistake-recover markup');
  for (const violation of ['missing-item', 'missing-step', 'wrong-value', 'not-checkbox', 'missing-label', 'missing-reason', 'missing-status', 'missing-status-text', 'missing-decide', 'missing-approve', 'missing-hold', 'missing-error', 'missing-check', 'missing-fallback', 'missing-summary', 'missing-restart', 'missing-region']) {
    await open(page);
    await page.evaluate(kind => {
      window.lpInstances[0].destroy();
      const q = selector => document.querySelector(selector);
      if (kind === 'missing-item') q('[data-lp-item="1"]').removeAttribute('data-lp-item');
      if (kind === 'missing-step') q('[data-lp-recover] label').remove();
      if (kind === 'missing-label') q('[data-lp-recover] label').replaceWith(q('[data-lp-recover] input'));
      if (kind === 'wrong-value') q('[data-lp-recover] input').value = 'bad';
      if (kind === 'not-checkbox') q('[data-lp-recover] input').type = 'radio';
      if (kind === 'missing-reason') q('[data-lp-reason]').remove();
      if (kind === 'missing-status') q('[data-lp-status]').remove();
      if (kind === 'missing-status-text') q('[data-lp-status-text]').remove();
      if (kind === 'missing-decide') q('[data-lp-decide]').remove();
      if (kind === 'missing-approve') q('[data-lp-approve]').remove();
      if (kind === 'missing-hold') q('[data-lp-hold]').remove();
      if (kind === 'missing-error') q('[data-lp-error]').remove();
      if (kind === 'missing-check') q('[data-lp-check]').remove();
      if (kind === 'missing-fallback') q('[data-lp-fallback]').remove();
      if (kind === 'missing-summary') q('[data-lp-summary]').remove();
      if (kind === 'missing-restart') q('[data-lp-restart]').remove();
      if (kind === 'missing-region') q('[role="status"]').remove();
    }, violation);
    await expect(page.evaluate(() => window.lpEnhance()), violation).rejects.toThrow(/Invalid mistake-recover|Missing mistake-recover/);
  }
  await expect(page.evaluate(async content => {
    const { enhance } = await import('/patterns/mistake-recover/enhance.js');
    const { strings } = await import('/patterns/mistake-recover/strings.js');
    window.lpInstances[0].destroy();
    enhance(document.querySelector('[data-lp-pattern]'), { content: { ...content, request: [content.request] }, strings: strings.en });
  }, english)).rejects.toThrow(/request/);
});

test('shared look: one card with no panel inside it, equal decision buttons and a quiet reset', async ({ page }) => {
  await open(page);
  const root = page.locator('[data-lp-pattern]');
  await expect(root.locator('.lp-box, .lp-scene, .lp-quote')).toHaveCount(0);
  await expect(root.locator('h2.lp-heading')).toHaveCSS('font-size', '21px');
  for (const button of [root.locator('[data-lp-approve]').first(), root.locator('[data-lp-hold]').first()]) await expect(button).toHaveClass(/lp-button-secondary/);
  await hold(item(root, 0)); await recover(item(root, 1), ['cancel']);
  // Records, status lines and the result are set apart by headings, rules, type and space, never by a
  // border or fill of their own.
  for (const part of [...await root.locator('dl, [data-lp-status], [data-lp-recover], [data-lp-summary]').all()]) {
    if (!await part.isVisible()) continue;
    await expect(part).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    for (const side of ['top', 'right', 'bottom', 'left']) await expect(part).toHaveCSS(`border-${side}-width`, '0px');
    await expect(part).toHaveCSS('box-shadow', 'none');
  }
  for (const section of [item(root, 0), item(root, 1), root.locator('[data-lp-result]')]) {
    await expect(section).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(section).toHaveCSS('border-top-width', '1px');
    for (const side of ['right', 'bottom', 'left']) await expect(section).toHaveCSS(`border-${side}-width`, '0px');
  }
  await expect(root.locator('dl dt').first()).toHaveCSS('font-weight', '600');
  await expect(root.locator('dl').first()).toHaveCSS('font-variant-numeric', 'tabular-nums');
  for (const locator of [item(root, 1).locator('[data-lp-reason]').first(), root.locator('.lp-choice-mark').first(), item(root, 1).locator('.lp-small').first(), root.locator('[data-lp-restart]')]) await expect(locator).toHaveCSS('font-size', '16px');
  await expect(root.locator('[data-lp-restart]')).toHaveClass(/lp-button-quiet/);
  await expect(root.locator('[data-lp-restart] svg[aria-hidden="true"]')).toHaveCount(1);
  await expectChoiceMarks(page);
  // Keyboard focus on a status line draws the shared ring.
  await page.keyboard.press('Tab');
  await line(root, 1).focus();
  await expect(line(root, 1)).toHaveCSS('outline-width', '3px');
});

test('forced colours keep the marks, the reset and focus distinct', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' }); await open(page);
  await approve(item(page, 0)); await recover(item(page, 0), ['update']);
  await expect(item(page, 0).locator('[data-lp-mark="wrong"]')).toHaveCSS('border-style', 'double');
  await expect(item(page, 0).locator('[data-lp-mark="missed"]').first()).toHaveCSS('border-top-style', 'dashed');
  await expect(page.locator('[data-lp-restart]')).toHaveCSS('text-decoration-line', 'underline');
  await page.keyboard.press('Tab');
  for (const locator of [page.locator('[data-lp-restart]'), line(page, 0)]) {
    await locator.focus();
    const style = await locator.evaluate(el => { const css = getComputedStyle(el); return [css.outlineWidth, css.outlineStyle, css.outlineColor]; });
    expect(style.slice(0, 2)).toEqual(['3px', 'solid']); expect(style[2]).not.toBe('rgba(0, 0, 0, 0)');
  }
});
