import test from 'node:test';
import assert from 'node:assert/strict';
import { confidenceGate, REPLY_LIMIT } from '../logic/03-contract.js';
import { readBranch } from '../logic/03-branch.js';
import demo from '../src/demos/03-branch.js';

test('shared branch contract preserves every model boundary and reply limit', () => {
  for (const [model, gate] of [['jev', .9], ['@cf/cloudflare/clef', .6], ['@cf/cloudflare/clef-flash', .7]]) {
    assert.equal(confidenceGate(model), gate);
    assert.equal(readBranch({ choice: 'defend', confidence: gate }, undefined, model), 'defend');
    assert.equal(readBranch({ choice: 'defend', confidence: gate - .0001 }, undefined, model), null);
  }
  assert.equal(REPLY_LIMIT, 1200);
  assert.equal(demo.fields.reply, 1200);
});
