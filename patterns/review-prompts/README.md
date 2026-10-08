---
title: Questions inside the reading
title_fr: Questions au fil de la lecture
summary: Answer questions between reading sections, compare with the answers and see when to review.
section: reading
ai: no
offline: yes
learners: not tried
---
# Questions inside the reading

Answer questions between reading sections, compare with the answers and see when to review.

## When to use it

Use it for short readings with facts or actions learners need to recall later. Give each section one focused question and a short answer. Ratings record what learners say they remembered. They do not verify recall or workplace performance.

## How it works

1. Read a section and answer its question from memory.
2. Select "I have my answer" to reveal the answer and compare it with yours.
3. Choose "I remembered" or "I forgot" to see your next review date. Change your choice to update the date.
4. Check your progress count and continue to the next section, if there is one.

## Evidence

Trying to recall what you read helps you remember it later better than rereading ([Roediger and Karpicke, 2006](https://doi.org/10.1111/j.1467-9280.2006.01693.x)). Practice testing was one of only two techniques a major review rated highly useful ([Dunlosky et al., 2013](https://doi.org/10.1177/1529100612453266)). Spacing reviews helps too. The best gap grows with how long you need to remember ([Cepeda et al., 2006](https://doi.org/10.1037/0033-2909.132.3.354)).

Questions inside a text help readers learn the material they ask about. Effects on other material are weaker ([Hamaker, 1986](https://doi.org/10.3102/00346543056002212)). Quantum Country's essays with spaced review questions inspired the design ([Matuschak and Nielsen, 2019](https://numinous.productions/ttft/)).

Students who overrate their recall stop studying too soon ([Dunlosky and Rawson, 2012](https://doi.org/10.1016/j.learninstruc.2011.08.003)), so learners see the answer before rating their recall. The review gaps are preset. This pattern has not been tested for recall after a delay.

## Accessibility

Follows the shared baseline in the root README.

- The article title and section headings form the reading's heading structure. "I have my answer" reveals a region labelled "Answer" and focuses it.
- Rating buttons keep their visible labels. The chosen rating has a pressed state.
- Each rating announces its review date and keeps focus on the chosen button. Revealing answers and updating progress stay silent.
- Without JavaScript, "Show the answer" opens a native disclosure.

## Content fields

Content is plain text. Rendering escapes HTML characters.

| Field | Meaning |
| --- | --- |
| `title` | Required article title, rendered as `h2`. The host owns `h1`. |
| `parts` | At least one reading part, in display order. |
| `parts[].id` | Unique id using letters, digits, underscores or hyphens. Keep it stable for saved state. |
| `parts[].heading` | Part heading, rendered as `h3` in the body font. |
| `parts[].paragraphs` | At least one nonempty paragraph. |
| `parts[].question` | Retrieval prompt below the reading. |
| `parts[].answer` | Answer shown after recall, or in a native disclosure without JavaScript. |
| `reviewDays.remembered` | Positive whole calendar days after "I remembered". |
| `reviewDays.forgot` | Positive whole calendar days after "I forgot". |

`validateContent` rejects empty strings, unknown fields and duplicate part ids. Whitespace is allowed. It supplies the uniqueness check that ordinary JSON Schema tools need, recorded as `x-uniqueBy`.

Strings in both languages share the keys `readingTime`, `progress`, `commit`, `answer`, `show`, `remembered`, `forgot` and `nextReview`. Placeholders are `{n}` for reading time, `{count}` and `{total}` for progress, and `{date}` for the review date.

The examples have one section about stonewalling. You can add parts, each with a question, answer and review date. Check subject-matter claims before publishing.

## Logic

`logic.js` has no DOM code. Hosts can build their own interface.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `readingMinutes(content)` | Whole minutes at 200 words per minute, rounded up with a minimum of one. Validates content first. |
| `scheduleReview(date, result, reviewDays?)` | A new `Date` at local midnight after the configured calendar days. Defaults to three days for `remembered` and one for `forgot`. |
| `isoDate(date)` | The local calendar date as `YYYY-MM-DD`. |
| `validateState(content, value)` | A copied `{ results: { [partId]: { result, reviewOn } } }`, or `null` for invalid saved state. |
| `REVIEW_DAYS` | A frozen `{ remembered: 3, forgot: 1 }` default. |

Progress counts questions rated, including saved ratings. Opening an answer adds nothing; changing a rating counts no extra question. Progress updates stay silent.

`readingMinutes(content)` counts whitespace-separated words in the title, headings, paragraphs, questions and answers. It excludes interface labels.

Without JavaScript, the title, reading time, sections, questions and native answers remain usable. Ratings and progress stay hidden.

The enhancer passes `content.reviewDays` to `scheduleReview` and starts each interval from the day the learner chooses a rating.

Unsupported results, invalid dates and dates outside years 0000 to 9999 throw. Day counts must be positive safe integers, but very large counts can still exceed the date range.

Display dates use `Intl.DateTimeFormat` with `en-CA` or `fr-CA` for weekday, day, month and year. Saved dates are calendar dates. Changing time zones does not shift their day.

Pass `state: { read, write }` to save `{ results: { [partId]: { result, reviewOn } } }`. `result` is `remembered` or `forgot`; `reviewOn` is a valid `YYYY-MM-DD` date. Invalid state is ignored as a whole. Valid dates restore exactly, even when overdue. Rated parts open silently. Each choice saves an independent copy of all results. `destroy()` removes listeners and ratings, keeping native answers usable. Repeated enhancement returns the same instance. Repeated destruction is safe.

The host can use `reviewOn` for reminders; the pattern sends none. Returning to a SCORM package requires email, a message or an xAPI target connected to a reminder service. Saving a date or sending an xAPI statement alone does not arrange a return visit.

## Use it

Copy `patterns/review-prompts/` and `lib/`, preserving their relative paths. Link `lib/base.css`, then `patterns/review-prompts/pattern.css`. Use a unique id prefix per instance. Render on the server before calling `enhance` in the browser.

```js
import { render } from './patterns/review-prompts/render.js';
import { enhance } from './patterns/review-prompts/enhance.js';
import { strings } from './patterns/review-prompts/strings.js';
const content = {
  title: 'Stonewalling and time-outs',
  parts: [{ id: 'pause', heading: 'Take a time-out',
    paragraphs: ['Announce your pause, then return to the conversation.'],
    question: 'What makes a pause a time-out?', answer: 'Announce it and return.' }],
  reviewDays: { remembered: 3, forgot: 1 }
};
document.querySelector('main').innerHTML = render(content, strings.en, { id: 'reading', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

## Adapt it with your agent

> Rewrite this article for [topic] and [audience]. Keep `{ title, parts: [{ id, heading, paragraphs, question, answer }], reviewDays: { remembered, forgot } }`. Write a short title, a focused question and a concise answer per part. Use stable unique ids. Keep the recall button and answer focus, native disclosures without JavaScript, h2 title, h3 section headings, silent progress, editable self-ratings and calendar-day scheduling. Include no score. Keep English and Québec French together; use vous in French. Authors write every message. Follow the pattern contract, including state, accessibility and CSS tokens. Update examples and tests. Show both languages for review. Explain how the host will arrange reminders.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
