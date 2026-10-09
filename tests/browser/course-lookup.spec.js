import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { strings } from '../../patterns/course-lookup/strings.js';

const faq = page => page.locator('[data-lp-kind="faq"]').first();
const sections = page => page.locator('[data-lp-kind="sections"]').first();
const draft = 'How long do I have to finish the course';

for (const lang of ['en', 'fr']) test(`Add focuses the new question; Remove focuses the next question or input (${lang})`, async ({ page }) => {
  await open(page, { lang }); await scores(page, { none: 1 });
  const root = faq(page), bank = root.locator('[data-lp-bank-list]');
  const first = 'Can I practise with my team', second = 'Can I practise with a colleague';
  await auto(page, first); await root.locator('[data-lp-add]').click();
  await expect(bank.locator('li').last().locator('.lp-course-lookup-q')).toBeFocused();
  await expect(root.locator('[data-lp-add]')).toBeHidden();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([strings[lang].noMatch, strings[lang].added]);
  await auto(page, second); await root.locator('[data-lp-add]').click();
  await expect(bank.locator('li').last().locator('.lp-course-lookup-q')).toBeFocused();
  await bank.getByRole('button').first().click();
  await expect(bank.getByRole('button').first()).toBeFocused();
  await bank.getByRole('button').first().click();
  await expect(root.getByRole('textbox')).toBeFocused();
  await expect(bank.locator('li')).toHaveCount(3);
});

test('lookup failure moves focused controls to the visible fallback', async ({ page }) => {
  await open(page, { mode: 'pending' });
  for (const root of [faq(page), sections(page)]) {
    await auto(page, draft, root);
    await page.evaluate(() => window.lpCalls.at(-1).reject(new Error('Offline')));
    await page.clock.runFor(50);
    await expect(root.locator('[data-lp-fallback] summary, [data-lp-fallback] a').first()).toBeFocused();
    await expect(root.locator('[data-lp-controls]')).toBeHidden();
  }
});

