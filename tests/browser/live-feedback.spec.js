import { frenchTypography } from '../../lib/html.js';
import { CAP_MESSAGES } from '../../lib/data-notice.js';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { strings } from '../../patterns/live-feedback/strings.js';

const examples = Object.fromEntries(await Promise.all(['en', 'fr'].map(async lang => [lang, JSON.parse(await readFile(new URL(`../../patterns/live-feedback/examples/${lang}.json`, import.meta.url)))])));
examples.fr = JSON.parse(JSON.stringify(examples.fr), (_key, value) => typeof value === 'string' ? frenchTypography(value, 'fr') : value);
const draft = 'I will speak at the next meeting.';

for (const lang of ['en', 'fr']) test(`checklist states are readable while typing stays silent (${lang})`, async ({ page }) => {
  await open(page, { lang });
  const prefixes = lang === 'en' ? { done: 'Done:', todo: 'To add:' } : { done: 'Fait :', todo: 'À ajouter :' };
  const rows = page.locator('[data-lp-items] > li');
  for (const row of await rows.all()) await expect(row).toContainText(prefixes.todo);
  await auto(page);
  for (const row of await rows.all()) {
    const mark = await row.getAttribute('data-lp-mark');
    await expect(row).toContainText(prefixes[mark]);
    expect(await row.ariaSnapshot()).toContain(prefixes[mark]);
  }
  const announcements = await page.evaluate(() => window.lpAnnouncements);
  await page.getByRole('textbox').press('x');
  await page.clock.runFor(100);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(announcements);
  await expect(page.locator('[data-lp-list]')).toHaveAttribute('aria-live', 'off');
  await page.clock.runFor(900);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(announcements);
});

for (const lang of ['en', 'fr']) test(`Edit focuses the editable plan before hiding its button (${lang})`, async ({ page }) => {
  await open(page, { lang });
  await page.evaluate(() => { window.lpValues = [1, 1, 1, 1]; });
  await auto(page);
  await page.evaluate(() => {
    window.lpEditFocus = [];
    document.addEventListener('focusin', event => {
      if (event.target.matches('textarea')) window.lpEditFocus.push({
        editable: !event.target.readOnly,
        oldControlVisible: document.querySelector('.lp-live-feedback-completion button').getClientRects().length > 0
      });
    });
  });
  const edit = page.getByRole('button', { name: strings[lang].edit, exact: true });
  await edit.focus();
  await page.keyboard.press('Enter');
  await page.clock.runFor(50);
  await expect(page.getByRole('textbox')).toBeFocused();
  await expect(edit).toBeHidden();
  expect(await page.evaluate(() => window.lpEditFocus)).toEqual([{ editable: true, oldControlVisible: true }]);
});

async function open(page, { lang = 'en', mode = 'ok', two = false } = {}) {
  await page.addInitScript(({ mode }) => {
    window.lpTestCalls = [];
    window.lpValues = [1, 0, .5, 1];
    window.lpAnnouncements = [];
    if (mode === 'missing') window.lpAsk = null;
    else window.lpAsk = async (block, fields, options) => {
      const call = { block, fields, signal: options.signal, slot: !!options.challengeSlot };
      window.lpTestCalls.push(call);
      if (mode === 'ip_daily' || mode === 'budget') {
        throw Object.assign(new Error('Daily cap'), { type: 'budget', reason: mode });
      }
      if (mode === 'throws') throw new Error('Offline');
      if (mode === 'invalid') return {};
      if (mode === 'pending') return new Promise((resolve, reject) => { call.resolve = resolve; call.reject = reject; });
      return Object.fromEntries(['three_actions', 'observable', 'when', 'commitments'].map((id, index) => [id, { noul: window.lpValues[index] }]));
    };
  }, { mode });
  await page.goto(`/live-feedback/${two ? 'two' : lang}.html`);
  await page.waitForFunction(() => window.lpReady);
  if (mode !== 'missing') await expect(page.locator('[data-lp-list]').first()).toBeVisible();
  await page.evaluate(() => {
    new MutationObserver(records => {
      for (const record of records) if (record.target.textContent) window.lpAnnouncements.push(record.target.textContent);
    }).observe(document.querySelector('[role="status"]'), { childList: true, characterData: true, subtree: true });
  });
  // Host and browser clocks can differ; freeze at a known future tick.
  const time = new Date(2026, 9, 6);
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 60_000));
}
const calls = page => page.evaluate(() => window.lpTestCalls.length);
// Advance past the adaptive ceiling for checks whose exact timing is not under test.
const settle = page => page.clock.runFor(900);
const auto = async (page, text = draft, root = page) => {
  await root.getByRole('textbox').fill(text);
  await settle(page);
};
async function axe(page) {
  await page.clock.resume();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
}

