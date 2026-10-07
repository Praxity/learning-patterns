---
title: Printable retrieval sheet
title_fr: Feuille de rappel à imprimer
summary: Print questions on the front and answers on the back to test yourself on a chosen date, with no connection needed.
section: course
ai: no
offline: yes
learners: not tried
---
# Printable retrieval sheet

You print questions on the front and answers on the back of a sheet to test yourself on a chosen date.

## When to use it

Use it for a short module with a few ideas or actions worth recalling. Keep questions focused and answers short enough for a sheet. Do not rely on handing out the sheet to bring learners back, since choosing a date sends no reminder.

It also suits learners with patchy or no internet. Print the sheets, or save them as PDFs, while a connection is available, and the practice goes with the learner on paper. In a SCORM package the sheet prints from the course files with nothing to fetch.

## How it works

1. You choose a "Test myself on" date. The suggested date is seven days from today.
2. You select Front or Back to preview the questions and answers.
3. You select "Print the sheet" to print the questions first and the answers after them.
4. On your chosen date, you write answers from memory, compare with the back and revisit what you missed.

## Evidence

Recalling studied prose improved retention two days and one week later, compared with restudying ([Roediger and Karpicke, 2006](https://doi.org/10.1111/j.1467-9280.2006.01693.x)), and a meta-analysis found that practice tests beat restudying and other study conditions ([Adesope, Trevisan and Sundararajan, 2017](https://doi.org/10.3102/0034654316689306)). Recall tests, like this sheet, produced larger benefits than recognition tests ([Rowland, 2014](https://doi.org/10.1037/a0037559)). The best gap between study and review grows with how long you need to remember ([Cepeda et al., 2008](https://doi.org/10.1111/j.1467-9280.2008.02209.x)), and the seven-day default suits remembering for weeks. The answers on the back give feedback right after each attempt. The weak point is use, since students tend to study when deadlines push them ([Hartwig and Dunlosky, 2012](https://doi.org/10.3758/s13423-011-0181-y)) and choosing a date sends no reminder. This sheet has not been tested with learners.

Logic unit tested. Not tried with learners.

## Accessibility

Meets the shared baseline in the root README.

- The Front and Back tabs have one tab stop. Left and Right arrows change sides; Home and End choose the first and last tabs.
- The date input has a visible label and linked errors. Date changes and print actions announce once and keep focus.
- Tab selection conveys the active side without a second status announcement.
- Printed questions leave space for handwritten answers. Check your printer's margins and double-sided settings by hand.

## Content fields

All fields are plain text. HTML characters are escaped.

| Field | Meaning |
| --- | --- |
| `title` | Module title in the scene header and on both printed sides. The host owns `h1`; the scene title is `h2`. |
| `questions` | At least one question and answer, in sheet order. |
| `questions[].id` | Unique id using letters, digits, underscores or hyphens. |
| `questions[].question` | Recall question on the front, with space to write an answer. |
| `questions[].answer` | Author's answer at the same number on the back. |

`validateContent` rejects empty strings, unknown fields, invalid ids and duplicate ids. Whitespace is allowed. The schema's `x-uniqueBy` annotation records id uniqueness; ordinary JSON Schema tools also need the validator's uniqueness check.

English and Québec French strings share the keys `instruction`, `dateLabel`, `dateError`, `dateChanged`, `sides`, `front`, `back`, `questions`, `answers`, `backInstruction`, `print`, `printHint`, and `printing`. Only `dateChanged` uses a placeholder, `{date}`. Authors write all learner-facing text.

## Logic

`logic.js` has no DOM code. Another host can build its own interface on these exports.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `defaultDate(today)` | Seven local calendar days ahead as `YYYY-MM-DD`, without changing `today`. Invalid dates and unsupported years throw. |
| `isDate(value)` | Whether the value is a real `YYYY-MM-DD` civil date in years 0001 to 9999. |
| `formatDate(date, lang)` | A readable date using `en-CA` or `fr-CA`. Formats in UTC to keep the saved civil day in every time zone. Invalid civil dates throw. |
| `validateState(value)` | A copied `{ date, side }`, or `null` for invalid saved state. |

Seven days is a demo default, not an established optimum for every topic or learner. Calendar scheduling handles month boundaries, leap years and daylight-saving changes.

The screen preview uses A4 proportions, a paper edge and a soft shadow. Narrow screens and enlarged text let the page grow. The scene header uses the shared file-text icon and module title. The recall instruction appears once, on the front, and stays visible in print. Interface colours and fonts use the shared `--lp-*` tokens.

Without JavaScript, both sides appear in order with the server's default date. Use your browser's Print command. Interactive controls stay hidden.

Printing makes the examples two pages on A4 or Letter, black on white, without controls or site chrome. Choose double-sided printing with the long-edge flip for one physical sheet. Turn off your browser's print headers and footers if it adds a URL or page numbers. Custom content can use more pages; text is never clipped to force it onto one sheet. Check your print preview after editing the questions.

`render` accepts an optional `today: Date` for a reproducible build date. Enhancement defaults to seven days after the learner's local day, so a static site's build date does not become its interactive default.

Pass optional `state: { read, write }` to store `{ date, side }`. `date` is a valid `YYYY-MM-DD` civil date; `side` is `front` or `back`. Invalid saved values are ignored as a whole. Valid dates restore exactly, including past dates, without an announcement. Each change passes a fresh copy to `write`; host mutation cannot change the live sheet. Host errors propagate.

An empty or invalid date shows an error beside the field and disables the print button. The last valid date stays on the sheet and in state until the learner chooses a valid date. The pattern does not restrict learners to future dates.

Repeated enhancement returns the same instance and keeps the server elements. `destroy()` removes listeners, hides controls and restores the original server dates and both visible sides. Calling it again is safe; enhancement can then run again.

The copied print stylesheet hides everything outside sheet roots while keeping their ancestors in flow. A pattern print button targets its own instance until `afterprint`; the browser's Print command prints all sheet instances in document order. Hosts that print other content on the same page should load this stylesheet only where they want a retrieval-sheet print view.

Saving a date sends no reminder. Arrange a reminder through your course host if you want one. Printing the sheet does not show that the learner used it.

## Use it

Copy `patterns/retrieval-sheet/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/retrieval-sheet/pattern.css`. Give every instance a unique id prefix. Render on the server before enhancing in the browser.

```js
import { render } from './patterns/retrieval-sheet/render.js';
import { enhance } from './patterns/retrieval-sheet/enhance.js';
import { strings } from './patterns/retrieval-sheet/strings.js';

const content = {
  title: 'Take a time-out',
  questions: [{ id: 'pause', question: 'What makes a pause a time-out?',
    answer: 'Say you need a few minutes, then return to the conversation.' }]
};
// On the server:
const markup = render(content, strings.en, { id: 'take-home', lang: 'en' });
// After inserting that HTML in the browser:
const instance = enhance(document.querySelector('[data-lp-pattern="retrieval-sheet"]'), {
  content, strings: strings.en
});
```

## Adapt it with your agent

> Write a retrieval sheet for my module: [topic]. My learners are [audience]. Keep `{ title, questions: [{ id, question, answer }] }`. Write focused questions and concise answers. Keep stable unique ids, a native date picker, Front and Back tabs, space for handwritten answers, a no-JavaScript view of both sides and clean two-sided printing. Keep English and Québec French together, addressing French learners with vous. Authors write every message. Preserve the render, enhancement, state, CSS token and accessibility contracts. Update examples and tests. Check A4 and Letter print previews. Show both languages for review.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