test('an input update moves focus before hiding the focused Add button', async ({ page }) => {
  await open(page); await scores(page, { none: 1 });
  const root = faq(page), input = root.getByRole('textbox'), add = root.locator('[data-lp-add]');
  await auto(page); await add.focus();
  await input.evaluate(element => {
    element.value = 'A revised question about the course';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(input).toBeFocused();
  await expect(add).toBeHidden();
});

test('replacing a focused section link retains focus in the lookup', async ({ page }) => {
  await open(page, { mode: 'pending' });
  const root = sections(page);
  await auto(page, 'How do I refuse extra work', root);
  await page.evaluate(() => window.lpCalls[0].resolve({ boundaries: 1 }));
  await expect(root.locator('[data-lp-result] a')).toBeVisible();
  await auto(page, 'How do I speak up in meetings', root);
  await root.locator('[data-lp-result] a').focus();
  await page.evaluate(() => window.lpCalls[1].resolve({ speaking: 1 }));
  await expect(root.locator('[data-lp-result] a')).toBeFocused();
  await auto(page, 'A question with no matching section', root);
  await root.locator('[data-lp-result] a').focus();
  await page.evaluate(() => window.lpCalls[2].resolve({ none: 1 }));
  await expect(root.getByRole('textbox')).toBeFocused();
});

test('bank capacity and automatic-check cap keep a usable focused control', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lp:course-lookup:en:example-faq-question', JSON.stringify({ questions: Array.from({ length: 100 }, (_, index) => `Saved question ${index}`) }));
  });
  await open(page); await scores(page, { none: 1 });
  const root = faq(page), add = root.locator('[data-lp-add]');
  await auto(page, 'Can I practise with my team'); await add.focus(); await page.keyboard.press('Enter');
  await expect(add).toBeFocused();
  await expect(root.locator('[data-lp-bank-message]')).toHaveText('Your bank is full. Remove a question to add another.');
  for (let index = 1; index < 30; index++) await auto(page, `Another unanswered question ${index}`);
  await expect(root.locator('[data-lp-paused]')).toBeVisible();
  await expect(root.getByRole('textbox')).toBeFocused();
  await add.focus(); await page.keyboard.press('Enter'); await expect(add).toBeFocused();
  await root.getByRole('textbox').focus();
  await root.getByRole('textbox').fill('Manual checking still works after the cap');
  await root.getByRole('textbox').press('Enter');
  expect(await calls(page)).toBe(31);
  await expect(root.getByRole('textbox')).toBeFocused();
});
async function open(page, { mode = 'ok', lang = 'en', two = false } = {}) {
  await page.addInitScript(({ mode }) => {
    window.lpCalls = [];
    window.lpScores = null;
    window.lpAnnouncements = [];
    window.lpLookupAnswer = (block, scores) => {
      const ids = block === '20-faq' ? ['deadline','certificate','time','help','assertive','interruptions','no','timeout'] : ['basics','needs','speaking','boundaries','conflict','practice'];
      scores ??= { [block === '20-faq' ? 'deadline' : 'boundaries']: .9, none: .1 };
      const probabilities = Object.fromEntries([...ids,'none'].map(id => [id, scores[id] ?? 0]));
      const choice = Object.keys(probabilities).sort((a,b) => probabilities[b] - probabilities[a])[0];
      return { lookup: { choice, confidence: 1, probabilities } };
    };
    if (mode === 'missing') window.lpAsk = null;
    else window.lpAsk = async (block, fields, options) => {
      const call = { block, fields, signal: options.signal, slot: !!options.challengeSlot };
      window.lpCalls.push(call);
      if (mode === 'throws') throw new Error('Offline');
      if (mode === 'invalid') return {};
      if (mode === 'pending') return new Promise((resolve, reject) => { call.resolve = scores => resolve(window.lpLookupAnswer(block, scores)); call.reject = reject; });
      return window.lpLookupAnswer(block, window.lpScores);
    };
  }, { mode });
  await page.goto(`/course-lookup/${two ? 'two' : lang}.html`);
  await page.waitForFunction(() => window.lpReady);
  if (mode !== 'missing') await expect(faq(page).locator('[data-lp-controls]')).toBeVisible();
  await page.evaluate(() => {
    for (const status of document.querySelectorAll('[role="status"]')) new MutationObserver(records => {
      for (const record of records) if (record.target.textContent) window.lpAnnouncements.push(record.target.textContent);
    }).observe(status, { childList: true, characterData: true, subtree: true });
  });
  await page.clock.install(); await page.clock.pauseAt(new Date());
}
const calls = page => page.evaluate(() => window.lpCalls.length);
async function auto(page, text = draft, root = faq(page)) {
  await root.getByRole('textbox').fill(text); await page.clock.runFor(700);
}
async function scores(page, value) { await page.evaluate(value => { window.lpScores = value; }, value); }
async function axe(page) {
  await page.clock.resume();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
}

test('default wait, minimum length, changed trimmed text, question mark and Enter', async ({ page }) => {
  await open(page);
  await auto(page, '123456789'); expect(await calls(page)).toBe(0);
  await faq(page).getByRole('textbox').fill(draft);
  await page.clock.runFor(699); expect(await calls(page)).toBe(0);
  await page.clock.runFor(1); expect(await calls(page)).toBe(1);
  await auto(page, ` ${draft} `); expect(await calls(page)).toBe(1);
  await faq(page).getByRole('textbox').fill(`${draft}?`); expect(await calls(page)).toBe(2);
  await faq(page).getByRole('textbox').fill('How many hours does this take');
  await faq(page).getByRole('textbox').press('Enter'); expect(await calls(page)).toBe(3);
  expect(await page.evaluate(() => window.lpCalls[0].fields)).toEqual({ question: draft });
});

