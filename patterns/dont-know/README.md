---
title: '"I don''t know" as an answer'
title_fr: « Je ne sais pas » comme réponse
summary: Answer a quiz with an "I don't know" option, then see your score, explanations and questions to review.
section: question
ai: no
offline: yes
learners: not tried
---
# "I don't know" as an answer

Answer a quiz with an "I don't know" option. See your score, explanations and questions to review.

## When to use it

Use it for short practice quizzes where learners need a way to say they are unsure. Set points for right, wrong and unknown answers. Losing points for wrong answers may discourage guessing. Test the scoring with your learners before using it for assessment.

## How it works

1. Read the scoring rule and choose an answer for each question. Choose "I don't know" when you are unsure.
2. Select "Check my answers". Fill in any answers you left blank.
3. See a mark beside each chosen answer. Wrong and unknown answers also show the correct answer and an explanation.
4. Read your score. Follow the review links to questions you got wrong or answered with "I don't know".
5. Select "Start over" to clear your answers and try again.

## Evidence

When learners can withhold an answer, the answers they give are more accurate. The gain depends on how well they judge their knowledge ([Koriat and Goldsmith, 1996](https://doi.org/10.1037/0033-295X.103.3.490)). Medical exams have also used certainty-based marking. It rewards learners for being honest about how sure they are ([Gardner-Medwin, 1995](https://doi.org/10.1080/0968776950030113)).

An "I don't know" option reduced guessing in a vocabulary test but also hid partial knowledge ([Zhang, 2013](https://eric.ed.gov/?id=EJ1027592)). In several studies, penalties led women to skip more questions than men. Removing penalties narrowed score gaps ([Baldiga, 2014](https://doi.org/10.1287/mnsc.2013.1776); [Coffman and Klinowski, 2020](https://doi.org/10.1073/pnas.1920945117)).

The pattern follows Freire's and hooks's critique of teaching that treats teachers as knowing everything and learners as knowing nothing. See Freire, *Pedagogy of the Oppressed*, 1970, and hooks, *Teaching to Transgress*, 1994. Recognising the limits of one's knowledge predicted more effort to learn in five studies ([Porter et al., 2020](https://doi.org/10.1016/j.lindif.2020.101888)).

This scoring rule and its effect on test anxiety have not been tested. Keep wrong-answer penalties low-stakes.

## Accessibility

Follows the shared baseline in the root README.

- Each unanswered question has one error message linked to its group. Its options expose an invalid state. Focus moves to the first unanswered option.
- Submission focuses the score to announce it once. The status region stays silent. Review links focus the question they name.
- Start over focuses the first option. Saved results restore without moving focus or making an announcement.

## Content fields

Content is plain text. Rendering escapes HTML characters.

| Field | Meaning |
| --- | --- |
| `title` | Nonempty quiz title in the header. |
| `questions` | At least one question, in display order. |
| `questions[].id` | Unique question id using letters, digits, underscores or hyphens. |
| `questions[].text` | Question text shown as the fieldset legend. |
| `questions[].options` | At least one option. Ids must be unique within the question. |
| `questions[].options[].id` | Id using letters, digits, underscores or hyphens. `dont-know` is reserved. |
| `questions[].options[].text` | Option label. |
| `questions[].correct` | Id of an option in this question. |
| `questions[].explanation` | Explanation for wrong or unknown answers, also shown without JavaScript. |
| `points.right`, `points.wrong`, `points.unknown` | Authored finite numbers, including fractions or negative values. |

`validateContent` rejects unknown fields, empty strings, duplicate ids and invalid correct-option references. Whitespace-only strings are allowed. It supplies the cross-field checks that ordinary JSON Schema tools need, recorded as `x-uniqueBy` and `x-optionReference`.

## Logic

Authored text is capped at 120 characters for titles and labels, 400 for questions and prompts, 300 for options, and 1,500 for answers, explanations and passage text. The schema gives each field's limit; `validateContent` enforces it.


`logic.js` has no DOM code. Hosts can build their own interface.

| Export | Returns |
| --- | --- |
| `DONT_KNOW` | The reserved option identity `dont-know`. |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `score(content, picks)` | `{ points, total, right, wrong, unknown, unanswered }`. Each group contains question identities in content order. `points` and `total` keep full precision; `total` is `questions.length * points.right`. Missing picks are unanswered. Invalid picks throw. |
| `validateState(content, value)` | A copied `{ picks, shown }`, or `null` for invalid saved state. A shown result requires complete picks. |
| `displayPoints(value, positive = false, lang = 'en')` | Localized text rounded to hundredths, with a mathematical minus and an optional plus sign. |
| `format(template, values)` | Text with known `{key}` placeholders replaced once. Inserted values stay literal. |

Without JavaScript, choose answers with the radios, then open "Answers" for correct options and explanations.

`points` must satisfy `right > unknown >= wrong`. Only the displayed text is rounded to hundredths.

The example scores +1 for right, −1 for wrong and 0 for "I don't know". Submission locks answers until reset. The decorative score ring stays between empty and full. It is empty for negative scores or nonpositive totals. Text always shows the actual score. Zero counts and empty review lists are hidden.

Pass `state: { read, write }` to save `{ picks: { [questionId]: optionId | 'dont-know' }, shown }`. Invalid state is ignored. Partial picks restore when `shown` is false. Shown results require complete picks and restore silently. Each pick, submission and reset saves state. Repeated enhancement returns the same instance. `destroy()` removes listeners, errors and results and restores native answers.

## Use it

Copy `patterns/dont-know/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/dont-know/pattern.css`. Use a unique id prefix per instance. Render on the server; call `enhance` in the browser.

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

> Rewrite the dont-know examples for [topic] and [audience]. Keep `{ title, questions: [{ id, text, options: [{ id, text }], correct, explanation }], points: { right, wrong, unknown } }`. Use descriptive unique option ids and valid correct-option references. Reserve `dont-know` for the uncertainty option. Explain wrong and unknown answers. Keep English and Québec French together; use vous in French. A model may only choose authored messages. Follow the pattern contract, including state, accessibility and CSS tokens. Update tests and show both languages for review. Keep the limits on untested scoring and penalties.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
