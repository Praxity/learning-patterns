---
title: Instant course lookup
title_fr: Trouvez une réponse dans le cours
summary: Ask a question to find an authored answer or course section. Save unanswered questions in your browser.
section: course
ai: yes
offline: yes
learners: not tried
---
# Instant course lookup

Ask about Assertive at work. The decision model picks an authored answer or a section of the course. It writes no answers.

## When to use it

Use it across a course with a small, stable catalogue. The demo has eight FAQ entries and six course sections. Both shapes use the same renderer and enhancer, configured with `kind: 'faq' | 'sections'`.

For catalogues with more than about 30 entries, first narrow the candidates with embeddings. Check the chosen candidates against the learner's question before showing them.

## How it works

1. Type at least 10 characters, excluding spaces at the start and end. A pause checks changed text. A final question mark or Enter checks it immediately.
2. Read the closest authored answer, or follow a link to the section. Two close matches can appear together.
3. If there is no match, choose "Add to the question bank". Your question appears as "Waiting for an answer". You can remove it.

The wait is 2.5 times the median of the last nine inter-key gaps, between 400 and 900 ms. It defaults to 700 ms until three gaps are available. A silent "Looking…" line appears only after a request takes 300 ms. Results stay silent. A polite status region announces a changed match once, without moving focus.

Editing cancels the older request and discards stale results. Each instance has at most one active request. All instances share 30 automatic checks per page session. Enter still works after the cap. Reloading resets it. Proxy limits can stop checks sooner.

### Question bank and data

The shared data notice explains the decision service. The offline demo uses fixed matches and sends no text. Live lookup sends the question to the decision model through the proxy. The proxy stores no question text.

The question bank uses browser storage, separately for each language and instance. Three authored examples show two instructor replies and one reply from another learner. Those examples always remain. Only added learner questions are stored. The demo stores no bank entries on a server and sends no notifications. A failed save shows an error and keeps the previous bank. The bank holds up to 100 added questions.

A real course should send questions to its forum or instructor queue. Ask for consent before sending. For example, "Send this question to the course forum? Other learners and the instructor can read it." Decide who can answer and remove questions, and state how long they remain.

Without JavaScript, the full FAQ appears as native disclosures. The outline is a linked list. If lookup fails, the same list appears. The bank stays available when lookup fails.

## Evidence