test('default pause resets on input; short and unchanged trimmed text skip', async ({ page }) => {
  await open(page);
  await auto(page, 'x'.repeat(19));
  expect(await calls(page)).toBe(0);
  await page.getByRole('textbox').fill('x'.repeat(20));
  await page.clock.runFor(699);
  expect(await calls(page)).toBe(0);
  await page.getByRole('textbox').fill(draft);
  await page.clock.runFor(699);
  expect(await calls(page)).toBe(0);
  await page.clock.runFor(1);
  expect(await calls(page)).toBe(1);
  await auto(page, `  ${draft}  `);
  expect(await calls(page)).toBe(1);
  expect(await page.evaluate(() => window.lpTestCalls[0].fields)).toEqual({ answer: draft });
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['2 of 4 done']);
});

for (const [gap, wait] of [[200, 500], [50, 400], [500, 900]]) {
  test(`key gaps of ${gap} ms use a ${wait} ms pause`, async ({ page }) => {
    await open(page);
    const answer = page.getByRole('textbox');
    await answer.fill('x'.repeat(19));
    for (const key of ['a', 'b', 'c', 'd']) {
      await answer.press(key);
      if (key !== 'd') await page.clock.runFor(gap);
    }
    await page.clock.runFor(wait - 1);
    expect(await calls(page)).toBe(0);
    await page.clock.runFor(1);
    expect(await calls(page)).toBe(1);
    await auto(page, 'x'.repeat(19));
    expect(await calls(page)).toBe(1);
  });
}

test('question marks and Enter keep the pause for plans', async ({ page }) => {
  await open(page);
  const answer = page.getByRole('textbox');
  await answer.fill('x'.repeat(18) + '?');
  await settle(page);
  expect(await calls(page)).toBe(0);
  await answer.fill('x'.repeat(19) + '?');
  await page.clock.runFor(699);
  expect(await calls(page)).toBe(0);
  await page.clock.runFor(1);
  expect(await calls(page)).toBe(1);
  await answer.fill(draft);
  await answer.press('Enter');
  await page.clock.runFor(699);
  expect(await calls(page)).toBe(1);
  await page.clock.runFor(1);
  expect(await calls(page)).toBe(2);
});

const order = page => page.locator('[data-lp-items] > li').evaluateAll(items => items.map(item => item.dataset.lpCriterion));

