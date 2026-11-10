---
title: Give feedback on a colleague's work
title_fr: Commentez le travail de votre collègue
summary: Read a colleague's draft, write them feedback, tick the issues it raised, then read why each one matters.
section: question
ai: no
offline: yes
learners: not tried
---
# Give feedback on a colleague's work

Read a colleague's draft, write them feedback, tick the issues your feedback raised, then read why each one matters.

## Use it when

- Learners already know the standard for a piece of work, such as a reply to a customer or a short report, and need practice finding where a colleague's draft falls short.
- A course on giving feedback needs a realistic draft to comment on before learners comment on a real one.
- Experienced learners need something to do besides another explanation: reviewing someone else's work as a manager, mentor or peer.

## Avoid it when

- When learners should judge their own answer against a model, use [Check your own answer](../self-check/README.md).
- When learners don't yet know what good work looks like, start with [Finish a worked example](../finish-worked-example/README.md).
- If you need a grade, use an assessment. The ticks record only the learner's own judgement of their feedback.

## Before you use it

Write a draft with two to five issues, and make sure it has no others. A careful reviewer should be able to find each issue from the card alone, so put the rule an issue breaks in the setup, as the sample does with the 30-day refund rule and the course credit. Keep the draft polite and short, so tone doesn't become an issue you didn't list.

Label each issue with the part of the draft to look at ("The reason for the refusal"), not with the fault ("No reason given"). Learners see the labels before they finish their feedback, so a label that names the fault would give it away. Write each explanation in two sentences: the fault and its effect, then what to ask the colleague to do.

## How it works

1. The learner reads the situation, the email the colleague is answering and the colleague's draft.
2. They write what they would tell the colleague to change, and why, then select "Check my feedback".
3. A checklist names each part of the draft to look at. The learner can reread the draft and add to their feedback, then ticks each part their feedback asks the colleague to change.
4. "Show the issues" locks the feedback and ticks, gives the number of issues raised in one sentence, and lists every issue marked "Raised" or "Not raised" with its explanation. The activity ends there.
5. "Start over" clears the feedback and the ticks.

Without JavaScript, the learner can read the emails, write in the field and open "Show the issues" to read every issue and its explanation.

## Evidence

