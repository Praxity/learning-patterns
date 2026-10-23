import { test, expect } from '@playwright/test';

// Shared look (lib/base.css) under a host page like praxity.io: headings in a display face, no
// font synthesis and no italic face loaded.
const HOST = 'h1, h2, h3 { font-family: Georgia, serif; } html { font-synthesis: none; }';

async function open(page, path, host = false) {
  await page.goto(path);
  await page.waitForFunction(() => window.lpReady);
  if (host) await page.addStyleTag({ content: HOST });
}

for (const name of ['dont-know', 'first-answer', 'highlight', 'retrieval-sheet', 'test-out', 'write-distractors']) {
  test(`headings inside the pattern keep the body face when the host styles headings (${name})`, async ({ page }) => {
    await open(page, `/${name}/en.html`, true);
    const families = await page.locator('.lp').evaluateAll(roots => roots.flatMap(root => [...root.querySelectorAll('h1, h2, h3, h4, h5, h6, .lp-scene-title, .lp-run-in')].map(el => getComputedStyle(el).fontFamily)));
    expect(families.length).toBeGreaterThan(0);
    for (const family of families) expect(family).toMatch(/^"Source Sans 3"/);
  });
}
