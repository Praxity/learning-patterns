---
title: Make a mistake and recover
title_fr: Faire une erreur et la rattraper
summary: Approve or hold a request in a practice system, see what an approval costs, take the steps that undo it, then decide a second request with less help.
section: question
ai: no
offline: yes
learners: not tried
---
# Make a mistake and recover

Decide a request in a practice system. Approving one with a fault changes its status line and states the cost, and the learner chooses the steps that undo it. A second request has a different fault and gives no prompts. A learner who holds both requests recovers a payment a colleague approved, so everyone practises recovery once.

## Use it when

- A process has a check people skip under pressure, such as matching an invoice before approving a payment.
- Learners should see what a mistake costs, and practise undoing it, before they meet it on a live system.
- The steps after an error matter as much as avoiding it: stopping the harm, fixing the cause and recording what happened.

## Avoid it when

- When the course has not yet taught the check, teach it first. This card states the rule in its context but does not explain it.
- When learners need to tell clean requests from faulty ones, use a sorting or decision activity before this one. Both requests here have a fault, so holding is always right, and a learner who holds everything never misses.
- When the goal is one fixed procedure with nothing to adapt, direct instruction may teach it with less time and effort. The meta-analysis below found error-based training most useful for transfer to new problems.

## Before you use it

Tell learners before the card that mistakes are expected and are part of the practice. Error management training pairs exploration with that kind of instruction, and the meta-analysis below found the instruction effective. The card itself only says that no real money moves.

Write two requests and a colleague's payment. Request 1 states each check's result in words, such as "Invoice: Not attached". Request 2 gives the values and leaves the comparison to the learner, such as an account on the request ending 1190 and one on file ending 1910. Put the rule all three checks apply in the context, in the record's own words, so a learner can decide from the card alone.

For each one, write the status lines: after Hold (requests only), after Approve, after recovery when the stopping step was chosen, and after recovery when it was missed. The line after Approve states the cost.

Write three to five recovery steps for each, with a reason for every step. Exactly one correct step stops the harm. Make each incorrect step one a rushed person would take, and vary where it sits in each list. In a real course, mix in requests that pass every check.

## How it works

1. The learner reads request 1 and selects Approve or Hold.
2. Hold changes the status line to say why the payment waits. Request 2 appears below.
3. Approve changes the status line to state the cost. The learner ticks the recovery steps they would take and selects "Check my steps". Each chosen step is marked "Correct" or "Incorrect", each correct step they left out is marked "Correct answer", and each marked step shows its reason. The status line changes again: cancelled when they chose the stopping step, still approved when they did not. Request 2 appears below.
4. Request 2 works the same way.
5. If the learner held both requests, a payment a colleague approved appears, already approved, and the learner recovers it.
6. One sentence says how it went, for example "You approved request 1 and held request 2, and stopped the payment for request 1 before it went out." "Start over" clears everything.

Each recovery is checked once. Nothing is scored.

## Evidence