for (const lang of ['en', 'fr']) test(`completion locks the answer, announces once and Edit resumes checks (${lang})`, async ({ page }) => {
  await open(page, { lang });
  const answer = page.getByRole('textbox');
  await expect(page.locator('[data-lp-complete]')).toBeHidden();
  await page.evaluate(() => { window.lpValues = [1, 1, 1, 1]; });
  await auto(page);
  await expect(answer).toHaveAttribute('readonly', '');
  await expect(answer).toBeEnabled();
  await expect(answer).toBeFocused();
  await expect(answer).toHaveValue(draft);
  await expect(answer).toHaveCSS('background-color', 'rgb(247, 248, 250)');
  await expect(answer).toHaveCSS('color', 'rgb(22, 24, 29)');
  await expect(page.locator('[data-lp-complete]')).toHaveText(strings[lang].complete);
  await expect(page.locator('[data-lp-complete] .lp-icon')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('[data-lp-notice]')).toBeVisible();
  const complete = frenchTypography(`${strings[lang].complete} ${strings[lang].summary.replace('{count}', '4').replace('{total}', '4')}`, lang);
  await expect(page.locator('[role="status"]')).toHaveText(complete);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([complete]);
  await answer.press('End');
  await page.keyboard.type(' This cannot change the plan.');
  await answer.dispatchEvent('input');
  await page.clock.runFor(1400);
  await expect(answer).toHaveValue(draft);
  expect(await calls(page)).toBe(1);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([complete]);
  await answer.focus();
  await page.keyboard.press('Tab');
  const edit = page.getByRole('button', { name: strings[lang].edit, exact: true });
  await expect(edit).toBeFocused();
  await page.keyboard.press('Enter');
  await page.clock.runFor(50);
  await expect(answer).toBeEditable();
  await expect(answer).not.toHaveAttribute('readonly');
  await expect(answer).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(answer).toBeFocused();
  expect(await answer.evaluate(el => [el.selectionStart, el.selectionEnd])).toEqual([draft.length, draft.length]);
  await expect(page.locator('[data-lp-complete]')).toBeHidden();
  await expect(edit).toBeHidden();
  await page.clock.runFor(1400);
  expect(await calls(page)).toBe(1);
  await page.evaluate(() => { window.lpValues = [0, 1, 1, 1]; });
  await auto(page, 'I will revise my plan before the meeting.');
  expect(await calls(page)).toBe(2);
  await expect(answer).toBeEditable();
  expect(await order(page)).toEqual(['observable', 'when', 'commitments', 'three_actions']);
  await page.evaluate(() => { window.lpValues = [1, 1, 1, 1]; });
  await auto(page, 'I will finish my revised plan before the meeting.');
  await expect(answer).toHaveAttribute('readonly', '');
  await expect(page.locator('[data-lp-complete]')).toBeVisible();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([
    complete, strings[lang].summary.replace('{count}', '3').replace('{total}', '4'), complete
  ]);
  await edit.click();
  await page.clock.runFor(50);
  await auto(page, 'I will keep all four items in another finished plan.');
  await expect(answer).toHaveAttribute('readonly', '');
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([
    complete, strings[lang].summary.replace('{count}', '3').replace('{total}', '4'), complete, complete
  ]);
  await axe(page);
});

test('destroy removes completion controls and restores an editable textarea', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { window.lpValues = [1, 1, 1, 1]; });
  await auto(page);
  await expect(page.getByRole('textbox')).toHaveAttribute('readonly', '');
  await page.evaluate(() => { window.lpInstances[0].destroy(); });
  await expect(page.getByRole('textbox')).toBeEditable();
  await expect(page.getByRole('textbox')).not.toHaveAttribute('readonly');
  await expect(page.getByRole('textbox')).toHaveValue(draft);
  await expect(page.locator('[data-lp-complete]')).toHaveCount(0);
  await expect(page.getByRole('button', { includeHidden: true })).toHaveCount(0);
  await expect(page.locator('[role="status"]')).toBeEmpty();
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await auto(page, 'I can edit freely after destroy.');
  expect(await calls(page)).toBe(1);
  await page.evaluate(() => { window.lpEnhance(); });
  await expect(page.locator('[data-lp-list]')).toBeVisible();
  await settle(page);
  await expect(page.getByRole('textbox')).toHaveAttribute('readonly', '');
  await expect(page.locator('[data-lp-complete]')).toHaveCount(1);
});

test('starting checklist uses four plain to-add rows, without a button', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-lp-items] > li [data-lp-item-text]')).toHaveText(examples.en.criteria.map(item => item.todo));
  await expect(page.locator('[data-lp-mark="todo"]')).toHaveCount(4);
  await expect(page.locator('.lp-live-feedback-bullet')).toHaveCount(4);
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.locator('[role="status"]')).toBeEmpty();
  expect(await calls(page)).toBe(0);
  await page.evaluate(() => { window.lpValues = [0, 0, 0, 0]; });
  await auto(page);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([]);
});

