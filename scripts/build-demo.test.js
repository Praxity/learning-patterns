import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readMeta } from './pattern-meta.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const build = (...args) => execFileSync(process.execPath, ['scripts/build-demo.mjs', ...args], { cwd: root });

test('demo builds keep AI pages offline by default and use the shared client when live', async () => {
  const pages = [];
  for (const entry of await readdir(new URL('../patterns/', import.meta.url), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const readme = await readFile(new URL(`../patterns/${entry.name}/README.md`, import.meta.url), 'utf8');
    if (!readMeta(entry.name, readme).ai) continue;
    for (const file of ['en.html', 'fr.html', 'two.html']) pages.push(`${entry.name}/${file}`);
  }
  assert.ok(pages.length > 0, 'AI demo pages must be checked');
  const read = page => readFile(new URL(`../demo-dist/${page}`, import.meta.url), 'utf8');
  try {
    build();
    for (const page of pages) {
      const html = await read(page);
      assert.doesNotMatch(html, /createAsk\s*\(/, page);
      assert.match(html, /window\.lpAsk === null/, page);
      assert.match(html, /window\.lpAsk \?\? fakeAsk/, page);
      assert.match(html, /config: async \(\) => mockConfig/, page);
    }
    build('--live-ask');
    for (const page of pages) {
      const html = await read(page);
      assert.doesNotMatch(html, /fakeAsk|mockConfig|window\.lpAsk/, page);
      assert.match(html, /import \{ createAsk \} from '\.\.\/lib\/ask\.js'/, page);
      assert.match(html, /const injectedAsk = createAsk\(\)/, page);
      assert.match(html, /ask: injectedAsk/, page);
    }
  } finally {
    build();
  }
});
