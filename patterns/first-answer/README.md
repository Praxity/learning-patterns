---
title: Your first answer comes back
title_fr: Votre première réponse revient
summary: Keep a dated journal entry from day one, answer again at the end of the course, then compare and check what improved.
section: course
ai: no
offline: yes
learners: not tried
---
# Your first answer comes back

You save a dated answer at the start of a course, answer again at the end and check what improved.

## When to use it

Use it near the start and end of a course when learners can revisit the same question. Keep the question and self-check criteria the same throughout the course. Do not use it to grade either answer, since learners assess their own changes.

## How it works

1. You write your first answer and select "Save my first answer". You see it as a dated entry that stays as you wrote it.
2. At the end of the course, you answer the same question and select "Compare".
3. You read your first answer below your new one and tick the checks that describe what improved. You see a count of your ticks.
4. You select "Try again" to rewrite your new answer and compare again. Your first answer and ticks stay saved.
5. You select "Start over" if you want to clear both answers and your ticks.

## Evidence

Checking your work against named criteria, the way a rubric works, is self-assessment, and the improvement checklist here is exactly that. A meta-analysis of 175 studies linked self-assessment to better academic performance ([Yan et al., 2022](https://doi.org/10.1016/j.edurev.2022.100484)), and self-assessment works best for improving a piece of work rather than grading it ([Andrade and Valtcheva, 2009](https://doi.org/10.1080/00405840802577544)). The first answer is kept as written because people misremember where they started. In one study, students who took a study skills course recalled their earlier skills as worse than they had rated them at the time, so the course seemed to help more than it did ([Conway and Ross, 1984](https://doi.org/10.1037/0022-3514.47.4.738)). Feedback on progress raised children's self-efficacy and writing achievement in two experiments ([Schunk and Swartz, 1993](https://doi.org/10.1006/ceps.1993.1024)), and an old answer beside a new one shows progress directly. Learners tend to rate their own work generously ([Dunlosky and Rawson, 2012](https://doi.org/10.1016/j.learninstruc.2011.08.003)), so the ticks show what a learner noticed changing, not a measured gain. Bringing back a first answer at the end of a course has not been tested directly.

## Accessibility

Meets the shared baseline in the root README.

- Saved entries show the date and time in the placement's language. First and current answers have separate labels.
- Blank or long answers get errors linked to the text box. Saving focuses Skip in the demo or the saved entry in a first-only placement.
- Try again focuses the current-answer field without an announcement. Reset focuses the first-answer field, or the current-answer field in an end-only placement.
- Storage problems have visible messages. Restoring valid entries makes no announcement.

## Content fields

All fields are plain text. HTML characters are escaped.

| Field | Meaning |
| --- | --- |
| `prompt` | The journal header's title, the same question at both course placements. |
| `checks` | At least one authored self-assessment check, in display order. |
| `checks[].id` | Unique letters, digits, underscores or hyphens. Keep stable across placements. |
| `checks[].label` | The visible checkbox label. |

Strings must be nonempty. `validateContent` rejects unknown fields and duplicate check identities. The schema's `x-uniqueBy` annotation needs the extra uniqueness check from `validateContent`.

## Logic

`logic.js` has no DOM code, so another host can build its own interface on it.

| Export | Returns |
| --- | --- |
| `MAX_LENGTH` | The answer limit, 2,000 characters. |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `validateAnswer(text)` | `{ ok: true, text }` with trimmed text, or `{ ok: false, error: 'empty' \| 'tooLong' }`. `MAX_LENGTH` is 2,000 characters. |
| `validateState(content, value)` | A clean `{ first, now, checks }`, or `null` for invalid saved state. |
| `emptyState(content)` | `{ first: null, now: null, checks }` with every check false. |
| `withFirstAnswer(content, state, text, savedAt)` | A copied state with the first answer saved. Throws if first or now is already saved. |
| `withAnswerNow(content, state, text, savedAt)` | A copied state replacing only now. First and checks keep their values. |
| `withChecks(content, state, checks)` | A copied state with known checks set to booleans. Throws when now is absent. |

Entries are `{ text, savedAt }`. Actions accept `null` state as empty state and throw on invalid inputs.

`render` accepts `stage: 'first' | 'end' | 'both'`, default `'both'`. First and end placements can appear on different course pages. Each placement has a notebook icon and the prompt as its title. Saved entries show the answer and its date. Steps use "Day one" and "End of the course" as headings. The demo uses both, with a dashed timeline, a course note and a skip button after saving. Skip opens the end section and focuses its heading. Restored answers open the end section directly. An end placement with no first answer explains the missing comparison and still accepts an answer now.

Without JavaScript, the prompt, a first-answer textarea and a saving note remain available in every placement.

Answers have a 2,000-character limit. Saving trims leading and trailing whitespace. The first entry cannot change until reset. Compare makes the current-answer field read-only and hides its button. Try again keeps the draft text and hides the comparison; the saved current answer changes only on the next Compare.

The optional host adapter has synchronous `read()` and `write(value)` methods. The host decides where state lives; this pattern never uses localStorage. Without an adapter, answers last for the mounted instance. For separate course pages, keep the prompt, check ids and state adapter the same in both placements. Render the closing block with `stage: 'end'`.

State is `{ first: { text, savedAt } | null, now: { text, savedAt } | null, checks: { [id]: boolean } }`. Dates are full ISO timestamps. `Intl.DateTimeFormat` displays them using the block's `lang`. The pattern writes UTC timestamps. Reset writes `emptyState(content)`.

State must contain a boolean for every known check. Saved answers must be trimmed, nonempty and within the limit. Dates must be valid ISO timestamps. A malformed or unreadable host value shows a visible warning. It blocks writes until you deliberately reset. Failed writes preserve the previous record and show a visible error. Restoring valid state makes no announcement. A saved now answer restores the locked comparison, even if you were rewriting when you left.

`enhance` preserves server elements and returns the same instance on repeated calls. `destroy()` removes listeners and restores the no-JavaScript baseline. Two mounted placements sharing an adapter reread it before each action, so a stale first placement cannot overwrite an answer saved elsewhere. The host remains responsible for concurrent writes across tabs or devices.

## Use it

Copy `patterns/first-answer/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/first-answer/pattern.css`. Give every instance a unique id prefix.

```js
import { render } from './patterns/first-answer/render.js';
import { enhance } from './patterns/first-answer/enhance.js';
import { strings } from './patterns/first-answer/strings.js';
const content = {
  prompt: 'What would you say to a colleague who keeps interrupting you?',
  checks: [{ id: 'view', label: 'Asks for their view' }]
};
const markup = render(content, strings.en, { id: 'opening', lang: 'en', stage: 'first' });
// Send markup from the server, then enhance the matching section in the browser.
const instance = enhance(document.querySelector('[data-lp-pattern="first-answer"]'), {
  content, strings: strings.en, state: hostState
});
```

## Adapt it with your agent

> Rewrite the first-answer examples for my topic: [topic]. My learners are [audience]. Keep one prompt at both course placements and the content shape `{ prompt, checks: [{ id, label }] }`. Write observable self-assessment checks, not scores or praise. Keep ids stable and unique. Write English and Québec French together, using vous in French. Preserve the saved first answer, state, stage, accessibility and CSS token contracts. A model may only choose authored messages. Update examples and tests. Show me both languages for review.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