test('done rows lead in criterion order; unsure uses the to-add wording and circle', async ({ page }) => {
  await open(page); await auto(page);
  expect(await order(page)).toEqual(['three_actions', 'commitments', 'observable', 'when']);
  await expect(page.locator('[data-lp-items] > li [data-lp-item-text]')).toHaveText([
    examples.en.criteria[0].done, examples.en.criteria[3].done,
    examples.en.criteria[1].todo, examples.en.criteria[2].todo
  ]);
  await expect(page.locator('[data-lp-mark="done"] .lp-icon')).toHaveCount(2);
  await expect(page.locator('[data-lp-mark="todo"] .lp-live-feedback-bullet')).toHaveCount(2);
  await expect(page.locator('[data-lp-mark="unsure"]')).toHaveCount(0);
  for (const row of await page.locator('[data-lp-items] > li').all()) {
    await expect(row).toHaveCSS('border-style', 'none');
    await expect(row).toHaveCSS('transition-property', 'transform');
    await expect(row).toHaveCSS('transition-duration', '0.2s');
  }
  await page.evaluate(() => { window.lpValues = [0, 1, 1, 0]; });
  await auto(page, 'I will write a different finished plan.');
  expect(await order(page)).toEqual(['observable', 'when', 'three_actions', 'commitments']);
});

test('unfinished final sentences retain done items and order until punctuation or newline', async ({ page }) => {
  await open(page);
  await auto(page);
  expect(await order(page)).toEqual(['three_actions', 'commitments', 'observable', 'when']);
  await page.evaluate(() => { window.lpValues = [0, 0, 0, 0]; });
  await auto(page, 'I will speak at the next meeting and');
  await expect(page.locator('[data-lp-mark="done"]')).toHaveCount(2);
  expect(await order(page)).toEqual(['three_actions', 'commitments', 'observable', 'when']);
  await auto(page, 'I will speak at the next meeting and ask for a turn.');
  await expect(page.locator('[data-lp-mark="todo"]')).toHaveCount(4);
  expect(await order(page)).toEqual(['three_actions', 'observable', 'when', 'commitments']);
  await page.evaluate(() => { window.lpValues = [1, 1, 1, 1]; });
  await auto(page, 'I will make another commitment.');
  await page.getByRole('button', { name: strings.en.edit }).click();
  await page.clock.runFor(50);
  await page.evaluate(() => { window.lpValues = [0, 0, 0, 0]; });
  await auto(page, 'I will describe another action\n');
  await expect(page.locator('[data-lp-mark="todo"]')).toHaveCount(4);
});

test('40 checks are shared across instances; the limit opens self-checks and survives re-enhancement', async ({ page }) => {
  await open(page, { two: true });
  const roots = page.locator('[data-lp-pattern]');
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id));
  expect(new Set(ids).size).toBe(ids.length);
  for (let index = 0; index < 39; index++) await auto(page, `${draft} ${index}.`, roots.nth(index % 2));
  for (const root of await roots.all()) await expect(root.locator('[data-lp-fallback]')).toBeHidden();
  await auto(page, `${draft} Last check.`, roots.nth(1));
  expect(await calls(page)).toBe(40);
  for (const root of await roots.all()) {
    await expect(root.locator('[data-lp-paused]')).toHaveText(strings.en.paused);
    await expect(root.locator('[data-lp-paused]')).toBeVisible();
    await expect(root.locator('[data-lp-list]')).toBeHidden();
    await expect(root.locator('[data-lp-fallback]')).toBeVisible();
    await expect(root.locator('[data-lp-fallback-text]')).toHaveText(strings.en.selfCheck);
    await expect(root.getByRole('checkbox')).toHaveCount(4);
  }
  await auto(page, `${draft} Over the cap.`, roots.first());
  await expect(roots.first().locator('[data-lp-paused]')).toBeVisible();
  expect(await calls(page)).toBe(40);
  await page.evaluate(() => { window.lpInstances[0].destroy(); window.lpEnhance(); });
  await expect(roots.first().locator('[data-lp-fallback]')).toBeVisible();
  await auto(page, `${draft} Re-enhanced.`, roots.first());
  expect(await calls(page)).toBe(40);
  await roots.first().getByRole('checkbox').first().check();
  await expect(roots.first().getByRole('checkbox').first()).toBeChecked();
});

