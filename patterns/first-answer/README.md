---
title: Your first answer replayed
title_fr: Revoir votre première réponse
summary: Save your first answer, answer again at the end of the course, then compare what changed.
section: course
ai: no
offline: yes
learners: not tried
---
# Your first answer replayed

Save an answer at the start of a course. Answer again at the end, then compare what changed.

## When to use it

Use it when learners can answer the same question at the start and end of a course. Keep the question and self-check criteria the same. Learners judge their own changes, so use another method to grade answers.

## How it works

1. Write an answer and select "Save my first answer". It stays as you wrote it, with the date you saved it.
2. At the end of the course, answer the same question and select "Compare".
3. Read your first answer below your new one. Tick the improvements you notice. The counter shows your ticks.
4. Select "Try again" to rewrite your new answer. Your first answer and ticks stay saved.
5. Select "Start over" to clear both answers and your ticks.

## Evidence

The improvement checklist asks learners to assess their work against named criteria. A meta-analysis of 175 studies linked self-assessment to better academic performance ([Yan et al., 2022](https://doi.org/10.1016/j.edurev.2022.100484)). Self-assessment works best for improving work rather than grading it ([Andrade and Valtcheva, 2009](https://doi.org/10.1080/00405840802577544)).

Keeping the first answer as written avoids relying on memory. After a study skills course, students remembered their earlier skills as worse than they had originally rated them. This made the course seem more helpful than it was ([Conway and Ross, 1984](https://doi.org/10.1037/0022-3514.47.4.738)). Feedback on progress raised children's self-efficacy and writing achievement in two experiments ([Schunk and Swartz, 1993](https://doi.org/10.1006/ceps.1993.1024)). Showing the old and new answers lets learners see changes directly.

Learners tend to rate their own work generously ([Dunlosky and Rawson, 2012](https://doi.org/10.1016/j.learninstruc.2011.08.003)). Ticks record changes they notice, not measured gains. Bringing back a first answer at the end of a course has not been tested directly.

## Accessibility

Follows the shared baseline in the root README.

- Saved entries show the date and time in the placement's language. First and current answers have separate labels.
- Blank or long answers get errors linked to the text box. Saving focuses Skip in the demo, or the saved entry in a first-only placement.
- Compare focuses the revealed Day one heading before the saved answer and improvement checks.
- Try again silently focuses the current-answer field. Reset focuses the first-answer field, or the current-answer field in an end-only placement.
- Storage problems show visible messages. Valid entries restore silently.

## Content fields

Authors write plain text. Rendering escapes HTML characters.

| Field | Meaning |
| --- | --- |
| `prompt` | Title and question. Keep the same at both course placements. |
| `checks` | At least one self-assessment check, in display order. |
| `checks[].id` | Unique id using letters, digits, underscores or hyphens. Keep stable across placements. |
| `checks[].label` | Visible checkbox label. |

Strings must be nonempty. `validateContent` rejects unknown fields and duplicate ids. The schema's `x-uniqueBy` annotation needs the uniqueness check in `validateContent`.

## Logic

`logic.js` has no DOM code. Hosts can use it with their own interface.

| Export | Returns |
| --- | --- |
| `MAX_LENGTH` | Answer limit of 2,000 characters. |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `validateAnswer(text)` | `{ ok: true, text }` with trimmed text, or `{ ok: false, error: 'empty' \| 'tooLong' }`. Uses `MAX_LENGTH`. |
| `validateState(content, value)` | Copied `{ first, now, checks }`, or `null` for invalid state. |
| `emptyState(content)` | `{ first: null, now: null, checks }` with every check false. |
| `withFirstAnswer(content, state, text, savedAt)` | Copied state with first saved. Throws if first or now is already saved. |
| `withAnswerNow(content, state, text, savedAt)` | Copied state replacing only now. Keeps first and checks. |
| `withChecks(content, state, checks)` | Copied state with known checks set to booleans. Throws when now is absent. |

Entries are `{ text, savedAt }`. Actions treat `null` state as empty and throw on invalid inputs.

`render` accepts `stage: 'first' | 'end' | 'both'`, default `'both'`. First and end placements can sit on different course pages. Each has a notebook icon, the prompt as title, and dated saved answers. Headings are "Day one" and "End of the course".

The demo shows both stages with a dashed timeline, a course note and Skip after saving. Skip opens and focuses the end heading. Restored answers open the end section directly. An end placement without a first answer explains the missing comparison and still accepts an answer.

Without JavaScript, every placement shows the prompt, a first-answer textarea and a note about saving.

Saving trims answers and limits them to 2,000 characters. The first entry stays fixed until reset. Compare makes the current-answer field read-only and hides its button. Try again keeps the draft and hides the comparison. Only the next Compare replaces the saved current answer.

Optional host state has synchronous `read()` and `write(value)` methods. The host chooses storage; the pattern never uses localStorage. Without an adapter, answers last for the mounted instance. Across course pages, use the same prompt, check ids and adapter. Set the closing block to `stage: 'end'`.

State is `{ first: { text, savedAt } | null, now: { text, savedAt } | null, checks: { [id]: boolean } }`. Dates are full ISO timestamps, written in UTC and displayed by `Intl.DateTimeFormat` using the block's `lang`. Reset writes `emptyState(content)`.

State needs a boolean for each check. Saved answers must be trimmed, nonempty and within the limit, with valid ISO timestamps. Malformed or unreadable state shows a warning and blocks writes until reset. Failed writes keep the previous record and show an error. Valid state restores silently. A saved now answer restores the locked comparison, even if the learner left while rewriting.

Repeated `enhance` calls preserve server elements and return the same instance. `destroy()` removes listeners and restores the no-JavaScript view. Placements sharing an adapter reread it before each action, so a stale placement cannot overwrite a newer answer. The host handles concurrent writes across tabs or devices.

## Use it

Copy `patterns/first-answer/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/first-answer/pattern.css`. Use a unique id prefix per instance.

```js
import { render } from './patterns/first-answer/render.js';
import { enhance } from './patterns/first-answer/enhance.js';
import { strings } from './patterns/first-answer/strings.js';
const content = {
  prompt: 'What would you say to a colleague who keeps interrupting you?',
  checks: [{ id: 'view', label: 'Asks how they see the situation' }]
};
const markup = render(content, strings.en, { id: 'opening', lang: 'en', stage: 'first' });
// Send markup to the browser, then:
const instance = enhance(document.querySelector('[data-lp-pattern="first-answer"]'), {
  content, strings: strings.en, state: hostState
});
```

## Adapt it with your agent

> Adapt the first-answer examples to [topic] for [audience]. Use the same prompt at both course placements. Keep `{ prompt, checks: [{ id, label }] }` and stable, unique ids. Write checks for changes learners can see in their answers. Write English and Québec French together, using vous. Preserve the first answer, state, stages, accessibility and CSS tokens. A model may only choose authored messages. Update examples and tests. Show both languages for review.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
