import { test, expect } from '@playwright/test';
import { radioGroupContract } from './radio-group.js';

/**
 * @typedef {Object} Subject
 * @property {import('@playwright/test').Locator} group
 * @property {string} legend
 * @property {string[]} names
 * @property {number|null} selected
 */

/** Compare browser semantics with the independent binding and native painted state.
 * @param {Subject} subject
 * @param {number|null} selected
 */
async function selection({ group, names }, selected) {
  const radios = group.getByRole('radio');
  await expect(radios).toHaveCount(names.length);
  await expect(group.getByRole('radio', { checked: true })).toHaveCount(selected === null ? 0 : 1);
  for (let i = 0; i < names.length; i++) {
    const radio = radios.nth(i);
    expect(await radio.evaluate(el => el instanceof HTMLInputElement && el.checked), 'native rendered checked state').toBe(i === selected);
    const snapshot = await radio.ariaSnapshot();
    expect(/\[checked\]/.test(snapshot), 'snapshot checked state').toBe(i === selected);
    await expect(group.getByRole('radio', { name: names[i], exact: true, checked: i === selected })).toHaveCount(1);
  }
}

/** Run exactly one expectation, also used unchanged by planted violations.
 * @param {string} id
 * @param {import('@playwright/test').Page} page
 * @param {Subject} subject
 */
export async function assertRadioExpectation(id, page, subject) {
  const { group, legend, names, selected } = subject;
  const radios = group.getByRole('radio');
  switch (id) {
    case 'group-name':
      await expect(group).toHaveRole('group');
      await expect(group).toHaveAccessibleName(legend);
      await expect(group.locator('legend')).toHaveText(legend);
      break;
    case 'radio-names':
      await expect(radios).toHaveCount(names.length);
      for (let i = 0; i < names.length; i++) await expect(radios.nth(i)).toHaveAccessibleName(names[i]);
      break;
    case 'checked':
      await selection(subject, selected);
      break;
    case 'tab': {
      // Sentinels isolate group entry/exit from unrelated fixture controls.
      await group.evaluate(el => {
        for (const side of ['before', 'after']) {
          const button = document.createElement('button');
          button.textContent = `Contract ${side}`;
          el.insertAdjacentElement(side === 'before' ? 'beforebegin' : 'afterend', button);
        }
      });
      const before = page.getByRole('button', { name: 'Contract before', exact: true });
      const after = page.getByRole('button', { name: 'Contract after', exact: true });
      try {
        await before.focus();
        await page.keyboard.press('Tab');
        await expect(radios.nth(selected ?? 0)).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(after).toBeFocused();
        // APG notes native reverse entry can differ when no radio is selected.
        // Check reverse entry with a selection, for which APG specifies one target.
        await radios.nth(names.length - 1).check();
        await after.focus();
        await page.keyboard.press('Shift+Tab');
        await expect(radios.last()).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(before).toBeFocused();
      } finally {
        await before.evaluate(el => el.remove());
        await after.evaluate(el => el.remove());
      }
      break;
    }
    case 'arrows':
      for (const [key, direction] of [['ArrowRight', 1], ['ArrowDown', 1], ['ArrowLeft', -1], ['ArrowUp', -1]]) {
        await radios.first().focus();
        for (let step = 1; step <= names.length; step++) {
          await page.keyboard.press(key);
          const index = (direction * step % names.length + names.length) % names.length;
          await expect(radios.nth(index)).toBeFocused();
          await selection(subject, index);
        }
      }
      break;
    case 'space':
      for (let i = 0; i < names.length; i++) {
        await radios.nth(i).focus();
        await page.keyboard.press('Space');
        await selection(subject, i);
        await page.keyboard.press('Space');
        await selection(subject, i);
      }
      break;
    case 'stable-names':
      for (let i = 0; i < names.length; i++) {
        await radios.nth(i).check();
        for (let j = 0; j < names.length; j++) await expect(radios.nth(j)).toHaveAccessibleName(names[j]);
      }
      break;
    case 'focus':
      await page.keyboard.press('Tab');
      for (const radio of await radios.all()) {
        await radio.focus();
        await expect(radio).toBeFocused();
        await expect(radio).toBeVisible();
        const indicator = await radio.evaluate(el => {
          // Native labels may paint the ring around a visually hidden input.
          const targets = [el, ...(el instanceof HTMLInputElement ? el.labels ?? [] : [])];
          return el.matches(':focus-visible') && targets.some(target => {
            const css = getComputedStyle(target), box = target.getBoundingClientRect();
            return box.width > 0 && box.height > 0 && Number(css.opacity) > 0 &&
              parseFloat(css.outlineWidth) >= 3 && !['none', 'hidden'].includes(css.outlineStyle) &&
              !['transparent', 'rgba(0, 0, 0, 0)'].includes(css.outlineColor);
          });
        });
        expect(indicator, 'visible 3px keyboard focus outline on radio or associated label').toBe(true);
      }
      break;
    default: throw new Error(`Unknown radio expectation: ${id}`);
  }
}

/**
 * @param {{name: string, cases: {name: string, load: (page: import('@playwright/test').Page, js: boolean) => Promise<Subject>}[]}} binding
 */
export function bindRadioContract(binding) {
  for (const javaScriptEnabled of [true, false]) {
    test.describe(`${binding.name} radio contract, JS ${javaScriptEnabled}`, () => {
      test.use({ javaScriptEnabled, reducedMotion: 'reduce' });
      for (const state of binding.cases) {
        for (const expectation of radioGroupContract) test(`${state.name}: ${expectation.id}`, async ({ page }) => {
          await test.step(`${expectation.outcome} (${expectation.sources.join(', ')})`, async () => {
            const subject = await state.load(page, javaScriptEnabled);
            await assertRadioExpectation(expectation.id, page, subject);
          });
        });
      }
    });
  }
}
