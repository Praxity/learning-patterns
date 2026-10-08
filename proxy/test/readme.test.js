import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const privateProse = /\bsupplied\b|\bthe brief\b|codex-runs|\b[A-Z]:[\\/]|—/i;

test('proxy README is public prose and contains the exact data notice', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.doesNotMatch(readme, privateProse);
  assert.ok(readme.includes("To choose the feedback, your answer is sent to {provider}. We don't store your text. Don't include names or personal details."));
  for (const planted of ['The supplied text.', 'As the brief asks.', 'C:/private/file', 'D:\\private\\file', 'codex-runs', 'Text — text']) assert.match(planted, privateProse);
});

test('the root asset Worker serves the proxy on the same origin with every binding', async () => {
  const source = await readFile(new URL('../../wrangler.jsonc', import.meta.url), 'utf8');
  const config = JSON.parse(source.replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(config.name, 'learning-patterns');
  assert.equal(config.main, 'proxy/src/worker.js');
  assert.equal(config.assets.directory, './demo-dist');
  assert.deepEqual(config.assets.run_worker_first, ['/api/patterns/*']);
  assert.equal(config.ai.binding, 'AI');
  assert.deepEqual(config.durable_objects.bindings, [{ name: 'COST_GUARD', class_name: 'CostGuard' }]);
  assert.ok(config.migrations.some(migration => migration.new_sqlite_classes.includes('CostGuard')));
  assert.ok(config.ratelimits.some(binding => binding.name === 'LIMITER' && binding.simple.limit === 120 && binding.simple.period === 60));
  await assert.rejects(readFile(new URL('../wrangler.jsonc', import.meta.url)), { code: 'ENOENT' });
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.ok(readme.includes('[wrangler.jsonc](../wrangler.jsonc)'));
  assert.ok(readme.includes('secret put CACHE_KEY_SECRET'));
  assert.ok(readme.includes('same origin'));
  assert.ok(readme.includes('server-chosen'));
  assert.ok(!readme.includes('--config proxy/wrangler.jsonc'));
  assert.ok(!readme.includes('`cached`'));
});