Training that lets people make errors and learn from them beat error-avoidant training on later tasks. A meta-analysis of 24 studies with 2,183 participants compared error management training with step-by-step training that steers learners away from errors, and with exploration that does not encourage errors. Error management training did better on average (d = 0.44). The gain showed after training (d = 0.56) and was largest on tasks unlike the training tasks (d = 0.80). During training it showed no advantage. Both parts of the method, active exploration and explicit encouragement to make errors, were effective ([Keith and Frese, 2008](https://doi.org/10.1037/0021-9010.93.1.59)).

The authors limit these findings. Twenty-one of the 24 studies taught software skills, and the other three used decision tasks on a computer. No study measured performance on the job. They also describe a study in which firefighters who studied other people's errors in incident stories were better at finding problems in new scenarios than trainees who studied success stories. That study used a different method and was left out of the meta-analysis, but it is the closest evidence for the colleague's payment here.

This pattern is a short, scripted case, not exploratory training. It allows one error per request rather than encouraging errors, and it has not been tested. This pattern has not been tried with learners.

## Accessibility

Follows the shared baseline in the root README.

Without JavaScript, learners see both requests and their records. Each request is followed by two closed disclosures: what approving does, and every recovery step marked "Correct" or "Incorrect" with its reason. The colleague's payment is left out, since every reader can study both recoveries.

## Content fields

Authors write plain text. Rendering escapes HTML characters. Keep English and Canadian French examples together, with the same step ids, correct steps and stopping steps.

| Field | Meaning |
| --- | --- |
| `title` | Card heading that names the task, at most 120 characters. |
| `context` | The learner's role and the rule the checks apply, at most 400 characters. |
| `requests` | Exactly two requests. The first states each check's result; the second gives values to compare. |
| `requests[].title`, `colleague.title` | Heading for the payment, at most 120 characters. |
| `requests[].summary`, `colleague.summary` | Who is paid and how much, at most 300 characters. The colleague's summary also says who the colleague is and that the learner may act. |
| `requests[].checks`, `colleague.checks` | Two to four lines of the record, each a `label` of at most 60 characters and a `value` of at most 200. |
| `requests[].held` | Status line after Hold, at most 300 characters. |
| `requests[].approved`, `colleague.approved` | Status line after Approve, stating the cost, at most 300 characters. For the colleague this is the line the payment opens with. |
| `requests[].stopped`, `colleague.stopped` | Status line after recovery when the stopping step was chosen, at most 300 characters. |
| `requests[].notStopped`, `colleague.notStopped` | Status line after recovery when the stopping step was missed, at most 300 characters. |
| `requests[].steps`, `colleague.steps` | Three to five recovery steps. |
| `steps[].id` | Unique id using letters, digits, underscores or hyphens. |
| `steps[].text` | The step, at most 200 characters. |
| `steps[].correct` | `true` for a step to take, `false` for one not to. Each list needs at least one of each. |
| `steps[].stops` | `true` on exactly one correct step: the one that stops the harm, which changes the status line. |
| `steps[].feedback` | Why, at most 300 characters. Write it so it reads right whether the step was chosen or missed. |
| `colleague.name` | The colleague's name, used in the closing sentence, at most 60 characters. |

The strings in `strings.js` speak of requests and payments. Change them along with the content for another kind of approval.

`validateContent` rejects unknown fields, blank strings, duplicate step ids, a list without exactly one stopping step, a stopping step that is not correct, and a list whose steps are all correct or all incorrect. The last three are the schema's `x-oneStoppingStep` annotation, which ordinary JSON Schema tools do not check.

## Logic

`logic.js`, `strings.js` and the schema contain no DOM code. Hosts can build their own interface.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `start()` | A new state, `{ decisions: [null, null], steps: [null, null, null] }`. |
| `progress(content, state)` | `{ stage, item, statuses }`. `stage` is `'decide'`, `'recover'` or `'done'`. `item` is the open payment: `0` and `1` for the requests, `2` for the colleague's payment, or `null` when done. `statuses` gives each payment's status line as `'pending'`, `'held'`, `'approved'`, `'stopped'`, `'notStopped'`, or `null` while it is not on screen. |
| `decide(content, state, item, decision)` | A new state with `'approve'` or `'hold'` on the open request. Throws when that request is not open. |
| `recover(content, state, item, ids)` | A new state with those recovery steps checked on the open payment. Throws when it is not open, or when the ids are empty, repeated or unknown. |
| `validateState(content, value)` | A copied state, or `null` when the learner's own steps could not have produced the value. |
| `summarize(content, state, strings)` | The closing sentence. Throws before the last payment is settled. |
| `format(template, values)` | Placeholder substitution that keeps inserted text literal. |

Optional host `state: { read, write }` stores `{ decisions, steps }`: the decision on each request, and the step ids checked on request 1, request 2 and the colleague's payment, or `null` where none were checked. Each decision, each check and "Start over" write it. Ticked steps that have not been checked stay in memory. Invalid saved values are ignored. A valid value restores the card where the learner left it, without an announcement or a focus move. Without an adapter, progress lasts for the mounted instance.

Repeated `enhance` calls return the same instance. `destroy()` removes listeners, clears progress and restores the no-JavaScript view without rebuilding the DOM.

## Use it

Copy `patterns/mistake-recover/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/mistake-recover/pattern.css`. Use a unique id prefix per instance.

```js
import { render } from './patterns/mistake-recover/render.js';
import { enhance } from './patterns/mistake-recover/enhance.js';
import { strings } from './patterns/mistake-recover/strings.js';
import content from './patterns/mistake-recover/examples/en.json' with { type: 'json' };

document.querySelector('main').innerHTML = render(content, strings.en, { id: 'payments', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern="mistake-recover"]'), { content, strings: strings.en });
```

### Accessibility details

- Each payment is a section named by its heading. Its record is a description list, one check per line.
- Approve and Hold have the same secondary style, so neither looks like the expected answer.
- After Approve or Hold, the two buttons go and focus moves to the payment's status line, which starts with "Status:". A screen reader reads that one line, not the whole record. Reading on reaches the recovery steps or the next payment.
- After "Check my steps", the steps lock and focus moves to the same status line, which now says whether the payment was cancelled or is still approved. The marked steps follow in reading order, each with its mark word and reason.
- The next payment appears below without scrolling, so the status line and the marked steps stay in view.
- When the card ends, focus moves to the status line first, then the status region announces the closing sentence once.
- Checking with no step ticked shows "Choose at least one step" in the group, links it as part of the group's description and focuses the first step.
- "Start over" focuses Approve on request 1 and announces "Answers cleared."
- Marks use "Correct", "Incorrect", or "Correct answer" on a correct step the learner left out.

## Adapt it with your agent

> Adapt the mistake-recover examples to [process] for [audience]. Keep the content fields. Write a context that states the rule the checks apply, in the record's words. Write request 1 with each check's result in words and one fault, and request 2 with values to compare and a different fault. Write a colleague's payment with a fault, a summary that says who the colleague is and that the learner may act, and its record as check results in words. For each, write the status lines after Hold, after Approve with the cost, and after recovery with and without the stopping step. Write three to five recovery steps with a reason each, exactly one correct step that stops the harm, and incorrect steps a rushed person would take, placed differently in each list. Write English and Québec French together, using vous, with the same step ids. Preserve the order of requests, one check per recovery, the no-JavaScript disclosures, the focus on the status line, one status region, saved state and CSS tokens. Update examples and tests. Show both languages for review.

## Related patterns

- [Scenario talk-through](../conversation/README.md) branches on the learner's replies. Nothing the learner does there persists in a record, and nothing is repaired.
- [Hint ladder](../hint-ladder/README.md) takes help away across two questions on the same rule. A wrong answer there costs nothing.
- [Change one detail](../change-one-detail/README.md) asks for a second decision on a changed case. This pattern asks the learner to undo the first decision.
- [Build an if-then plan](../if-then-plan/README.md) can follow this card, with a plan for the check people skip.

## Help improve this pattern

Tried it with learners? [Tell us what happened](https://github.com/Praxity/learning-patterns/issues/new?template=pattern-feedback.yml&pattern=Make%20a%20mistake%20and%20recover). You can also [suggest a change to this page](https://github.com/Praxity/learning-patterns/edit/main/patterns/mistake-recover/README.md).

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