Reviewing other people's work teaches the reviewer. In a randomised study with 61 undergraduates, students who rated and commented on peers' papers then wrote better reports than students who only read the same papers or had no treatment. Comments that found a problem and suggested a fix went with better writing ([Cho and MacArthur, 2011](https://doi.org/10.1037/a0021950)). In nine second-language writing classes with 91 students, students who only reviewed others' papers for a semester improved their own writing more than students who only received feedback ([Lundstrom and Baker, 2009](https://doi.org/10.1016/j.jslw.2008.06.002)).

Both studies measured the reviewers' own writing in writing courses. Neither tested a workplace draft reviewed in a role, a fixed list of issues or learners ticking their own feedback. Explanations helped more than right-or-wrong feedback in computer-based learning ([Van der Kleij, Feskens and Eggen, 2015](https://doi.org/10.3102/0034654314564881)), so every issue has one.

This sequence has not been tested as a whole, and the pattern has not been tried with learners.

## Accessibility

Follows the shared baseline in the root README.

Write each email's heading so it says whose message it is, such as "Email from Alex Moreau, customer", and mark the colleague's draft as a draft. Screen reader users move between the emails by heading. Without JavaScript, learners can write feedback and open every issue with its explanation, but nothing is ticked or saved.

## Content fields

All text is plain text and escaped on render. Keep English and Canadian French examples together.

| Field | Meaning |
| --- | --- |
| `title` | Card heading, the name of the task, at most 120 characters. |
| `context` | The situation and any rule the issues depend on, at most 400 characters. |
| `colleague` | The colleague's name, used in the feedback question and the checklist question, at most 120 characters. |
| `messages` | One to three messages in reading order. The last is the colleague's draft. |
| `messages[].heading` | Heading above the message, such as "Priya's draft reply", at most 120 characters. |
| `messages[].subject` | Optional subject line, at most 120 characters. |
| `messages[].body` | The message. Each line break starts a new paragraph. At most 1,500 characters. |
| `issues` | Two to five issues, in display order. |
| `issues[].id` | Unique id using letters, digits, underscores or hyphens. Keep it stable for saved state. |
| `issues[].label` | The part of the draft to look at, shown in the checklist and the result, at most 120 characters. |
| `issues[].explanation` | The fault and its effect, then what to ask the colleague to do, at most 1,500 characters. |

`validateContent` rejects unknown fields, empty text, duplicate ids and counts outside the limits. Standard schema validators enforce the local limits; the `x-uniqueBy` annotation needs `validateContent`.

## Logic

`logic.js`, `strings.js` and the schema contain no DOM code.

| Export | Returns |
| --- | --- |
| `MAX_LENGTH` | Feedback limit of 2,000 characters. |
| `validateContent(content)` | Nothing; throws an Error naming the invalid field. |
| `validateFeedback(text)` | `{ ok: true, text }` with trimmed text, or `{ ok: false, error: 'empty' \| 'tooLong' }`. |
| `result(content, ticked)` | `{ count, total, key, items }`. `key` is `'all'`, `'some'` or `'none'` and picks `resultAll`, `resultSome` or `resultNone` from the strings. `items` holds every issue in author order as `{ id, label, explanation, raised }`. Throws for an unknown or repeated id. |
| `validateState(content, value)` | An independent `{ feedback, ticked, stage }` copy, or `null`. Rejects unknown or repeated ids, an unknown stage and ticks saved before the checklist was shown. |
| `format(template, values)` | Placeholder substitution preserving inserted text literally. |

Optional host `state: { read, write }` stores `{ feedback, ticked, stage }`: the feedback as typed, the ticked issue ids, and `'write'`, `'compare'` or `'done'`. Feedback is saved as the learner types, and ticks when they change. Without an adapter the work lasts for the mounted instance. Invalid saved values are ignored. A saved draft longer than the limit is restored in full, and checking it shows the length error. Repeated enhancement returns the same instance; `destroy()` removes listeners, clears the feedback and ticks, and restores the server markup without rebuilding the DOM.

## Use it

Copy `patterns/mark-colleague/` and `lib/`, keeping relative paths. Link `lib/base.css` before `patterns/mark-colleague/pattern.css`. Use a unique id prefix per instance.

```js
import { render } from './patterns/mark-colleague/render.js';
import { enhance } from './patterns/mark-colleague/enhance.js';
import { strings } from './patterns/mark-colleague/strings.js';
import content from './patterns/mark-colleague/examples/en.json' with { type: 'json' };

document.querySelector('main').innerHTML = render(content, strings.en, { id: 'review', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

The emails are set apart by section rules, a heading with a mail icon, a small subject line and spacing. They sit in the card with no panel of their own.

### Accessibility details

Each email has a level 3 heading, one level below the card title. The feedback field is labelled with the question to the colleague.

"Check my feedback" with an empty field shows an error linked to the field and returns focus to it. Otherwise focus moves to the first checkbox, so the checklist question and its hint are read with it. "Show the issues" moves focus to the result sentence, so it is read once, and then locks the feedback and ticks. Each issue's mark is an icon and the word "Raised" or "Not raised". These focus moves replace status messages; only "Start over" uses the status region, to say the feedback was cleared, and it returns focus to the field. Saved work restores silently.

## Adapt it with your agent

> Adapt the mark-colleague examples to [topic] for [audience]. Keep `{ title, context, colleague, messages: [{ heading, subject, body }], issues: [{ id, label, explanation }] }`. Write a two-sentence context that names the learner's role and any rule the issues break. Write a short, polite draft from the colleague with two to five issues and no others. Label each issue with the part of the draft to look at, never the fault. Write each explanation in two sentences: the fault and its effect, then "Ask [colleague] to...". Write English and Québec French together, using vous. Preserve the two checks, the ending after the second, the no-JavaScript disclosure, one status region and saved state. Show both languages for review.

## Related patterns

- [Check your own answer](../self-check/README.md)
- [Finish a worked example](../finish-worked-example/README.md)
- [Scenario talk-through](../conversation/README.md)
- [Write the wrong options](../write-distractors/README.md)

## Help improve this pattern

Tried it with learners? [Tell us what happened](https://github.com/Praxity/learning-patterns/issues/new?template=pattern-feedback.yml&pattern=Give%20feedback%20on%20a%20colleague%27s%20work). You can also [suggest a change to this page](https://github.com/Praxity/learning-patterns/edit/main/patterns/mark-colleague/README.md).

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
