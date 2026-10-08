---
title: Explain it back
title_fr: Expliquez-le avec vos mots
summary: Explain a short lesson, check its three key ideas, then reread the parts to add.
section: reading
ai: yes
offline: yes
learners: not tried
---
# Explain it back

You explain a lesson in your own words, then see which key ideas your explanation includes.

## When to use it

Use it after a short reading with a few clear ideas to explain. The example covers stonewalling, announcing a pause and returning to the conversation. The automatic check uses fixed questions about these ideas. It helps revise an explanation; it is not a grade.

## How it works

1. You read the three lesson sections and explain them to a new manager in two sentences.
2. You select "Check my explanation". A short verification appears if needed.
3. You see how many key ideas were found. Each idea says "Found", "To add" or "Not sure", with an authored explanation.
4. You follow a rereading link to the matching lesson heading, revise your explanation and check again.
5. When all three ideas are found, a model explanation opens. If the automatic check is unavailable, you check the three ideas yourself and compare with the model explanation.

## Evidence

Evidence coming.

## Accessibility

Meets the shared baseline in the root README.

- Results appear on submit and announce one summary without moving focus.
- Rereading links move keyboard focus to the lesson heading.
- Each row has an icon and a word as well as colour. "To add" is orange; "Not sure" is neutral.
- Without JavaScript or an automatic check, the answer box, native checklist and model explanation remain available.
- English and Québec French have the same fields and controls.

## Content fields

All fields are plain text and escaped when rendered.

| Field | Meaning |
| --- | --- |
| `task` | The card title and writing task. |
| `model` | The authored model explanation. |
| `ideas` | Exactly three ideas, ordered `stonewalling`, `pause`, `return`. |
| `ideas[].id` | The fixed question identity. |
| `ideas[].heading`, `ideas[].body` | The lesson heading and paragraph. |
| `ideas[].label` | The self-check statement. |
| `ideas[].met`, `ideas[].missed`, `ideas[].unsure` | Authored feedback for each decision. |

Required strings are nonempty. Unknown fields and wrong idea identities are rejected. The schema and validator require the same fixed lesson order. Changing the topic also requires changing and evaluating the proxy's question set. Rewording the lesson must preserve what those questions check.

## Logic

`logic.js` is pure and imports the gate, idea identities and answer limit from `proxy/logic/`. Keep those browser-safe modules when copying the pattern.

| Function | Returns |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming the bad field. |
| `feedback(content, answers)` | `{ count, total, allFound, items }`. Items are `{ id, mark, text, heading }`, with `mark: 'met'`, `'missed'` or `'unsure'`. Invalid model answers throw. |
| `validateState(value)` | A clean `{ answer, ticked }` draft, or `null` for invalid saved values. |
| `ANSWER_LIMIT` | The proxy-owned maximum answer length. |

Pass optional `state: { read, write }` to retain a draft and self-check ticks. Automated judgments are not saved. Editing while a check is pending discards its result. Repeated enhancement returns the same instance; `destroy()` removes listeners, cancels pending checks and restores the native fallback.

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

The shared client is `ask(block, fields, { challengeSlot, signal? })`, returning typed answers. Its `config()` method caches the public configuration. The shared notice helper renders the English or French notice received from that configuration. It loads Turnstile only after a clearance refusal and retries once with the solved token. `AskError.type` is `offline`, `refused`, `busy`, `budget` or `invalid`. Every failure, including missing `ask` or failed configuration, selects the self-check fallback. The demo uses fixed answers and sends no text.

## Adapt it with your agent

> Rewrite the Explain it back example for my audience: [audience]. Keep the three ideas about unexplained withdrawal, announcing a pause, and agreeing when to return and following through. Keep `{ task, model, ideas: [{ id, heading, body, label, met, missed, unsure }] }` and the fixed idea order. Write specific feedback for each idea, including a useful unsure line. Keep English and Québec French together and address French learners with vous. Models only choose authored lines. Keep the no-model self-check, lesson focus links, proxy-owned gates, data notice and on-demand verification. To change the topic, update the server's question set and evaluate it against authored sample labels before enabling it.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
