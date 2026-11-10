---
title: Build an if-then plan
title_fr: Construire un plan « si-alors »
summary: Choose a moment and an action to build a one-sentence plan, then add it to your calendar.
section: course
ai: no
offline: yes
learners: not tried
---
# Build an if-then plan

Choose a moment and an action to build a one-sentence plan, "When ..., I will ...", then add it to your calendar.

## Use it when

- A course ends with a skill learners must use at work, such as asking more questions in a one-on-one, and you want each of them to leave with a plan for a named moment.
- Using the skill depends on noticing a moment, such as a colleague asking for advice or a call starting.
- Learners finish with intentions too vague to act on, such as "be more patient".

## Avoid it when

- When learners should look back on what they tried, use [Journal entry with a nudge](../journal/README.md). This pattern plans one future action and records nothing about how it went.
- When the date is for recalling facts, use [Questions inside the reading](../review-prompts/README.md) or [Printable retrieval sheet](../retrieval-sheet/README.md). Their dates schedule a review, and this one schedules an action.
- If learners have not taken on the goal, start there. If-then plans help most when people are highly motivated to pursue the goal.

## Before you use it

Write a setup of two short sentences: the situation, then the goal. Then write three to five moments and three to five actions.

- Every moment must read correctly after "When", every action after "I will", and every moment with every action. Start an option in lower case unless it begins with a name, and leave off the closing period.
- A concrete moment is something that happens and that the learner will notice. A concrete action is something another person could see or hear.
- Give each list at least two concrete options, so the plan is the learner's choice. Three concrete options and one vague one work well.
- For each vague option, write the reason it is too vague and what to choose instead. Do not always put it last.
- Label the date field with the event the plan is for, such as "Start of your next one-on-one".

The calendar file is made in the learner's browser, and the pattern sends nothing anywhere.

## How it works

1. The learner reads the situation and the goal, then chooses a moment from a list that completes "When…".
2. "Add to my plan" accepts a concrete moment. A vague one is marked "Too vague" with its reason, and the learner chooses another.
3. The sentence grows to "When Sam starts to describe a problem, I will…", and the learner chooses an action the same way.
4. The finished plan shows as one sentence. The learner sets a date and time, and "Add to calendar" downloads a calendar file that shows the plan 10 minutes before.
5. "Start over" clears the plan.

Without JavaScript, the learner sees both lists, can open the reasons the vague options are too vague, and is asked to write the plan in their calendar as one sentence.

## Evidence

