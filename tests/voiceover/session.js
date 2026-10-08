// Web-content entry follows Guidepup's MIT Playwright fixture at d5c9d805.
import { voiceOver, macOSActivate, MacOSKeyCodes, voiceOverKeyCodeCommands } from '@guidepup/guidepup';
import { appendFile, writeFile } from 'node:fs/promises';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function startSession(page, info) {
  const rows = [];
  await voiceOver.start({ capture: true, retries: 3 });
  await writeFile(info.outputPath('settings.json'), JSON.stringify(await voiceOver.getSettings(), null, 2));

  async function state() {
    return page.evaluate(() => {
      const el = document.activeElement;
      return {
        hasFocus: document.hasFocus(), lang: document.documentElement.lang,
        active: { tag: el.tagName, id: el.id, text: el.innerText ?? '', name: el.getAttribute('aria-label'), value: el.value, checked: el.checked, pressed: el.getAttribute('aria-pressed'), selected: el.getAttribute('aria-selected') },
        statuses: [...document.querySelectorAll('[role="status"]')].map(el => el.textContent),
        mutations: window.voStatusChanges ?? [], keys: (window.voKeys ?? []).slice(-20)
      };
    });
  }
  async function step(label, action, capture = true) {
    const before = await state(), begin = new Date().toISOString();
    await voiceOver.clearSpokenPhraseLog();
    await voiceOver.clearItemTextLog();
    let error;
    try { await action(capture); } catch (e) { error = e; }
    const row = { step: label, begin, end: new Date().toISOString(), before, after: await state(), speech: await voiceOver.spokenPhraseLog(), cursor: await voiceOver.itemTextLog(), error: error?.stack };
    rows.push(row);
    await appendFile(info.outputPath('steps.jsonl'), JSON.stringify(row) + '\n');
    await appendFile(info.outputPath('spoken-phrases.txt'), `${label}\n${JSON.stringify(row.speech)}\n`);
    console.log(`${info.title}: ${label}: ${JSON.stringify(row.speech)}`);
    if (error) throw error;
    return row;
  }
  const key = (key, label = key, capture = true) => step(label, c => voiceOver.press(key, { capture: c, application: 'Playwright' }), capture);
  const next = (label, capture = 'initial') => step(label, c => voiceOver.next({ capture: c }), capture);
  const previous = label => step(label, c => voiceOver.previous({ capture: c }), 'initial');

  async function enter(label = 'Arrival heading', capture = true) {
    await macOSActivate('Playwright');
    await voiceOver.press('Control', { capture: false });
    await page.bringToFront();
    await page.evaluate(() => {
      const marker = document.createElement('input');
      marker.id = '__guidepup_marker__'; marker.value = 'Guidepup Marker'; marker.readOnly = true; marker.tabIndex = -1;
      marker.setAttribute('aria-label', 'Guidepup Marker');
      marker.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
      document.body.prepend(marker);
    });
    try {
      await voiceOver.perform(voiceOverKeyCodeCommands.openItemChooser, { capture: false });
      await pause(500);
      await voiceOver.type('web content', { capture: false });
      await voiceOver.press('Enter', { capture: false });
      await pause(100);
      await voiceOver.interact({ capture: false });
      await voiceOver.perform(voiceOverKeyCodeCommands.moveToBeginningOfText, { capture: false });
      await voiceOver.perform({ keyCode: MacOSKeyCodes.Control }, { capture: false });
      await pause(100);
      await voiceOver.perform(voiceOverKeyCodeCommands.moveToBeginningOfText, { capture: false });
      await next(label, capture);
    } finally {
      await page.evaluate(() => document.querySelector('#__guidepup_marker__')?.remove());
    }
  }
  async function observe() {
    await page.evaluate(() => {
      window.voStatusChanges = [];
      window.voKeys = [];
      document.addEventListener('keydown', event => window.voKeys.push({ key: event.key, code: event.code, ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, meta: event.metaKey, trusted: event.isTrusted }), true);
      for (const el of document.querySelectorAll('[role="status"]')) new MutationObserver(() => window.voStatusChanges.push({ at: new Date().toISOString(), text: el.textContent })).observe(el, { childList: true, characterData: true, subtree: true });
    });
  }
  async function seek(selector, label) {
    const target = page.locator(selector).first();
    if (!await target.isVisible()) throw new Error(`Journey target not visible: ${selector}`);
    for (let i = 0; i < 4; i++) {
      if (await target.evaluate(el => el === document.activeElement)) return;
      const backwards = await target.evaluate(el => document.activeElement !== document.body && Boolean(el.compareDocumentPosition(document.activeElement) & Node.DOCUMENT_POSITION_FOLLOWING));
      await key(backwards ? 'Shift+Tab' : 'Tab', `${label}: ${backwards ? 'Shift+Tab' : 'Tab'} ${i + 1}`, 'initial');
    }
    if (await target.evaluate(el => el === document.activeElement)) return;
    // WebKit's default Tab policy skips some buttons. VO navigation reaches them.
    await enter(`${label}: VO beginning`, 'initial');
    for (let i = 0; i < 100; i++) {
      await next(`${label}: VO+Right ${i + 1}`);
      if (await target.evaluate(el => el === document.activeElement)) return;
    }
    throw new Error(`Keyboard could not reach ${selector}`);
  }
  const activate = async (selector, label, press = 'Enter') => { await seek(selector, label); return key(press, label); };
  const type = (text, label) => step(label, () => voiceOver.type(text, { capture: 'initial', application: 'Playwright' }));
  async function snapshot(label) {
    await writeFile(info.outputPath(`${label}.html`), await page.content());
    await writeFile(info.outputPath(`${label}-aria.txt`), await page.locator('body').ariaSnapshot());
    await page.screenshot({ path: info.outputPath(`${label}.png`), fullPage: true });
  }
  // Explicit rereads are separate steps; they are not spontaneous duplicate announcements.
  async function read(label, limit = 70) {
    await enter(`${label}: beginning`, 'initial');
    for (let i = 0; i < limit; i++) {
      const row = await next(`${label}: VO+Right ${i + 1}`);
      if (row.cursor.some(text => /end of web content|bottom of web content/i.test(text)) || row.speech.some(text => /end of web content|bottom of web content/i.test(text))) break;
      if (i > 1 && JSON.stringify(row.cursor) === JSON.stringify(rows.at(-2)?.cursor)) break;
    }
  }
  return { rows, step, key, next, previous, enter, observe, seek, activate, type, snapshot, read, state,
    stop: async () => { await writeFile(info.outputPath('final-state.json'), JSON.stringify(await state(), null, 2)); await voiceOver.stop(); }
  };
}
