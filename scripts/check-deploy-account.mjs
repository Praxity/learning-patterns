import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const BLOCKED = new Set(['905586684457c646d94e3efb41729a28d8ddc9e8a10d890529f0a431aadcad1e']);
export const OVERRIDE = 'LP_ALLOW_PRAXITY_DEPLOY';

/** @param {string} id */
export const hash = id => createHash('sha256').update(id.trim().toLowerCase()).digest('hex');

/** @param {{ accountId?: string, loginAccounts: string[], override?: boolean, blocked?: Set<string> }} input
 * @returns {string | null} the refusal message, or null when the deploy may go ahead */
export function refusal({ accountId, loginAccounts, override = false, blocked = BLOCKED }) {
  if (override) return null;
  const candidates = accountId ? [accountId] : loginAccounts;
  if (!candidates.some(id => blocked.has(hash(id)))) return null;
  return `preview:deploy refused: this is Praxity's Cloudflare account, which serves the live demos separately. Use your own account, or set ${OVERRIDE}=1 to deploy here on purpose.`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  let loginAccounts = [];
  if (!accountId) {
    try {
      const out = execSync('npx wrangler@4 whoami --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      loginAccounts = (JSON.parse(out).accounts ?? []).map(/** @param {{ id: string }} a */ a => a.id);
    } catch { loginAccounts = []; }
  }
  const message = refusal({ accountId, loginAccounts, override: process.env[OVERRIDE] === '1' });
  if (message) { console.error(message); process.exit(1); }
}
