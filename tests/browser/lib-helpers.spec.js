import { test, expect } from '@playwright/test';

async function fixture(page, markup) {
  await page.route('**/lib-helpers-fixture.html', route => route.fulfill({
    contentType: 'text/html; charset=utf-8', body: `<!doctype html><html lang="fr-CA"><title>Library helpers</title><body>${markup}</body></html>`
  }));
  await page.goto('/lib-helpers-fixture.html');
}

test('answer rows mark, replace and clear with escaped localized words', async ({ page }) => {
  await fixture(page, '<section lang="fr-CA"><label id="row"><input type="radio"><span>Answer</span><span class="lp-choice-mark" hidden></span></label></section>');
  for (const [kind, tone, word, iconPath] of [
    ['correct', 'lp-met', 'Oui\u202f!', 'M5 12l5 5l10 -10'],
    ['wrong', 'lp-missed', '<b>Non</b>', 'M18 6l-12 12'],
    ['missed', 'lp-neutral', 'Bonne réponse', null]
  ]) {
    await page.evaluate(async kind => {
      const { markChoice } = await import('/lib/choice-mark.js');
      const root = document.querySelector('section');
      markChoice(document.querySelector('#row'), kind,
        { markCorrect: 'Oui !', markWrong: '<b>Non</b>', markAnswer: 'Bonne réponse' }, root.lang);
    }, kind);
    const row = page.locator('#row'), mark = row.locator('.lp-choice-mark');
    await expect(row).toHaveAttribute('data-lp-mark', kind);
    await expect(mark).toHaveCount(1);
    await expect(mark).toBeVisible();
    await expect(mark).toHaveClass(`lp-choice-mark ${tone}`);
    await expect(mark).toHaveText(word);
    await expect(mark.locator('b')).toHaveCount(0);
    await expect(mark.locator('svg[aria-hidden="true"][focusable="false"]')).toHaveCount(1);
    if (iconPath) await expect(mark.locator(`path[d="${iconPath}"]`)).toHaveCount(1);
  }
  expect(await page.evaluate(async () => {
    const { markChoice } = await import('/lib/choice-mark.js');
    try { markChoice(document.querySelector('#row'), 'unknown', {}); }
    catch (error) { return error instanceof RangeError; }
    return false;
  })).toBe(true);
  await expect(page.locator('#row')).toHaveAttribute('data-lp-mark', 'missed');
  await page.evaluate(async () => {
    const { clearChoice } = await import('/lib/choice-mark.js');
    for (let n = 0; n < 2; n++) clearChoice(document.querySelector('#row'));
  });
  await expect(page.locator('#row')).not.toHaveAttribute('data-lp-mark');
  await expect(page.locator('#row .lp-choice-mark')).toHaveCount(0);
  await expect(page.locator('#row input')).toHaveCount(1);
  await page.evaluate(async () => {
    const { markChoice } = await import('/lib/choice-mark.js');
    markChoice(document.querySelector('#row'), 'correct', { markCorrect: 'Correct' });
  });
  await expect(page.locator('#row .lp-choice-mark')).toHaveCount(1);
  await expect(page.locator('#row')).toHaveAttribute('data-lp-mark', 'correct');
});

