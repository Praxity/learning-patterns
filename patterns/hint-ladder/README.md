---
title: Hint ladder
title_fr: Échelle d’indices
summary: Answer a question with hints that open one at a time and a worked answer that waits for a try, then answer a second question without hints.
section: question
ai: no
offline: yes
learners: not tried
---
# Hint ladder

Answer a question, opening hints one at a time if you need them. The worked answer opens after one try. Then answer a second question of the same kind without hints.

## Use it when

- A question applies a rule with a step people skip, and some learners need help with it while others don't.
- Learners should try before they read the answer.
- You want to know whether a learner can answer the same kind of question unaided, and how much help the first one took.

## Avoid it when

- When questions test separate facts, a hint can only be the answer. Use ["I don't know" as an answer](../dont-know/README.md), which takes one answer per question and lets learners say they don't know.
- When learners have not yet seen the procedure, show it first. The pattern "Finish a worked example" gives worked steps up front and removes them case by case. This pattern suits the practice that follows, where help is there on request.
- When each wrong option's reason is all the help you can write, a question that lets learners choose again until they are right is enough. This pattern is worth its extra writing when you have hints that lead toward the answer and a second case to check it.

## Before you use it

Write one question with three or four options, and a reason for each wrong option. A reason says why that option is wrong. It does not name the right one.

Write one to three hints. Each gives more than the one before, and none gives the answer. A common ladder is a nudge toward the step people skip, then the rule as it applies here.

Write the worked answer, which is the reasoning from the question to the correct option. Every learner sees it when the first question ends.

Write a second question on a new case that uses the same rule, with two to four options and one explanation.

Put the rule on the card, in the context, unless the course has just taught it. A learner should be able to answer from the card alone.

## How it works

1. The learner reads the question, chooses an answer and selects "Check my answer". "Show hint 1 of 2" sits beside it.
2. A wrong answer is marked "Incorrect" with its reason and closes. The other options stay open for another try.
3. Each hint opens under the options, in order. After the last hint the button reads "Show the worked answer", which opens once the learner has checked an answer.
4. The first question ends when the learner answers correctly, opens the worked answer, or has only the correct option left. The worked answer shows in all three cases.
5. A second question of the same kind follows, with no hints and one try.
6. One sentence says how both went, for example "You answered the first question correctly in 2 tries with 1 hint, then answered the question without hints correctly." "Start over" clears everything.

Nothing is scored, and hints cost nothing.

## Evidence

