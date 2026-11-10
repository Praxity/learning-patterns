---
title: Finish a worked example
title_fr: Terminer un exemple résolu
summary: Study one fully worked case, then finish cases that leave more steps to you, until you do the last one alone.
section: question
ai: no
offline: yes
learners: not tried
---
# Finish a worked example

Study one fully worked case of a procedure. Each later case leaves more of its steps to you, and the last one is yours alone.

## Use it when

- Learners can follow a procedure when someone demonstrates it but stall when they do it alone, such as checking an invoice, triaging a support ticket or working out a dose.
- Learners are new to the procedure, and each step ends in a result you can write as two to four options.

## Avoid it when

- When learners already carry out the procedure, give them whole cases with [Prolific questions](../prolific-questions/README.md), because worked steps stop helping once learners have experience.
- When the answer is free writing with no fixed steps, use [Check your own answer](../self-check/README.md).
- When the procedure has more than four steps, split it into two activities.

## Before you use it

Pick a procedure with two to four steps. Write each step as a question with two to four possible results. Then write three or four short cases, with one line per fact and one or two sentences of reason for each step's result.

Decide which steps the learner does in each case. The first case is fully worked. Each later case hands over at least one more step and keeps the ones already handed over. The learner does every step of the last case.

State the rule behind each step in the first case's reasons. Then check every wrong option in the later cases: it must be wrong under a rule the first case states, not only under your own practice.

Keep it short. A learner should finish in about two minutes, and the field limits are set for that.

Nearby patterns show a model after the attempt, or once at the start. [Check your own answer](../self-check/README.md) shows a model answer after the learner writes theirs. [Prolific questions](../prolific-questions/README.md) shows one worked example, then whole cases. [Your first answer replayed](../first-answer/README.md) compares two of the learner's own answers, and [Explain what you learned](../explain-back/README.md) checks an explanation of a reading. This pattern starts from the full model and takes it away one step at a time.

## How it works

1. The learner reads a short case with every step worked. Each step shows its result and the reason for it.
2. The next case leaves at least one step to them. Every step is labelled "Done for you" or "Your step", and the case heading says how many steps are theirs.
3. At their step, they choose a result and select that step's check button, such as "Check step 3". Their choice is marked and the reason appears. After a wrong choice the correct result is marked too, so they can always go on to the next step.
4. Each case leaves them more steps. They do every step of the last case, then see how many of their steps they got right.
5. "Previous case" reopens any earlier case, including the worked one. "Start over" clears their answers.

## Evidence

