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

Write three actions to become more assertive at work. A short checklist updates when you pause, so you can revise your plan without submitting it each time. The decision model chooses between authored lines. It never writes feedback.

## When to use it

Use it for a short action plan with a few concrete criteria. This example checks for three distinct actions, observable behaviours, a time or situation, and personal commitments. These checks help you revise; they are not a grade.

## How it works

After a 0.7 second typing pause, changed text of at least 20 trimmed characters is checked through the existing proxy with Perplexity Decider v1.1. The four items update silently. Select "Check my answer so far" to hear one summary, including missing and uncertain items.

A quiet "Checking…" line leaves the text box available during a slow request. Editing or starting another check aborts the previous request; stale answers are discarded. While the last sentence is unfinished, an item already found stays found. A final period, exclamation mark, question mark or newline permits it to change.

All instances share 20 automatic checks per page session. After that, a calm line says they are paused. The button still works, subject to the proxy's separate daily and cost limits. Reloading starts a new page session. If the proxy is unavailable or refuses a check, the native self-tick checklist replaces automatic feedback. Without JavaScript, the prompt, answer box and self-check are already present.

## Evidence

Research on formative feedback supports specific, timely information learners can use to revise their work, while noting that timing depends on the task ([Shute, 2008](https://doi.org/10.3102/0034654307313795)). Connecting an action to a time or situation draws on implementation intentions ([Gollwitzer, 1999](https://doi.org/10.1037/0003-066X.54.7.493)). These sources inform the checklist, not the 0.7 second delay or the 20-check allowance. This pattern and its feedback timing have not been tested with learners.

Perplexity Decider v1.1 scored 11/12 on authored test answers using the original Jev question wording and confidence gates. That small check is not evidence of accuracy on every learner answer or of improved learning. The shared decision function keeps the original inclusive gates: found at 0.65 or above, missing at 0.35 or below, uncertain between them.

## Accessibility

Meets the shared baseline in the root README.

- Automatic list updates and the checking line have no live announcements. The button announces one summary in the polite status region without moving focus.
- Each result has an icon and a word as well as colour. Typing stays available during requests.
- Native checkboxes work without JavaScript and after a failed check.
- English and Québec French use the same content fields and controls, with vous in French.
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

All fields are escaped plain text. Unknown fields, empty strings and wrong criterion identities are rejected. Rewording must preserve what the fixed proxy questions check. Changing the topic requires changing and evaluating those questions too.

## Logic

`logic.js` is pure. It imports the decision owner, identities and answer limit from `proxy/logic/02-live.js`, which browser and proxy share.

| Export | Returns or value |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming a bad field. |
| `feedback(content, answers, draft = '', previous = [])` | `{ count, total, items }`; each item is `{ id, mark, text, short }`, with mark `met`, `missed` or `unsure`. Invalid decision answers throw. |
| `validateState(value)` | A clean `{ answer, ticked }`, or `null` for invalid saved values. |
| `ANSWER_LIMIT` | Proxy-owned 1,200-character cap. |
| `MIN_CHARS`, `PAUSE_MS`, `AUTO_CHECK_LIMIT` | 20 trimmed characters, 700 milliseconds, 20 automatic checks. |

Optional `state: { read, write }` retains the draft and self-check ticks. Automated judgments are never persisted. Repeated enhancement returns the same instance. `destroy()` removes listeners, aborts pending checks and restores the native self-check while retaining the learner's draft and ticks. Re-enhancement keeps the page's remaining automatic allowance.

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

The shared client calls `ask('02-live', { answer }, { challengeSlot, signal })` and reads `/config` for the data notice. Verification appears only after a clearance refusal. Every request or configuration failure selects the self-check fallback. Configure the proxy for Perplexity; this pattern falls back if the configuration names another live provider. The demo uses fixed feedback and sends no text.

## Adapt it with your agent

> Rewrite the action-plan example for my audience. Keep three distinct observable actions, at least one time or situation, and the learner's own commitments. Keep the four identities and content fields, authored missing and uncertain lines, English and Québec French with vous, the pause, unfinished-sentence rule, page allowance, manual summary, data notice and self-check. The decision model only chooses authored lines. Evaluate any changed proxy questions before enabling them.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
