---
title: "I don't know" as an answer
title_fr: « Je ne sais pas » comme réponse
summary: Take a short quiz with an I don't know option, then see your score, explanations and links to questions to review.
section: question
ai: no
offline: yes
learners: not tried
---
# "I don't know" as an answer

You answer a quiz with an "I don't know" option, then see your score, explanations and questions to review.

## When to use it

Use it for a short practice quiz where learners need a way to report uncertainty. Authors set the points for right, wrong and unknown answers. A penalty for wrong answers may discourage guessing. Do not use it for assessment without testing the scoring with your learners.

## How it works

1. You read the scoring rule and choose one answer for each question, including "I don't know" when you are unsure.
2. You select "Check my answers" and answer any questions you left blank.
3. You see a mark beside each chosen answer. For wrong or uncertain answers, you also see the correct answer and an explanation.
4. You read your score and follow the review links to questions you got wrong or answered with "I don't know".
5. You select "Start over" to clear your answers and try again.

## Evidence

The nearest evidence is certainty-based marking. Gardner-Medwin's conference abstract reports improved exam reliability when students report certainty and confident errors cost points. That method uses certainty levels; this pattern uses one "I don't know" option. The scoring methods differ. [Gardner-Medwin, Analysis of exams using certainty-based marking](https://www.physoc.org/abstracts/analysis-of-exams-using-certainty-based-marking/).

This exact scoring has not been tested. A penalty for wrong answers may discourage guessing. Choosing "I don't know" records uncertainty, but it does not establish learners' confidence or prove a learning benefit.

Logic unit tested. Not tried with learners.

## Accessibility

Meets the shared baseline in the root README.

- Unanswered messages are linked to their questions and options. Focus moves to the first unanswered option.
- Submission focuses the score and announces its summary. Review links move focus to the question they name.
- Start over returns focus to the first option. Restoring a saved result keeps focus where it is and makes no announcement.

## Content fields

All text is plain text and escaped when rendered.

| Field | Meaning |
| --- | --- |
| `title` | Required nonempty quiz title in the scene header. |
| `questions` | At least one question, in display order. |
| `questions[].id` | Unique question identity using letters, digits, underscores or hyphens. |
| `questions[].text` | Question text shown as the fieldset legend. |
| `questions[].options` | At least one authored option, with unique identities within the question. |
| `questions[].options[].id` | Descriptive identity using letters, digits, underscores or hyphens. `dont-know` is reserved. |
| `questions[].options[].text` | Option label. |
| `questions[].correct` | Identity of an option in this question. |
| `questions[].explanation` | Authored explanation shown for wrong or unknown answers and in the native fallback. |
| `points.right`, `points.wrong`, `points.unknown` | Authored finite numbers, including fractions or negative values. |

`validateContent` rejects unknown fields, empty strings, duplicate identities and invalid correct-option references. Whitespace-only strings are allowed, as in the reference pattern. `x-uniqueBy` and `x-optionReference` describe cross-field checks. Ordinary JSON Schema validators need `validateContent` for those checks.

## Logic

`logic.js` has no DOM code, so another host can build its own interface on it.

| Export | Returns |
| --- | --- |
| `DONT_KNOW` | The reserved option identity `dont-know`. |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `score(content, picks)` | `{ points, total, right, wrong, unknown, unanswered }`. Each group contains question identities in content order. `total` is `questions.length * points.right`. Missing picks are unanswered. Invalid picks throw. |
| `validateState(content, value)` | A copied `{ picks, shown }`, or `null` for invalid saved state. A shown result requires complete picks. |
| `displayPoints(value, positive)` | A number as text, using a mathematical minus sign and an optional plus sign. |
| `format(template, values)` | Text with known `{key}` placeholders replaced once. Inserted values stay literal. |

Without JavaScript, use the native radios, then open "Answers" to read each correct option and explanation.

The example awards 1 point for a right answer, subtracts 1 for a wrong answer and awards 0 for "I don't know". Completed submissions lock the answers until reset. The decorative score ring is bounded between empty and full. Negative scores and nonpositive totals use an empty ring; the text always shows the actual score. Zero counts and an empty review list are omitted.

Optional `state: { read, write }` stores `{ picks: { [questionId]: optionId | 'dont-know' }, shown }`. Invalid saved state is ignored. Partial picks restore if `shown` is false. A shown result requires every question answered and rebuilds silently. Each pick, submit and reset saves state. Repeated enhancement returns the same instance. `destroy()` removes listeners, errors and results and restores the native answers.

## Use it

Copy `patterns/dont-know/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/dont-know/pattern.css`. Give every instance a unique id prefix. Render HTML on your server and call `enhance` in the browser.

```js
import { render } from './patterns/dont-know/render.js';
import { enhance } from './patterns/dont-know/enhance.js';
import { strings } from './patterns/dont-know/strings.js';
const content = {
  title: 'Money basics',
  questions: [{ id: 'fund', text: 'What is an emergency fund for?',
    options: [{ id: 'unexpected', text: 'Unexpected expenses' }],
    correct: 'unexpected', explanation: 'It covers unexpected expenses.' }],
  points: { right: 1, wrong: -1, unknown: 0 }
};
document.querySelector('main').innerHTML = render(content, strings.en, { id: 'practice', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

## Adapt it with your agent

> Rewrite the dont-know examples for my topic, [topic], and audience, [audience]. Keep `{ title, questions: [{ id, text, options: [{ id, text }], correct, explanation }], points: { right, wrong, unknown } }`. Use descriptive unique option ids, reserve `dont-know` for the string-based uncertainty option, and keep correct-option references valid. Write explanations for wrong and unknown answers. Keep English and Québec French together, addressing French learners with vous. A model may only choose authored messages. Keep render, enhancement, state, accessibility and CSS token contracts. Update tests and show both languages for review. State that this exact scoring is untested and that penalties may discourage guessing.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
