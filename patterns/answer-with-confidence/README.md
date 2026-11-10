---
title: Answer with confidence
title_fr: Répondre avec ou sans certitude
summary: Answer each question as sure or not sure, read feedback for the answer you chose, then see where your certainty and your results disagreed.
section: question
ai: no
offline: yes
learners: not tried
---
# Answer with confidence

Answer each question once and say whether you are sure. Read feedback for the answer you chose, then see the questions where your certainty and your result disagreed.

The nearest pattern is ["I don't know" as an answer](../dont-know/README.md). That one checks a whole quiz at once and takes points off for wrong answers, so guessing has a cost. This one checks each question on its own, asks for certainty with every answer and never lets it change the result. Choose this pattern to show learners where they are sure and wrong. Choose "I don't know" when you want a score that discourages guessing.

## Use it when

- Learners arrive sure of answers that are often wrong, such as habits picked up on the job, and need to notice which ones.
- A practice quiz comes before a review session, and learners need to know which questions to reread first.

## Avoid it when

- When the result is graded or reported to someone else, use a quiz without certainty. Saying "Not sure" should never cost the learner anything.
- When wrong answers should cost points so that guessing doesn't pay, use ["I don't know" as an answer](../dont-know/README.md).

## Before you use it

Write two to six options for each question, and one or two sentences of feedback for every option, including the correct one. The learner sees only the feedback for the option they chose, so a wrong option's feedback says why it is wrong and what is right.

Where a wrong option is tempting for a good reason, add a line saying when it would be right. Learners see it only after choosing that option and saying they were sure.

Choose questions people tend to answer quickly and get wrong. Keep the feedback for one question short and about the same length, because the space kept for it is as tall as the longest. Turn on "Don't know" only where a lucky guess would do harm, such as a placement check.

## How it works

1. The learner chooses an answer, then submits it with "Sure of my answer" or "Not sure". Each question takes one try.
2. Their answer is marked correct or incorrect, and the feedback for that option takes the place of the submit buttons.
3. If they were sure and incorrect, one more line says why that option can seem right.
4. After the last question, a summary gives the number correct. It lists the questions they were sure of and got wrong, to review first, then the ones they got right without being sure.
5. "Start over" clears every answer.

Certainty never changes the result. With "Don't know" turned on, a third button submits a question without an answer and shows the correct one. A card with one question shows no summary, only "Start over" under the feedback.

## Evidence

