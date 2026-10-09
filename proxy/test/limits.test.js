import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import { CAP_MESSAGES } from '../../lib/data-notice.js';
import { CAP_MESSAGES as proxyMessages } from '../src/limits.js';

test('the public limits module serves both languages from the shared owner', async () => {
  assert.equal(proxyMessages, CAP_MESSAGES);
  const response = await worker.fetch(new Request('https://demo.example/api/patterns/limits.js'), {});
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/javascript; charset=utf-8');
  const source = await response.text();
  const served = await import(`data:text/javascript,${encodeURIComponent(source)}`);
  assert.deepEqual(served.CAP_MESSAGES, CAP_MESSAGES);
});
