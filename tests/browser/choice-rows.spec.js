import { test, expect } from '@playwright/test';

for (const lang of ['en', 'fr']) test(`choice text is optically centred on its key (${lang})`, async ({ page }) => {
  await page.goto(`/dont-know/${lang}.html`);
  await page.waitForFunction(() => window.lpReady);
  await page.evaluate(() => document.fonts.ready);
  const offsets = await page.locator('.lp-choice').evaluateAll(rows => rows.map(row => {
    const text = row.querySelector(':scope > span:not(.lp-choice-mark)');
    const range = document.createRange();
    range.selectNodeContents(text);
    const [line] = range.getClientRects();
    const style = getComputedStyle(text);
    const context = document.createElement('canvas').getContext('2d');
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const box = context.measureText('Hx');
    const baseline = line.top + (line.height - box.fontBoundingBoxAscent - box.fontBoundingBoxDescent) / 2 + box.fontBoundingBoxAscent;
    const optical = baseline - (context.measureText('H').actualBoundingBoxAscent + context.measureText('x').actualBoundingBoxAscent) / 4;
    const rowBox = row.getBoundingClientRect(), rowStyle = getComputedStyle(row);
    const top = rowBox.top + parseFloat(rowStyle.borderTopWidth) + parseFloat(rowStyle.paddingTop);
    const keyHeight = parseFloat(getComputedStyle(row, '::before').height);
    return Math.round((optical - (top + keyHeight / 2)) * 10) / 10;
  }));
  expect(offsets.length).toBeGreaterThan(0);
  for (const offset of offsets) expect(Math.abs(offset)).toBeLessThanOrEqual(1);
});
