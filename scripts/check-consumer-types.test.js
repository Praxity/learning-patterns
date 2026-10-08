import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('strict consumers resolve deep JavaScript imports and JSON', async (t) => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const consumer = await mkdtemp(join(tmpdir(), 'lp-consumer-'));
  t.after(() => rm(consumer, { recursive: true, force: true }));
  await mkdir(join(consumer, 'node_modules'));
  await symlink(root, join(consumer, 'node_modules/learning-patterns'), 'junction');
  await copyFile(join(root, 'tests/types/consumer.mts'), join(consumer, 'consumer.mts'));

  for (const [resolution, module] of [['bundler', 'ESNext'], ['nodenext', 'NodeNext']]) {
    await t.test(resolution, () => {
      const result = spawnSync(process.execPath, [
        join(root, 'node_modules/typescript/bin/tsc'),
        '--noEmit', '--strict', '--resolveJsonModule', '--esModuleInterop',
        '--target', 'ES2022', '--module', module, '--moduleResolution', resolution,
        'consumer.mts',
      ], { cwd: consumer, encoding: 'utf8' });
      assert.equal(result.status, 0, result.error?.message || result.stdout || result.stderr);
    });
  }
});
