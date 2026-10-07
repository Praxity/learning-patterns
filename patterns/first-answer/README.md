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

Your journal keeps a dated entry from day one. At the end of the course, answer the same prompt and read your first entry below your new answer. Tick authored checks about what improved. The pattern does not grade either answer.

## When to use it

Use it near the start and end of a course when learners can revisit the same question. Keep the same prompt, check ids and host state for both placements. The demo asks what you would say to a colleague who keeps interrupting you.

## How it works

1. Write your first answer and select "Save my first answer". Blank answers show a linked error. Answers have a 2,000-character limit. Leading and trailing whitespace is trimmed when saving.
2. The saved entry appears as a dated card with a calendar icon and "It stays as you wrote it." It cannot change until you select "Start over".
3. At the end, write your answer now and select "Compare". The text box becomes read-only and Compare hides. Read your dated first answer below it, then tick the checks. A short summary counts your ticks.
4. Select "Try again" to rewrite. The comparison hides, Compare returns and focus moves to the text box. Your text stays. The saved answer now changes only when you select Compare again. Your first answer and ticks stay saved.
5. "Start over" clears the answers and ticks through the host's state adapter. It returns focus to the first text box. In an end-only placement, it returns focus to the current-answer text box.

`render` accepts `stage: 'first' | 'end' | 'both'`, default `'both'`. First and end placements can appear on different course pages. Each placement has a notebook scene header labelled "Your journal", with the prompt as its title. Steps use "Day one" and "End of the course" as headings. The demo uses both, with a dashed timeline, a course note and a skip button after saving. Skip opens the end section and focuses its heading. Restored answers open the end section directly. An end placement with no first answer explains the missing comparison and still accepts an answer now.

Without JavaScript, the prompt, a first-answer textarea and a saving note remain available in every placement.

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

| Function | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `validateAnswer(text)` | `{ ok: true, text }` with trimmed text, or `{ ok: false, error: 'empty' \| 'tooLong' }`. `MAX_LENGTH` is 2,000 characters. |
| `validateState(content, value)` | A clean `{ first, now, checks }`, or `null` for invalid saved state. |
| `emptyState(content)` | `{ first: null, now: null, checks }` with every check false. |
| `withFirstAnswer(content, state, text, savedAt)` | A copied state with the first answer saved. Throws if first or now is already saved. |
| `withAnswerNow(content, state, text, savedAt)` | A copied state replacing only now. First and checks keep their values. |
| `withChecks(content, state, checks)` | A copied state with known checks set to booleans. Throws when now is absent. |

Entries are `{ text, savedAt }`. Actions accept `null` state as empty state and throw on invalid inputs.

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

The optional host adapter has synchronous `read()` and `write(value)` methods. The host decides where state lives; this pattern never uses localStorage. Without an adapter, answers last for the mounted instance. For separate course pages, pass the same adapter in both placements and render the closing block with `stage: 'end'`.

State is `{ first: { text, savedAt } | null, now: { text, savedAt } | null, checks: { [id]: boolean } }`. Dates are full ISO timestamps. `Intl.DateTimeFormat` displays them using the block's `lang`. The pattern writes UTC timestamps. Reset writes `emptyState(content)`.

State must contain a boolean for every known check. Saved answers must be trimmed, nonempty and within the limit. Dates must be valid ISO timestamps. A malformed or unreadable host value shows a visible warning. It blocks writes until you deliberately reset. Failed writes preserve the previous record and show a visible error. Restoring valid state makes no announcement. A saved now answer restores the locked comparison, even if you were rewriting when you left.

`enhance` preserves server elements and returns the same instance on repeated calls. `destroy()` removes listeners and restores the no-JavaScript baseline. Two mounted placements sharing an adapter reread it before each action, so a stale first placement cannot overwrite an answer saved elsewhere. The host remains responsible for concurrent writes across tabs or devices.

## Accessibility

Browser tests check axe WCAG 2.0, 2.1 and 2.2 AA at each stage in Chromium, WebKit and Firefox. They cover keyboard focus, linked errors and one status change per message. They also check French language and dates, two instances, saved state and the no-JavaScript baseline. Layout checks use 320 CSS pixels with text spacing. Chromium checks forced colours.

Each placement uses one activity box. The journal fields have extra padding and 1.65 line height. Dated cards use an inset rule; the end section uses space and a top rule. Saving hides the editor and save button, moving focus to Skip in the demo or to the saved entry in a first-only placement. Compare hides after submission without an explicit focus move. Try again focuses the current-answer text box without an announcement. Skip and reset move focus as described above. Notebook, calendar and history icons are decorative and paired with visible text. Try again and Start over also have decorative Tabler icons. There is no animation or time limit.

Screen reader passes: not yet

## Evidence

The supplied research files contain no direct evidence that returning a learner's first answer at the end of a course improves learning.

The related self-explanation research supports asking learners to explain their thinking. This example asks for a reply rather than an explanation of why that reply works, so that evidence does not establish an effect here. [Bisra et al., 2018](https://doi.org/10.1007/s10648-018-9434-x).

The checklist asks learners to assess their own answer against authored criteria. The supplied research proposes a self-check group when testing automated feedback. It also reports a tutor study with no overall advantage for writing explanations over selecting them. A self-assessment group could help compare outcomes in a trial. That is a research design choice, not evidence that these checkboxes improve performance. [Aleven et al., 2004](https://link.springer.com/chapter/10.1007/978-3-540-30139-4_42).

Logic unit tested. Not tried with learners.

## Adapt it with your agent

> Rewrite the first-answer examples for my topic: [topic]. My learners are [audience]. Keep one prompt at both course placements and the content shape `{ prompt, checks: [{ id, label }] }`. Write observable self-assessment checks, not scores or praise. Keep ids stable and unique. Write English and Québec French together, using vous in French. Preserve the saved first answer, state, stage, accessibility and CSS token contracts. A model may only choose authored messages. Update examples and tests. Show me both languages for review.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
