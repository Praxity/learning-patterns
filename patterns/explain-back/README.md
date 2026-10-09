---
title: Explain it back
title_fr: Expliquez-le avec vos mots
summary: Explain a short lesson, check three key ideas and reread any you missed.
section: reading
ai: yes
offline: yes
learners: not tried
---
# Explain it back

Explain a lesson in your own words and check which key ideas you included.

## When to use it

Use it after a short reading. This example checks three ideas: stonewalling, announcing a pause and returning to the conversation. The feedback helps you revise your explanation. It gives no grade.

## How it works

1. Read the three lesson sections, then select "I'm ready to explain it".
2. Explain stonewalling and taking a time-out to a new manager in two sentences. Select "Check my explanation". Verification appears if needed.
3. Read the idea count and feedback for each idea: "Found", "To add" or "Not sure".
4. Select "Read the text again" or a feedback link to revisit the lesson. Your draft and result stay available. Return to your explanation, revise it and check again.
5. When all three ideas are found, the model answer opens. If automatic checking is unavailable, use the checklist and compare with the model answer.

## Evidence

Prompts to explain connections in learning material produced an average benefit of 0.55 standard deviations across 69 effect sizes ([Bisra et al., 2018](https://doi.org/10.1007/s10648-018-9434-x)). Explaining an idea to a new manager also draws on research about learning by teaching ([Fiorella and Mayer, 2016](https://doi.org/10.1007/s10648-015-9348-9)). These studies support asking learners to explain in their own words, but did not test this pattern. Research on explanatory feedback informs the hints and links to missing ideas ([Van der Kleij et al., 2015](https://doi.org/10.3102/0034654314564881)). With JavaScript, reading and explaining are separate steps. Learners can return to the reading at any time. The decision model was tested only on agent-written answers. The two-sentence task, missing-idea checks and passage links have not been tested with learners.

## Accessibility

Daily proxy caps show and announce the reason and midnight UTC reset once, keep focus in place and leave the fallback usable.

Meets the shared baseline in the root README.

- Results appear on submit and announce one summary without moving focus.
- Switching steps reveals the new step, waits for browser layout, focuses its heading, then hides the previous step. Feedback links open the reading step and focus the matching lesson heading. "Read the text again" stays available after a check.
- Each row has an icon and a word as well as colour. "To add" is orange; "Not sure" is neutral.
- Without JavaScript, the lesson, answer box, native checklist and model answer appear together. JavaScript adds the step controls. If automatic checking is unavailable, the explanation step offers the checklist and model answer.
- English and Québec French have the same fields and controls.

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

`logic.js` is pure and imports the gate, idea identities and answer limit from `proxy/logic/`. Keep those browser-safe modules when copying the pattern.

| Function | Returns |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming the bad field. |
| `feedback(content, answers)` | `{ count, total, allFound, items }`. Items are `{ id, mark, text, heading }`, with `mark: 'met'`, `'missed'` or `'unsure'`. Invalid decision model answers throw. |
| `validateState(value)` | A clean `{ answer, ticked }` draft, or `null` for invalid saved values. |
| `ANSWER_LIMIT` | The proxy-owned maximum answer length. |

Pass `state: { read, write }` to save drafts and checklist ticks. Restoring either opens the explanation step. Check results stay available between steps but are not saved. Editing during a check discards its result. Repeated enhancement returns the same instance. `destroy()` removes listeners, cancels checks and restores the server markup with both steps and the native fallback visible.

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

## Adapt it with your agent

> Adapt this example for [audience]. Keep unexplained withdrawal, announcing a pause, and agreeing when to return and following through. Keep the fields and idea order. Write useful feedback for each result. Write English and Québec French together, using vous. Preserve authored feedback, the self-check, lesson focus links, proxy gates, data notice and on-demand verification. Evaluate any changed proxy questions against authored sample labels before use.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