test('completion on check 40 stays locked; Edit opens the self-check without more requests', async ({ page }) => {
  await open(page);
  for (let index = 0; index < 39; index++) await auto(page, `${draft} ${index}.`);
  await page.evaluate(() => { window.lpValues = [1, 1, 1, 1]; });
  await auto(page, 'I will finish on the last automatic check.');
  await expect(page.getByRole('textbox')).toHaveAttribute('readonly', '');
  await expect(page.locator('[data-lp-complete]')).toBeVisible();
  await expect(page.locator('[data-lp-notice]')).toBeVisible();
  await expect(page.locator('[data-lp-fallback]')).toBeHidden();
  await page.getByRole('button', { name: strings.en.edit }).click();
  await page.clock.runFor(50);
  await expect(page.getByRole('textbox')).toBeEditable();
  await expect(page.getByRole('textbox')).toBeFocused();
  await expect(page.locator('[data-lp-complete]')).toBeHidden();
  await expect(page.locator('[data-lp-paused]')).toBeVisible();
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await auto(page, 'I will keep editing with the self-check.');
  expect(await calls(page)).toBe(40);
});

test('failed checks after Edit restore the editable fallback', async ({ page }) => {
  await open(page, { mode: 'pending' });
  await auto(page);
  await page.evaluate(() => {
    window.lpTestCalls[0].resolve(Object.fromEntries(['three_actions', 'observable', 'when', 'commitments'].map(key => [key, { noul: 1 }])));
  });
  await expect(page.getByRole('textbox')).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: strings.en.edit }).click();
  await page.clock.runFor(50);
  await auto(page, 'I will revise before the next meeting.');
  await page.evaluate(() => { window.lpTestCalls[1].reject(new Error('Offline')); });
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  await expect(page.getByRole('textbox')).toBeEditable();
  await expect(page.locator('[data-lp-complete]')).toBeHidden();
});

test('slow requests keep typing available, abort on edit and discard stale successes and failures', async ({ page }) => {
  await open(page, { mode: 'pending' });
  await auto(page);
  await expect(page.locator('[data-lp-checking]')).toHaveText(strings.en.checking);
  await expect(page.getByRole('textbox')).toBeEnabled();
  await page.clock.runFor(9000);
  expect(await calls(page)).toBe(1);
  await expect(page.locator('[data-lp-checking]')).toBeVisible();
  await auto(page, 'I will ask for a turn at the next meeting.');
  expect(await page.evaluate(() => window.lpTestCalls.map(call => call.signal.aborted))).toEqual([true, false]);
  await page.evaluate(() => {
    const all = value => Object.fromEntries(['three_actions', 'observable', 'when', 'commitments'].map(key => [key, { noul: value }]));
    window.lpTestCalls[1].resolve(all(1));
    window.lpTestCalls[0].resolve(all(0));
  });
  await expect(page.locator('[data-lp-mark="done"]')).toHaveCount(4);
  await page.getByRole('button', { name: strings.en.edit }).click();
  await page.clock.runFor(50);
  await auto(page, 'I will name a different workplace action.');
  await auto(page, 'I will name the latest workplace action.');
  await page.evaluate(() => { window.lpTestCalls[2].reject(new Error('Old refusal')); });
  await expect(page.locator('[data-lp-fallback]')).toBeHidden();
  await expect(page.locator('[data-lp-checking]')).toBeVisible();
  await page.evaluate(() => { window.lpTestCalls[3].resolve(Object.fromEntries(['three_actions', 'observable', 'when', 'commitments'].map(key => [key, { noul: 0 }]))); });
  await expect(page.locator('[data-lp-mark="todo"]')).toHaveCount(4);
  await expect(page.locator('[data-lp-checking]')).toBeHidden();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual(['Well done! 4 of 4 done', '0 of 4 done']);
});

