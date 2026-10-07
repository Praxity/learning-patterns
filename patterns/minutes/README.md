---
title: Minutes per section
title_fr: Minutes par section
summary: A course outline estimates each section from reading, narration and question counts, with editable author inputs.
section: course
ai: no
offline: yes
learners: not tried
---
# Minutes per section

A course outline shows estimated minutes for each section and a total, with counts authors can edit.

## When to use it

Use it when learners need an estimate of course length or authors need to check section sizes. Tune the reading and question rates against your content and learner observations. Do not use the estimates as measured learner time. The formula assumes learners read and listen together, so it underestimates time if they do them separately.

## How it works

1. You read the outline and the estimated minutes beside each section.
2. You see a warning beside sections estimated at more than 15 minutes and read the course total.
3. If you are editing the course, you select "Author view" and change the word, narration or question counts. The fields replace the count breakdowns.
4. You finish editing a number to see the new total. You correct any numbers with an error beside them.

## Evidence

The reading rate, question rate and warning threshold are assumptions from demo 24. No learning-effect claim or timing study is supplied. Tune estimates against your course and learner observations before publishing.

Logic unit tested. Not tried with learners.

## Accessibility

Meets the shared baseline in the root README.

- The outline is an ordered list with course and section headings. Each number field names its section and count.
- Invalid numbers have errors linked to their fields and an invalid-state indicator.
- Finishing a field edit announces the total once. Typing, toggling Author view and restoring counts stay silent and keep focus.

## Content fields

| Field | Meaning |
| --- | --- |
| `title` | Course title in the scene header. |
| `rates.readingWordsPerMinute` | Positive finite reading rate. The example uses 200. |
| `rates.minutesPerQuestion` | Nonnegative finite question time. The example uses 0.75 minutes, or 45 seconds. |
| `sections[].id` | Stable unique identifier, letters, digits, `_` or `-`. |
| `sections[].title` | Section title. |
| `sections[].words` | Nonnegative safe whole word count. |
| `sections[].narrationSeconds` | Nonnegative safe whole narration duration in seconds. |
| `sections[].questions` | Nonnegative safe whole question count. |

The rates are assumptions to tune for your content and learners. Author them in `rates`; narration duration is authored per section. The 15-minute warning follows the source demo's Check threshold, not a validated learning limit. If learners read and listen separately, this concurrent-time formula will underestimate their time.

`validateContent` rejects empty strings, unknown fields, duplicate ids, invalid counts, invalid rates and unsafe section estimates. Whitespace is allowed. The schema's `x-uniqueBy` annotation records identity uniqueness; use the validator for uniqueness and calculated range checks. `courseEstimate` also checks the total's safe integer range.

## Logic

`logic.js` has no DOM code or runtime dependencies.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `estimateMinutes(words, questions, narrationSeconds, rates?)` | Whole minutes from `ceil(max(words / readingWordsPerMinute, narrationSeconds / 60) + minutesPerQuestion * questions)`. Rates default to `RATES`. Invalid values throw. |
| `overLimit(minutes)` | Whether a safe whole minute estimate exceeds 15. Invalid values throw. |
| `parseCount(text)` | A nonnegative safe integer from decimal digits, or `null`. Surrounding whitespace is allowed. Blank, negative, fractional, scientific notation and unsafe values are rejected. |
| `courseEstimate(content)` | `{ sections: [{ id, minutes, overLimit }], total }`, in authored order. Validates content and total. |
| `validateState(content, value)` | An independent `{ authorView, sections: { [id]: { words, questions, narrationSeconds } } }`, or `null` for invalid saved state. |
| `RATES` | Frozen `{ readingWordsPerMinute: 200, minutesPerQuestion: 0.75 }` defaults. |
| `LIMIT_MINUTES` | The warning threshold, 15. |
| `COUNT_FIELDS` | Frozen field order, `words`, `narrationSeconds`, `questions`. |

English and Québec French strings have identical keys. `formatText(template, numericValues, lang)` replaces numeric placeholders using `en-CA` or `fr-CA`. `summaryText(strings, total, flagged, lang)` selects the authored zero, one or many warning summary. Authors write all labels, instructions, errors and announcements in `strings.js`.

The server outline has all estimates and warnings without JavaScript. Enhancement keeps that markup and reveals Author view. Repeated enhancement returns the same instance. `destroy()` removes listeners and hides author controls, keeping the last valid outline and discarding invalid drafts. Repeated destruction is safe.

Pass optional `state: { read, write }` to save the author toggle and a complete set of section counts. Invalid snapshots are ignored as a whole. Valid snapshots restore without announcements. Each committed valid edit or toggle writes an independent snapshot. Invalid drafts are not saved. Fixing an invalid field restores its estimate; while any field is invalid the total is unavailable. This demo estimates duration and does not measure learner time.

Authors supply plain text and counts. The estimate assumes narration plays during reading. It uses the longer of reading and narration time, adds time per question, then rounds up to whole minutes. The total adds the rounded section estimates. Empty sections take zero minutes.

## Use it

Copy `patterns/minutes/` and `lib/`, preserving relative paths. Link `lib/base.css`, then `patterns/minutes/pattern.css`. Give each instance a unique id prefix.

```js
import { render } from './patterns/minutes/render.js';
import { enhance } from './patterns/minutes/enhance.js';
import { strings } from './patterns/minutes/strings.js';

const content = {
  title: 'Your course',
  rates: { readingWordsPerMinute: 200, minutesPerQuestion: 0.75 },
  sections: [{ id: 'intro', title: 'Introduction', words: 1200,
    questions: 2, narrationSeconds: 60 }]
};
// On the server, place this HTML in the page.
const markup = render(content, strings.en, { id: 'outline', lang: 'en' });
// In the browser, enhance the existing server markup.
const instance = enhance(document.querySelector('[data-lp-pattern="minutes"]'), {
  content, strings: strings.en
});
```

## Adapt it with your agent

> Build an outline for my course: [course]. Supply stable section ids, titles, word counts, narration seconds and question counts. Keep named authored reading and question rates. Describe the rates as assumptions to tune. Keep the concurrent reading and narration formula, whole-minute estimates, total, author toggle, local field errors, saved state and bilingual messages. Use Québec French with vous. Keep the render, enhancement, schema and accessibility contracts. Update examples and tests. Show both languages for review.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