test('actual keystrokes adapt the wait and composing text waits for completion', async ({ page }) => {
  await open(page);
  const input = faq(page).getByRole('textbox');
  await input.fill(draft);
  for (const key of ['a','b','c','d']) { await input.press(key); if (key !== 'd') await page.clock.runFor(200); }
  await page.clock.runFor(499); expect(await calls(page)).toBe(0);
  await page.clock.runFor(1); expect(await calls(page)).toBe(1);
  await input.fill('A different question');
  await input.dispatchEvent('compositionstart');
  await input.dispatchEvent('input', { isComposing: true });
  await page.clock.runFor(1000);
  // Composition must not start checks on unfinished text.
  expect(await calls(page)).toBe(1);
  await input.dispatchEvent('compositionend');
  await page.clock.runFor(900); expect(await calls(page)).toBe(2);
});

test('Looking appears only after 300 ms; edits abort requests and stale responses cannot update', async ({ page }) => {
  await open(page, { mode: 'pending' }); await auto(page);
  const root = faq(page);
  await expect(root.locator('[data-lp-checking]')).toBeHidden();
  await page.clock.runFor(299); await expect(root.locator('[data-lp-checking]')).toBeHidden();
  await page.clock.runFor(1); await expect(root.locator('[data-lp-checking]')).toHaveText('Looking…');
  await expect(root.locator('[data-lp-checking]')).toBeVisible();
  await auto(page, 'Will I get a certificate');
  expect(await page.evaluate(() => window.lpCalls.map(call => call.signal.aborted))).toEqual([true,false]);
  await page.evaluate(() => { window.lpCalls[1].resolve({ certificate: .9, none: .1 }); window.lpCalls[0].resolve({ deadline: .9, none: .1 }); });
  await expect(root.locator('[data-lp-result]')).toContainText('Will I get a certificate?');
  await expect(root.locator('[data-lp-checking]')).toBeHidden();
  await auto(page, 'First newer question'); await auto(page, 'Second newer question');
  await page.evaluate(() => { window.lpCalls[2].reject(new Error('Stale error')); });
  await expect(root.locator('[data-lp-fallback]')).toBeHidden();
  await page.evaluate(() => { window.lpCalls[3].resolve({ none: 1 }); });
  await expect(root.locator('[data-lp-result]')).toHaveText('No answer yet');
});

for (const lang of ['en','fr']) test(`one announcement per changed match, two matches and silent no-match (${lang})`, async ({ page }) => {
  await open(page, { lang }); await auto(page);
  const root = faq(page);
  const firstTitle = await root.locator('[data-lp-result] h3 > span').textContent();
  expect(await page.evaluate(() => window.lpAnnouncements)).toEqual([strings[lang].found.replace('{title}',firstTitle)]);
  await auto(page, 'Another phrasing of the same question');
  expect(await page.evaluate(() => window.lpAnnouncements.length)).toBe(1);
  await scores(page, { deadline: .5, time: .4, none: .1 }); await auto(page, 'Course deadline and total time');
  await expect(root.locator('[data-lp-result] article')).toHaveCount(2);
  expect(await page.evaluate(() => window.lpAnnouncements.length)).toBe(2);
  await scores(page, { deadline: .34, time: .33, none: .33 }); await auto(page, 'A question below the gate');
  await expect(root.locator('[data-lp-result]')).toHaveText(strings[lang].noMatch);
  await expect(root.locator('[data-lp-add]')).toBeVisible();
  await auto(page, 'Another unanswered question');
  expect(await page.evaluate(() => window.lpAnnouncements.length)).toBe(3);
  await expect(root.locator('[data-lp-result]')).toHaveAttribute('aria-live','off');
  await expect(root.getByRole('textbox')).toBeFocused();
  await axe(page);
});

