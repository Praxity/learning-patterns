---
title: Instant course lookup
title_fr: Trouvez une réponse dans le cours
summary: Ask a question to find an authored answer or course section. Save unanswered questions in your tab.
section: course
ai: yes
offline: yes
learners: not tried
---
# Instant course lookup

Ask about Assertive at work. The decision model picks an authored answer or a section of the course. It writes no answers.

## Use it when

- Use it across a course with a small, stable catalogue. The demo has eight FAQ entries and six course sections.

## Avoid it when

- When you need to search a large or changing catalogue, use a course search tool. This example relies on a small, fixed catalogue.
- When learners need to recall an answer before seeing it, use [Questions inside the reading](../review-prompts/README.md).

## Before you use it

It needs a server running a model. Without JavaScript, or when lookup fails, the page shows that lookup's full FAQ or outline.

Write the answers or section summaries. The server keeps its own copy, so update and test it when the course changes. Added questions stay in the learner's tab and reach no one. Decide who answers them.

## How it works

1. The learner types a question of at least 10 characters. Lookup runs when they pause typing, or straight away on Enter or a final question mark.
2. An FAQ lookup shows the closest authored answer. A section lookup links the closest course section. When two match about equally well, both appear.
3. When nothing matches, the learner can add the question to the question bank, where it shows as "Waiting for an answer".

Lookup sends only the question to the decision model, and the Praxity proxy stores none of it. The offline demo uses fixed matches and sends nothing. Automatic lookup stops after 30 checks per page load, shared by every lookup on the page. After that, Enter still looks up. A daily server limit stops lookup and shows the full list.

Without JavaScript, or when lookup fails, the page shows that lookup's full FAQ or outline. The question bank still works when lookup fails.

### Question bank

The demo keeps up to 100 added questions in the browser tab until it's closed. It stores nothing on a server and notifies no one. Three sample entries show answered questions: two answered by an instructor, one by another learner.

In a real course, send questions to the course forum or the instructor's queue, and ask the learner first. For example: "Send this question to the course forum? Other learners and the instructor can read it." Decide who answers and removes questions, and say how long they stay.

## Evidence

