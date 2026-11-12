---
title: Explain what you learned
title_fr: Expliquer ce que vous avez appris
summary: Explain a short lesson, check three key ideas and reread any you missed.
section: reading
ai: yes
offline: yes
learners: not tried
---
# Explain what you learned

Explain a lesson in your own words and check which key ideas you included.

## Use it when

- Learners have read a short text and need to put its key ideas in their own words.
- Learners can repeat a definition but can't yet explain how the ideas connect.

## Avoid it when

- When the reading is long or has more than three key ideas, use [Questions inside the reading](../review-prompts/README.md).
- When you need a grade, use an assessment. This pattern helps learners revise.

## Before you use it

It needs a server running a model. If automatic checking is unavailable, the explanation step offers the checklist and model answer.

Write a short lesson, three checklist statements, hints and a model answer, then update and test the model checks for those ideas.

## How it works

1. The learner reads a three-part lesson, then selects "I'm ready to explain it", which hides the lesson.
2. They explain the lesson in two sentences, as if to a new manager, and select "Check my explanation".
3. Each key idea is marked "Found", "To add" or "Not sure", with a count of ideas found.
4. "Read the text again" or a feedback link brings the lesson back. The draft stays, so the learner can revise and check again.
5. The model answer appears once all three ideas are found. If automatic checking is unavailable, the learner ticks the ideas themselves and compares with the model answer.

## Evidence

Prompts to explain connections in learning material produced an average benefit of 0.55 standard deviations across 69 effect sizes ([Bisra et al., 2018](https://doi.org/10.1007/s10648-018-9434-x)). Explaining an idea to a new manager also draws on research about learning by teaching ([Fiorella and Mayer, 2016](https://doi.org/10.1007/s10648-015-9348-9)). These studies support asking learners to explain in their own words, but did not test this pattern. Research on explanatory feedback informs the hints and links to missing ideas ([Van der Kleij et al., 2015](https://doi.org/10.3102/0034654314564881)). With JavaScript, reading and explaining are separate steps. Learners can return to the reading at any time. The decision model was tested only on agent-written answers. The two-sentence task, missing-idea checks and passage links have not been tested with learners.

## Accessibility

Meets the shared baseline in the root README.

Write three clear checklist statements, a hint for each and a model answer. Without JavaScript, learners see the lesson, answer box, checklist and model answer together.

## Content fields

All fields are plain text and escaped when rendered.

| Field | Meaning |
| --- | --- |
| `task` | The card title and writing task. |
| `model` | The authored model answer. |
| `ideas` | Exactly three ideas, ordered `stonewalling`, `pause`, `return`. |
| `ideas[].id` | The fixed question identity. |
| `ideas[].heading`, `ideas[].body` | The lesson heading and paragraph. |
| `ideas[].label` | The self-check statement. |
| `ideas[].met`, `ideas[].missed`, `ideas[].unsure` | Authored feedback for each decision. |

Text must be nonempty. The schema and validator reject unknown fields and require the fixed idea IDs and order. Keep the meaning of the proxy questions when rewording. To change the topic, change and evaluate those questions too.

## Logic

Authored text is capped at 120 characters for titles and labels, 400 for questions and prompts, 300 for options, and 1,500 for answers, explanations and passage text. The schema gives each field's limit; `validateContent` enforces it.

`logic.js` is pure and imports the gate, idea identities and answer limit from `proxy/logic/`. Keep those browser-safe modules when copying the pattern.

| Function | Returns |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming the bad field. |
| `feedback(content, answers)` | `{ count, total, allFound, items }`. Items are `{ id, mark, text, heading }`, with `mark: 'met'`, `'missed'` or `'unsure'`. Invalid decision model answers throw. |
| `validateState(value)` | A clean `{ answer, ticked }` draft, or `null` for invalid saved values. |
| `ANSWER_LIMIT` | The proxy-owned maximum answer length. |

Pass `state: { read, write }` to save drafts and checklist ticks. Restoring either opens the explanation step. Check results stay available between steps but are not saved. Editing during a check discards its result. Repeated enhancement returns the same instance. `destroy()` removes listeners, cancels checks and restores the server markup with both steps and the native fallback visible.

Stored drafts restore intact even above the send limit. The host owns its total storage budget; the send limit still applies before every proxy request. Self-check ticks survive restoration. Automated judgments are not restored.

## Use it

Copy this folder, `lib/` and `proxy/logic/`, preserving relative paths. Include `lib/base.css`, then `pattern.css`. Each instance needs a unique id prefix. Serve the proxy on the page's own origin.

```js
import { render } from './patterns/explain-back/render.js';
import { enhance } from './patterns/explain-back/enhance.js';
import { strings } from './patterns/explain-back/strings.js';
import { createAsk } from './lib/ask.js';
// Server, with the English example loaded as content:
const markup = render(content, strings.en, { id: 'explain', lang: 'en' });
// Browser, after the server markup reaches the page:
const ask = createAsk({ endpoint: '/api/patterns', fetch: window.fetch.bind(window) });
enhance(document.querySelector('[data-lp-pattern="explain-back"]'), { content, strings: strings.en, ask });
```

The shared `ask(block, fields, { challengeSlot, signal? })` client returns typed answers. Its cached `config()` supplies the English and French data notice. Turnstile loads after a clearance refusal and retries once with the solved token. `AskError.type` is `offline`, `refused`, `busy`, `budget` or `invalid`. Any failure, missing `ask` or failed configuration opens the self-check. The demo uses fixed answers and sends no text.

### Accessibility details

Text fields keep the full draft, including text over the limit. Checking or saving shows a linked length error instead of cutting text. Limits come from the existing logic constants. The automatic action stays enabled while model configuration loads. An early press waits for configuration, then checks or uses the existing fallback.

Daily proxy caps show and announce the reason and midnight UTC reset once, keep focus in place and leave the fallback usable.

- Results appear on submit and announce one summary without moving focus.
- While a check runs, "Check my explanation" keeps its label and focus, and pressing it again sends nothing. "Checking your explanation…" appears beside it. If the check takes more than a second, the status region says it once.
- If automatic checking fails while "Check my explanation" has focus, focus moves to the first idea in the checklist before the button hides. The checklist's legend is the message, so the screen reader reads it once as focus enters the group, and the status region stays empty. If focus is elsewhere, the status region announces the message once.
- Switching steps reveals the new step, waits for browser layout, focuses its heading, then hides the previous step. Feedback links open the reading step and focus the matching lesson heading. "Read the text again" stays available after a check.
- Each row has an icon and a word as well as colour. "To add" is orange; "Not sure" is neutral.
- Without JavaScript, the lesson, answer box, native checklist and model answer appear together. JavaScript adds the step controls. If automatic checking is unavailable, the explanation step offers the checklist and model answer.
- English and Québec French have the same fields and controls.

## Adapt it with your agent

> Adapt this example for [audience]. Keep unexplained withdrawal, announcing a pause, and agreeing when to return and following through. Keep the fields and idea order. Write useful feedback for each result. Write English and Québec French together, using vous. Preserve authored feedback, the self-check, lesson focus links, proxy gates, data notice and on-demand verification. Evaluate any changed proxy questions against authored sample labels before use.

## Related patterns

- [Questions inside the reading](../review-prompts/README.md)
- [Check your own answer](../self-check/README.md)

## Help improve this pattern

Tried it with learners? [Tell us what happened](https://github.com/Praxity/learning-patterns/issues/new?template=pattern-feedback.yml&pattern=Explain%20what%20you%20learned). You can also [suggest a change to this page](https://github.com/Praxity/learning-patterns/edit/main/patterns/explain-back/README.md).

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
