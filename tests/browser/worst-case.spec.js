import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Layout under worst-case content: long names, pasted file names and URLs, long titles and French
// marks at 320px, where the card is narrowest.
const example = async (name, lang = 'en') => JSON.parse(await readFile(new URL(`../../patterns/${name}/examples/${lang}.json`, import.meta.url)));
const token = 'Q3-Client-Report_Northwind_Industries_Holdings_FINAL_v12_approved-by-legal.xlsx';

// Replace the demo with this content through the public render/enhance interface, with optional saved state.
async function mount(page, name, content, { lang = 'en', state, enhance = true, width = 320 } = {}) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/${name}/${lang}.html`);
  await page.waitForFunction(() => window.lpReady);
  await page.evaluate(async ({ name, content, lang, state, enhance }) => {
    const { render } = await import(`/patterns/${name}/render.js`);
    const { strings } = await import(`/patterns/${name}/strings.js`);
    window.lpInstances.forEach(instance => instance.destroy());
    document.querySelector('main').innerHTML = render(content, strings[lang], { id: 'worst', lang });
    if (!enhance) return;
    const module = await import(`/patterns/${name}/enhance.js`);
    module.enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings[lang], state: { read: () => state, write: () => {} } });
  }, { name, content, lang, state, enhance });
  await page.evaluate(() => document.fonts.ready);
}

const overflow = page => page.evaluate(() => {
  const card = document.querySelector('[data-lp-pattern]').getBoundingClientRect();
  return { page: document.documentElement.scrollWidth - innerWidth, card: Math.max(...[...document.querySelectorAll('[data-lp-pattern] *')].filter(el => el.getClientRects().length && !el.closest('.lp-visually-hidden')).map(el => el.getBoundingClientRect().right - card.right)) };
});

for (const width of [320, 1280]) test(`a long recipient wraps inside its pill at ${width}px`, async ({ page }) => {
  const content = await example('self-check');
  content.context = { ...content.context, to: 'Bartholomew Fitzgerald, Regional Director of Customer Operations (bartholomew.fitzgerald@northwind-industries-holdings.example.com)' };
  await mount(page, 'self-check', content, { width });
  const geometry = await page.locator('.lp-self-check-recipient').evaluate(pill => {
    const box = pill.getBoundingClientRect(), composer = pill.closest('.lp-self-check-composer').getBoundingClientRect();
    return { right: box.right - composer.right, height: box.height, radius: parseFloat(getComputedStyle(pill).borderTopLeftRadius), avatar: pill.querySelector('.lp-self-check-avatar').getBoundingClientRect().top - box.top };
  });
  expect(geometry.right).toBeLessThanOrEqual(0);
  expect(geometry.height).toBeGreaterThan(40);
  // A rounded box rather than a lozenge, with the avatar on the first line.
  expect(geometry.radius).toBeLessThanOrEqual(geometry.height / 3);
  expect(geometry.avatar).toBeLessThanOrEqual(3);
  expect((await overflow(page)).page).toBeLessThanOrEqual(0);
});

test('a long legend label keeps the line and its status drops under it at 320px', async ({ page }) => {
  const content = await example('self-check');
  content.parts[0].label = 'Offer the finished sections (executive summary, methodology and the first two regional chapters) by Friday at 17:00';
  await mount(page, 'self-check', content, { state: { answer: 'Hi Sam', ticked: [], shown: true } });
  const geometry = await page.locator('.lp-self-check-legend-line').first().evaluate(line => {
    const label = line.querySelector('.lp-self-check-legend-label').getBoundingClientRect(), status = line.querySelector('.lp-self-check-legend-status').getBoundingClientRect();
    return { label: label.width / line.getBoundingClientRect().width, below: status.top - label.bottom };
  });
  expect(geometry.label).toBeGreaterThan(.95);
  expect(geometry.below).toBeGreaterThanOrEqual(0);
});

test('a pasted file name in a question breaks instead of widening the column', async ({ page }) => {
  const content = await example('course-lookup');
  content.entries[0].title = `Where do I upload ${token}?`;
  await mount(page, 'course-lookup', content, { enhance: false });
  const { page: scroll, card } = await overflow(page);
  expect(scroll).toBeLessThanOrEqual(0);
  expect(card).toBeLessThanOrEqual(0);
});

// The tile centres on the text block up to two title lines; past that it stays level with the first two.
for (const [name, field] of [['dont-know', 'title'], ['first-answer', 'prompt'], ['highlight', 'title'], ['retrieval-sheet', 'title'], ['self-check', 'task'], ['test-out', 'title'], ['write-distractors', 'question']]) {
  test(`a long ${name} title keeps the scene tile level with its first lines`, async ({ page }) => {
    const content = await example(name);
    content[field] = 'Notions financières de base pour les nouveaux employés : régimes de retraite, épargne d’urgence et cotisations';
    await mount(page, name, content);
    const geometry = await page.locator('.lp-scene').evaluate(scene => {
      const text = scene.querySelector(':scope > div').getBoundingClientRect(), title = scene.querySelector('.lp-scene-title');
      const tile = scene.querySelector('.lp-scene-icon svg').getBoundingClientRect(), line = parseFloat(getComputedStyle(title).lineHeight);
      return { lines: Math.round(title.getBoundingClientRect().height / line), offset: tile.top + tile.height / 2 - (title.getBoundingClientRect().top + line) };
    });
    expect(geometry.lines).toBeGreaterThan(2);
    expect(Math.abs(geometry.offset)).toBeLessThanOrEqual(1);
  });
}

test('a long French mark wraps inside its row with its icon on the first line', async ({ page }) => {
  await mount(page, 'dont-know', await example('dont-know', 'fr'), { lang: 'fr' });
  // A shared row with the default no-wrap mark, as idea demos and hosts use it.
  await page.locator('[data-lp-pattern]').evaluate(card => card.insertAdjacentHTML('beforeend', `<div class="lp-choices"><label class="lp-choice" data-lp-mark="correct"><input type="radio" checked disabled><span>Une réponse</span><span class="lp-choice-mark lp-met" id="fixture-mark">${card.querySelector('.lp-scene-icon svg').outerHTML}Même réponse que l’auteur, mot pour mot</span></label></div>`));
  const geometry = await page.locator('#fixture-mark').evaluate(mark => {
    const box = mark.getBoundingClientRect(), row = mark.closest('.lp-choice').getBoundingClientRect(), icon = mark.querySelector('svg').getBoundingClientRect();
    return { over: box.right - row.right, height: box.height, line: parseFloat(getComputedStyle(mark).lineHeight), radius: parseFloat(getComputedStyle(mark).borderTopLeftRadius), icon: icon.top + icon.height / 2 - box.top };
  });
  expect(geometry.over).toBeLessThanOrEqual(0);
  expect(geometry.height).toBeGreaterThan(geometry.line * 1.5);
  expect(geometry.radius).toBeLessThanOrEqual(geometry.height / 3);
  expect(geometry.icon).toBeLessThan(geometry.line);
});

test('echoed learner text keeps its line breaks and breaks a long URL', async ({ page }) => {
  await mount(page, 'dont-know', await example('dont-know'));
  const echo = 'First paragraph.\nSecond line with https://intranet.example.com/finance/client-runs/2026-10/october-invoice-run/Q3-figures-draft-v3-FINAL-approved.xlsx';
  await page.locator('[data-lp-pattern]').evaluate((card, echo) => {
    card.insertAdjacentHTML('beforeend', '<ul class="lp-outcomes"><li class="lp-outcome lp-met"><svg class="lp-icon"></svg><span class="lp-outcome-word">Found</span><span class="lp-outcome-detail" id="fixture-detail"></span></li></ul>');
    card.querySelector('#fixture-detail').textContent = `You wrote: ${echo}`;
  }, echo);
  const lines = await page.locator('#fixture-detail').evaluate(detail => detail.innerText.split('\n').length);
  expect(lines).toBe(2);
  const { page: scroll, card } = await overflow(page);
  expect(scroll).toBeLessThanOrEqual(0);
  expect(card).toBeLessThanOrEqual(0);
});

for (const [marked, outcome] of [[['ignored'], 'correct'], [['actions'], 'missed']]) test(`a ${outcome} mark stays on the line of its chunk at every width`, async ({ page }) => {
  await mount(page, 'highlight', await example('highlight'), { state: { marked, shown: true } });
  const split = await page.locator('[data-lp-passage]').evaluate((passage, outcome) => {
    const mark = passage.querySelector(`.lp-highlight-feedback[data-lp-outcome="${outcome}"]`), chunk = mark.previousElementSibling;
    const widths = [];
    for (let width = 240; width <= 760; width += 2) {
      passage.style.inlineSize = `${width}px`;
      const range = document.createRange(); range.selectNodeContents(chunk);
      const last = [...range.getClientRects()].at(-1), box = mark.getBoundingClientRect();
      if (Math.abs(box.bottom - last.bottom) > 6) widths.push(width);
    }
    return widths;
  }, outcome);
  expect(split).toEqual([]);
});

test('review links show two lines and the full question on hover and in their name', async ({ page }) => {
  const content = await example('dont-know');
  content.questions[0].text = 'Your employer matches pension contributions up to 5% of salary. You currently contribute 2%, have £1,200 in a savings account paying 1.5% and a £3,400 credit card balance at 24.9% APR. You get a £2,000 bonus. Which use of the bonus is most likely to leave you better off after one year?';
  const picks = Object.fromEntries(content.questions.map(q => [q.id, 'dont-know']));
  await mount(page, 'dont-know', content, { state: { picks, shown: true } });
  const link = page.locator('.lp-dont-know-review a').first();
  const lines = () => link.locator('span').evaluate(span => Math.round(span.getBoundingClientRect().height / parseFloat(getComputedStyle(span).lineHeight)));
  expect(await lines()).toBe(2);
  await expect(link).toHaveAccessibleName(content.questions[0].text);
  await link.hover();
  expect(await lines()).toBeGreaterThan(2);
});