How much help to give has no settled answer. A review of experiments with tutoring software asked how a learning environment should balance giving help and withholding it, named this the "assistance dilemma" and called it an open problem ([Koedinger and Aleven, 2007](https://doi.org/10.1007/s10648-007-9049-0)). This pattern lets the learner decide how many hints to take and holds back only the answer.

Learners often misuse hints they can ask for. Students using a geometry tutor waited a long time before asking for hints, then focused on the most specific hint and ignored the levels before it ([Aleven and Koedinger, 2000](https://doi.org/10.1007/3-540-45108-0_33)). A later review by the same group reports that students spent under a second on 68% of the hint levels before the last, and that clicking through to the answer was common and went with lower learning gains ([Aleven, Roll, McLaren and Koedinger, 2016](https://doi.org/10.1007/s40593-015-0089-1)). Students who often used a tutor's feedback and help to get answers scored lower on a post-test than students who never did, after allowing for prior knowledge ([Baker, Corbett, Koedinger and Wagner, 2004](https://doi.org/10.1145/985692.985741)). These are correlations from classroom tutoring software.

This pattern makes the worked answer wait for one checked answer and names it on the button, so opening it is a deliberate step. Neither measure has been tested. A learner can still check any option, open every hint without reading and take the answer. The 2016 review also found that coaching students to use hints more carefully changed how they used them, even months later, without improving what they learned.

Hints in place of answers protected later unaided performance in one field experiment. Nearly a thousand high school mathematics students practised with an AI tutor. Those with a standard chat tutor, which many used to get answers, scored 17% lower on a later exam without it than students who never had a tutor. Those whose tutor was told to give hints and not answers scored about the same as students who never had one ([Bastani and colleagues, 2025](https://doi.org/10.1073/pnas.2422633122)). That tutor also held teacher-written solutions and common mistakes, the study ran in one school, and the hints produced no gain over practising without a tutor. The harm showed only on the unaided exam, which is why this pattern ends on a question without hints.

Answering questions helps memory more than rereading. Students who took recall tests on a passage remembered more of it two days and a week later than students who reread it, although rereading did better on a test five minutes later ([Roediger and Karpicke, 2006](https://doi.org/10.1111/j.1467-9280.2006.01693.x)). Across 192 effect sizes, practice tests also helped on new questions (d = 0.40), least of all on problems involving worked examples ([Pan and Rickard, 2018](https://doi.org/10.1037/bul0000151)). The second question here comes straight after the first, so these studies support asking it but not its timing. Its main use is to show the learner and the course whether the first answer depended on the hints.

Hints in steps, a worked answer that waits for a try and an unaided question to finish have not been tested together. This pattern has not been tried with learners.

## Accessibility

Follows the shared baseline in the root README.

Write each hint and each reason so it makes sense read on its own. Without JavaScript, learners can choose answers to both questions. Each hint and the worked answer sit behind their own closed disclosure in order, the worked answer's disclosure also gives the reason for each wrong option, and the second question's answer sits behind "Show the answer". Nothing is checked or counted.

## Content fields

Authors write plain text. Rendering escapes HTML characters. Keep English and Canadian French examples together, with the same option ids and correct answers.

| Field | Meaning |
| --- | --- |
| `title` | Card heading that names the task, at most 120 characters. |
| `context` | Optional. The learner's role and the rule both questions use, at most 600 characters. |
| `question` | The first question, at most 400 characters. |
| `options` | Three or four options for the first question. |
| `options[].id` | Unique id using letters, digits, underscores or hyphens. |
| `options[].text` | Option text, at most 300 characters. Leave off a closing period, because the no-JavaScript answer adds one ("Correct answer: Wednesday."). |
| `options[].feedback` | Why this option is wrong, at most 600 characters. Required on every wrong option and refused on the correct one, whose reasoning is the worked answer. |
| `correct` | Id of the correct option. |
| `hints` | One to three hints in the order they open, each at most 400 characters. |
| `worked` | The worked answer, at most 600 characters. |
| `followUp.question` | The second question, with its new case, at most 400 characters. |
| `followUp.options` | Two to four options, each with a unique `id` and a `text` of at most 300 characters. |
| `followUp.correct` | Id of the correct option of the second question. |
| `followUp.explanation` | Why, at most 600 characters. Shown after the check, whatever the learner chose. |

The worked answer is its own field, so every ladder ends with one and no hint has to double as it. The second question is required. Without it the pattern is a retry quiz with hints, and the result cannot say how the learner did unaided.

`validateContent` rejects unknown fields, blank strings, duplicate option ids and unknown correct-option references. It also makes the checks ordinary JSON Schema tools cannot: `x-uniqueBy`, `x-optionReference` and `x-feedbackUnlessCorrect` (a reason on every wrong option and none on the correct one).

## Logic

`logic.js`, `strings.js` and the schema contain no DOM code. Hosts can build their own interface.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `start()` | A new state, `{ tries: [], opened: 0, followUp: null }`. |
| `progress(content, state)` | `{ first, tries, hints, next, gated, followUp, done }`. `first` is `'open'`, `'solved'` or `'shown'`. `tries` and `hints` are counts. `next` is the help step the button offers, `'hint'` or `'worked'`, or `null` once the first question has ended. `gated` is true while the worked answer waits for a checked answer. `followUp` is `'right'`, `'wrong'` or `null`. |
| `tryFirst(content, state, option)` | A new state with that option checked on the first question. Throws when the question has ended or the option was already checked. |
| `openHelp(content, state)` | A new state with the next hint open, or the worked answer after the last hint. Throws while the worked answer is gated or when the question has ended. |
| `tryFollowUp(content, state, option)` | A new state with the second question answered. Throws before the first question ends and after one answer. |
| `validateState(content, value)` | A copied state, or `null` when the learner's own steps could not have produced the value. |
| `summarize(content, state, strings)` | The closing sentence. Throws before the second question is checked. |
| `format(template, values)` | Placeholder substitution that keeps inserted text literal. |

The first question ends as `'solved'` when the last checked option is the correct one. It ends as `'shown'` when the learner opens the worked answer, or when every wrong option has been checked, since the one option left would not be an answer of their own. A checked wrong option cannot be checked again, so the try count never exceeds the number of wrong options.

Optional host `state: { read, write }` stores `{ tries, opened, followUp }`: the option ids checked on the first question in order, the number of help steps opened (the worked answer counts as one more than the hints), and the option id checked on the second question or `null`. Each check, each help step and "Start over" write it. A choice that has not been checked stays in memory. Invalid saved values are ignored. A valid value restores the card where the learner left it, without an announcement or a focus move. Without an adapter, progress lasts for the mounted instance.

Repeated `enhance` calls return the same instance. `destroy()` removes listeners, clears progress and restores the no-JavaScript view without rebuilding the DOM.

## Use it

Copy `patterns/hint-ladder/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/hint-ladder/pattern.css`. Use a unique id prefix per instance.

```js
import { render } from './patterns/hint-ladder/render.js';
import { enhance } from './patterns/hint-ladder/enhance.js';
import { strings } from './patterns/hint-ladder/strings.js';
import content from './patterns/hint-ladder/examples/en.json' with { type: 'json' };

document.querySelector('main').innerHTML = render(content, strings.en, { id: 'deadline', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern="hint-ladder"]'), { content, strings: strings.en });
```

### Accessibility details

- The hint button's name carries its place: "Show hint 1 of 2", then "Show hint 2 of 2", then "Show the worked answer".
- Opening a hint moves focus to it, so it is read once. The next Tab stop is "Check my answer", and Shift+Tab returns to the options.
- While the worked answer waits for a checked answer, its button stays focusable, is marked unavailable, and has the visible line "The worked answer opens after you check an answer." as its description.
- A wrong check leaves focus on "Check my answer", and moves it there if the option being closed held it. The status region announces "Incorrect." and the reason once. The option is disabled and keeps its mark and reason.
- When the first question ends, focus moves to the worked answer. It starts with a visually hidden "Correct." or, when the last wrong option was checked, "Incorrect." and that option's reason. Reading on reaches the second question.
- Checking the second question moves focus to its explanation, which starts with a visually hidden "Correct." or "Incorrect. Correct answer: …". The status region then announces the closing sentence once.
- Checking with nothing chosen shows "Choose an answer" in the question group, links it as the group's description and focuses the first option still open.
- "Start over" focuses the first option of the first question and announces "Answers cleared."
- Hints are set apart by space, an icon and a label. Marks use "Correct", "Incorrect", or "Correct answer" on a correct option the learner did not choose.

## Adapt it with your agent

> Adapt the hint-ladder examples to [topic] for [audience]. Keep the content fields. Write one question with three or four options and a reason for each wrong option that does not name the right one. Write one to three hints that each give more than the last and never give the answer, then the worked answer. Write a second question on a new case that uses the same rule, with one explanation. Put the rule in the context so both questions can be answered from the card. Write English and Québec French together, using vous, with the same option ids and correct answers. Preserve the retry on the first question, the worked answer waiting for one checked answer, the single try on the second question, the no-JavaScript disclosures, one status region, saved state and CSS tokens. Update examples and tests. Show both languages for review.

## Related patterns

- ["I don't know" as an answer](../dont-know/README.md) asks several questions about separate facts, takes one answer for each and scores them. This pattern stays on one rule, lets the learner try again with help, and scores nothing.
- [Check your own answer](../self-check/README.md) gives a hint for each part a written answer missed, all at once and after the learner has marked their own work. This pattern gives hints one at a time, before the answer.
- [Questions inside the reading](../review-prompts/README.md) and [Printable retrieval sheet](../retrieval-sheet/README.md) check the same skill later, without help.

## Help improve this pattern

Tried it with learners? [Tell us what happened](https://github.com/Praxity/learning-patterns/issues/new?template=pattern-feedback.yml&pattern=Hint%20ladder). You can also [suggest a change to this page](https://github.com/Praxity/learning-patterns/edit/main/patterns/hint-ladder/README.md).

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