test('lock preserves values, keeps authored controls usable and restores exact prior states', async ({ page }) => {
  await fixture(page, `<section id="scope">
    <textarea id="draft">A draft</textarea><textarea id="readonly" readonly disabled hidden>Saved</textarea>
    ${['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'month', 'week', 'time', 'datetime-local'].map(type => `<input id="${type}" type="${type}">`).join('')}
    <input id="default"><input id="invalid" type="not-a-type">
    <input id="radio" type="radio" checked><input id="checkbox" type="checkbox" disabled>
    <input id="range" type="range"><input id="color" type="color"><input id="file" type="file">
    <input id="submit" type="submit"><input id="reset" type="reset"><input id="hidden" type="hidden">
    <select id="select"><option selected>One</option></select>
    <button id="outside">Outside actions</button>
    <div class="lp-actions"><button id="action">Check</button><button id="already" disabled hidden>Hidden</button>
      <input id="action-input" type="submit" value="Submit">
      <button id="retry" data-lp-try-again>Réessayer</button>
      <button id="kept-button" data-lp-keep>Keep</button>
    </div>
    <div data-lp-keep><textarea id="kept-text">Keep draft</textarea><input id="kept-radio" type="radio"><select id="kept-select"><option>Keep</option></select><div class="lp-actions"><button id="kept-action">Kept action</button></div></div>
  </section><button id="other-scope">Other scope</button>`);
  const states = () => page.locator('input, textarea, select, button').evaluateAll(controls => controls.map(control => ({
    id: control.id, disabled: control.disabled, hidden: control.hidden, readOnly: control.readOnly ?? null,
    value: control.value, checked: control.checked ?? null
  })));
  const before = await states();
  await page.evaluate(async () => {
    const { lock } = await import('/lib/lock.js');
    window.unlockFixture = lock(document.querySelector('#scope'));
  });
  const locked = await states();
  expect(locked.filter(control => control.readOnly).map(control => control.id)).toEqual([
    'draft', 'readonly', 'text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'month', 'week', 'time', 'datetime-local', 'default', 'invalid'
  ]);
  expect(locked.filter(control => control.disabled).map(control => control.id)).toEqual([
    'readonly', 'radio', 'checkbox', 'range', 'color', 'file', 'submit', 'reset', 'hidden', 'select', 'outside', 'action', 'already', 'action-input'
  ]);
  expect(locked.filter(control => control.hidden).map(control => control.id)).toEqual(['readonly', 'action', 'already', 'action-input']);
  for (const id of ['retry', 'kept-button', 'kept-text', 'kept-radio', 'kept-select', 'kept-action', 'other-scope']) {
    expect(locked.find(control => control.id === id)).toEqual(before.find(control => control.id === id));
  }
  expect(locked.map(({ value, checked }) => ({ value, checked }))).toEqual(before.map(({ value, checked }) => ({ value, checked })));
  await expect(page.locator('#retry')).toHaveText('Réessayer');
  await expect(page.locator('button')).toHaveCount(7);
  await page.evaluate(() => window.unlockFixture());
  expect(await states()).toEqual(before);
  await page.locator('#draft').fill('Revised');
  await page.locator('#action').click();
});

test('lock moves focus to the visible enabled Try again before disabling or hiding Check', async ({ page }) => {
  await fixture(page, `<button data-lp-try-again>Other scope</button><section id="scope">
    <div hidden><button data-lp-try-again>Hidden</button></div>
    <button data-lp-try-again disabled>Disabled</button>
    <button data-lp-try-again style="visibility: hidden">Invisible</button>
    <div inert><button data-lp-try-again>Inert</button></div>
    <div class="lp-actions"><button id="action">Check</button><button id="retry" data-lp-try-again hidden>Try again</button></div>
  </section>`);
  const immediate = await page.evaluate(async () => {
    const { lock } = await import('/lib/lock.js');
    const action = document.querySelector('#action'), retry = document.querySelector('#retry');
    action.focus();
    retry.hidden = false;
    retry.addEventListener('focus', () => {
      window.actionAtFocus = { disabled: action.disabled, hidden: action.hidden };
    }, { once: true });
    window.unlockFixture = lock(document.querySelector('#scope'));
    return { focused: document.activeElement.id, disabled: action.disabled, hidden: action.hidden };
  });
  expect(immediate).toEqual({ focused: 'action', disabled: false, hidden: false });
  await expect(page.locator('#retry')).toBeFocused();
  expect(await page.evaluate(() => window.actionAtFocus)).toEqual({ disabled: false, hidden: false });
  await expect(page.locator('#action')).toBeDisabled();
  await expect(page.locator('#action')).toBeHidden();
  await page.evaluate(() => window.unlockFixture());
  await expect(page.locator('#action')).toBeEnabled();
  await expect(page.locator('#action')).toBeVisible();
});

