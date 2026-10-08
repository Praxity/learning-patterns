# Learning patterns proxy

This Cloudflare Worker checks short answers against fixed question sets. The browser posts `{ block, fields }`; the server chooses the questions. Clef 27B runs through a Workers AI binding, with no model API key. Jev is an optional provider.

## Deploy in your own account

Run these commands from the repository root. Use Node 22. The proxy has no npm dependencies; Wrangler handles deployment.

1. Sign in to your Cloudflare account with `npx wrangler@4.148.0 login`. Your account needs access to [Workers AI](https://developers.cloudflare.com/workers-ai/configuration/bindings/) and SQLite Durable Objects.
2. Set your own service name in the root [wrangler.jsonc](../wrangler.jsonc). It serves the demo pages and `/api/patterns/*` from one Worker and declares the `AI` binding, the `COST_GUARD` binding and its SQLite migration. Keep that migration tag after your first deployment. The separate proxy Worker config has been removed.
3. Create a Turnstile widget for your course's hostname. Put its public site key in `TURNSTILE_SITE_KEY` in the config.
4. Store the four secrets below in your account. Use the widget's secret for `TURNSTILE_SECRET_KEY`. Generate independent random values of at least 32 characters for `COOKIE_SIGNING_KEY`, `IP_SALT` and `CACHE_KEY_SECRET`. Keep them outside source control. Live requests fail closed if any of those three is shorter than 32 characters.
5. Run `npm ci`, `npm run demo`, then `npx wrangler@4.148.0 deploy`. This command creates your service and its Durable Object namespace.

```sh
npx wrangler@4.148.0 secret put TURNSTILE_SECRET_KEY
npx wrangler@4.148.0 secret put COOKIE_SIGNING_KEY
npx wrangler@4.148.0 secret put IP_SALT
npx wrangler@4.148.0 secret put CACHE_KEY_SECRET
```

Self-hosters must serve their pages and proxy on the same origin. The root config's `assets.run_worker_first: ["/api/patterns/*"]` sends API requests to the Worker and serves the demo build for page requests. To serve your own pages, change `assets.directory` to your built site. For pages already hosted on a Cloudflare-managed domain, you can instead route this service's API to that origin:

```json
"routes": [{ "pattern": "example.org/api/patterns/*", "zone_name": "example.org" }]
```

The route must belong to this service. Unrecognised API paths return 404. The proxy does not add CORS headers. Your page loads the Turnstile widget, posts to the relative URL `/api/patterns/ask`, sends its token in `x-turnstile-token` on the first request, and lets the browser carry the signed cookie on later requests. The cookie is secure, HttpOnly, SameSite Strict and valid for one hour. Its MAC binds it to the hashed IP key, so another key needs its own Turnstile solve. Turnstile verification requires the request hostname to match the widget's hostname.

The demo build currently has no page that calls the API. Add the page that renders Turnstile and posts to `/api/patterns/ask` to the site's asset build before enabling live checks. The root config's `ASSETS` binding returns page responses and asset 404s without running proxy checks. `npm run preview:deploy` also ships the API; live requests return 503 until `COOKIE_SIGNING_KEY`, `IP_SALT` and `CACHE_KEY_SECRET` are configured.

On a custom domain, keep Cloudflare's Pseudo IPv4 setting off or on "Add header". "Overwrite headers" replaces `cf-connecting-ip` with a synthetic IPv4 address for each IPv6 address, allowing address rotation to bypass the IPv6 prefix limits.

## Requests and question sets

`GET /api/patterns/config` returns the public Turnstile site key, provider, model and mock status. `POST /api/patterns/ask` accepts this shape:

```json
{ "block": "07-explain-back", "fields": { "answer": "I would announce a pause and agree when to return." } }
```

| Block | Fields and maximum characters |
| --- | --- |
| `03-branch` | `reply`: 1,200; `node`: 40, one of the authored dialogue nodes |
| `06-misconceptions` | `answer`: 1,500 |
| `07-explain-back` | `answer`: 1,500 |
| `13-journal` | `answer`: 1,500 |
| `16-fixtures` | `answer`: 800 |

Other blocks, missing fields, extra fields and caller-authored questions are refused. The [registry](src/registry.js) owns the allowed blocks. Their server modules own the question wording and authored context. Adapting these questions to another topic requires changing server code and checking the model's answers on that topic.

A successful response includes typed `answers`, server-chosen `questions`, `model`, `tokens`, `ms`, `costUsd` and `mock`. The questions are public, not secret. The model's answers choose authored feedback. It does not write feedback. [logic/](logic/) contains the original browser-safe decision owners; browser code and evaluation code import the same functions. Those files do not import the question sets. Keep the gates and wording together when tuning a block.

## Limits and cost

One named SQLite Durable Object coordinates all live calls. Before contacting a provider it atomically checks and increments both daily call counters and reserves the block's input-token bound, currently 8,192 tokens for each registered block. It settles a successful response against reported input tokens. Both providers have a 15 second deadline. Timeouts, invalid answers and unknown usage keep the reservation, since the provider may have billed the call. Failed calls count against both daily call limits too. Calls with different cache keys run independently; identical in-flight requests share one charge. `13-journal` always makes an independent live call, with no result cache or in-flight sharing, so cost and timing do not reveal whether another learner sent the same personal text.

| Guard | Default | Where to change it |
| --- | --- | --- |
| Live calls per IPv4 address or IPv6 /64 per UTC day | 20 | `IP_DAILY_LIMIT` in the config |
| Live calls per IPv4 /24 or IPv6 /48 per UTC day | 60 | Three times `IP_DAILY_LIMIT` |
| Global model input-token budget per UTC day | $1.00 | `DAILY_BUDGET_USD` in the config |
| Burst requests per IP | 120 per minute | `ratelimits` in the config |
| Result cache, except `13-journal` | 30 days | `CACHE_TTL` in `src/cost-guard.js`; block policy in the registry |
| Signed clearance cookie | One hour | `HOUR` and the cookie's `Max-Age` in `src/turnstile.js` |

The daily defaults and refusal messages live in [src/limits.js](src/limits.js). The sole price table lives in [src/prices.js](src/prices.js); per-block reservation bounds live in the registry. Recheck a block's bound whenever its questions, authored context or field caps grow. Price calculations use integer nanodollars. The budget counts model input tokens only; Cloudflare service charges are separate. The input-only list prices are $0.24 per million for Clef 27B and $0.042 per million for Jev 1.13.0. Recheck provider prices and token limits before deploying or changing models.

The per-IP daily limit, burst limiter and clearance cookie use the full IPv4 address or the IPv6 /64 prefix. A second daily counter groups IPv4 /24 and IPv6 /48 networks. IPv4-mapped IPv6 addresses use their embedded IPv4 address for all guards. The burst limiter runs before Turnstile verification. Cache hits still need clearance and pass through the burst limiter, but spend no model budget and use no daily live call. Editing state, questions, model or `CACHE_KEY_SECRET` changes the HMAC cache key. Expired cache entries are deleted through an expiry index on requests and daily alarms. Each object schedules its first alarm once; daily alarms schedule the next. IP counters and spend rows retain the current and previous UTC day. Request bodies are capped at 16 KiB, including bodies without `content-length`. The proxy counts incoming bytes and cancels the stream as soon as it exceeds that cap.

A daily refusal returns HTTP 429 with `reason: "ip_daily"` or `reason: "budget"`. Missing configuration returns 503; provider failures return 502. Offer the learner a self-check fallback when live checks cannot run.

## Optional Jev provider

Clef remains the default even if a Jev secret exists. To use Jev, set `MODEL_PROVIDER` to `jev` and store `JEV_API_KEY` with `npx wrangler@4.148.0 secret put JEV_API_KEY`. Without that secret, Jev calls are refused. Only the server chooses the provider. Jev uses its original question wording and gates; these blocks were selected using Clef 27B results, so assess Jev separately for your content.

For local UI work, `JEV_MOCK=1` returns fake answers and bypasses clearance and model calls. The response has `mock: true`. Mock mode and Turnstile test secrets work only on `localhost`, `127.0.0.1` or `[::1]`; other hosts return 503 with a misconfigured error. Use real Turnstile credentials on your deployed origin.

## Data notice

Place this text next to the answer box:

> To choose the feedback, your answer is sent to {provider}. We don't store your text. Don't include names or personal details.

Use `Cloudflare Workers AI` for Clef and `TypeSafe (US)` for Jev. Before sending learner text in a client course, arrange consent wording and a data agreement with the chosen provider.

The proxy sends the answer and authored context to the provider. Except for `13-journal`, it keeps an HMAC-SHA-256 key of the model, state and questions, validated model answers and response metadata for 30 days. Journal results are never cached or shared between in-flight requests. The cache uses `CACHE_KEY_SECRET`, separate from the IP salt. It stores salted IP and network hashes and daily call and spend counters. It stores neither submitted text nor raw provider responses, and writes no application logs. Extra provider fields are discarded; text in a numeric answer or an unknown choice fails validation before caching. Hosting and model providers have their own data policies.

## Check a deployment

Use real Turnstile credentials, with the widget's hostname list limited to your page host. Leave `JEV_MOCK` unset and `MODEL_PROVIDER=clef`; Jev needs its own explicit configuration. Keep the three signing and hashing secrets independent. Avoid request-body logging in Workers Logs, Logpush or an AI Gateway.

After deploying, confirm `/api/patterns/config` reports `mock: false`, `provider: "clef"` and a non-empty `siteKey`. A POST without a token or cookie must return 403. Take the notice's provider name from the configuration.

Make one maximum-length live call for each block with non-ASCII text, such as 1,500 CJK characters for `13-journal`. Confirm the response's `tokens`, from the provider's `usage.input_tokens`, is a positive integer below 8,192. Missing usage or usage above the bound returns 502 and keeps the reservation. Above the bound, the ledger can undercount the provider's bill; revise that block's reservation before offering live checks.

Send 10 distinct concurrent live calls and confirm none reaches the 15 second deadline. Each Clef timeout retains an 8,192-token reservation, $0.00196608. Recheck provider prices, including output-token or neuron charges, against the input-only price table. Set a Cloudflare billing alert for service charges outside the model budget.

## Tests

`npm run test:proxy` runs the moved cost-guard, clearance, price, adapter, question and decision tests plus registry, provider, privacy and security regression checks. `npm test` includes them too, including in Linux CI with Node 22. The privacy checks submit distinctive text through all five blocks and both providers, make providers echo it, and inspect SQL writes, every table, alarms and application log calls after live, repeated and failed requests.
