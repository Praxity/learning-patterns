---
title: Spot the misconception
title_fr: Repérez l'idée fausse
summary: Answer a study question, compare an authored refutation or key idea with a model answer.
section: question
ai: yes
offline: yes
learners: not tried
---
# Spot the misconception

You answer a question about studying, then compare your reasoning with a model answer and feedback about a common misconception.

## When to use it

Use it when a short answer can reveal a specific wrong belief. The example asks whether rereading notes prepares you for a test. The proxy checks a fixed catalogue of study beliefs. Feedback helps you revise your reasoning; it is not a grade.

## How it works

1. Write an answer and select "Check my answer". Verification appears inline only if needed.
2. A key idea gets a green check. A known misconception gets its name and one authored refutation.
3. "Not sure" names what you may mean without treating it as an error. An unmatched answer gets a comparison prompt.
4. The model answer opens with every result. Revise your answer and check again.
5. If the automatic check is unavailable, the same button opens the model answer and a self-check list of common misconceptions. Tick any belief your answer includes and use its refutation to revise.

## Evidence

Refutation texts produced an average learning benefit of 0.41 standard deviations across 44 comparisons involving 3,869 participants ([Schroeder and Kucera, 2022](https://doi.org/10.1007/s10648-021-09656-z)). This supports the choice to name a mistaken idea and explain the correction. A separate review found larger average effects for explanatory computer feedback than for right-or-wrong feedback ([Van der Kleij et al., 2015](https://doi.org/10.3102/0034654314564881)). Here the decision model only chooses which authored explanation to show. The decision model's choices were checked against agent-written answers, not learners. Accurate identification of learners' misconceptions and learning from this brief feedback have not been tested with learners.

## Accessibility

The question labels the three-line answer box. Feedback appears on submit and updates one status region once, without moving focus. Icons accompany text; colour carries no meaning alone. Native disclosures and checkboxes work with keyboards. The shared styles support reduced motion, forced colours and narrow layouts. Without JavaScript, the answer box, open model answer and self-check list are available immediately. English and Québec French use the same content structure.

The browser tests cover all results, fallback, axe, keyboard use, 320 px reflow, text spacing and lifecycle in three engines. Human screen-reader checks remain separate.

## Content fields

| Field | Meaning |
| --- | --- |
| `question` | The quiz question and answer-box label. |
| `keyIdea` | Feedback when the expected idea is found. |
| `model` | The authored model answer. |
| `unsureKeyIdea` | A useful comparison prompt for a low-confidence key idea. |
| `unsureMisconception` | Authored template containing `{idea}` and `{why}`. |
| `noMatch` | A prompt to compare unmatched reasoning with the model answer. |
| `misconceptions` | Exactly four entries, in order: `rereading`, `highlighting`, `cramming`, `watching`. |
| `misconceptions[].id` | The proxy's fixed belief identity. |
| `misconceptions[].label` | A short name for the wrong belief. |
| `misconceptions[].idea` | The belief as a clause that fits the unsure template. |
| `misconceptions[].why` | One sentence refuting the belief and giving an action instead. |

Required text is nonempty. Unknown fields, missing template tokens and wrong catalogue identities are rejected. The schema and validator require the same order. Rewording must preserve the beliefs the proxy checks. Changing the topic requires updating and evaluating the server's question set.

## Logic

The pure module imports identities, answer length and the decision model's confidence gate from `proxy/logic/06-misconceptions.js`. Keep that module and `shared.js` when copying this pattern.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming the bad field. |
| `feedback(content, answers, model?)` | `{ kind, heading, text }`. Kinds are `correct`, `misconception`, `unsure-key`, `unsure-misconception`, `none`. Without a decision model, uses Jev's confidence gate, also used by the default Perplexity provider. Invalid labels or probabilities throw. |
| `validateState(value)` | A clean `{ answer, ticked }` draft, or `null`. |
| `ANSWER_LIMIT` | The proxy-owned answer limit. |

`answers` is `{ misconception: { choice, confidence } }`. A no-match label uses the comparison prompt at every confidence. Known beliefs and the key idea use the configured decision model's gate. Only authored strings reach the learner.

Optional `state: { read, write }` retains drafts and native ticks, never automated judgments. Editing a pending draft discards its judgment. Enhancement is idempotent; `destroy()` removes listeners, aborts pending work and restores the native fallback.

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

The shared `ask(block, fields, { challengeSlot, signal? })` client returns typed answers. Its cached `config()` supplies the provider, decision model, bilingual data notice and public verification key. The notice sits under the answer box. Turnstile loads only on a clearance refusal. Missing `ask`, failed configuration and thrown checks all select the self-check version. The demo uses fixed feedback and sends no text.

The learner page contains no designer's inbox, raw decision model output or timing. A host could collect unmatched answers separately for authors to review, with explicit consent, its own storage and retention policy. This pattern neither collects nor stores them.

## Adapt it with your agent

> Rewrite this study question for my audience: [audience]. Keep the key idea about familiarity versus recall and the four beliefs about rereading, highlighting, cramming and watching. Keep the content fields and catalogue order. Write one refutation per belief that says why it is wrong and what to do instead. Give unsure answers a useful comparison prompt. Keep English and Québec French together, use vous, and use « guillemets » with non-breaking spaces. Preserve authored-only feedback, the configured data notice, decision model's proxy gates, on-demand verification and the offline self-check. To change the topic, update and evaluate the proxy's question set first.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
