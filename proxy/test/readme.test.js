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