An if-then plan links a situation to an action, so that meeting the situation prompts the action ([Gollwitzer, 1999](https://doi.org/10.1037/0003-066X.54.7.493)). Across 94 tests, adding such a plan to a goal had a medium-to-large effect on reaching it (d = .65) ([Gollwitzer and Sheeran, 2006](https://doi.org/10.1016/S0065-2601%2806%2938002-1)). A later meta-analysis of 642 tests found effects from d = .27 to d = .66, depending on the kind of outcome. Effects were larger when the plan had an if-then form, when people were highly motivated and when they rehearsed the plan ([Sheeran, Listrom and Gollwitzer, 2024](https://doi.org/10.1080/10463283.2024.2334563)).

For workplace training the direct evidence is small. In an experiment with 37 trainees, those who formed if-then plans at the end of training used active listening sooner and more than a control group. In a second, run in the field with 28 trainees, they scored higher on using the trained behaviour ([Friedman and Ronen, 2015](https://doi.org/10.1002/ejsp.2114)). A plan does not replace support at work. A meta-analysis of 89 studies linked the use of trained skills to a supportive work environment, as well as to the trainee's ability and motivation ([Blume et al., 2010](https://doi.org/10.1177/0149206309352880)).

In this pattern the learner chooses a plan from options and does not write one. The nearest tests of that are in health, not in courses. A trial with 248 adults found no significant difference between choosing a plan the researchers had written and writing one's own, and both reduced drinking ([Armitage, 2009](https://doi.org/10.1037/a0015984)). In a trial with 193 smokers, those given a sheet for linking temptations to smoke with ready-made responses smoked less and quit more than three control groups ([Armitage, 2008](https://doi.org/10.1037/0278-6133.27.5.557)).

Whether choosing from an author's options works as well as forming your own plan for a skill learned in a course has not been tested. Nor have this pattern's two steps, its vague options and their reasons, or its calendar entry. The pattern has not been tried with learners.

## Accessibility

Follows the shared baseline in the root README.

Write options that read correctly after the sentence stem. A screen reader gives the stem as the name of the group, then each option. Without JavaScript, learners see both lists and the reasons the vague options are too vague, and are asked to write the plan in their calendar themselves. Making the calendar file needs JavaScript.

## Content fields

All text is plain text and escaped on render. Keep English and Canadian French examples together.

| Field | Meaning |
| --- | --- |
| `title` | Card heading, the name of the task, at most 120 characters. |
| `context` | The situation, then the goal, at most 400 characters. |
| `when.options` | Three to five moments, in display order. Each completes "When …". |
| `will.options` | Three to five actions, in display order. Each completes "I will …". |
| `options[].id` | In either list. Unique within its list, using letters, digits, underscores or hyphens. Keep it stable for saved state. |
| `options[].text` | The option, at most 300 characters. |
| `options[].vague` | Optional. Its presence makes the option vague. The text is the reason shown when a learner chooses it, at most 400 characters. |
| `dateLabel` | Label of the date and time field, at most 120 characters. |

`validateContent` rejects unknown fields, blank text and duplicate ids, and requires at least two options without `vague` in each list. Standard schema validators enforce the local limits; the `x-uniqueBy` and `x-minWithout` annotations need `validateContent`.

The words around the options ("When", "I will") live in `strings.js` as `whenStem`, `willStem`, `soFar` and `plan`. Change the four together if you change the form of the sentence.

## Logic

`logic.js`, `strings.js` and the schema contain no DOM code.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing; throws an Error naming the invalid field. |
| `choose(content, step, id)` | `{ ok: true, text }` for a concrete option, `{ ok: false, reason }` for a vague one. `step` is `'when'` or `'will'`. Throws for an unknown id. |
| `sentence(content, strings, state)` | The sentence as far as it is built: `whenStem`, then `soFar` with the moment, then the whole `plan`. |
| `emptyState()` | `{ when: null, will: null, start: '' }`. |
| `validateState(content, value)` | An independent `{ when, will, start }` copy, or `null`. Rejects unknown and vague ids, an action without a moment, and a start time without a finished plan. |
| `startError(start, now)` | `null`, `'invalid'` or `'past'` for times in milliseconds. |
| `calendarFile({ plan, note, start, now, uid })` | The text of an iCalendar file with one entry. Throws for a start that is invalid or not after `now`. |
| `format(template, values)` | Placeholder substitution preserving inserted text literally. |
| `REMINDER_MINUTES` | `10`: how long before the chosen time the calendar entry starts. |

The calendar entry starts `REMINDER_MINUTES` before the chosen time and ends at it, so it sits just before the event in a calendar. Its title is the plan. Its description repeats the plan and names the activity it came from. It carries one display alarm at its start; some calendars replace that with their own default reminder on import. Times are written in UTC, converted from the learner's local time by the browser, so the entry keeps its moment in any time zone. Text is escaped as RFC 5545 requires: every line break becomes an escaped newline and other control characters become spaces. Lines are folded at 75 octets.

Optional host `state: { read, write }` stores `{ when, will, start }`: the ids of the accepted moment and action, and the value of the date and time field. A choice is saved when it joins the plan, and the date when it changes. Vague options the learner tried are not saved. Without an adapter the plan lasts for the mounted instance. Invalid saved values are ignored, and state errors propagate. Repeated enhancement returns the same instance; `destroy()` removes listeners, clears the choices, the date and the plan text, and restores the server markup without rebuilding the DOM.

## Use it

Copy `patterns/if-then-plan/` and `lib/`, keeping relative paths. Link `lib/base.css` before `patterns/if-then-plan/pattern.css`. Use a unique id prefix per instance.

```js
import { render } from './patterns/if-then-plan/render.js';
import { enhance } from './patterns/if-then-plan/enhance.js';
import { strings } from './patterns/if-then-plan/strings.js';
import content from './patterns/if-then-plan/examples/en.json' with { type: 'json' };

document.querySelector('main').innerHTML = render(content, strings.en, { id: 'plan', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

The date and time field is the browser's own `datetime-local` input, so its picker, language and keyboard behaviour come from the browser.

### Accessibility details

Each list is a radio group. The first group is named "When…". After a moment is accepted, the second group is named with the plan so far, such as "When Sam starts to describe a problem, I will…", and focus moves to its first option, so a screen reader reads the sentence as it grows. When the action is accepted, focus moves to the finished plan, which is read as one sentence. These two focus moves replace a status message.

A vague choice is announced once through the status region as "Too vague", followed by its reason. Focus stays on "Add to my plan". The option is disabled and keeps its mark and reason, and the other options stay open. The mark is an icon and the words "Too vague" in the warning colour. It is feedback on the plan, so the Correct and Incorrect marks are not used.

Pressing "Add to my plan" with nothing chosen shows an error linked to the group and announces it. "Add to calendar" is disabled until the field holds a future date and time; the hint above the field says what to set. A past time shows a linked error when the learner leaves the field. After a download, a line under the button and the status region both say the file was downloaded. "Start over" announces the reset and focuses the first moment. Saved plans restore silently. A restored time that has passed shows its linked error at once, because the button is disabled.

The plan is set apart by space, a rule and larger type, with no box inside the card. Forced colours keep a double border on a vague option the learner tried.

## Adapt it with your agent

> Adapt the if-then-plan examples to [topic] for [audience]. Keep `{ title, context, when: { options }, will: { options }, dateLabel }` and stable, unique option ids. Write a two-sentence context: the situation, then the goal. Write three concrete moments and one vague one, and three concrete actions and one vague one. A moment is something that happens and that the learner will notice; an action is something another person could see or hear. Check that every moment reads correctly with every action in "When ..., I will ...". Give each vague option a `vague` reason that says why it is too vague and what to choose instead. Write English and Québec French together, using vous for instructions and je inside the plan. Preserve the two steps, the calendar file, the no-JavaScript version, one status region and saved state. Show both languages for review.

## Related patterns

- [Journal entry with a nudge](../journal/README.md)
- [Questions inside the reading](../review-prompts/README.md)
- [Printable retrieval sheet](../retrieval-sheet/README.md)
- [Your first answer replayed](../first-answer/README.md)

## Help improve this pattern

Tried it with learners? [Tell us what happened](https://github.com/Praxity/learning-patterns/issues/new?template=pattern-feedback.yml&pattern=Build%20an%20if-then%20plan). You can also [suggest a change to this page](https://github.com/Praxity/learning-patterns/edit/main/patterns/if-then-plan/README.md).

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
