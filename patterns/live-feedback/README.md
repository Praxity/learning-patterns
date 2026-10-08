---
title: Feedback while you type
title_fr: De la rétroaction pendant que vous écrivez
summary: Write an action plan and see four checklist items update when you pause.
section: question
ai: yes
offline: yes
learners: not tried
---
# Feedback while you type

Write three actions to become more assertive at work. A checklist updates when you pause. The decision model selects authored feedback to help you revise.

## When to use it

Use it for short action plans. This example checks for three different actions a colleague could see or hear, a time or situation, and your own commitments. The feedback helps you revise. It gives no grade.

## How it works

1. Write at least 20 characters, excluding spaces at the start and end. After a 0.7 second pause, the proxy checks changed text with Perplexity Decider v1.1.
2. Read the four checklist items, which update silently.
3. Select "Check my answer so far" to hear a summary, including missing and uncertain items.

The "Checking…" line appears during requests. You can keep typing. Editing or starting another check cancels the previous request and discards its result. Found items stay found while the last sentence is unfinished. A final period, exclamation mark, question mark or newline allows them to change.

All instances share 20 automatic checks per page session. Then automatic checks pause, but the button still works within the proxy’s daily and cost limits. Reloading resets the page allowance. If the proxy is unavailable or refuses a check, use the native checklist. Without JavaScript, the prompt, answer box and checklist appear immediately.

## Evidence

Research on feedback supports specific, timely information for revision. The right timing depends on the task ([Shute, 2008](https://doi.org/10.3102/0034654307313795)). Linking an action to a time or situation draws on research about implementation intentions ([Gollwitzer, 1999](https://doi.org/10.1037/0003-066X.54.7.493)). These sources inform the checklist. They do not support the specific 0.7 second delay or 20-check allowance. This pattern and its feedback timing have not been tested with learners.

Perplexity Decider v1.1 scored 11/12 on authored test answers using the original Jev question wording and confidence gates. This small test does not establish accuracy on learner answers or improved learning. The shared decision function keeps the original inclusive gates: found at 0.65 or above, missing at 0.35 or below, uncertain between them.

## Accessibility

Meets the shared baseline in the root README.

- The list updates silently. The checking line is also silent. The button announces one summary through the polite status region without moving focus.
- Each result has an icon and a word as well as colour. Typing stays available during requests.
- Native checkboxes work without JavaScript and after a failed check.
- English and Québec French share fields and controls. French uses vous.
- Browser checks cover keyboard use, axe, narrow reflow, text spacing, reduced motion and forced colours. Screen reader listening requires a separate human check.

## Content fields

| Field | Meaning |
| --- | --- |
| `prompt` | The learner's writing task. |
| `criteria` | Exactly four items, ordered `three_actions`, `observable`, `when`, `commitments`. |
| `criteria[].id` | Fixed question identity. |
| `criteria[].label` | The initial and self-check statement. |
| `criteria[].short` | The name used in the announced summary. |
| `criteria[].met`, `criteria[].missed`, `criteria[].unsure` | Authored feedback for each decision. |

All fields are escaped plain text. Unknown fields, empty strings and incorrect criterion IDs are rejected. Preserve what the proxy questions check. To change the topic, change and evaluate those questions too.

## Logic

`logic.js` imports decisions, criterion IDs and the answer limit from `proxy/logic/02-live.js`. The browser and proxy share that pure module.

| Export | Returns or value |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming a bad field. |
| `feedback(content, answers, draft = '', previous = [])` | `{ count, total, items }`; each item is `{ id, mark, text, short }`, with mark `met`, `missed` or `unsure`. Invalid decision answers throw. |
| `validateState(value)` | A clean `{ answer, ticked }`, or `null` for invalid saved values. |
| `ANSWER_LIMIT` | Proxy-owned 1,200-character cap. |
| `MIN_CHARS`, `PAUSE_MS`, `AUTO_CHECK_LIMIT` | 20 trimmed characters, 700 milliseconds, 20 automatic checks. |

Pass `state: { read, write }` to save drafts and checklist ticks. Check results are not saved. Repeated enhancement returns the same instance. `destroy()` removes listeners, cancels checks and restores the native checklist, keeping the draft and ticks. Re-enhancement keeps the remaining automatic allowance.

## Use it

Copy this folder, `lib/` and `proxy/logic/`, preserving relative paths. Include `lib/base.css` and then `pattern.css`. Give each instance a unique id prefix. Serve the proxy on the page's own origin.

```js
import { render } from './patterns/live-feedback/render.js';
import { enhance } from './patterns/live-feedback/enhance.js';
import { strings } from './patterns/live-feedback/strings.js';
import { createAsk } from './lib/ask.js';
const markup = render(content, strings.en, { id: 'plan', lang: 'en' });
// After the server markup reaches the browser:
enhance(document.querySelector('[data-lp-pattern="live-feedback"]'), {
  content, strings: strings.en, ask: createAsk()
});
```

The shared client calls `ask('02-live', { answer }, { challengeSlot, signal })` and reads `/config` for the data notice. Verification appears after a clearance refusal. Request or configuration failures open the self-check. Use Perplexity; other live providers select the self-check. The demo uses fixed feedback and sends no text.

## Adapt it with your agent

> Adapt the action plan for [audience]. Keep three different observable actions, at least one time or situation, and the learner’s own commitments. Keep the four criterion IDs, fields and authored feedback. Write English and Québec French together, using vous. Preserve the pause, unfinished-sentence rule, page allowance, summary button, data notice and self-check. Evaluate any changed proxy questions before use.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
