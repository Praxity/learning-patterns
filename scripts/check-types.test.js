import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareTypes } from './check-types.mjs';

test('declaration check catches stale, missing and extra files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'lb-types-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const actual = join(root, 'actual');
  const expected = join(root, 'expected');
  await mkdir(actual); await mkdir(expected);
  await writeFile(join(expected, 'a.d.ts'), 'export const a: string;\n');
  await assert.rejects(compareTypes(actual, expected), /stale/);
  await writeFile(join(actual, 'a.d.ts'), 'export const a: number;\n');
  await assert.rejects(compareTypes(actual, expected), /stale/);
  await writeFile(join(actual, 'a.d.ts'), 'export const a: string;\r\n');
  await compareTypes(actual, expected);
  await writeFile(join(actual, 'extra.d.ts'), '');
  await assert.rejects(compareTypes(actual, expected), /stale/);
});
