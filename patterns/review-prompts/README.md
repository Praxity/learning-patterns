---
title: Questions inside the reading
title_fr: Questions au fil de la lecture
summary: Read a course article with recall cards, check your memory and record a next review date.
section: reading
ai: no
offline: yes
learners: not tried
---
# Questions inside the reading

You answer recall questions between sections of a reading, compare with the answers and record dates to review them.

## When to use it

Use it for short readings with facts or actions worth recalling later. Write one focused question and a concise answer for each part. Do not use self-ratings to verify recall or workplace performance, since they record only what the learner reports.

## How it works

1. Read a section and recall the answer to its question.
2. Select "I have my answer". Focus moves to the answer so you can compare it with what you recalled.
3. You choose "I remembered" or "I forgot" and see a date for your next review. You can change your choice to update the date.
4. You see how many questions you have checked. If the reading has several sections, continue to the next one.

## Evidence

The mnemonic medium puts spaced recall prompts inside prose. Quantum Country used it first; Orbit extends the approach. It is the design source for this pattern. [Matuschak, mnemonic medium](https://notes.andymatuschak.org/Mnemonic_medium).

The supplied research notes describe Quantum Country retention observations from its authors' logs. They provide no controlled comparison and establish no effect for this pattern. [Matuschak, Quantum Country retention](https://notes.andymatuschak.org/zS5uKLsoTbkJSadTv2U3Z4G3uEBrFxTLy5E).

The supplied feedback research contains no direct study of recall practice or spacing for this interaction. Neither note validates its three-day and one-day schedule, self-ratings or workplace transfer. Treat the intervals as demo defaults and test delayed recall with your learners.

Logic unit tested. Not tried with learners.

## Accessibility

Meets the shared baseline in the root README.

- The article title and section headings give the reading a heading structure. "I have my answer" reveals a region labelled "Answer" and moves focus there.
- Rating buttons keep their visible labels and expose the chosen rating as pressed.
- Each rating announces its review date and keeps focus on the chosen button. Revealing answers and updating progress stay silent.
- Without JavaScript, "Show the answer" opens a native disclosure.

## Content fields

All content is plain text. HTML characters are escaped.

| Field | Meaning |
| --- | --- |
| `title` | Required article title, rendered as `h2`. The host owns `h1`. |
| `parts` | At least one reading part, in display order. |
| `parts[].id` | Unique identity using letters, digits, underscores or hyphens. Keep it stable for saved state. |
| `parts[].heading` | Part heading, rendered as `h3` in the body font. |
| `parts[].paragraphs` | At least one nonempty paragraph. |
| `parts[].question` | Retrieval prompt below the reading. |
| `parts[].answer` | Authored answer revealed after recall, with native details as the no-JavaScript fallback. |
| `reviewDays.remembered` | Positive whole calendar days after "I remembered". |
| `reviewDays.forgot` | Positive whole calendar days after "I forgot". |

`validateContent` rejects empty strings, unknown fields and duplicate part ids. Whitespace is allowed. The schema's `x-uniqueBy` annotation records identity uniqueness; ordinary JSON Schema tools also need the validator's uniqueness check.

Strings in both languages share the keys `readingTime`, `progress`, `commit`, `answer`, `show`, `remembered`, `forgot` and `nextReview`. Placeholders are `{n}` for reading time, `{count}` and `{total}` for progress, and `{date}` for the review date.

The examples contain one section about stonewalling and its recall card. Content can include several parts, each with its own question, answer and review date. Check subject-matter claims before publishing your own reading.

## Logic

`logic.js` has no DOM code, so another host can build its own interface on it.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `readingMinutes(content)` | Whole minutes at 200 words per minute, rounded up with a minimum of one. Validates content first. |
| `scheduleReview(date, result, reviewDays?)` | A new `Date` at local midnight after the configured calendar days. Defaults to three days for `remembered` and one for `forgot`. |
| `isoDate(date)` | The local calendar date as `YYYY-MM-DD`. |
| `validateState(content, value)` | A copied `{ results: { [partId]: { result, reviewOn } } }`, or `null` for invalid saved state. |
| `REVIEW_DAYS` | A frozen `{ remembered: 3, forgot: 1 }` default. |

The header's progress line counts distinct rated prompts, including restored ratings. Opening an answer does not count it; changing a rating does not increase the count. Progress updates are not announced.

`readingMinutes(content)` estimates time at 200 words per minute, rounded up with a minimum of one minute. It counts whitespace-separated words in the title, part headings, paragraphs, questions and answers. Interface labels are excluded.

Without JavaScript, the title, reading time, readings, questions and native answers remain usable. Rating controls and progress stay hidden.

`scheduleReview(date, result, reviewDays?)` returns a new date at local midnight after the configured number of calendar days. Its defaults match the source demo. The enhancer passes `content.reviewDays` and uses the current day for every choice. `isoDate(date)` serializes the local calendar date as `YYYY-MM-DD`.

Unsupported results, invalid dates and unrepresentable review dates throw. Day counts must be positive safe integers. Very large counts can still exceed the supported date range of years 0000 to 9999.

Display dates use `Intl.DateTimeFormat` with `en-CA` or `fr-CA`, showing weekday, day, month and year. Saved dates are civil dates, not UTC timestamps. They are formatted without shifting the day when a learner changes time zones.

Pass optional `state: { read, write }` to store `{ results: { [partId]: { result, reviewOn } } }`. `result` is `remembered` or `forgot`; `reviewOn` is a valid `YYYY-MM-DD` calendar date. Invalid saved state is ignored as a whole. Valid saved dates restore exactly, even when past due. Rated parts open on restoration without an announcement. Each choice writes an independent copy of all results. `destroy()` removes listeners and rating UI while leaving native answers usable. Repeated enhancement returns the same instance; repeated destruction is safe.

The host can read `reviewOn` to remind the learner. This pattern sends no reminders. A SCORM package can't bring a learner back on that date; that needs email, a message or an xAPI target connected to a reminder service. Saving a date or sending an xAPI statement alone does not arrange a return visit.

## Use it

Copy `patterns/review-prompts/` and `lib/`, preserving their relative paths. Link `lib/base.css`, then `patterns/review-prompts/pattern.css`. Give each instance a unique id prefix. Render the HTML on the server before calling the enhancer in the browser.

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

> Rewrite this article for my topic: [topic]. My learners are [audience]. Keep the plain-text shape `{ title, parts: [{ id, heading, paragraphs, question, answer }], reviewDays: { remembered, forgot } }`. Write a short title, a focused retrieval question and a concise answer for each part. Keep stable unique ids, the commitment button and answer focus, native details as the no-JavaScript fallback, h2 article title, h3 part headings, silent progress, editable self-ratings and calendar-day scheduling. Include no score. Keep English and Québec French together, addressing French learners with vous. Authors write every message. Keep the render, enhancement, state, CSS token and accessibility contracts. Update examples and tests. Show both languages for review and describe how the host will arrange reminders.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
