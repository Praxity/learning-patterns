---
title: Test your feedback rules
title_fr: Testez vos règles de rétroaction
summary: Compare the model's labels with your labels on sample answers before using a rubric with learners.
section: authors
ai: yes
offline: yes
learners: not tried
---
# Test your feedback rules

A table compares your labels on sample answers with the model's labels. It counts agreement, disagreement and uncertainty for each rubric criterion. Expand a row to read its answer across the table and compare only the labels that differ.

## When to use it

Use this before a course starts using model-selected feedback, and again whenever its rubric, questions, model or gates change.

### Before shipping an AI pattern

Write examples and label them before asking the model. Include incomplete answers, mistakes, paraphrases, both languages, irrelevant answers and attempts to influence the grader. Keep some examples separate from tuning. Use the same questions, model and confidence gates you will ship.

Run the samples, inspect every disagreement and uncertain label, then decide whether to change the wording, the rubric or the fallback. Repeat with fresh examples after tuning. Decide your acceptance bar before the test. Keep dated results so a change in model or questions can be checked against the previous run.

Agreement measures whether the model reproduced your labels on these examples. It does not prove that your labels are right, that your rubric teaches well or that the model will judge new answers reliably. These fixtures were written by agents and form a small sample. Learner testing and independently labelled examples remain necessary.

This example tests the rubric from Check your own answer. Clef 27B scored 8 of 11 answers in a separate acceptance test and failed that test's bar. The original sample fixtures all agree in the final calibrated run. That small result does not reverse the acceptance failure.

## How it works

Choose English or French samples, then select "Run the samples". Each sample is sent once. The first request obtains any required inline clearance. After that, at most four requests run together. Rows fill as their requests finish. A failed sample leaves six "not run" cells; it does not count as uncertainty or stop the others.

The summary counts raw predicate labels. "Met" in "Blames someone" means blame was present, which is a mistake. Agreement on that column means both labels detected the same thing, not that the message was good.

Without the model, after failed configuration or when every sample fails, the dated saved table appears with one unavailable line and no run button. The language switch still works. Without JavaScript, the saved run is a plain table with native answer disclosures. The example's quoted messages retain their original wording, including the French colleague's informal address. Author-facing French uses vous.

## Evidence

