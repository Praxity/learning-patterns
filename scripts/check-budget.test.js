import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { checkBudget } from './check-budget.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'lb-budget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'blocks', 'test'), { recursive: true });
  return { root, block: join(root, 'blocks', 'test') };
}

test('budget catches a planted oversized transitive dependency', async (t) => {
  const { root, block } = await fixture(t);
  await writeFile(join(block, 'enhance.js'), "import './middle.js';");
  await writeFile(join(block, 'middle.js'), "export * from './large.js';");
  await writeFile(join(block, 'large.js'), `export const text = '${randomBytes(24000).toString('hex')}';`);
  await assert.rejects(checkBudget(root), /test.*10240/);
});

test('budget follows literal dynamic imports and handles cycles', async (t) => {
  const { root, block } = await fixture(t);
  await writeFile(join(block, 'enhance.js'), "import('./other.js');");
  await writeFile(join(block, 'other.js'), "import './enhance.js';");
  assert.equal((await checkBudget(root))[0].modules, 2);
  await writeFile(join(block, 'other.js'), `export const text = '${randomBytes(24000).toString('hex')}';`);
  await assert.rejects(checkBudget(root), /test.*10240/);
});

test('budget refuses imports it cannot measure', async (t) => {
  const { root, block } = await fixture(t);
  for (const source of ["import 'package';", 'import(name);', "import '../../../../outside.js';"]) {
    await writeFile(join(block, 'enhance.js'), source);
    await assert.rejects(checkBudget(root), /import/);
  }
});