for (const fallback of ['draft', 'scope']) {
  test(`lock falls back to ${fallback} when no usable Try again exists`, async ({ page }) => {
    await fixture(page, `<section id="scope">
      <button data-lp-try-again hidden>Hidden</button><button data-lp-try-again disabled>Disabled</button>
      ${fallback === 'draft' ? '<textarea id="draft">Draft</textarea>' : ''}
      <div class="lp-actions"><button id="action">Check</button></div>
    </section>`);
    await page.evaluate(async fallback => {
      const { lock } = await import('/lib/lock.js');
      const action = document.querySelector('#action');
      document.getElementById(fallback).addEventListener('focus', () => {
        window.actionAtFocus = { disabled: action.disabled, hidden: action.hidden };
      }, { once: true });
      action.focus();
      window.unlockFixture = lock(document.querySelector('#scope'));
    }, fallback);
    await expect(page.locator(`#${fallback}`)).toBeFocused();
    expect(await page.evaluate(() => window.actionAtFocus)).toEqual({ disabled: false, hidden: false });
    await expect(page.locator('#action')).toBeDisabled();
    await expect(page.locator('#action')).toBeHidden();
    if (fallback === 'draft') await expect(page.locator('#draft')).toHaveJSProperty('readOnly', true);
    else await expect(page.locator('#scope')).toHaveAttribute('tabindex', '-1');
    await page.evaluate(() => window.unlockFixture());
    await expect(page.locator('#scope')).not.toHaveAttribute('tabindex');
  });
}