FAQs can give people a direct route to common answers. They need real user questions and readable lists. The mock questions here illustrate the format; they did not come from learner research ([Nielsen Norman Group, 2014](https://www.nngroup.com/articles/faqs-deliver-value/)).

Help-seeking research distinguishes seeking help to understand from seeking an answer to finish quickly. Perceived emphasis on mastery was associated with more help-seeking in two studies of college classes ([Karabenick, 2004](https://doi.org/10.1037/0022-0663.96.3.569)). This supports treating questions as part of learning. It does not test instant lookup or this bank.

[Dhakal et al., CHI 2018](https://doi.org/10.1145/3173574.3174220) measured a mean inter-key interval of 239 ms, and over 480 ms for slow typists, in a transcription task. [Nielsen, 1993](https://www.nngroup.com/articles/response-times-3-important-limits/) identifies about one second as the limit for uninterrupted flow. These inform the adaptive wait. They do not establish the multiplier, sample window or cap. Network time adds to the wait.

This pattern has not been tested with learners. We have not measured whether immediate answers improve learning, help-seeking or course completion. Calibration uses authored questions, not learner questions. It does not establish accuracy in a real course.

In 44 authored live checks, all 32 single-answer or unanswered cases matched the expected result; only 1 of 12 paired questions returned both entries at these gates.

## Accessibility

Daily proxy caps show and announce the reason and midnight UTC reset once, keep focus in place and leave the fallback usable. Checks then stop until reload.

Meets the shared baseline in the root README.

- Results and the delayed progress line use `aria-live="off"`. One empty `role="status"` region announces a new result. Typing produces no announcements.
- Enter starts a check. Shift+Enter adds a line break. Composition input finishes before lookup. Links and bank buttons use native keyboard behaviour.
- Native FAQ disclosures and outline links work without JavaScript. Failed checks reveal the same content.
- No animation, colour-only feedback or focus movement on results. Adding a question focuses its text in the bank. Removing a question moves focus to the next removal button or the question field. If lookup fails while a lookup control has focus, focus moves to the first fallback disclosure or outline link.
- English and Québec French use the same controls. French uses vous.
- Browser checks cover axe, keyboard use, narrow reflow, text spacing, reduced motion and forced colours. Screen reader listening requires a separate human check.

## Content fields

| Field | Meaning |
| --- | --- |
| `kind` | `faq` or `sections`. |
| `prompt` | Visible heading and question field label. |
| `entries` | Eight FAQ entries or six sections, in the proxy's fixed ID order. |
| `entries[].id`, `title` | Fixed identity and authored question or section title. |
| `entries[].answer` | Short authored FAQ answer, for `faq` only. |
| `entries[].summary` | One-line section summary, for `sections` only. |
| `seeds` | Three authored bank examples, with unique `id`, `question`, `author` and `answer`. |
| `seeds[].author` | `instructor` for two examples; `learner` for one. |

All text is escaped. Unknown fields, wrong IDs and empty text fail validation. Keep the displayed catalogue consistent with the server-owned catalogue. To change topics, change both and calibrate the questions again. Section results link to the outline anchors that `render` creates.

## Logic

The proxy owns both catalogues and the Choice questions. The browser sends only the question to `20-faq` or `21-sections`. Both use Perplexity Decider v1.1. The best entry must reach 0.35 probability and the decision's confidence must reach 0.35. A second entry appears if its probability also reaches 0.35 and is within 0.20 of the best. A winning or tied `none` suppresses matches. These are selection probabilities, not evidence that an answer is correct.

| Export | Returns or value |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming an invalid field. |
| `lookup(content, answers)` | Zero, one or two authored entries, best first. Invalid Choice distributions throw. |
| `validateState(value)` | A clean `{ questions: string[] }`, or `null`. |
| `QUESTION_LIMIT`, `AUTO_CHECK_LIMIT`, `BANK_LIMIT` | 500 characters, 30 automatic checks, 100 added questions. |

`proxy/logic/20-faq.js` and `21-sections.js` own the catalogue IDs and match gates, shared by browser and proxy. `lib/typing-pause.js` exports `typingPause({ minChars = 10, questionMark = true } = {})`, with `key(time)`, `wait()` and `delay(text, checked, enter = false)`. Delay returns milliseconds or `null` when no check is due. [Feedback while you type](../live-feedback/README.md) shares this module, with a 20-character minimum and no question-mark shortcut.

`enhance(root, { content, strings, ask, state })` returns `{ destroy() }`. Repeated calls return the same instance. Optional `state: { read, write }` replaces browser storage. Use a separate state adapter for each instance. Invalid saved values are ignored. `destroy()` cancels work, removes listeners and restores server markup. The page allowance survives re-enhancement.

## Use it

Each block asks one Choice question with a 500-character cap. Each reserves at most 8,192 input tokens, including catalogue, escaped UTF-8 state and 1,024 framing tokens. Request and cost-guard tests cover these bounds and failed calls.

Copy this folder, `lib/` and both proxy decision modules, preserving relative imports. Include `lib/base.css` before `pattern.css`. For live checks, set up the [proxy](../../proxy/README.md). Keep server catalogues and gates with it. Check the provider's data terms before using its notice.

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

Browser storage uses the key `lp:course-lookup:<lang>:<question-field-id>`. Give each instance a stable, unique prefix so its bank survives reloads. Use a separate prefix for each course.

## Adapt it with your agent

> Replace the FAQ and outline for [course]. Keep one shared renderer and enhancer, server-owned Choice catalogues, authored answers and a browser-only bank. Write English and Québec French together, using vous. Calibrate the questions and gates before using live lookup with learners.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
