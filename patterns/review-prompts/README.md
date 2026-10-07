---
title: Questions inside the reading
title_fr: Questions au fil de la lecture
summary: Read a short section, recall its answer, then record whether you remembered it and see a review date.
section: reading
ai: no
offline: yes
learners: not tried
---
# Questions inside the reading

Short questions interrupt the reading so learners can try to recall an answer before revealing it. Each self-rating records a next review date. There is no score or summary banner.

## When to use it

Use it for short readings with facts or actions worth recalling later. Write one focused question and a concise answer for each part. Self-ratings record what the learner reports; they do not verify recall or workplace performance.

## How it works

1. Read a part and answer its "Check yourself" question in your head.
2. Open the native "Show the answer" details to compare your answer. JavaScript keeps this same details element and reveals "I remembered" and "I forgot" below the answer.
3. Choose a self-rating. "Next review: {date}" appears with a semantic `time` element and is announced once without moving focus. Change the choice to update the date. Closing and reopening the answer keeps the choice.

Without JavaScript, all readings, questions and native answers remain usable. Rating controls stay hidden.

`scheduleReview(date, result, reviewDays?)` returns a new date at local midnight, the configured number of calendar days after `date`. The default is three days for `remembered` and one for `forgot`, as in the source demo. The enhancer passes `content.reviewDays` and uses the current day for every choice. `isoDate(date)` serializes the local calendar date as `YYYY-MM-DD`. Unsupported results, invalid dates and unrepresentable review dates throw. Day counts must be positive safe integers; very large counts can still exceed the supported date range of years 0000 to 9999.

Display dates use `Intl.DateTimeFormat` with `en-CA` or `fr-CA`, showing weekday, day, month and year. Saved dates are civil dates, not UTC timestamps. They are formatted without shifting the day when a learner changes time zones.

## Content fields

All content is plain text. HTML characters are escaped.

| Field | Meaning |
| --- | --- |
| `parts` | At least one reading part, in display order. |
| `parts[].id` | Unique identity using letters, digits, underscores or hyphens. Keep it stable for saved state. |
| `parts[].heading` | Part heading, rendered as `h3`. The host owns `h1` and `h2`. |
| `parts[].paragraphs` | At least one nonempty paragraph. |
| `parts[].question` | Retrieval prompt below the reading. |
| `parts[].answer` | Authored answer in native details. |
| `reviewDays.remembered` | Positive whole calendar days after "I remembered". |
| `reviewDays.forgot` | Positive whole calendar days after "I forgot". |

`validateContent` rejects empty strings, unknown fields and duplicate part ids. Whitespace is allowed. The schema's `x-uniqueBy` annotation records identity uniqueness; ordinary JSON Schema tools also need the validator's uniqueness check.

Praxity Studio imports `logic.js`, `content.schema.json` and `strings.js` and builds its own UI. This pattern introduces the content shape `{ parts: [{ id, heading, paragraphs, question, answer }], reviewDays: { remembered, forgot } }`. The pure exports are `validateContent`, `scheduleReview`, `isoDate`, `validateState` and the frozen default `REVIEW_DAYS`. Strings in both languages share the keys `check`, `instruction`, `show`, `remembered`, `forgot` and `nextReview`. The last string contains `{date}`.

The examples preserve the demo's three parts about stonewalling and time-outs, including its reported 93% prediction claim. That example claim is not evidence for this pattern. Check subject-matter claims before publishing your own reading.

## Use it

Copy `patterns/review-prompts/` and `lib/`, preserving their relative paths. Include `pattern.css` and give each instance a unique id prefix. Render the HTML on the server before calling the enhancer in the browser.

```js
import { render } from './patterns/review-prompts/render.js';
import { enhance } from './patterns/review-prompts/enhance.js';
import { strings } from './patterns/review-prompts/strings.js';
const content = {
  parts: [{ id: 'pause', heading: 'Take a time-out',
    paragraphs: ['Announce your pause, then return to the conversation.'],
    question: 'What makes a pause a time-out?', answer: 'Announce it and return.' }],
  reviewDays: { remembered: 3, forgot: 1 }
};
document.querySelector('main').innerHTML = render(content, strings.en, { id: 'reading', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

Pass optional `state: { read, write }` to store `{ results: { [partId]: { result, reviewOn } } }`. `result` is `remembered` or `forgot`; `reviewOn` is a valid `YYYY-MM-DD` calendar date. Invalid saved state is ignored as a whole. Valid saved dates restore exactly, even when past due. Rated parts open on restoration without an announcement. Each choice writes an independent copy of all results. `destroy()` removes listeners and rating UI while leaving native answers usable. Repeated enhancement returns the same instance; repeated destruction is safe.

The host can read `reviewOn` to remind the learner. This pattern sends no reminders. A SCORM package can't bring a learner back on that date; that needs email, a message or an xAPI target connected to a reminder service. Saving a date or sending an xAPI statement alone does not arrange a return visit.

## Accessibility

Native details work with and without JavaScript. Each part has an `h3`; prompt groups have visible labels. Buttons have visible words, pressed states and a decorative check mark. One status region is present and empty at load. Each rating announces its date once, including repeated submissions. Opening answers and restoring state do not announce. Focus stays on the learner's control. There is no animation or time limit.

Automated checks cover axe WCAG 2.0, 2.1 and 2.2 AA rules at load, answer, rating and changed-choice stages in Chromium, WebKit and Firefox. Keyboard checks cover focus, dates and announcements. Tests also cover French, no JavaScript, two instances, state restoration, 320 CSS pixels with text spacing, and Chromium forced colours. Root `--lp-*` tokens control colours, spacing, radius, font and focus.

Screen reader passes: not yet

## Evidence

The mnemonic medium embeds spaced retrieval prompts in prose. Quantum Country used it first; Orbit extends the approach. This is the design source for placing questions inside a reading. [Matuschak, mnemonic medium](https://notes.andymatuschak.org/Mnemonic_medium).

The supplied research notes report Quantum Country retention observations from its authors' own logs. Those observations are not a controlled comparison and do not establish an effect for this pattern. [Matuschak, Quantum Country retention](https://notes.andymatuschak.org/zS5uKLsoTbkJSadTv2U3Z4G3uEBrFxTLy5E).

The supplied feedback research contains no direct retrieval-practice or spacing study for this interaction. Neither note validates the three-day and one-day schedule, self-ratings or workplace transfer. Treat those intervals as demo defaults and test delayed recall with your learners.

Logic unit tested. Not tried with learners.

## Adapt it with your agent

> Rewrite these reading parts for my topic: [topic]. My learners are [audience]. Keep the plain-text shape `{ parts: [{ id, heading, paragraphs, question, answer }], reviewDays: { remembered, forgot } }`. Write a focused retrieval question and a concise answer for each part. Keep stable unique ids, native details, h3 headings, editable self-ratings and calendar-day scheduling. Include no score or summary banner. Keep English and Québec French together, addressing French learners with vous. Authors write every message. Keep the render, enhancement, state, CSS token and accessibility contracts. Update examples and tests. Show both languages for review and describe how the host will arrange reminders.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