test('lock leaves focus on typed, kept and out-of-scope controls', async ({ page }) => {
  await fixture(page, `<section id="scope"><textarea id="draft">Draft</textarea><input id="text">
    <button id="kept" data-lp-keep>Keep</button><button id="retry" data-lp-try-again>Try again</button>
    <div class="lp-actions"><button>Check</button></div></section><button id="other-scope">Other</button>`);
  for (const id of ['draft', 'text', 'kept', 'retry', 'other-scope']) {
    await page.evaluate(async id => {
      const { lock } = await import('/lib/lock.js');
      document.getElementById(id).focus();
      window.unlockFixture = lock(document.querySelector('#scope'));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, id);
    await expect(page.locator(`#${id}`)).toBeFocused();
    await page.evaluate(() => window.unlockFixture());
  }
});

for (const afterFrame of [false, true]) {
  test(`unlock cancels pending focus and restores states (${afterFrame ? 'after first frame' : 'immediately'})`, async ({ page }) => {
    await fixture(page, `<section id="scope"><input id="readonly" readonly><input id="disabled" type="radio" disabled>
      <div class="lp-actions"><button id="already" hidden disabled>Hidden</button><button id="action">Check</button></div></section>`);
    const result = await page.evaluate(async afterFrame => {
      const { lock } = await import('/lib/lock.js');
      const scope = document.querySelector('#scope'), action = document.querySelector('#action');
      const states = () => [...scope.querySelectorAll('input, button')].map(control => ({
        id: control.id, readOnly: control.readOnly ?? null, disabled: control.disabled, hidden: control.hidden
      }));
      const before = states();
      action.focus();
      const unlock = lock(scope);
      if (afterFrame) await new Promise(requestAnimationFrame);
      unlock();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { before, after: states(), focused: document.activeElement.id, tabindex: scope.getAttribute('tabindex') };
    }, afterFrame);
    expect(result.after).toEqual(result.before);
    expect(result.focused).toBe('action');
    expect(result.tabindex).toBe(null);
  });
}

test('lock ignores keep, Try again and actions ancestors outside its scope', async ({ page }) => {
  await fixture(page, `<div data-lp-keep data-lp-try-again class="lp-actions"><section id="scope">
    <input id="text"><input id="radio" type="radio"><button id="button">Outside local actions</button>
    <div class="lp-actions"><button id="action">Check</button></div>
    <div data-lp-keep><button id="kept">Keep</button></div><button id="retry" data-lp-try-again>Try again</button>
  </section></div>`);
  await page.evaluate(async () => {
    const { lock } = await import('/lib/lock.js');
    window.unlockFixture = lock(document.querySelector('#scope'));
  });
  await expect(page.locator('#text')).toHaveJSProperty('readOnly', true);
  for (const id of ['radio', 'button', 'action']) await expect(page.locator(`#${id}`)).toBeDisabled();
  await expect(page.locator('#button')).toBeVisible();
  await expect(page.locator('#action')).toBeHidden();
  for (const id of ['kept', 'retry']) {
    await expect(page.locator(`#${id}`)).toBeEnabled();
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await page.evaluate(() => window.unlockFixture());
  for (const id of ['radio', 'button', 'action']) await expect(page.locator(`#${id}`)).toBeEnabled();
  await expect(page.locator('#action')).toBeVisible();
});

test('reveal keeps visible content and focus still', async ({ page }) => {
  await fixture(page, '<button id="start">Start</button><p id="feedback" hidden>Feedback</p>');
  await page.locator('#start').focus();
  const result = await page.evaluate(async () => {
    const { reveal } = await import('/lib/reveal.js');
    const feedback = document.querySelector('#feedback');
    let scrolls = 0;
    feedback.scrollIntoView = () => { scrolls++; };
    reveal(feedback);
    return { scrolls, tabindex: feedback.getAttribute('tabindex') };
  });
  expect(result).toEqual({ scrolls: 0, tabindex: null });
  await expect(page.locator('#feedback')).toBeVisible();
  await expect(page.locator('#start')).toBeFocused();
});

for (const [motion, behavior] of [['reduce', 'instant'], ['no-preference', 'smooth']]) {
  test(`reveal scrolls partially obscured feedback with nearest alignment (${motion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: motion });
    await page.setViewportSize({ width: 800, height: 600 });
    await fixture(page, '<style>html { scroll-padding-top: 80px; } #feedback { position: fixed; margin: 0; height: 40px; width: 100px; }</style><p id="feedback" hidden>Feedback</p>');
    const calls = await page.evaluate(async () => {
      const { reveal } = await import('/lib/reveal.js');
      const feedback = document.querySelector('#feedback'), calls = [];
      feedback.scrollIntoView = options => calls.push(options);
      // Top is behind scroll padding; bottom and horizontal edges are partly off screen.
      for (const position of [{ top: '60px', left: '100px' }, { top: '580px', left: '100px' }, { top: '100px', left: '-20px' }, { top: '100px', left: '780px' }]) {
        Object.assign(feedback.style, position);
        feedback.hidden = true;
        reveal(feedback);
        if (feedback.hidden) throw new Error('Feedback stayed hidden');
      }
      return calls;
    });
    expect(calls).toEqual(Array.from({ length: 4 }, () => ({ block: 'nearest', behavior })));
  });
}

test('reduced-motion reveal actually scrolls feedback into view', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 800, height: 600 });
  await fixture(page, '<style>html { scroll-padding-top: 80px; scroll-behavior: smooth; } body { margin: 0; } #space { height: 1600px; } #feedback { margin: 0; height: 80px; }</style><div id="space"></div><p id="feedback" hidden>Feedback</p>');
  await page.evaluate(async () => {
    const { reveal } = await import('/lib/reveal.js');
    reveal(document.querySelector('#feedback'));
  });
  await expect(page.locator('#feedback')).toBeInViewport({ ratio: 1 });
  expect(await page.locator('#feedback').evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(79);
});
