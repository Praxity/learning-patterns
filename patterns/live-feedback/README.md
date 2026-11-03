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

## Use it when

Use it for short action plans, outline-like writing assignments, and generally to give learners immediate feedback on responses that can be classified. This example checks for three different actions a colleague could see or hear, a time or situation, and your own commitments. The feedback helps you revise.

## Avoid it when

It gives no grade.

## How it works

1. The learner writes a plan. Once it's 20 characters or longer, each pause in typing checks it.
2. A checklist of four criteria updates after each check. Met criteria move to the top with a green check. The rest show a hint, and so do criteria the model isn't sure about.
3. When all four are met, "Well done!" appears and checking stops until the next edit.

A check waits for a pause that fits the learner's typing speed, between 0.4 and 0.9 seconds. A met criterion stays met while the last sentence is unfinished, so a half-typed sentence can't undo it.

Automatic checks stop after 40 per page load. From then on, or when a check fails, the learner ticks the criteria themselves. Without JavaScript, the learner gets the prompt, the answer box and the tick list.

## Evidence

Research on feedback supports specific, timely information for revision. The right timing depends on the task ([Shute, 2008](https://doi.org/10.3102/0034654307313795)). Linking an action to a time or situation draws on research about implementation intentions ([Gollwitzer, 1999](https://doi.org/10.1037/0003-066X.54.7.493)). These sources inform the checklist. They do not support the specific wait or 40-check allowance. This pattern and its feedback timing have not been tested with learners.

[Dhakal et al., CHI 2018](https://doi.org/10.1145/3173574.3174220) measured a mean inter-key interval of 239 ms, and over 480 ms for slow typists, in a transcription task. [Nielsen, 1993](https://www.nngroup.com/articles/response-times-3-important-limits/) identifies about one second as the limit for uninterrupted flow. These inform the adaptive wait. They do not establish the multiplier, sample window or cap. Network time adds to the wait.

Perplexity Decider v1.1 scored 11/12 on authored test answers using the original Jev question wording and confidence gates. This small test does not establish accuracy on learner answers or improved learning. The shared decision function keeps the original inclusive gates: found at 0.65 or above, missing at 0.35 or below, uncertain between them.

## Accessibility

Daily proxy caps show and announce the reason and midnight UTC reset once, keep focus in place and leave the fallback usable. Checks then stop until reload.

Meets the shared baseline in the root README.

- The list and checking line stay silent. The polite status region announces a changed count once. Reaching all four items announces "Well done! 4 of 4 done" once, and later checks that stay at four announce nothing. Focus stays in place.
- The box never locks, so typing after "Well done!" keeps every character.
- Checkmarks and open dashed circles show state through shape as well as colour. Each list item also has a screen-reader prefix, "Done:" or "To add:". Native fallback checkboxes expose their checked state.
- Reordering uses a 200 ms transform transition. Reduced motion moves items instantly.
- Native checkboxes work without JavaScript and after a failed check.
- English and Québec French share fields and controls.
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

Authored text is capped at 120 characters for titles and labels, 400 for questions and prompts, 300 for options, and 1,500 for answers, explanations and passage text. The schema gives each field's limit; `validateContent` enforces it.

`logic.js` imports decisions, criterion IDs and the answer limit from `proxy/logic/02-live.js`. The browser and proxy share that pure module.

| Export | Returns or value |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming a bad field. |
| `feedback(content, answers, draft = '', previous = [])` | `{ count, total, items }`; each item is `{ id, mark, text }`, with mark `done` or `todo`, ordered done first. Invalid decision answers throw. |
| `validateState(value)` | A clean `{ answer, ticked }`, or `null` for invalid saved values. |
| `ANSWER_LIMIT` | Proxy-owned 1,200-character cap. |
| `MIN_CHARS`, `AUTO_CHECK_LIMIT` | 20 trimmed characters, 40 automatic checks. |

`lib/typing-pause.js` owns the adaptive wait. Live feedback uses `typingPause({ minChars: MIN_CHARS, questionMark: false })`, with `key(time)`, `wait()` and `delay(text, checked, enter = false)`. Delay returns milliseconds or `null` when no check is due. Live feedback does not request an immediate check on Enter.

Pass `state: { read, write }` to save drafts and checklist ticks. Check results are not saved. Repeated enhancement returns the same instance. `destroy()` removes listeners and the "Well done!" line, cancels checks and restores the native checklist, keeping the draft and ticks. Re-enhancement keeps the remaining automatic allowance.

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

> Adapt the action plan for [audience]. Keep three different observable actions, at least one time or situation, and the learner’s own commitments. Keep the four criterion IDs, fields and authored feedback. Write English and Québec French together, using vous. Preserve the pause, unfinished-sentence rule, page allowance, completion pause, announcements, data notice and self-check. Evaluate any changed proxy questions before use.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