test('30 automatic checks are shared; Enter works beyond the cap and after re-enhancement', async ({ page }) => {
  await open(page, { two: true });
  for (let index=0; index<30; index++) await auto(page, `A course question ${index}`, index % 2 ? sections(page) : faq(page));
  expect(await calls(page)).toBe(30);
  await auto(page, 'Automatic checks have stopped'); expect(await calls(page)).toBe(30);
  await faq(page).getByRole('textbox').press('Enter'); expect(await calls(page)).toBe(31);
  await page.evaluate(() => { window.lpInstances[0].destroy(); window.lpEnhance(); });
  await expect(faq(page).locator('[data-lp-paused]')).toBeVisible();
  await auto(page, 'Still no automatic check'); expect(await calls(page)).toBe(31);
  await faq(page).getByRole('textbox').press('Enter'); expect(await calls(page)).toBe(32);
  const ids = await page.locator('[id]').evaluateAll(elements => elements.map(el => el.id));
  expect(new Set(ids).size).toBe(ids.length);
});

test('browser bank adds, deduplicates, removes and persists separately from the seeds and other instances', async ({ page }) => {
  await open(page); await scores(page, { none:1 });
  const root=faq(page), bank=root.locator('[data-lp-bank-list]');
  await expect(bank.locator('li')).toHaveCount(3);
  await expect(bank.locator('li').filter({hasText:'Instructor'})).toHaveCount(2);
  await expect(bank.locator('li').filter({hasText:'Another learner'})).toHaveCount(1);
  const question = 'Can I practise with my team';
  await auto(page, question); await root.locator('[data-lp-add]').click();
  await expect(bank.locator('li')).toHaveCount(4);
  await expect(bank).toContainText('Waiting for an answer');
  await expect(root.locator('[data-lp-add]')).toBeHidden();
  await expect(sections(page).locator('[data-lp-bank-list] li')).toHaveCount(3);
  await page.reload(); await page.waitForFunction(() => window.lpReady);
  await expect(bank.locator('li')).toHaveCount(4);
  await bank.getByRole('button').click();
  await expect(bank.locator('li')).toHaveCount(3);
  await page.reload(); await page.waitForFunction(() => window.lpReady);
  await expect(bank.locator('li')).toHaveCount(3);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lp:course-lookup:en:example-faq-question')))).toEqual({questions:[]});
});

test('bank storage failures preserve the previous bank and report the failed change', async ({ page }) => {
  await open(page); await scores(page,{none:1}); await auto(page,'Can I practise with my team');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Quota'); }; });
  await faq(page).locator('[data-lp-add]').focus();
  await page.keyboard.press('Enter');
  await expect(faq(page).locator('[data-lp-bank-message]')).toHaveText(strings.en.storageError);
  await expect(faq(page).locator('[data-lp-bank-list] li')).toHaveCount(3);
  await expect(faq(page).locator('[data-lp-add]')).toBeVisible();
  await expect(faq(page).locator('[data-lp-add]')).toBeFocused();
});

test('section results reveal and link to the authored outline without moving focus on update', async ({ page }) => {
  await open(page); await auto(page,'How do I refuse extra work',sections(page));
  const root=sections(page), link=root.locator('[data-lp-result] a');
  await expect(link).toHaveText('Set boundaries');
  await expect(link).toHaveAttribute('href','#example-sections-section-boundaries');
  await expect(root.getByRole('textbox')).toBeFocused();
  await link.click(); await expect(root.locator('[data-lp-fallback]')).toBeVisible();
  await expect(page.locator('#example-sections-section-boundaries')).toBeVisible();
  await axe(page);
});

for (const mode of ['missing','throws','invalid']) test(`failed lookup exposes full FAQ and outline (${mode})`,async ({page})=>{
  await open(page,{mode});
  if(mode!=='missing') {await auto(page); await auto(page,'How do I refuse extra work',sections(page)); await page.clock.runFor(50);}
  for(const root of [faq(page),sections(page)]) {
    await expect(root.locator('[data-lp-controls]')).toBeHidden();
    await expect(root.locator('[data-lp-fallback]')).toBeVisible();
    await expect(root.locator('[data-lp-fallback-message]')).toHaveText(strings.en.fallback);
  }
  await expect(faq(page).locator('details')).toHaveCount(8);
  await faq(page).locator('summary').first().click();
  await expect(faq(page).locator('details').first()).toHaveAttribute('open','');
  await expect(sections(page).locator('[data-lp-fallback] a')).toHaveCount(6);
  await axe(page);
});

