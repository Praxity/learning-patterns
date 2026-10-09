---
title: Spot the misconception
title_fr: Repérez l'idée fausse
summary: Answer a study question and compare feedback with a model answer.
section: question
ai: yes
offline: yes
learners: not tried
---
# Spot the misconception

Answer a study question. Compare your reasoning with the feedback and model answer.

## When to use it

Use it when a short answer can reveal a mistaken belief. This example asks whether rereading notes prepares you for a test. The proxy checks four study misconceptions. Feedback helps you revise your reasoning. It gives no grade.

## How it works

1. Write an answer and select "Check my answer". Verification appears if needed.
2. A key idea gets a green check. A listed misconception gets its name and a correction.
3. "Not sure" shows a possible match for you to check. Unmatched answers get a prompt to compare.
4. The model answer opens with every result. Revise your answer and check again.
5. If automatic checking is unavailable, the button opens the model answer and misconception checklist. Tick beliefs in your answer and use the corrections to revise.

## Evidence

Refutation texts produced an average learning benefit of 0.41 standard deviations across 44 comparisons involving 3,869 participants ([Schroeder and Kucera, 2022](https://doi.org/10.1007/s10648-021-09656-z)). This supports naming a mistaken idea and explaining the correction. A separate review found larger average effects for explanatory computer feedback than for right-or-wrong feedback ([Van der Kleij et al., 2015](https://doi.org/10.3102/0034654314564881)). The decision model selects authored explanations and was tested only on agent-written answers. Its identification of misconceptions and the learning benefits of this feedback have not been tested with learners.

## Accessibility

The question labels the three-line answer box. Submitting announces feedback once through one status region, without moving focus. Icons accompany text; colour alone conveys no meaning. Native disclosures and checkboxes support keyboards. Shared styles support reduced motion, forced colours and narrow layouts. Without JavaScript, the answer box, open model answer and checklist appear immediately. English and Québec French share the content structure.

The browser tests cover all results, fallback, axe, keyboard use, 320 px reflow, text spacing and lifecycle in three engines. Human screen-reader checks remain separate.

## Content fields

| Field | Meaning |
| --- | --- |
| `question` | The quiz question and answer-box label. |
| `keyIdea` | Feedback when the expected idea is found. |
| `model` | The authored model answer. |
| `unsureKeyIdea` | Comparison prompt when the key idea is uncertain. |
| `unsureMisconception` | Authored template containing `{idea}` and `{why}`. |
| `noMatch` | A prompt to compare unmatched reasoning with the model answer. |
| `misconceptions` | Exactly four entries, in order: `rereading`, `highlighting`, `cramming`, `watching`. |
| `misconceptions[].id` | The proxy's fixed belief identity. |
| `misconceptions[].label` | A short name for the wrong belief. |
| `misconceptions[].idea` | The belief as a clause that fits the unsure template. |
| `misconceptions[].why` | Correction and an action to try instead. |

Text must be nonempty. The schema and validator reject unknown fields, missing template tokens and incorrect belief IDs or order. Preserve the beliefs the proxy checks. To change the topic, update and evaluate its questions.

## Logic

The pure module imports identities, answer length and the decision model's confidence gate from `proxy/logic/06-misconceptions.js`. Keep that module and `shared.js` when copying this pattern.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming the bad field. |
| `feedback(content, answers, model?)` | `{ kind, heading, text }`. Kinds are `correct`, `misconception`, `unsure-key`, `unsure-misconception`, `none`. Without a decision model, uses Jev's confidence gate, also used by the default Perplexity provider. Invalid labels or probabilities throw. |
| `validateState(value)` | A clean `{ answer, ticked }` draft, or `null`. |
| `ANSWER_LIMIT` | The proxy-owned answer limit. |

`answers` is `{ misconception: { choice, confidence } }`. A no-match label uses the comparison prompt at every confidence. Known beliefs and the key idea use the configured decision model's gate. Only authored strings reach the learner.

Pass `state: { read, write }` to save drafts and checklist ticks. Check results are not saved. Editing during a check discards its result. Repeated enhancement returns the same instance. `destroy()` removes listeners, cancels checks and restores the native fallback.

## Use it

Copy this folder, `lib/` and the two proxy logic modules, preserving relative paths. Include `lib/base.css`, then `pattern.css`. Give each instance a unique id prefix. Serve the proxy on the page's origin.

```js
import { render } from './patterns/misconception/render.js';
import { enhance } from './patterns/misconception/enhance.js';
import { strings } from './patterns/misconception/strings.js';
import { createAsk } from './lib/ask.js';
// Server, with the English example loaded as content:
const markup = render(content, strings.en, { id: 'study', lang: 'en' });
// Browser:
const ask = createAsk({ endpoint: '/api/patterns', fetch: window.fetch.bind(window) });
enhance(document.querySelector('[data-lp-pattern="misconception"]'), { content, strings: strings.en, ask });
```

The shared `ask(block, fields, { challengeSlot, signal? })` client returns typed answers. Its cached `config()` supplies the provider, decision model, bilingual data notice and public verification key. The notice appears under the answer box. Turnstile loads after a clearance refusal. Missing `ask`, failed configuration or a failed check opens the self-check. The demo uses fixed feedback and sends no text.

This pattern collects and stores no answers. A host may collect unmatched answers for review with explicit consent, separate storage and a retention policy. The learner page shows no review inbox, raw decision model output or request timing.

## Adapt it with your agent

> Adapt this example for [audience]. Keep familiarity versus recall and the four beliefs about rereading, highlighting, cramming and watching. Keep the fields and belief order. Explain each correction and what to do instead. Give uncertain results a comparison prompt. Write English and Québec French together, using vous and « guillemets » with non-breaking spaces. Preserve authored feedback, the data notice, proxy gates, on-demand verification and offline self-check. Evaluate any changed proxy questions before use.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
