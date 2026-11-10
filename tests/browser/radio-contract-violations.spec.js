import { test, expect } from '@playwright/test';
import { radioGroupContract } from './contracts/radio-group.js';
import { assertRadioExpectation } from './contracts/radio-group-runner.js';

// Like the patterns: the input is invisible and its label draws the focus ring.
const fixture = `<style>input { opacity: 0 } label:has(input:focus-visible) { outline: 3px solid blue; outline-offset: 2px }</style>
<fieldset><legend>Delivery</legend>
<label><input type="radio" name="delivery" value="standard">Standard</label>
<label><input type="radio" name="delivery" value="express">Express</label></fieldset>`;

const violations = {
  'group-name': { error: /toHaveAccessibleName/, plant: () => document.querySelector('legend').remove() },
  'radio-names': { error: /toHaveCount/, plant: () => document.querySelector('input').type = 'checkbox' },
  'checked': { error: /toHaveCount/, plant: () => {
    const first = document.querySelector('input');
    first.outerHTML = '<span role="radio" aria-label="Standard"></span>';
  } },
  'tab': { error: /toBeFocused/, plant: () => {
    document.querySelector('fieldset').addEventListener('keydown', event => {
      if (event.key === 'Tab') event.preventDefault();
    });
  } },
  'arrows': { error: /toBeFocused/, plant: () => {
    document.querySelector('fieldset').addEventListener('keydown', event => {
      if (event.key.startsWith('Arrow')) event.preventDefault();
    });
  } },
  'space': { error: /toHaveCount/, plant: () => {
    document.querySelector('fieldset').addEventListener('keydown', event => {
      if (event.code === 'Space') event.preventDefault();
    });
  } },
  'stable-names': { error: /toHaveAccessibleName/, plant: () => {
    document.querySelector('fieldset').addEventListener('change', event => event.target.setAttribute('aria-label', 'Changed'));
  } },
  'focus': { error: /visible 3px keyboard focus outline/, plant: () => {
    const style = document.createElement('style');
    style.textContent = 'label:has(input:focus-visible) { outline: none !important }';
    document.head.append(style);
  } }
};

for (const expectation of radioGroupContract) {
  test(`${expectation.id}: conforming control passes, planted violation fails`, async ({ page }) => {
    await page.setContent(fixture);
    const subject = { group: page.getByRole('group'), legend: 'Delivery', names: ['Standard', 'Express'], selected: null };
    await assertRadioExpectation(expectation.id, page, subject);
    await page.setContent(fixture);
    // A missing checked state must fail even when selection is promised by a binding.
    if (expectation.id === 'checked') subject.selected = 0;
    const violation = violations[expectation.id];
    await page.evaluate(violation.plant);
    await expect(assertRadioExpectation(expectation.id, page, subject)).rejects.toThrow(violation.error);
  });
}

test('focus rejects an outline that shows without focus', async ({ page }) => {
  await page.setContent(fixture);
  await page.addStyleTag({ content: 'label { outline: 3px solid blue }' });
  await expect(assertRadioExpectation('focus', page, {
    group: page.getByRole('group'), legend: 'Delivery', names: ['Standard', 'Express'], selected: null
  })).rejects.toThrow(/only while focused/);
});

test('focus rejects a group with no radios rather than passing an empty loop', async ({ page }) => {
  await page.setContent('<fieldset><legend>Delivery</legend></fieldset>');
  await expect(assertRadioExpectation('focus', page, {
    group: page.getByRole('group'), legend: 'Delivery', names: ['Standard', 'Express'], selected: null
  })).rejects.toThrow(/toHaveCount/);
});