FAQs can give people a direct route to common answers. They need real user questions and readable lists. The mock questions here illustrate the format; they did not come from learner research ([Nielsen Norman Group, 2014](https://www.nngroup.com/articles/faqs-deliver-value/)).

Help-seeking research distinguishes seeking help to understand from seeking an answer to finish quickly. Perceived emphasis on mastery was associated with more help-seeking in two studies of college classes ([Karabenick, 2004](https://doi.org/10.1037/0022-0663.96.3.569)). This supports treating questions as part of learning. It does not test instant lookup or this bank.

[Dhakal et al., CHI 2018](https://doi.org/10.1145/3173574.3174220) measured a mean inter-key interval of 239 ms, and over 480 ms for slow typists, in a transcription task. [Nielsen, 1993](https://www.nngroup.com/articles/response-times-3-important-limits/) identifies about one second as the limit for uninterrupted flow. These inform the adaptive wait. They do not establish the multiplier, sample window or cap. Network time adds to the wait.

This pattern has not been tested with learners. We have not measured whether immediate answers improve learning, help-seeking or course completion. Calibration uses authored questions, not learner questions. It does not establish accuracy in a real course.

In 44 authored live checks, all 32 single-answer or unanswered cases matched the expected result; only 1 of 12 paired questions returned both entries at these gates.

## Accessibility

The field keeps the full question. After a typing pause or Enter, an oversized question shows a linked length error and is not sent for lookup.

Daily proxy caps show and announce the reason and midnight UTC reset once, keep focus in place and leave the fallback usable. Checks then stop until reload.

Meets the shared baseline in the root README.

- Results and the delayed progress line use `aria-live="off"`. One empty `role="status"` region announces a new result. Typing produces no announcements.
- Enter starts a check. Shift+Enter adds a line break. Composition input finishes before lookup. Links and bank buttons use native keyboard behaviour.
- Native FAQ disclosures and outline links work without JavaScript. Failed checks reveal the same content.
- Activating a section result reveals the outline and focuses that entry's link after layout, while keeping the URL fragment.
- No animation, colour-only feedback or focus movement on results. Adding a question focuses its text in the bank. Removing a question moves focus to the next removal button or the question field. If lookup fails while a lookup control has focus, focus moves to the message "Lookup is unavailable. Browse the list below." before the controls hide. Focus reads the message, so the status region stays empty, and the next Tab reaches the first fallback disclosure or outline link. If focus is elsewhere, the status region announces the message once.
- English and Québec French use the same controls.
- Browser checks cover axe, keyboard use, narrow reflow, text spacing, reduced motion and forced colours. Screen reader listening requires a separate human check.

## Content fields

| Field | Meaning |
| --- | --- |
| `kind` | `faq` or `sections`. |
| `prompt` | Visible heading and question field label, up to 400 characters. |
| `course` | Optional course name, up to 120 characters; required when the prompt contains `{course}`. Every occurrence renders in italics. |
| `entries` | Eight FAQ entries or six sections, in the proxy's fixed ID order. |
| `entries[].id`, `title` | Fixed identity and authored question or section title. |
| `entries[].answer` | Short authored FAQ answer, for `faq` only. |
| `entries[].summary` | One-line section summary, for `sections` only. |
| `seeds` | Three authored bank examples, with unique `id`, `question`, `author` and `answer`. |
| `seeds[].author` | `instructor` for two examples; `learner` for one. |

All text is escaped. Unknown fields, wrong IDs and empty text fail validation. Keep the displayed catalogue consistent with the server-owned catalogue. To change topics, change both and calibrate the questions again. Section results link to the outline anchors that `render` creates.

## Logic

Authored text is capped at 120 characters for titles and labels, 400 for questions and prompts, 300 for options, and 1,500 for answers, explanations and passage text. The schema gives each field's limit; `validateContent` enforces it.


The proxy owns both catalogues and the Choice questions. The browser sends only the question to `20-faq` or `21-sections`. Both use Perplexity Decider v1.1. The best entry must reach 0.35 probability and the decision's confidence must reach 0.35. A second entry appears if its probability also reaches 0.35 and is within 0.20 of the best. A winning or tied `none` suppresses matches. These are selection probabilities, not evidence that an answer is correct.

| Export | Returns or value |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming an invalid field. |
| `lookup(content, answers)` | Zero, one or two authored entries, best first. Invalid Choice distributions throw. |
| `validateState(value)` | A clean `{ questions: string[] }`, or `null`. |
| `QUESTION_LIMIT`, `AUTO_CHECK_LIMIT`, `BANK_LIMIT` | 500 characters, 30 automatic checks, 100 added questions. |

`proxy/logic/20-faq.js` and `21-sections.js` own the catalogue IDs and match gates, shared by browser and proxy. `lib/typing-pause.js` exports `typingPause({ minChars = 10, questionMark = true } = {})`, with `key(time)`, `wait()` and `delay(text, checked, enter = false)`. Delay returns milliseconds or `null` when no check is due. [Feedback while you type](../live-feedback/README.md) shares this module, with a 20-character minimum and no question-mark shortcut.

`enhance(root, { content, strings, ask, state })` returns `{ destroy() }`. Repeated calls return the same instance. Optional `state: { read, write }` replaces session storage. Use a separate state adapter for each instance. Invalid saved values are ignored. `destroy()` cancels work, removes listeners and restores server markup. The page allowance survives re-enhancement.

## Use it

Both shapes use the same renderer and enhancer, configured with `kind: 'faq' | 'sections'`. For catalogues with more than about 30 entries, first narrow the candidates with embeddings. Check the chosen candidates against the learner's question before showing them.

Each block asks one Choice question with a 500-character cap. Each reserves at most 8,192 input tokens, including catalogue, escaped UTF-8 state and 1,024 framing tokens. Request and cost-guard tests cover these bounds and failed calls.

Copy this folder, `lib/` and both proxy decision modules, preserving relative imports. Include `lib/base.css` before `pattern.css`. For live checks, set up the [proxy](../../proxy/README.md). Keep server catalogues and gates with it. Check the provider's data terms, and name the provider in the course introduction or terms of participation.

```js
import { render } from './patterns/course-lookup/render.js';
import { enhance } from './patterns/course-lookup/enhance.js';
import { strings } from './patterns/course-lookup/strings.js';
import { createAsk } from './lib/ask.js';

const markup = render(content, strings.en, { id: 'course-faq', lang: 'en' });
// Insert markup into your page, then enhance its root.
enhance(document.querySelector('[data-lp-pattern="course-lookup"]'), {
  content, strings: strings.en, ask: createAsk()
});
```

The default `browserState` adapter uses sessionStorage with the key `lp:course-lookup:<lang>:<question-field-id>`. Give each instance a stable, unique prefix so its bank survives reloads. Use a separate prefix for each course.

## Adapt it with your agent

> Replace the FAQ and outline for [course]. Keep one shared renderer and enhancer, server-owned Choice catalogues, authored answers and a browser-only bank. Write English and Québec French together, using vous. Calibrate the questions and gates before using live lookup with learners.

## Related patterns

- [Questions inside the reading](../review-prompts/README.md)
- [Feedback while you type](../live-feedback/README.md)

## Help improve this pattern

Tried it with learners? [Tell us what happened](https://github.com/Praxity/learning-patterns/issues/new?template=pattern-feedback.yml&pattern=Instant%20course%20lookup). You can also [suggest a change to this page](https://github.com/Praxity/learning-patterns/edit/main/patterns/course-lookup/README.md).

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
