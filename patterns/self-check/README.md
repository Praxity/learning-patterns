---
title: Check your own answer
title_fr: Vérifiez votre réponse
summary: Compose a message, check its parts, then compare it beside an annotated model with hints for parts to add.
section: question
ai: no
offline: yes
learners: not tried
---
# Check your own answer

You write an answer, check which parts it includes, then compare it with an annotated model and hints.

## When to use it

Use it when learners can judge their own answers against a short list of clear parts. It also works as an offline fallback or a comparison when testing automated feedback. Do not use it when you need the pattern to judge the learner's text.

## How it works

1. You read the task, recipient and subject, then write your message and select "Check my answer".
2. You tick the parts your message includes and see how many you have checked.
3. You select "Show feedback" and compare your message with the model. The numbered marks match the parts you checked.
4. You read "Included" or "To add" for each part, with a hint for each part to add.
5. You can edit your message and ticks, then submit again, or select "Start over" to clear them.

## Evidence

Authored feedback explains each part. A meta-analysis of computer-based learning found larger effects for explanatory feedback than for right-or-wrong feedback. That supports giving hints alongside the count. It does not establish an effect for this pattern. [Van der Kleij, Feskens and Eggen, 2015](https://doi.org/10.3102/0034654314564881).

Self-explanation prompts can help learning. A tutor study found no overall advantage for writing explanations over choosing them from a menu. Use a self-check comparison when evaluating automated feedback, since the prompt and checklist may do some of the work. [Bisra et al., 2018](https://doi.org/10.1007/s10648-018-9434-x), [Aleven et al., 2004](https://link.springer.com/chapter/10.1007/978-3-540-30139-4_42).

Access to answers can improve practice without improving later independent performance. A mathematics study found that safeguards using teacher-designed hints reduced this risk. This pattern shows its model after an attempt and a self-check. It does not require a revision, and its no-JavaScript fallback makes the model available in native details. Those are weaker guards. [Bastani et al., 2025](https://doi.org/10.1073/pnas.2422633122).

The offline fallback keeps the checklist and model available without scripts or network services. Its usefulness for learners still needs testing.

Logic unit tested. Not tried with learners.

## Accessibility

Meets the shared baseline in the root README.

- An empty answer gets an error linked to the text box. Checking an answer moves focus to the first checklist item.
- Numbered marks connect the model to the parts list. Each part has a visible status, and each missed part has its own hint.
- Submitting feedback announces the count of included parts. Start over returns focus to the answer field.

## Content fields

All content fields are plain text. HTML characters are escaped.

| Field | Meaning |
| --- | --- |
| `task` | The writing task. |
| `context.to` | The message recipient. |
| `context.initials` | Decorative recipient initials. |
| `context.subject` | The message subject. |
| `context.placeholder` | Optional text shown in the empty message field. It may include line breaks and is never saved as an answer. |
| `parts` | At least one part, in display order. |
| `parts[].id` | A unique identity using letters, digits, underscores or hyphens. |
| `parts[].label` | The checkbox label and the part's name in feedback. |
| `parts[].missed` | The hint when the learner leaves this part unticked. |
| `parts[].evidence` | Exact text that occurs once in the model, or `null` for a whole-message part. |
| `model` | The model answer. |

Required strings must be nonempty. The optional placeholder must be a string when present; an empty string is allowed. `validateContent` rejects unknown fields and duplicate part identities. The schema's `x-uniqueBy` and `x-occursOnceIn` annotations describe identity uniqueness and evidence matching. Ordinary JSON Schema tools need these cross-field checks from `validateContent`.

## Logic

`logic.js` has no DOM code, so another host can build its own interface on it. Praxity Studio does.

| Function | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `feedback(content, ticked)` | `{ count, total, items }`. Each item is `{ id, included, label, hint }`; `hint` is `null` for an included part and the authored `missed` text otherwise. |
| `annotate(model, parts, includedIds)` | `{ text, partIndex, included }[]` in model order. Unmarked text has `partIndex: null` and `included: false`. Part indexes refer to author order. Pass validated content and an array of included ids. If evidence overlaps, the first span in model order owns the text. Whole-message parts have no mark. |
| `validateState(content, value)` | A clean `{ answer, ticked, shown }`, or `null` when `value` isn't valid saved state. |

Without JavaScript, open "Check your message for these parts." to read every part's hint and the model answer.

Pass optional `state: { read, write }` to store `{ answer, ticked, shown }` in your host. Invalid saved values are ignored. A nonempty saved draft opens the checklist. A shown result is rebuilt from the saved ticks without an announcement. Editing preserves the visible result until the next submission. Call `instance.destroy()` to remove listeners and restore the native fallback.

## Use it

Copy `patterns/self-check/` and `lib/`, preserving their relative paths. Link `lib/base.css`, then `patterns/self-check/pattern.css`. Give each instance its own id prefix. This example shows the server and browser calls together. In a server-rendered project, send the rendered HTML to the browser before calling `enhance`.

```js
import { render } from './patterns/self-check/render.js';
import { enhance } from './patterns/self-check/enhance.js';
import { strings } from './patterns/self-check/strings.js';
const content = {
  task: 'Explain why you need another day.',
  context: { to: 'Sam', initials: 'S', subject: 'Report', placeholder: 'Hi Sam,\n\nType your message here…' },
  parts: [{ id: 'reason', label: 'Reason', missed: 'Explain the delay.', evidence: 'The data arrived late.' }],
  model: 'The data arrived late. Could I have until Tuesday?'
};
document.querySelector('main').innerHTML = render(content, strings.en, { id: 'practice', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

## Adapt it with your agent

Copy this prompt and fill in your topic and audience.

> Rewrite the self-check example content for my topic: [topic]. My learners are [audience]. Ask them to write an answer they could use in their work. Keep the pattern contract and plain-text content shape `{ task, context: { to, initials, subject }, parts: [{ id, label, missed, evidence }], model }`. Keep unique part ids. Evidence must occur exactly once in the model, or be null for a part that spans the whole message. Write clear labels that name each part in the checklist and feedback. Write specific hints for unticked parts. Keep English and Québec French together and address French learners with vous. A model may only choose authored messages. Keep the render, enhancement, state, accessibility and CSS token contracts. Update the examples and tests. Show me both languages for review.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
