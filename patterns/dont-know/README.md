---
title: "I don't know" as an answer
title_fr: « Je ne sais pas » comme réponse
summary: Answer a quiz with an explicit uncertainty option, then review wrong answers and knowledge gaps separately.
section: question
ai: no
offline: yes
learners: not tried
---
# "I don't know" as an answer

Answer four money-basics questions, or choose "I don't know". After submission, review wrong answers first, then knowledge gaps, then right answers.

## When to use it

Use it for a short practice quiz where learners need a way to report uncertainty. Authors set the points for right, wrong and unknown answers. The example awards 1 for a right answer, subtracts 1 for a wrong answer and awards 0 for "I don't know". A penalty for wrong answers may discourage guessing. Test the scoring with your learners before using it for assessment.

## How it works

1. Read the scoring rule and choose one radio option for each question. "I don't know" is always last.
2. Select "Check my answers". Unanswered questions get visible messages. Focus moves to the first unanswered question's first radio.
3. Read the score and counts. The report groups wrong answers with your choice and the explanation, unknown answers with the explanation, and right answers with the question only. Empty groups say "None."
4. Changing an answer clears the old results. Submit again to get feedback. "Start again" appears after results and clears every pick and result, then focuses the first radio.

Without JavaScript, use the native radios, then open "Answers" to read each correct option and explanation.

## Content fields

All text is plain text and escaped when rendered.

| Field | Meaning |
| --- | --- |
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

Praxity Studio imports `logic.js`, `content.schema.json` and `strings.js` without DOM code. `score(content, picks)` returns `{ points, total, right, wrong, unknown, unanswered }`. Groups contain question identities in content order. `total` is the all-right score, `questions.length * points.right`. Missing picks are unanswered, never unknown. Invalid picks throw. `DONT_KNOW` is `dont-know`. This new pattern changes no existing pattern's content or interface.

## Use it

Copy `patterns/dont-know/` and `lib/`, keeping their relative paths. Include `pattern.css`. Give every instance a unique id prefix. Render HTML on your server and call `enhance` in the browser.

```js
import { render } from './patterns/dont-know/render.js';
import { enhance } from './patterns/dont-know/enhance.js';
import { strings } from './patterns/dont-know/strings.js';
const content = {
  questions: [{ id: 'fund', text: 'What is an emergency fund for?',
    options: [{ id: 'unexpected', text: 'Unexpected expenses' }],
    correct: 'unexpected', explanation: 'It covers unexpected expenses.' }],
  points: { right: 1, wrong: -1, unknown: 0 }
};
document.querySelector('main').innerHTML = render(content, strings.en, { id: 'practice', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

Optional `state: { read, write }` stores `{ picks: { [questionId]: optionId | 'dont-know' }, shown }`. Invalid saved state is ignored. Partial picks restore if `shown` is false. A shown result requires every question answered and rebuilds silently. Each pick, submit and reset saves state. Repeated enhancement returns the same instance. `destroy()` removes listeners, errors and results and restores the native answers.

## Accessibility

Native fieldsets, legends and radios work before enhancement. Unanswered messages describe the fieldsets and radios, and the first missing radio receives focus. Successful submission keeps focus on the button. One status region starts empty and announces only the score once per submission, or the reset message. Results use words and decorative icons. There is no animation or time limit.

Browser checks cover axe WCAG 2.0, 2.1 and 2.2 AA rules at load, errors, results and reset in Chromium, Firefox and WebKit. They also cover keyboard focus, French language, no JavaScript, two instances, saved state, repeated enhancement, 320 CSS pixels with text spacing and Chromium forced colours.

Screen reader passes: not yet

## Evidence

The nearest evidence is certainty-based marking. Gardner-Medwin's conference abstract reports that asking students for certainty and penalising confident errors improved exam reliability. Its scoring uses certainty levels. This pattern uses a single "I don't know" option, so it is a different scoring method. [Gardner-Medwin, Analysis of exams using certainty-based marking](https://www.physoc.org/abstracts/analysis-of-exams-using-certainty-based-marking/).

This exact scoring has not been tested. A penalty for wrong answers may discourage guessing. Separating wrong answers from unknown answers gives learners two lists to review, but it does not establish their confidence or prove a learning benefit.

Logic unit tested. Not tried with learners.

## Adapt it with your agent

> Rewrite the dont-know examples for my topic, [topic], and audience, [audience]. Keep `{ questions: [{ id, text, options: [{ id, text }], correct, explanation }], points: { right, wrong, unknown } }`. Use descriptive unique option ids, reserve `dont-know` for the string-based uncertainty option, and keep correct-option references valid. Write explanations for wrong and unknown answers. Keep English and Québec French together, addressing French learners with vous. A model may only choose authored messages. Keep render, enhancement, state, accessibility and CSS token contracts. Update tests and show both languages for review. State that this exact scoring is untested and that penalties may discourage guessing.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
