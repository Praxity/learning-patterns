# 0004: Build and authoring contracts

## Status

Accepted. Records existing behaviour.

## Context

Patterns ship as separate browser modules, while the demo and publishing tools read the same authored metadata. These rules retain their build, budget and deployment boundaries.

## Decision

- `scripts/build-demo.mjs`, `root`: Builds the static demo site: one folder per pattern with English, French and two-instance pages, an index of every pattern, each pattern's raw README for agents, and headers that keep the unlisted preview out of search. Browser tests and the live preview both use this output.
- `scripts/build-demo.mjs`, `FONTS`: The demo pages load the course fonts the base styles name. They are dev dependencies (OFL), not part of a pattern.
- `scripts/build-icons.mjs`, `names`: Copies the Tabler outline icons the patterns use into lib/icons.js, so patterns need no runtime dependency, build step or CDN. Run after changing the list: npm run icons
- `scripts/build-icons.mjs`, `[pattern, keys]`: Small collections keep these activities within the per-pattern module budget.
- `scripts/check-budget.mjs`, `BUDGET`: The cap flags a pattern that has grown well past a small interaction; package imports are refused separately below. It counts shared lib/ modules in every pattern, though a page downloads them once. Raised from 10 KiB when the largest pattern reached it, so fixes stop trimming "why" comments to fit.
- `scripts/check-budget.mjs`, `checkBudget`: Measure each shipped module separately, as browsers receive separate ES modules.
- `scripts/check-deploy-account.mjs`, `BLOCKED`: Stops `npm run preview:deploy` from recreating a demo Worker on Praxity's own Cloudflare account, where the live demos are deployed separately. Self-hosters' accounts never match. The account ID is stored as a SHA-256 hash so the public repo doesn't carry it.
- `scripts/check-deploy-account.mjs`, `refusal`: Accounts wrangler would deploy to: CLOUDFLARE_ACCOUNT_ID when set, otherwise every account the login can use.
- `scripts/check-deploy-account.mjs`, `out`: Without a login, wrangler deploy fails on its own; let it report that.
- `scripts/pattern-meta.mjs`, `SECTIONS`: Each pattern README starts with flat front matter. It owns the facts the index and the praxity.io cards show: titles, one-line summary, section, and the three facets.
- `scripts/pattern-meta.mjs`, `scalar`: Reads one front matter value the way YAML does. GitHub and site builds parse this front matter as YAML, so a value YAML would misread or reject fails here.

Sources: the corresponding source files and their recorded rationale at commit `66fc86dc5f9a90f2dc243d6bdc90b75e2583cffa`. Browser and screen-reader observations above are historical evidence recorded in those files, not new checks. Owner decisions retain their dates where recorded.

## Consequences

Preserve these constraints when changing the named symbols. Revisit a browser constraint or provider calibration only with new evidence.