Comparing model labels with author labels draws on automated-scoring research that treats agreement with human raters as one part of validation ([Williamson et al., 2012](https://doi.org/10.1111/j.1745-3992.2011.00223.x)). Testing guidelines recommend independent validation answers and comparison with at least two human raters ([International Test Commission and Association of Test Publishers, 2022](https://www.testpublishers.org/assets/Guidelines%20for%20Technology-Based%20Assessment%20v2022.11.08.pdf)). A simple agreement percentage also leaves chance agreement unaccounted for ([Hallgren, 2012](https://www.tqmp.org/RegularArticles/vol08-1/p023/p023.pdf)). The table helps authors inspect disagreements and revise their rules. The model's choices were checked against agent-written answers, not learners. Its held-out check covered 11 eligible answers. Agreement on representative learner answers and the tool's effects on authors' feedback decisions have not been tested.

## Accessibility

Meets the shared baseline in the root README. Row and column headers identify the cells. Each cell shows the author's label with a check, cross or question mark for model agreement, disagreement or uncertainty. Hidden text gives screen readers the full label and outcome. Failed cells say "not run". The wide table scrolls within its own named, keyboard-focusable region. Native row disclosures open a full-width comparison row immediately, including without JavaScript. One status region announces the completed summary once; progressive fills never move focus or announce each cell. The run button retains focus, and the sample language cannot change during a run.

Automated checks cover both languages, three browser engines, axe including the table, keyboard, 320 px reflow, text spacing, reduced motion, forced colours and no JavaScript. Human screen-reader checks remain separate.

## Content fields

All prose is authored plain text and escaped before rendering.

| Field | Meaning |
| --- | --- |
| `task` | The task whose rubric is tested. |
| `note` | What this example and its acceptance result establish. |
| `polarityNote` | Explains the negative blame predicate once. |
| `criteria` | Six `{ id, label, polarity }` columns, in proxy order. Blame has `negative` polarity. |
| `fixtures` | `{ id, name: { en, fr }, answer: { en, fr }, expected }` rows. Expected labels are `met` or `missed`. |
| `savedRun` | `{ date, model, modelName, answers: { en, fr } }`. Each language maps fixture ids to six `{ noul }` answers, or `null` for a failed sample. Omitted ids mean no recorded run. |

Unknown fields, duplicate fixture ids, invalid probabilities and answers beyond the proxy limit are rejected. Adapting the rubric requires changing and evaluating its proxy-owned questions too.

### Saved-run provenance

The example contains 144 recorded predicate values, 72 per sample language. None are invented and no cells lack a recording. They come from the final calibration data for wording `f03390a`, dated 2026-10-07, model `@cf/cloudflare/clef`, displayed as Clef 27B.

English rubric calibration records are rows `16-012` through `16-021` and `16-023`, plus parity row `17-056` for the translated complete-message fixture. French parity records are rows `17-039`, `17-041`, `17-043`, `17-045`, `17-047`, `17-049`, `17-051`, `17-053`, `17-055`, `17-059`, `17-fixture-off_topic-french`, plus rubric row `16-022`. All are from the final work-deadline calibration calls. Each selected answer text and each of the six questions matches the shipped rubric exactly. The sincere predicate is not counted.

The static demo's fake `ask` returns these recorded values for the requested answer. It sends no text to a provider. Tests inject separate, clearly synthetic disagreements and uncertain values to check the interface.

## Logic

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing; throws an Error naming the invalid field. |
| `summarize(content, results, model)` | `{ agree, disagree, unsure, notRun, total, failed, rows }`. Each row has `{ id, cells, failed, review }`; cells have `{ id, author, model, outcome }`. `review` covers disagreements and uncertain labels. |
| `runSamples(fixtures, ask, onResult, signal?)` | Promise of results by fixture id, with `null` for failed requests. Calls `onResult(id, answers)` progressively. Abort stops new requests and rejects. |
| `ANSWER_LIMIT` | The proxy-owned maximum sample length. |

The proxy owns `CRITERIA`, `labelAnswers` and every model gate in `proxy/logic/rubric.js`. No threshold is copied into this pattern. Blame is compared as a raw predicate, without inversion.

## Use it

Copy this folder, `lib/`, `proxy/logic/rubric.js` and `proxy/logic/shared.js`, keeping relative paths. Include `lib/base.css`, then `pattern.css`.

```js
import { render } from './patterns/feedback-rules/render.js';
import { enhance } from './patterns/feedback-rules/enhance.js';
import { strings } from './patterns/feedback-rules/strings.js';
import { createAsk } from './lib/ask.js';

const markup = render(content, strings.en, { id: 'rules', lang: 'en' });
// Insert markup on the server, then enhance the section in the browser.
const instance = enhance(root, { content, strings: strings.en, ask: createAsk() });
```

The optional host `state` adapter is accepted by the shared contract but unused. Live judgments are not saved. Repeated enhancement returns the same instance; `destroy()` cancels pending requests, removes listeners and restores the saved table.

## Adapt it with your agent

Copy this prompt and fill in your task and audience.

> Adapt the feedback-rules content for my task and audience. Write sample answers and label each criterion before calling the model. Keep English and Québec French together, using vous for author-facing French. Keep the six proxy criterion identities and polarity; if the rubric changes, change and evaluate its owned proxy questions too. Preserve the pattern contract, one summary announcement, progressive results and the four-request limit. Use recorded outcomes only for a saved run. Leave missing records as not run. Explain what agreement does and does not establish. Update the examples, schema and interface tests. Show both languages for review.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
