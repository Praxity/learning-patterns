import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { checkBudget } from './check-budget.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'lp-budget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'patterns', 'test'), { recursive: true });
  return { root, pattern: join(root, 'patterns', 'test') };
}

test('budget catches a planted oversized transitive dependency', async (t) => {
  const { root, pattern } = await fixture(t);
  await writeFile(join(pattern, 'enhance.js'), "import './middle.js';");
  await writeFile(join(pattern, 'middle.js'), "export * from './large.js';");
  await writeFile(join(pattern, 'large.js'), `export const text = '${randomBytes(24000).toString('hex')}';`);
  await assert.rejects(checkBudget(root), /test.*10240/);
});

test('budget follows literal dynamic imports and handles cycles', async (t) => {
  const { root, pattern } = await fixture(t);
  await writeFile(join(pattern, 'enhance.js'), "import('./other.js');");
  await writeFile(join(pattern, 'other.js'), "import './enhance.js';");
  assert.equal((await checkBudget(root))[0].modules, 2);
  await writeFile(join(pattern, 'other.js'), `export const text = '${randomBytes(24000).toString('hex')}';`);
  await assert.rejects(checkBudget(root), /test.*10240/);
});

test('budget refuses imports it cannot measure', async (t) => {
  const { root, pattern } = await fixture(t);
  for (const source of ["import 'package';", 'import(name);', "import '../../../../outside.js';"]) {
    await writeFile(join(pattern, 'enhance.js'), source);
    await assert.rejects(checkBudget(root), /import/);
  }
});