for (const lang of ['en', 'fr']) {
  test(`silent list and one count announcement only when the count changes (${lang})`, async ({ page }) => {
    await open(page, { lang });
    await expect(page.locator('h2')).toHaveText(examples[lang].prompt);
    await expect(page.locator('[data-lp-hint]')).toHaveCount(0);
    await expect(page.locator('[data-lp-notice]')).toBeVisible();
    await expect(page.locator('[data-lp-challenge]')).toBeHidden();
    await auto(page);
    const summary = strings[lang].summary.replace('{count}', '2').replace('{total}', '4');
    await expect(page.locator('[role="status"]')).toHaveText(summary);
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([summary]);
    await expect(page.getByRole('textbox')).toBeFocused();
    await expect(page.locator('[data-lp-list]')).toHaveAttribute('aria-live', 'off');
    await page.getByRole('textbox').fill('I will write another plan at our meeting.');
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([summary]);
    await settle(page);
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([summary]);
    await page.evaluate(() => { window.lpValues = [0, 1, 1, 0]; });
    await auto(page, 'I will change which items are done.');
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([summary]);
    await page.evaluate(() => { window.lpValues = [1, 1, 1, 1]; });
    await auto(page, 'I will finish the whole plan.');
    const complete = frenchTypography(`${strings[lang].complete} ${strings[lang].summary.replace('{count}', '4').replace('{total}', '4')}`, lang);
    expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([summary, complete]);
    await expect(page.locator('[data-lp-hint]')).toHaveCount(0);
    await axe(page);
  });

  for (const mode of ['missing', 'throws', 'invalid']) test(`native checklist fallback for ${mode} (${lang})`, async ({ page }) => {
    await open(page, { lang, mode });
    if (mode !== 'missing') await auto(page);
    await expect(page.locator('[data-lp-fallback]')).toBeVisible();
    await expect(page.locator('[data-lp-fallback-text]')).toHaveText(strings[lang].fallback);
    await expect(page.locator('[data-lp-list]')).toBeHidden();
    for (const item of examples[lang].criteria) await expect(page.getByRole('checkbox', { name: item.done, exact: true })).toBeVisible();
    await page.getByRole('checkbox').first().focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('checkbox').first()).toBeChecked();
    await expect(page.getByRole('checkbox').nth(1)).not.toBeChecked();
    await expect(page.getByRole('checkbox').first()).toMatchAriaSnapshot(`- checkbox "${examples[lang].criteria[0].done}" [checked]`);
    await expect(page.getByRole('checkbox').nth(1)).toMatchAriaSnapshot(`- checkbox "${examples[lang].criteria[1].done}"`);
    expect(await page.evaluate(() => window.lpSaved.ticked)).toEqual(['three_actions']);
    await axe(page);
  });

  test(`320 px reflow, text spacing and reduced motion (${lang})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, { lang }); await auto(page);
    await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('.lp-choice, .lp-button, .lp-input').evaluateAll(elements => elements.filter(el => el.clientWidth + 1 < el.scrollWidth).map(el => el.className))).toEqual([]);
      for (const row of await page.locator('[data-lp-items] > li').all()) await expect(row).toHaveCSS('transition-duration', '0s');
      expect(await page.locator('[data-lp-items]').evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
    }
    await axe(page);
  });
}

test('configured Perplexity notice comes from the shared ask client; refused calls fall back', async ({ page }) => {
  await open(page);
  await page.evaluate(async content => {
    window.lpInstances[0].destroy();
    const { enhance } = await import('/patterns/live-feedback/enhance.js');
    const { strings } = await import('/patterns/live-feedback/strings.js');
    const { createAsk } = await import('/lib/ask.js');
    const { noticeConfig } = await import('/lib/data-notice.js');
    window.lpNetwork = [];
    const ask = createAsk({ fetch: async (url, options) => {
      window.lpNetwork.push({ url, body: options.body });
      if (url.endsWith('/config')) return Response.json({ provider: 'perplexity', siteKey: '', model: 'pplx-decider-v1.1-27b', ...noticeConfig('perplexity') });
      return Response.json({ reason: 'budget' }, { status: 429 });
    } });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, ask });
  }, examples.en);
  await expect(page.locator('[data-lp-list]')).toBeVisible();
  await expect(page.locator('[data-lp-notice]')).toHaveText('Your answer is sent to a decision model; the service does not store it or use it for training.');
  await auto(page);
  await expect(page.locator('[data-lp-fallback]')).toBeVisible();
  expect(await page.evaluate(() => window.lpNetwork.map(call => call.url))).toEqual(['/api/patterns/config', '/api/patterns/ask']);
  expect(await page.evaluate(() => JSON.parse(window.lpNetwork[1].body))).toEqual({ block: '02-live', fields: { answer: draft } });
});

for (const mode of ['config-failure', 'clef']) test(`configuration ${mode} uses self-check`, async ({ page }) => {
  await open(page);
  await page.evaluate(async ({ content, mode }) => {
    window.lpInstances[0].destroy();
    const { enhance } = await import('/patterns/live-feedback/enhance.js');
    const { strings } = await import('/patterns/live-feedback/strings.js');
    const ask = Object.assign(async () => { throw new Error('Must not call'); }, { config: async () => {
      if (mode === 'config-failure') throw new Error('Unavailable');
      return { provider: 'clef' };
    } });
    enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en, ask });
  }, { content: examples.en, mode });
  await expect(page.locator('[data-lp-fallback-text]')).toHaveText(strings.en.fallback);
  await expect(page.locator('[data-lp-list]')).toBeHidden();
});

test('idempotent enhancement; destroy restores server DOM and ignores pending work', async ({ page }) => {
  await open(page, { mode: 'pending' });
  expect(await page.evaluate(() => window.lpEnhance() === window.lpInstances[0])).toBe(true);
  await auto(page);
  await page.evaluate(() => {
    window.lpInstances[0].destroy(); window.lpInstances[0].destroy();
    window.lpTestCalls[0].resolve({});
  });
  expect(await page.evaluate(() => window.lpTestCalls[0].signal.aborted)).toBe(true);
  const markup = await page.evaluate(async content => {
    const { render } = await import('/patterns/live-feedback/render.js');
    const { strings } = await import('/patterns/live-feedback/strings.js');
    const expected = document.createElement('div');
    expected.innerHTML = render(content, strings.en, { id: 'example', lang: 'en' });
    return { actual: document.querySelector('[data-lp-pattern]').outerHTML, expected: expected.firstElementChild.outerHTML };
  }, examples.en);
  expect(markup.actual).toBe(markup.expected);
  await expect(page.getByRole('textbox')).toHaveValue(draft);
  await page.getByRole('textbox').fill('After destroy');
  expect(await page.evaluate(() => window.lpSaved.answer)).toBe(draft);
  await settle(page);
  expect(await calls(page)).toBe(1);
});

test('saved drafts and self-check ticks restore', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { answer: 'Saved plan', ticked: ['when'] }; });
  await open(page, { mode: 'missing' });
  await expect(page.getByRole('textbox')).toHaveValue('Saved plan');
  await expect(page.getByRole('checkbox').nth(2)).toBeChecked();
});

test('invalid saved state is ignored', async ({ page }) => {
  await page.addInitScript(() => { window.lpSeed = { answer: 'Invalid', ticked: ['unknown'] }; });
  await open(page, { mode: 'missing' });
  await page.waitForFunction(() => window.lpReady);
  await expect(page.getByRole('textbox')).toHaveValue('');
  for (const box of await page.getByRole('checkbox').all()) await expect(box).not.toBeChecked();
});

test('no JavaScript keeps prompt, textarea and four native self-checks in both languages', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const lang of ['en', 'fr']) {
    await page.goto(`${baseURL}/live-feedback/${lang}.html`);
    await expect(page.locator('h2')).toHaveText(examples[lang].prompt);
    await expect(page.getByRole('textbox')).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(4);
    await expect(page.locator('[data-lp-hint]')).toHaveCount(0);
    for (const item of examples[lang].criteria) await expect(page.getByRole('checkbox', { name: item.done, exact: true })).toBeVisible();
    await page.getByRole('checkbox').first().check();
    await expect(page.getByRole('checkbox').first()).toBeChecked();
  }
  await context.close();
});

test('forced colours keep marks and visible keyboard focus', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Forced colours emulation checked in Chromium.');
  await page.emulateMedia({ forcedColors: 'active' });
  await open(page); await auto(page);
  await expect(page.locator('[data-lp-mark="done"] .lp-icon').first()).toBeVisible();
  await expect(page.locator('[data-lp-mark="todo"] .lp-live-feedback-bullet').first()).toHaveCSS('border-style', 'dotted');
  await page.getByRole('textbox').focus();
  await expect(page.getByRole('textbox')).toHaveCSS('outline-style', 'solid');
  await expect(page.getByRole('textbox')).toHaveCSS('outline-width', '2px');
});

for (const lang of ['en', 'fr']) for (const reason of ['ip_daily', 'budget']) test(`daily cap shows and announces once, keeps focus and a usable fallback (${lang}, ${reason})`, async ({ page }) => {
  await open(page, { lang, mode: reason });
  const root = page.locator('[data-lp-pattern]').first();
  const input = root.getByRole('textbox');
  await input.fill('A complete draft for a live check');
  await input.focus();
  await page.evaluate(() => {
    window.lpCapFocusMoves = 0;
    document.addEventListener('focusin', () => { window.lpCapFocusMoves++; });
  });
  await page.clock.runFor(900);
  const message = CAP_MESSAGES[reason][lang];
  await expect(root.locator('[data-lp-cap]')).toHaveText(message);
  await expect(root.locator('[data-lp-cap]')).toBeVisible();
  await expect(input).toBeFocused();
  expect(await page.evaluate(() => window.lpCapFocusMoves)).toBe(0);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([message]);
  await expect(root.locator('[data-lp-fallback]')).toBeVisible();
  expect(await root.evaluate(root => {
    const notice = root.querySelector('[data-lp-cap]');
    const fallback = root.querySelector('[data-lp-fallback]');
    return Boolean(notice.compareDocumentPosition(fallback) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);
  await input.fill('Another changed draft that must not retry?');
  await input.press('Enter');
  await page.clock.runFor(2000);
  expect(await calls(page)).toBe(1);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([message]);
  const box = root.locator('[data-lp-fallback] input').first();
  await box.check();
  await expect(box).toBeChecked();
});

for (const lang of ['en', 'fr']) for (const reason of ['ip_daily', 'budget']) test(`daily cap on an edited draft cancels later checks (${lang}, ${reason})`, async ({ page }) => {
  await open(page, { lang, mode: 'pending' });
  const root = page.locator('[data-lp-pattern]').first();
  const input = root.getByRole('textbox');
  await auto(page, 'A complete draft for a live check');
  await input.fill('An edited draft waiting for another check');
  await page.evaluate(reason => {
    window.lpTestCalls[0].reject(Object.assign(new Error('Daily cap'), { type: 'budget', reason }));
  }, reason);
  await expect(root.locator('[data-lp-cap]')).toHaveText(CAP_MESSAGES[reason][lang]);
  await expect(input).toBeFocused();
  await input.press('Enter');
  await page.clock.runFor(2000);
  expect(await calls(page)).toBe(1);
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([CAP_MESSAGES[reason][lang]]);
  const cap = root.locator('[data-lp-cap]');
  await expect(cap).toBeVisible();
});