People are often sure of answers that are wrong. Across several question and response formats, adults answering general-knowledge questions were consistently overconfident ([Fischhoff, Slovic and Lichtenstein, 1977](https://doi.org/10.1037/0096-1523.3.4.552)). Those studies asked for a degree of certainty in a laboratory, not for one of two buttons in a course.

A wrong answer given with high confidence is the one most likely to be corrected after feedback ([Butterfield and Metcalfe, 2001](https://doi.org/10.1037/0278-7393.27.6.1491)). The effect still held a week later, but high-confidence errors that were not corrected were also the most likely to come back ([Butler, Fazio and Marsh, 2011](https://doi.org/10.3758/s13423-011-0173-y)). That is why the summary puts these questions first. Both studies asked general-knowledge questions, took a confidence rating for each answer and gave the correct answer as feedback. Neither used two certainty buttons or feedback written for each option.

Feedback also helps after a right answer the learner was unsure of. In two experiments with multiple-choice questions, feedback doubled later retention of correct answers given with low confidence ([Butler, Karpicke and Roediger, 2008](https://doi.org/10.1037/0278-7393.34.4.918)). The questions were general-knowledge facts. That is why correct answers get feedback too, and why the summary lists the ones the learner was unsure of.

Asking for certainty at submission comes from certainty-based marking. Medical students chose one of three confidence levels with each answer, and marks rose for confident right answers and fell for confident wrong ones. In 107 voluntary self-test sessions, their accuracy at each level matched, on average, what the level implied ([Gardner-Medwin, 1995](https://doi.org/10.1080/0968776950030113)). This pattern keeps the declaration and drops the marks. Whether learners report certainty as carefully with no marks at stake has not been tested.

The combination here has not been tested with learners: two levels of certainty on a submit button, the "Why it can seem right" line and the two summary lists.

## Accessibility

Follows the shared baseline in the root README.

Write feedback for every option and keep it short. Without JavaScript, learners can choose answers and open "Answers" to read each correct option and its feedback. Certainty, feedback for wrong options and the summary need JavaScript.

## Content fields

Content is plain text. Rendering escapes HTML characters.

| Field | Meaning |
| --- | --- |
| `title` | Title in the header above several questions, at most 120 characters. Required with two or more questions. With one question it is optional and not shown: the context comes first and the question is the card's heading. |
| `context` | Optional situation under the header, at most 400 characters. |
| `dontKnow` | Optional. `true` adds a "Don't know" button to the submit control. Off by default. |
| `questions` | At least one question, in display order. |
| `questions[].id` | Unique question id using letters, digits, underscores or hyphens. |
| `questions[].text` | Question text shown as the fieldset legend, at most 400 characters. |
| `questions[].options` | Two to six options. Ids must be unique within the question. |
| `questions[].options[].id` | Id using letters, digits, underscores or hyphens. `dont-know` is reserved. |
| `questions[].options[].text` | Option label, at most 300 characters. |
| `questions[].options[].feedback` | Shown when the learner chooses this option, at most 300 characters. The correct option's feedback also appears after "Don't know" and without JavaScript. |
| `questions[].options[].rightWhen` | Optional, wrong options only, at most 200 characters. Says when this option would be right. Shown after "Why it can seem right:" when the learner chose it and was sure. |
| `questions[].correct` | Id of an option in this question. |

`validateContent` rejects unknown fields, blank strings, duplicate ids, invalid correct-option references, a `rightWhen` on the correct option and several questions without a title. It supplies the cross-field checks that ordinary JSON Schema tools need, recorded as `x-uniqueBy`, `x-optionReference`, `x-wrongOptionsOnly` and `x-requiredWithSeveral`.

## Logic

`logic.js`, `strings.js` and the schema contain no DOM code. Hosts can build their own interface.

| Export | Returns |
| --- | --- |
| `DONT_KNOW`, `SURE`, `UNSURE` | The reserved answer `dont-know` and the certainty values `sure` and `unsure`. |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `feedback(content, questionId, answer, certainty)` | `{ result, correct, feedback, rightWhen }`. `result` is `right`, `wrong` or `unknown`. `correct` is the correct option. `feedback` is the chosen option's text, or the correct option's after `dont-know`. `rightWhen` is the chosen option's line only when the answer is wrong and `certainty` is `sure`; otherwise `null`. Invalid answers and certainties throw. |
| `summarize(content, answers, certainties)` | `{ total, right, wrong, unknown, unanswered, sureWrong, unsureRight }`. Each group holds question ids in content order. `certainties` is optional and only fills the last two groups. Invalid answers and certainties throw. |
| `validateState(content, value)` | A copied `{ answers }`, or `null` for invalid saved state, including any value with other keys. |
| `format(template, values)` | Text with known `{key}` placeholders replaced once. Inserted values stay literal. |

The result is the number of questions in `right` out of `total`. Certainty never moves a question between groups.

Pass `state: { read, write }` to save `{ answers: { [questionId]: optionId | 'dont-know' } }`. Answers are saved so that a reload keeps each question's one try and a host can count correct answers. Whether the learner was sure is held in memory and never written, so no host can keep a record of it. Restored answers show "Correct" or "Incorrect" with their feedback, without "Why it can seem right", and the summary lists only questions answered since the page loaded. Invalid state is ignored. Each submission and Start over writes state. Repeated enhancement returns the same instance. `destroy()` removes listeners, clears answers and restores the "Answers" disclosure.

## Use it

Copy `patterns/answer-with-confidence/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/answer-with-confidence/pattern.css`. Use a unique id prefix per instance. Render on the server; call `enhance` in the browser.

```js
import { render } from './patterns/answer-with-confidence/render.js';
import { enhance } from './patterns/answer-with-confidence/enhance.js';
import { strings } from './patterns/answer-with-confidence/strings.js';
const content = {
  title: 'Sharing files',
  questions: [{ id: 'redact', text: 'You draw a black box over a number in a PDF and save it. Is the number hidden?',
    options: [
      { id: 'no', text: 'No, the text is still in the file', feedback: 'A drawn box sits on top of the text. A redaction tool deletes it.' },
      { id: 'yes', text: 'Yes, the box covers it', feedback: 'The box sits on top of the text, which anyone can still copy.', rightWhen: 'A box does hide the number on a printed page.' }
    ],
    correct: 'no' }]
};
document.querySelector('main').innerHTML = render(content, strings.en, { id: 'practice', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

The submit control and every possible feedback for a question share one grid cell, so the space is as tall as the tallest of them from the start and showing feedback moves nothing. The space is unpainted: before an answer it is only room under the buttons. Each option also keeps room for the widest answer mark beside its text, so a mark never changes an option's height. In containers narrower than 34rem the mark goes under the text and no room is kept for it, so the options that get a mark grow by one line. The "Choose an answer first." message uses the same space; in a narrow container, where the buttons stack, it can add a line or two.

### Accessibility details

Every control is a native radio button or button, so nothing needs a screen reader's focus mode switched by hand.

- Each question is a radio group with the question as its legend. Arrow keys choose an option; Tab moves to the submit buttons.
- The submit control is a group named "Submit your answer to question 2". Its two or three buttons are separate tab stops named by their visible labels. Activating one submits. None has a pressed or selected state.
- Submitting without an answer shows "Choose an answer first." under the buttons and links it to the question. Focus moves to the first option, which reads the question and the message once. The status region stays silent.
- Submitting hides the buttons, so focus moves to the feedback that takes their place. A screen reader reads it once: the verdict, such as "Sure, but incorrect", then "Correct answer" with the option's text after a wrong answer, then the feedback and any "Why it can seem right" line. The correct answer is visually hidden there because the option's mark already shows it.
- After the last question the status region announces the summary sentence and the size of each list. Summary entries are buttons that look like links and focus the question they name.
- An answered question's options and buttons are disabled. Each marked option's name ends with its mark.
- Start over focuses the first option and announces "Answers cleared." Saved answers restore without moving focus or announcing.
- The buttons stack in narrow containers. Forced colours keep the button borders and native radios.

## Adapt it with your agent

> Rewrite the answer-with-confidence examples for [topic] and [audience]. Keep `{ title, context, dontKnow, questions: [{ id, text, options: [{ id, text, feedback, rightWhen }], correct }] }`. Write two to six options per question and feedback for every option; a wrong option's feedback says why it is wrong and what is right. Add `rightWhen` only to wrong options that are right in some other situation, and say which. Never use the word "belief" in learner text. Leave `dontKnow` off unless a lucky guess would do harm. Keep English and Québec French together; use vous in French. Certainty must never change the result or reach saved state. Follow the pattern contract, including state, accessibility and CSS tokens. Update tests and show both languages for review.

## Related patterns

- ["I don't know" as an answer](../dont-know/README.md)
- [Pre-test to skip sections](../test-out/README.md)

## Help improve this pattern

Tried it with learners? [Tell us what happened](https://github.com/Praxity/learning-patterns/issues/new?template=pattern-feedback.yml&pattern=Answer%20with%20confidence). You can also [suggest a change to this page](https://github.com/Praxity/learning-patterns/edit/main/patterns/answer-with-confidence/README.md).

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
