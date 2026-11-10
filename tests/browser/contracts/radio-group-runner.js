import { test, expect as baseExpect } from '@playwright/test';
import { radioGroupContract, webkitRadioArrows } from './radio-group.js';

const expect = baseExpect.configure({ timeout: 1000 });

/**
 * @typedef {Object} Subject
 * @property {import('@playwright/test').Locator} group
 * @property {string} legend
 * @property {string|RegExp} [accessibleName]
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
  await expect(group.getByRole('radio', { checked: false })).toHaveCount(names.length - (selected === null ? 0 : 1));
  const painted = await radios.evaluateAll(elements => elements.map(el => el instanceof HTMLInputElement && el.checked));
  expect(painted, 'native rendered checked state').toEqual(names.map((_, i) => i === selected));
  if (selected !== null) {
    const checked = group.getByRole('radio', { checked: true });
    await expect(checked).toHaveAccessibleName(names[selected]);
    expect((await checked.ariaSnapshot()).split('\n')[0], 'snapshot checked state').toMatch(/\[checked\]$/);
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
  // An empty subject must fail, including focus loops over all radios.
  await expect(radios).toHaveCount(names.length);
  switch (id) {
    case 'group-name':
      await expect(group).toHaveRole('group');
      await expect(group).toHaveAccessibleName(subject.accessibleName ?? legend);
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
    case 'arrows': {
      const wraps = test.info().project.use.browserName === 'webkit' ? webkitRadioArrows.wraps : true;
      for (const [key, direction] of [['ArrowRight', 1], ['ArrowDown', 1], ['ArrowLeft', -1], ['ArrowUp', -1]]) {
        const start = direction === 1 ? 0 : names.length - 1;
        await radios.nth(start).focus();
        for (let step = 1; step <= names.length; step++) {
          const offset = start + direction * step;
          const index = wraps ? (offset + names.length) % names.length : Math.max(0, Math.min(names.length - 1, offset));
          await test.step(`${key} press ${step}/${names.length}: option ${index + 1}, ${wraps ? 'APG wrap' : webkitRadioArrows.source}`, async () => {
            await page.keyboard.press(key);
            await expect(radios.nth(index), `${key} press ${step}: focus on option ${index + 1}`).toBeFocused();
            await selection(subject, index);
          });
        }
      }
      break;
    }
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
 * @param {{name: string, lang: string, cases: {name: string, load: (page: import('@playwright/test').Page, js: boolean) => Promise<Subject>}[]}} binding
 */
export function bindRadioContract(binding) {
  for (const javaScriptEnabled of [true, false]) {
    test.describe(`${binding.name} radio contract, ${binding.lang}, JS ${javaScriptEnabled}`, () => {
      test.use({ javaScriptEnabled, reducedMotion: 'reduce', actionTimeout: 3000 });
      test('all questions and states', async ({ page, browserName }) => {
        test.setTimeout(60_000);
        for (const state of binding.cases) {
          const subject = await state.load(page, javaScriptEnabled);
          // Retain the computed names in CI so whitespace acceptance is auditable.
          if (binding.name === 'dont-know' && subject.selected === null) console.log(`RADIO_NAME ${browserName} ${binding.name} ${binding.lang} JS=${javaScriptEnabled} ${state.name} ${JSON.stringify((await subject.group.ariaSnapshot()).split('\n')[0])}`);
          for (const expectation of radioGroupContract) {
            await test.step(`${expectation.id}, ${state.name}: ${expectation.outcome} (${expectation.sources.join(', ')})`, async () => {
              // Fixture setup resets native selection without navigation or synthetic events.
              // Each expectation still starts from the binding's declared state.
              await subject.group.getByRole('radio').evaluateAll((elements, selected) => {
                for (const [i, element] of elements.entries()) {
                  if (!(element instanceof HTMLInputElement)) throw new Error('Expected native radio fixture');
                  element.checked = i === selected;
                }
              }, subject.selected);
              await assertRadioExpectation(expectation.id, page, subject);
            });
          }
        }
      });
    });
  }
}
