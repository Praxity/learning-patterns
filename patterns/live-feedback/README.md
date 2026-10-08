---
title: Feedback while you type
title_fr: De la rétroaction pendant que vous écrivez
summary: Write a classifiable response and see a checklist update when you pause.
section: question
ai: yes
offline: yes
learners: not tried
---
# Feedback while you type

Write three actions to become more assertive at work. A checklist updates when you pause. The decision model selects authored feedback to help you revise.

## When to use it

Use it for short action plans, outline-like writing assignments, and generally to give learners immediate feedback on responses that can be classified. This example checks for three different actions a colleague could see or hear, a time or situation, and your own commitments. The feedback helps you revise. It gives no grade.

## How it works

1. Write at least 20 characters, excluding spaces at the start and end. A typing pause checks changed text with Perplexity Decider v1.1.
2. Read the checklist. Done items move to the top; the other items give hints for revision. Each group keeps criterion order.
3. Revise your plan. A short count is announced only when the number of done items changes.
4. When all four items are done, "Well done!" appears and the box becomes read-only. Automatic checks stop. Choose "Edit my plan" to unlock it and resume checks on your next input.

The wait is 2.5 times the median of the last nine inter-key gaps, between 400 and 900 ms. It defaults to 700 ms until three gaps are available. Question marks and Enter keep this wait for plans.

All four items start with open dotted circles. Uncertain decisions keep the hint and circle. Done items have green checkmarks. They stay done while the last sentence is unfinished. A final period, exclamation mark, question mark or newline allows them to change.

The quiet "Checking…" line appears during requests. Typing stays available until all four items are done. Editing cancels the pending request and discards stale results. Unchanged text skips the check.

All instances share 40 automatic checks per page session. At the limit, a calm message and native self-checks let you finish. Reloading resets the allowance. Failed or refused requests also open the self-checks. Without JavaScript, the prompt, answer box and self-checks appear immediately.

## Evidence

Research on feedback supports specific, timely information for revision. The right timing depends on the task ([Shute, 2008](https://doi.org/10.3102/0034654307313795)). Linking an action to a time or situation draws on research about implementation intentions ([Gollwitzer, 1999](https://doi.org/10.1037/0003-066X.54.7.493)). These sources inform the checklist. They do not support the specific wait or 40-check allowance. This pattern and its feedback timing have not been tested with learners.

[Dhakal et al., CHI 2018](https://doi.org/10.1145/3173574.3174220) measured a mean inter-key interval of 239 ms, and over 480 ms for slow typists, in a transcription task. [Nielsen, 1993](https://www.nngroup.com/articles/response-times-3-important-limits/) identifies about one second as the limit for uninterrupted flow. These inform the adaptive wait. They do not establish the multiplier, sample window or cap. Network time adds to the wait.

Perplexity Decider v1.1 scored 11/12 on authored test answers using the original Jev question wording and confidence gates. This small test does not establish accuracy on learner answers or improved learning. The shared decision function keeps the original inclusive gates: found at 0.65 or above, missing at 0.35 or below, uncertain between them.

## Accessibility

Meets the shared baseline in the root README.

- The list and checking line stay silent. The polite status region announces changed counts once, or "Well done! 4 of 4 done" on completion. Focus stays in place.
- The completed box is read-only, muted and still focusable, with AA text contrast. "Edit my plan" unlocks it and puts focus and the caret at the end of the text.
- Checkmarks and open dotted circles show state through shape as well as colour. State never depends on colour alone.
- Reordering uses a 200 ms transform transition. Reduced motion moves items instantly.
- Native checkboxes work without JavaScript and after a failed check.
- English and Québec French share fields and controls. French uses vous.
- Browser checks cover keyboard use, axe, narrow reflow, text spacing, reduced motion and forced colours. Screen reader listening requires a separate human check.

## Content fields

| Field | Meaning |
| --- | --- |
| `prompt` | The learner's writing task. |
| `criteria` | Exactly four items, ordered `three_actions`, `observable`, `when`, `commitments`. |
| `criteria[].id` | Fixed question identity. |
| `criteria[].done` | The done statement and self-check checkbox label. |
| `criteria[].todo` | A short revision hint, used initially and for missing or uncertain decisions. Never supplies an answer. |

All fields are escaped plain text. Unknown fields, empty strings and incorrect criterion IDs are rejected. Preserve what the proxy questions check. To change the topic, change and evaluate those questions too.

## Logic

`logic.js` imports decisions, criterion IDs and the answer limit from `proxy/logic/02-live.js`. The browser and proxy share that pure module.

| Export | Returns or value |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming a bad field. |
| `feedback(content, answers, draft = '', previous = [])` | `{ count, total, items }`; each item is `{ id, mark, text }`, with mark `done` or `todo`, ordered done first. Invalid decision answers throw. |
| `validateState(value)` | A clean `{ answer, ticked }`, or `null` for invalid saved values. |
| `ANSWER_LIMIT` | Proxy-owned 1,200-character cap. |
| `MIN_CHARS`, `AUTO_CHECK_LIMIT` | 20 trimmed characters, 40 automatic checks. |

`lib/typing-pause.js` owns the adaptive wait. Live feedback uses `typingPause({ minChars: MIN_CHARS, questionMark: false })`, with `key(time)`, `wait()` and `delay(text, checked, enter = false)`. Delay returns milliseconds or `null` when no check is due. Live feedback does not request an immediate check on Enter.

Pass `state: { read, write }` to save drafts and checklist ticks. Check results are not saved. Repeated enhancement returns the same instance. `destroy()` removes listeners and completion controls, cancels checks, unlocks the box and restores the native checklist, keeping the draft and ticks. Re-enhancement keeps the remaining automatic allowance.

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

> Adapt the action plan for [audience]. Keep three different observable actions, at least one time or situation, and the learner’s own commitments. Keep the four criterion IDs, fields and authored feedback. Write English and Québec French together, using vous. Preserve the pause, unfinished-sentence rule, page allowance, completion lock, Edit control, announcements, data notice and self-check. Evaluate any changed proxy questions before use.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
