# 0003: Provider contracts and budgets

## Status

Accepted. Records existing behaviour.

## Context

The proxy accepts learner fields and asks server-owned questions. These rules retain the evaluated gates, request bounds and storage constraints behind its provider adapters.

## Decision

- `proxy/logic/03-contract.js`, `BRANCH_SURE`: A Choice below this confidence, or an off_script choice, doesn't count. Set from the training replies only: clear ones scored 0.98 or more, the ambiguous "Okay, whatever you say" picked withdraw at 0.89, and a prompt injection 0.55. Holdout replies weren't used to set it.
- `proxy/logic/03-contract.js`, `CLEF_BRANCH_SURE`: With the tuned wording, both Clef models put every clear train reply above 0.70 and the injected attack below 0.56. Keep Jev's original gate. Check labels were not used.
- `proxy/logic/03-contract.js`, `CLEF_27B_BRANCH_SURE`: Three-group 27B calibration. 0.60 accepts clear hedges and keeps the known injected attack at 0.5538 below the gate. Lower fits added gaming credit.
- `proxy/logic/06-misconceptions.js`, `CLEF_CONFIDENT`: The revised wording classifies all 27B train beliefs correctly, with confidence at least 0.527. Retain the earlier 0.50 gate for flash; 27B now uses the shared three-group Choice calibration. Jev keeps its original gate.
- `proxy/logic/13-journal.js`, `DISTRESS`: Keep the distress threshold below the met threshold: missing a support line costs more than showing one needlessly.
- `proxy/logic/16-fixture-data.js`, `FIXTURES`: Expected labels authored before live calls. Met for blame means a mistake.
- `proxy/logic/16-fixture-data.js`, `summarizeParity`: `summarizeParity` compares paired English and French predicate results. Agreements require equal definite labels. Unequal labels count as disagreements; either unsure result also counts as an uncertain pair, so these counts can overlap. Per-criterion results include pair counts, language matches and raw language means. Empty means are null. Means describe yes probability, never answer quality.
- `proxy/logic/20-faq.js`, `selectLookup`: Validate a complete Choice distribution, then choose at most two authored entries. `none` winning always suppresses suggestions. Inclusive gates permit a split decision.
- `proxy/logic/question-set.js`, `validateSets`: Provider wording and thresholds can differ; outcome meanings must agree.
- `proxy/logic/question-set.js`, `requestQuestions`: Proxy enumeration keeps numeric IDs in authored order when JSON.stringify builds the request.
- `proxy/logic/question-set.js`, `canonicalJson`: Object keys sort by UTF-16 code units; array order and Unicode strings stay unchanged. Emit objects directly: rebuilding one would reorder all-digit keys again.
- `proxy/logic/question-set.js`, `acceptanceFingerprint`: This array is the fingerprint preimage, including the bar's fixed field order.
- `proxy/logic/question-set.js`, `questionSetDigest`: Question IDs and field IDs are values in arrays, never keys whose order JavaScript changes.
- `proxy/logic/question-set.js`, `inputTokenBound`: JSON can escape each UTF-16 code unit to six bytes. Count shared state per question.
- `proxy/logic/question-set.js`, `checkBodyLimit`: Bound compact JSON with six bytes per UTF-16 unit, and URL-encoded forms with nine.
- `proxy/logic/question-set.js`, `readAnswers`: Only typed answers leave the provider seam. Discard echoed state and other extra values.
- `proxy/logic/rubric.js`, `rubricBand`: Shared rubric calibration, including demos 01 and 15. The shorter deadline wording separates real due dates from draft offers in all three data groups. 0.625 accepts the two remaining clear 0.639+ deadlines; 0.60 agreement resolves both positive and negative hedges without adding credit to any gaming row.
- `proxy/logic/shared.js`, `MET`: Noul bands. Between the two thresholds the demo should say it isn't sure rather than guess.
- `proxy/logic/shared.js`, `CLEF_CHOICE_CONFIDENT`: Three-group calibration for 27B's horseman, study-belief and topic Choices. Fold optima were 0.15, 0.15 and 0.25; use their conservative upper boundary. Dialogue branches retain a higher gate to reject a known injected attack.
- `proxy/src/answers.js`, `readAnswers`: Keep only typed answers to server-owned questions. Providers may echo state in extra fields; persisting their raw response would break the no-text promise.
- `proxy/src/clef.js`, `clef`: Clef uses the System One question and answer schemas. Workers AI also needs a short model selector inside the body; its binding takes the full model id.
- `proxy/src/cost-guard.js`, `CostGuard`: Only initial alarm setup holds the startup gate, never provider I/O.
- `proxy/src/cost-guard.js`, `fetch`: Identical in-flight requests share a charge; unrelated keys run independently.
- `proxy/src/cost-guard.js`, `ask`: Check and reserve both daily counters and spend in one transaction. Persist the bound before external I/O. A timeout or object restart keeps it charged, since the provider may have billed a request we never heard back from.
- `proxy/src/cost-guard.js`, `ask`: A provider 429 refuses the request before inference, so nothing was billed.
- `proxy/src/demos/01-rubric.js`, `clefQuestions`: One candidate wording for both Clef models, also inherited by demos 16 and 17.
- `proxy/src/demos/07-explain-back.js`, `questions`: The original pause question outperformed shorter variants on 27B train rows.
- `proxy/src/demos/20-faq.js`, `CATALOGUE`: The proxy owns the catalogue and wording. Browser requests contain only learner text.
- `proxy/src/perplexity.js`, `perplexityRequest`: Preserve the authored Jev wording. Decisions requires string instructions.
- `proxy/src/perplexity.js`, `convertAnswers`: Perplexity echoes the requested name, including after retiring and rerouting a version.
- `proxy/src/prices.js`, `DEFAULT_MODEL`: Input-only list prices. Perplexity: docs.perplexity.ai/docs/decisions/quickstart (output free); Jev: docs.typesafe.ai/models; Clef: Cloudflare model pages.
- `proxy/src/prices.js`, `pricing`: Keep the calculation inside a self-contained function so its browser exports survive bundler renaming and minification. Only table data crosses that boundary.
- `proxy/src/prices.js`, `browserPrices`: The Worker serves this same owner's exports to the browser. No copied price table.
- `proxy/src/registry.js`, `blocks`: Only evaluated blocks can receive live checks. Evaluation and browser callers use the same decision owners and gates. Clef/Jev reserve 8,192 tokens. Perplexity bounds conservatively repeat state per question. Its bounds cover the UTF-8 bytes of each separate question request at field caps, including six-byte JSON escapes, plus 1,024 framing tokens per question. Uncertain billing retains this charge; re-evaluate each bound when its wording or fields grow.
- `proxy/src/registry.js`, `blocks`: Four questions at 1,200 characters need 35,892 including byte bounds and framing; round up to 40,960.
- `proxy/src/registry.js`, `blocks`: Journal text is personal. Cache hits or shared calls would reveal another learner's submission through cost and timing.
- `proxy/src/registry.js`, `blocks`: One Choice question, 500 characters at six escaped bytes each plus catalogue and 1,024 framing tokens.
- `proxy/src/shared.js`, `sincere`: Questions more than one demo reuses. Keep wording here so every demo asks them the same way.
- `proxy/src/shared.js`, `clefSincere`: Clef candidate: separate attempting the task from meeting its rubric. Keep this shared so a short or incorrect attempt has the same gate everywhere.
- `proxy/src/shared.js`, `criterion`: A yes/no check that `answer` does something. Every rubric criterion in the demos is one of these.
- `proxy/src/turnstile.js`, `TEST_SECRET`: Cloudflare's always-pass test secret returns a dummy hostname such as example.com.
- `proxy/src/worker.js`, `ipKey`: URL canonicalises compressed, uppercase and embedded-IPv4 IPv6 spellings.
- `proxy/src/worker.js`, `buildRequest`: Exported for tests. The client names a block and sends plain text fields; the questions always come from the server, so the key can't be used for arbitrary prompts.

Sources: the corresponding source files and their recorded rationale at commit `66fc86dc5f9a90f2dc243d6bdc90b75e2583cffa`. Browser and screen-reader observations above are historical evidence recorded in those files, not new checks. Owner decisions retain their dates where recorded.

## Consequences

Preserve these constraints when changing the named symbols. Revisit a browser constraint or provider calibration only with new evidence.