test('no-JS page includes eight readable FAQ answers and six outline anchors',async ({browser,baseURL})=>{
  const context=await browser.newContext({javaScriptEnabled:false,baseURL}); const page=await context.newPage();
  await page.goto('/course-lookup/en.html');
  await expect(faq(page).locator('details')).toHaveCount(8);
  await faq(page).locator('summary').first().click();
  await expect(faq(page).locator('details').first()).toContainText('eight weeks');
  await expect(sections(page).locator('[data-lp-fallback] a')).toHaveCount(6);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  // axe needs page scripts. The same fallback receives axe checks with scripts enabled.
  await context.close();
});

test('destroy cancels requests and restores exactly the rendered DOM; re-enhance is idempotent',async ({page})=>{
  await open(page,{mode:'pending'}); await auto(page);
  const expected = await page.evaluate(async()=>{
    const source=await (await fetch(location.href)).text();
    return new DOMParser().parseFromString(source,'text/html').querySelector('[data-lp-kind="faq"]').innerHTML;
  });
  await page.evaluate(()=>{window.lpInstances[0].destroy(); window.lpCalls[0].resolve({none:1});});
  expect(await faq(page).innerHTML()).toBe(expected);
  expect(await page.evaluate(()=>window.lpCalls[0].signal.aborted)).toBe(true);
  await page.evaluate(()=>{window.lpRe=window.lpEnhance(); window.lpSame=window.lpRe===window.lpEnhance();});
  expect(await page.evaluate(()=>window.lpSame)).toBe(true);
  await expect(faq(page).locator('[data-lp-controls]')).toBeVisible();
});

test('keyboard, narrow layout, text spacing, forced colours and reduced motion',async ({page})=>{
  await open(page,{lang:'fr'}); await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});
  await page.addStyleTag({content:'*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}'});
  await faq(page).getByRole('textbox').focus(); await faq(page).getByRole('textbox').fill('Comment puis-je obtenir une attestation');
  await faq(page).getByRole('textbox').press('Enter');
  await expect(faq(page).locator('[data-lp-result]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await axe(page);
});

test('visual evidence at wide and narrow widths', async ({browser,baseURL},testInfo)=>{
  const folder=process.env.LP_LOOKUP_EVIDENCE_DIR;
  test.skip(!folder || testInfo.project.name!=='chromium','Evidence path supplied for Chromium only');
  await mkdir(folder,{recursive:true});
  for(const width of [1280,390]){
    const context=await browser.newContext({baseURL,viewport:{width,height:900}});
    const page=await context.newPage(); await open(page);
    await auto(page); await page.clock.resume(); await page.evaluate(()=>document.fonts.ready);
    await faq(page).screenshot({path:join(folder,`lookup-faq-match-${width}.png`)});
    await scores(page,{deadline:.5,time:.4,none:.1}); await auto(page,'Course deadline and time');
    await faq(page).screenshot({path:join(folder,`lookup-faq-two-${width}.png`)});
    await scores(page,{none:1}); await auto(page,'Can I practise with my team');
    await faq(page).screenshot({path:join(folder,`lookup-no-match-${width}.png`)});
    await faq(page).locator('[data-lp-add]').click();
    await faq(page).locator('[data-lp-bank]').screenshot({path:join(folder,`lookup-bank-${width}.png`)});
    await scores(page,{boundaries:.9,none:.1}); await auto(page,'How do I refuse extra work',sections(page));
    await sections(page).screenshot({path:join(folder,`lookup-section-match-${width}.png`)});
    await page.evaluate(()=>{window.lpInstances.forEach(instance=>instance.destroy());});
    await faq(page).locator('summary').first().click();
    await page.screenshot({path:join(folder,`lookup-fallback-${width}.png`),fullPage:true});
    await context.close();
  }
});
