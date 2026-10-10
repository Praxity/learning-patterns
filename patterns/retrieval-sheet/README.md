---
title: Printable retrieval sheet
title_fr: Feuille de rappel à imprimer
summary: Print questions and answers on opposite sides of a sheet, then test yourself on a chosen date.
section: question
ai: no
offline: yes
learners: not tried
---
# Printable retrieval sheet

Print questions on the front and answers on the back. Choose a date to answer from memory and check your work.

## When to use it

Use it for a short module with a few ideas or actions worth recalling. Keep questions focused and answers short.

Learners can use the sheet without internet. Print it or save a PDF while connected. A SCORM package prints from its course files without fetching anything.

Choosing a date sends no reminder. Arrange one through your course host if needed.

## How it works

1. Choose when to test yourself: in 2 days, 1 week, 2 weeks or 1 month. Each choice shows its date. The default is 1 week. Choose "Another date" to enter your own date.
2. Select "Front" to preview questions or "Back" to preview answers.
3. Select "Print the sheet". Questions print first, then answers.
4. On your chosen date, write answers from memory. Check the back and revisit what you missed.

## Evidence

Recalling studied prose improved retention two days and one week later compared with restudying ([Roediger and Karpicke, 2006](https://doi.org/10.1111/j.1467-9280.2006.01693.x)). A meta-analysis found that practice tests beat restudying and other study conditions ([Adesope, Trevisan and Sundararajan, 2017](https://doi.org/10.3102/0034654316689306)). Recall tests, like this sheet, produced larger benefits than recognition tests ([Rowland, 2014](https://doi.org/10.1037/a0037559)).

The best gap before review grows with how long you need to remember ([Cepeda et al., 2008](https://doi.org/10.1111/j.1467-9280.2008.02209.x)). The seven-day default suits remembering for weeks. Answers on the back give feedback after each attempt.

Use remains uncertain. Students tend to study when deadlines push them ([Hartwig and Dunlosky, 2012](https://doi.org/10.3758/s13423-011-0181-y)). Choosing a date sends no reminder, and this sheet has not been tested with learners.

## Accessibility

Follows the shared baseline in the root README.

- Front and Back tabs share one tab stop. Left and Right arrows change sides; Home selects Front and End selects Back. Selection updates the tabs and panel before moving focus.
- A fieldset names the five spacing choices. Each radio's name includes its date, after a comma. Native radios support Tab and arrow keys, with a visible selected row and keyboard focus.
- "Another date" reveals a field labelled "Date" and announces the date in it. Date changes and printing announce once and keep focus.
- A newly invalid date announces its error once through the status region. The field gets the error as its description when focus leaves it, so it isn't read twice. Repeated invalid edits stay silent. A valid date, even the same one as before, announces once. A year typed digit by digit changes nothing until it has four digits.
- Tab selection identifies the active side without another status announcement.
- NVDA speaks a newly selected tab twice after Arrow, Home or End changes sides in Chrome and Firefox. The W3C ARIA Authoring Practices example also does this. Tabs still activate on focus; requiring Enter or Space would add a step for everyone.
- Printed questions leave space for handwritten answers. Check printer margins and double-sided settings by hand.

## Content fields

Authors write plain text. Rendering escapes HTML characters.

| Field | Meaning |
| --- | --- |
| `title` | Module title in the scene header and on both printed sides. The host owns `h1`; the scene uses `h2`. |
| `questions` | At least one question and answer, in sheet order. |
| `questions[].id` | Unique id using letters, digits, underscores or hyphens. |
| `questions[].question` | Front-side recall question, with writing space. |
| `questions[].answer` | Author's answer at the same number on the back. |

`validateContent` rejects empty strings, unknown fields, invalid ids and duplicates. Whitespace is allowed. The schema's `x-uniqueBy` annotation needs the validator's uniqueness check.

English and Québec French strings share `instruction`, `dateLabel`, `dateError`, `dateChanged`, `sides`, `front`, `back`, `questions`, `answers`, `backInstruction`, `print`, `printHint` and `printing`. The spacing choices use `spacingLegend`, `in2Days`, `in1Week`, `in2Weeks`, `in1Month` and `anotherDate`. The custom field uses `customDateLabel`; `dateLabel` stays on the printed sheet. Only `dateChanged` uses `{date}`. Authors write every learner-facing message.

## Logic

Authored text is capped at 120 characters for titles and labels, 400 for questions and prompts, 300 for options, and 1,500 for answers, explanations and passage text. The schema gives each field's limit; `validateContent` enforces it.

`validateContent` and the schema cap `questions` at eight.

`logic.js` has no DOM code. Hosts can use these exports with their own interface.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `presetDays` | The spacing offsets `[2, 7, 14, 30]` in civil days. |
| `dateAfterDays(today, days)` | `YYYY-MM-DD`, counting whole days from the local date of `today` with UTC arithmetic. Leaves `today` unchanged. Invalid dates, non-integer offsets and unsupported years throw. |
| `defaultDate(today)` | Seven local calendar days ahead as `YYYY-MM-DD`. Leaves `today` unchanged. Invalid dates and unsupported years throw. |
| `isDate(value)` | Whether the value is a real `YYYY-MM-DD` civil date in years 0001 to 9999. |
| `isPartialYear(value)` | Whether a date field value has a year under 1000, which a browser can report while the year is still being typed. |
| `formatDate(date, lang)` | Readable date using `en-CA` or `fr-CA`. UTC formatting preserves the civil day across time zones. Invalid dates throw. |
| `formatShortDate(date, lang)` | Short weekday and date using `en-CA` or `fr-CA`, such as "Thu, Oct 15" or "jeu. 15 oct.". UTC formatting preserves the civil day. Invalid dates throw. |
| `validateState(value)` | Copied `{ date, side }`, or `null` for invalid state. |

The spacing choices offer several gaps because the best gap grows with how long you need to remember, as the evidence above describes. Seven days is a demo default, not an established optimum for every topic or learner. Scheduling handles month boundaries, leap years and daylight-saving changes.

The preview has A4 proportions, a paper edge and a soft shadow. It grows for narrow screens or enlarged text. The scene shows a file-text icon and module title. The recall instruction appears once on the front, including in print. Colours and fonts use shared `--lp-*` tokens.

Without JavaScript, both sides appear in order with the server's date. Controls stay hidden. Use the browser's Print command.

The examples print as two black-on-white pages on A4 or Letter, without controls or site navigation. Choose double-sided printing with the long-edge flip for one sheet. Turn off browser headers and footers to omit URLs or page numbers. A sheet accepts at most eight questions. The print tests cover eight questions on both paper sizes in both languages. Long stems, answers or deliberate line breaks can still add pages; text is never clipped. Check print preview after editing questions.

`render` accepts optional `today: Date` for a reproducible build date. Enhancement uses the learner's local day, so a static build date does not determine the interactive default.

Optional `state: { read, write }` stores `{ date, side }`. `date` is a valid `YYYY-MM-DD` civil date; `side` is `front` or `back`. Invalid state is ignored as a whole. Valid dates restore exactly and silently, including past dates. A date matching a spacing choice from today selects that row. Other dates select "Another date" and fill its field. Each change writes a fresh copy; host mutation cannot change the live sheet. Host errors propagate.

Invalid or empty edits in "Another date" show a local error and disable Print. Choosing a preset clears the error and enables Print. The sheet and state keep the last valid date until a valid edit. Past dates are allowed.

Repeated enhancement preserves server elements and returns the same instance. `destroy()` removes listeners, hides controls and restores server dates and both visible sides. Repeated destruction is safe; the root can then be enhanced again.

The print stylesheet hides everything outside sheet roots and keeps their ancestors in flow. Print buttons target their own instance until `afterprint`. The browser's Print command prints all sheet instances in document order. Load this stylesheet only on pages where this print view is wanted.

Saving a date sends no reminder. Printing does not show that the learner used the sheet.

## Use it

Copy `patterns/retrieval-sheet/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/retrieval-sheet/pattern.css`. Use a unique id prefix per instance. Render on the server, then enhance in the browser.

```js
import { render } from './patterns/retrieval-sheet/render.js';
import { enhance } from './patterns/retrieval-sheet/enhance.js';
import { strings } from './patterns/retrieval-sheet/strings.js';

const content = {
  title: 'Take a time-out',
  questions: [{ id: 'pause', question: 'What makes a pause a time-out?',
    answer: 'Say you need a few minutes, then return to the conversation.' }]
};
const markup = render(content, strings.en, { id: 'take-home', lang: 'en' });
// Send markup to the browser, then:
const instance = enhance(document.querySelector('[data-lp-pattern="retrieval-sheet"]'), {
  content, strings: strings.en
});
```

## Adapt it with your agent

> Write a retrieval sheet for [topic] and [audience]. Keep `{ title, questions: [{ id, question, answer }] }` with stable, unique ids. Write focused questions and short answers. Preserve the spacing radio group, the "Another date" field, Front and Back tabs above the preview, writing space, no-JavaScript view and two-sided printing. Write English and Québec French together, using vous. Authors write every message. Preserve render, enhancement, state, CSS tokens and accessibility. Update examples and tests. Check A4 and Letter print previews. Show both languages for review.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