Students who studied worked algebra examples solved similar problems faster and with fewer errors than students who only solved problems. The gain was limited to problems with the same structure ([Sweller and Cooper, 1985](https://doi.org/10.1207/s1532690xci0201_3)).

Finishing a partly worked solution also helps. High school students who completed and extended existing programs wrote better programs after a ten-lesson course than students who wrote each program from scratch. They were no better at explaining what a program does ([van Merriënboer, 1990](https://doi.org/10.2190/4NK5-17L7-TWQV-1EHL)). In statistics training, studying worked problems or completing partly worked ones led to better transfer than solving conventional problems ([Paas, 1992](https://doi.org/10.1037/0022-0663.84.4.429)).

Removing worked steps a few at a time, called fading, beat pairing each example with a whole problem in three experiments. Learners made fewer errors while learning. The gain showed on problems close to the ones practised, and removing the last steps first worked better than removing the first steps first ([Renkl et al., 2002](https://doi.org/10.1080/00220970209599510)). A later experiment found that the position of the removed steps made no difference. Learners learned most about the principles behind the steps they did themselves ([Renkl, Atkinson and Große, 2004](https://doi.org/10.1023/B:TRUC.0000021815.74806.f6)). The sample hands over the last step first. Your content says which steps the learner does in each case, so hand over first the step you most want practised.

Fading alone did not reliably help on problems unlike the ones practised. Adding prompts that asked learners to name the principle behind each worked step did, in two experiments ([Atkinson, Renkl and Merrill, 2003](https://doi.org/10.1037/0022-0663.95.4.774)). This pattern states a reason under each worked step and does not ask the learner to name it.

Worked examples help beginners. As trade apprentices gained experience, worked examples became redundant and solving problems worked better ([Kalyuga et al., 2001](https://doi.org/10.1037/0022-0663.93.3.579)). A review found the same reversal for several other teaching techniques ([Kalyuga et al., 2003](https://doi.org/10.1207/S15326985EP3801_4)).

In the fading studies, learners worked out each missing step themselves. Here they choose its result from two to four options, which may be easier. Fading across only three or four short cases, with choices in place of worked-out steps, has not been tested, and this pattern has not been tried with learners.

## Accessibility

Follows the shared baseline in the root README.

Write each step as a plain question and each fact on one line. Without JavaScript, every case shows in full. Learners can choose an answer for each of their steps, then open that case's answers to check them.

## Content fields

Authors write plain text. Rendering escapes HTML characters. Keep English and Québec French examples together.

| Field | Meaning |
| --- | --- |
| `title` | Card heading, the name of the task. At most 120 characters. |
| `context` | The learner's role and what to do, in one or two short sentences. At most 300 characters. |
| `steps` | Two to four steps of the procedure, in order. Every case uses them. |
| `steps[].question` | The step, as a question. At most 120 characters. |
| `steps[].options` | Two to four possible results, each unique and at most 80 characters. |
| `cases` | Three or four cases, in the order the learner meets them. |
| `cases[].facts` | One to four labelled lines that describe the case. |
| `cases[].facts[].label` | What the line is, such as "Invoice". At most 40 characters. |
| `cases[].facts[].text` | The fact. At most 120 characters. |
| `cases[].steps` | One entry for each step, in step order. |
| `cases[].steps[].answer` | Position of the correct result in that step's `options`, counting from 0. |
| `cases[].steps[].reason` | Why that result is right, shown with the result. At most 200 characters. |
| `cases[].steps[].worked` | `true` when the step is shown done, `false` when the learner does it. |

`validateContent` rejects unknown fields and blank text. It also checks the fading: every step of the first case is worked, none of the last case is, and each case in between keeps the learner's earlier steps and adds at least one. Standard schema validators enforce the local limits. The `x-lengthFrom`, `x-optionIndex` and `x-fading` annotations need `validateContent`.

## Logic

`logic.js`, `strings.js` and the schema contain no DOM code. Hosts can use them with their own interface.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `learnerSteps(content, caseIndex)` | Indexes of the steps the learner does in that case, in order. Empty for the worked case. |
| `emptyState(content)` | `{ at: 0, picks }` with every pick `null`. |
| `nextStep(content, state, caseIndex)` | Index of the step the learner answers next in that case, or `-1` when the case is finished. |
| `reach(content, state)` | Index of the furthest case the learner may open: the first unfinished one, or the last. |
| `answer(content, state, caseIndex, step, pick)` | Copied state with that pick recorded. Throws a `RangeError` unless it is the next step of the case `reach` returns and `pick` is one of its options. |
| `move(content, state, caseIndex)` | Copied state with `at` set. Throws a `RangeError` for a case the learner has not reached. |
| `result(content, state)` | `{ right, total, done }` counted over the learner's own steps in every case. |
| `validateState(content, value)` | Copied `{ at, picks }`, or `null` for invalid state. |
| `format(template, values)` | The template with `{name}` placeholders filled. Inserted text is kept literally. |

State is `{ at, picks }`. `at` is the open case. `picks[case][step]` is the option the learner checked for that step, or `null`. Worked steps stay `null`. A checked step never changes, and a wrong pick opens the next step like a right one.

Optional host `state: { read, write }` stores that state. Each check, each case change and Start over write it. A choice the learner has not checked yet stays in the page and is not saved. Invalid saved values are ignored. Restoring shows the saved case with its marks and moves no focus.

Repeated `enhance` calls return the same instance. `destroy()` removes listeners, clears answers and marks, and restores the no-JavaScript view.

## Use it

The title comes first, then the context, then one case at a time.

Copy `patterns/finish-worked-example/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/finish-worked-example/pattern.css`. Use a unique id prefix per instance.

```js
import { render } from './patterns/finish-worked-example/render.js';
import { enhance } from './patterns/finish-worked-example/enhance.js';
import { strings } from './patterns/finish-worked-example/strings.js';
import content from './patterns/finish-worked-example/examples/en.json' with { type: 'json' };

document.querySelector('main').innerHTML = render(content, strings.en, { id: 'invoice', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

A worked step that comes after one of the learner's steps would give that answer away. It shows its number and question, and its result appears once the learner has checked the steps before it. The learner's own later steps wait the same way, so each answer is checked before the next step opens.

### Accessibility details

- The steps of a case are a list. Each learner step is a native radio group whose legend gives the step number, "Your step" and the question. Worked steps are text: step number, "Done for you", the question, the result and the reason.
- The accent label marks the learner's steps, and its words say the same without colour. The case heading gives the count, such as "You do 1 of the 3 steps."
- Checking a step with no choice shows an error linked to each option and moves focus to the first option, which reads the error once.
- After a check, focus moves to the reason under the step. For screen readers that line starts with "Correct." or "Incorrect. Correct answer:" and the correct result. The status region stays empty, so the result is read once, and Tab goes on to the next step or to "Next case".
- Checking the last step announces the final count once through the status region.
- "Next case", "Previous case" and "Start over" move focus to the case heading, which holds the case number and how many steps are the learner's.
- Marks use words, icons and borders. The case change slides for 240 ms and is instant under reduced motion. The facts stack under their labels in narrow containers.

Without JavaScript, the cases follow each other on one page. The learner's steps are radio groups, and each case with learner steps has an "Answers for case" disclosure with the result and reason for those steps and any worked step after them. Check, case navigation and the final count stay hidden.

## Adapt it with your agent

> Adapt the finish-worked-example examples to [procedure] for [audience]. Keep `{ title, context, steps: [{ question, options }], cases: [{ facts: [{ label, text }], steps: [{ answer, reason, worked }] }] }`. Use two to four steps with two to four options each, and three or four cases a learner can finish in about two minutes. Make the first case fully worked, hand over at least one more step in each later case, and leave every step of the last case to the learner. State the rule behind each step in the first case's reasons, so the later cases can be answered from the card alone. Write English and Québec French together, using vous. Preserve the step labels, the check after each step, the correct result after a wrong choice, one case at a time, saved state, the no-JavaScript answers and the narrow-screen layout. Update examples and tests. Show both languages for review.

## Related patterns

- [Prolific questions](../prolific-questions/README.md)
- [Check your own answer](../self-check/README.md)

## Help improve this pattern

Tried it with learners? [Tell us what happened](https://github.com/Praxity/learning-patterns/issues/new?template=pattern-feedback.yml&pattern=Finish%20a%20worked%20example). You can also [suggest a change to this page](https://github.com/Praxity/learning-patterns/edit/main/patterns/finish-worked-example/README.md).

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
