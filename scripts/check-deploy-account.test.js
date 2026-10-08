import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKED, hash, refusal } from './check-deploy-account.mjs';

const praxity = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const other = '0123456789abcdef0123456789abcdef';
const blocked = new Set([hash(praxity)]);

test('refuses the blocked account from the login or CLOUDFLARE_ACCOUNT_ID', () => {
  assert.match(refusal({ loginAccounts: [praxity], blocked }) ?? '', /refused.*LP_ALLOW_PRAXITY_DEPLOY=1/);
  assert.match(refusal({ loginAccounts: [other, praxity], blocked }) ?? '', /refused/);
  assert.match(refusal({ accountId: ` ${praxity.toUpperCase()} `, loginAccounts: [], blocked }) ?? '', /refused/);
});

test('allows self-hosters and deliberate overrides', () => {
  assert.equal(refusal({ loginAccounts: [other], blocked }), null);
  assert.equal(refusal({ loginAccounts: [], blocked }), null);
  assert.equal(refusal({ accountId: other, loginAccounts: [praxity], blocked }), null);
  assert.equal(refusal({ loginAccounts: [praxity], override: true, blocked }), null);
});

test('ships one blocked account hash and no raw account ID', () => {
  assert.equal(BLOCKED.size, 1);
  for (const value of BLOCKED) assert.match(value, /^[0-9a-f]{64}$/);
});
