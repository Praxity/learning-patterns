import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radioGroupContract } from './browser/contracts/radio-group.js';

test('radio expectations have distinct IDs, outcomes and checkable standards sources', () => {
  assert.equal(new Set(radioGroupContract.map(row => row.id)).size, radioGroupContract.length);
  for (const row of radioGroupContract) {
    assert.ok(row.outcome.trim());
    assert.ok(row.sources.length);
    assert.ok(row.sources.some(source => source.includes('/patterns/radio/') || source.includes('/TR/WCAG22/#')));
    for (const source of row.sources) assert.equal(new URL(source).hostname, 'www.w3.org');
  }
  assert.deepEqual(radioGroupContract.filter(row => row.static).map(row => row.id), ['group-name', 'radio-names', 'checked']);
});

