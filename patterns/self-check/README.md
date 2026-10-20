---
title: Check your own answer
title_fr: Vérifiez votre réponse
summary: Write an answer, tick the parts it includes, then compare with a model and hints.
section: question
ai: no
offline: yes
learners: not tried
---
# Check your own answer

Write an answer, tick the parts it includes, then compare with a model. Hints help you add missing parts.

## When to use it

Use it when learners can check their answers against a short list of clear parts. It works offline and can help you compare self-checking with automated feedback. The pattern does not judge the learner's text.

## How it works

1. Write your answer and select "Check my answer". Email tasks also show a recipient and subject.
2. Tick each part your answer includes. A count updates as you tick.
3. Select "Show feedback" to compare your answer with the model. Numbered marks connect the model to the checklist.
4. Read "Included" or "To add" beside each part, with a hint for each part to add.
5. Edit your answer or ticks and submit again. Select "Start over" to clear them.

## Evidence

Adults checked their recall against a list of key ideas. They judged their learning more accurately and did better on a later test ([Rawson, O'Neil and Dunlosky, 2011](https://doi.org/10.1037/a0024749)). Seeing the correct answer made middle school students less sure of their wrong answers ([Lipko et al., 2009](https://doi.org/10.1037/a0017599)).

Self-assessment against clear criteria helps learners improve drafts. It is not meant for grading ([Andrade and Valtcheva, 2009](https://doi.org/10.1080/00405840802577544)). A meta-analysis of 175 studies found that it improved academic performance ([Yan et al., 2022](https://doi.org/10.1016/j.edurev.2022.100484)).

Explanations helped more than right-or-wrong feedback in computer-based learning ([Van der Kleij, Feskens and Eggen, 2015](https://doi.org/10.3102/0034654314564881)), so each missing part has a hint. The model appears after an attempt. Easy access to answers can raise practice scores without lasting learning ([Bastani et al., 2025](https://doi.org/10.1073/pnas.2422633122)).

This sequence has not been tested as a whole. Ticks record only the learner's own judgment.

## Accessibility

Follows the shared baseline in the root README.

- An empty answer gets an error linked to its text box. Checking moves focus to the first checklist item.
- Native checkbox labels supply their names and support clicking. Firefox may also announce "clickable" on these labels.
- Numbered marks connect the model to the checklist. Each part has a visible status and each missed part has a hint.
- Feedback announces how many parts the learner ticked. Start over focuses the answer field.

## Content fields

Content is plain text. Rendering escapes HTML characters.

| Field | Meaning |
| --- | --- |
| `task` | The writing task. |
| `context` | Optional email context. Omit it to hide recipient and subject fields. |
| `context.to` | Email recipient, required with context. |
| `context.initials` | Decorative recipient initials, required with context. |
| `context.subject` | Email subject, required with context. |
| `context.placeholder` | Optional placeholder text. Allows line breaks; never saved as an answer. |
| `parts` | At least one part, in display order. |
| `parts[].id` | Unique id using letters, digits, underscores or hyphens. |
| `parts[].label` | The checkbox label and the part's name in feedback. |
| `parts[].missed` | The hint when the learner leaves this part unticked. |
| `parts[].evidence` | Exact text that occurs once in the model, or `null` for a whole-answer part. |
| `model` | The model answer. |

Required strings must be nonempty. Context requires `to`, `initials` and `subject`. It cannot be `null`, `{}` or incomplete. The optional placeholder must be a string; it may be empty. `validateContent` rejects unknown fields and duplicate ids. It checks unique ids and evidence matching, recorded as `x-uniqueBy` and `x-occursOnceIn` in the schema. Ordinary JSON Schema tools need these checks from `validateContent`.

## Logic

Authored text is capped at 120 characters for titles and labels, 400 for questions and prompts, 300 for options, and 1,500 for answers, explanations and passage text. The schema gives each field's limit; `validateContent` enforces it.

`logic.js` has no DOM code. Hosts such as Praxity Studio can build their own interface.

| Function | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `feedback(content, ticked)` | `{ count, total, items }`. Each item is `{ id, included, label, hint }`; `hint` is `null` for an included part and the authored `missed` text otherwise. |
| `annotate(model, parts, includedIds)` | `{ text, partIndex, included }[]` in model order. Unmarked text has `partIndex: null` and `included: false`. Part indexes refer to author order. Pass validated content and an array of included ids. If evidence overlaps, the first span in model order owns the text. Whole-answer parts have no mark. |
| `validateState(content, value)` | A clean `{ answer, ticked, shown }`, or `null` when `value` isn't valid saved state. |

Without JavaScript, open "Check for these parts." to read all hints and the model answer.

Pass `state: { read, write }` to save `{ answer, ticked, shown }`. Invalid saved values are ignored. A nonempty draft opens the checklist. Saved results rebuild from ticks without an announcement. Editing keeps the old result visible until you submit again. `instance.destroy()` removes listeners and restores the native fallback.

## Use it

Copy `patterns/self-check/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/self-check/pattern.css`. Use a unique id prefix per instance. The example combines both calls; render HTML on the server before calling `enhance` in the browser.

```js
import { render } from './patterns/self-check/render.js';
import { enhance } from './patterns/self-check/enhance.js';
import { strings } from './patterns/self-check/strings.js';
const content = {
  task: 'Explain why you need another day.',
  parts: [{ id: 'reason', label: 'Reason', missed: 'Explain the delay.', evidence: 'The data arrived late.' }],
  model: 'The data arrived late. Could I have until Tuesday?'
};
document.querySelector('main').innerHTML = render(content, strings.en, { id: 'practice', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

For an email task, add `context: { to: 'Sam', initials: 'S', subject: 'Report' }`. Use `context.placeholder` for a prompt in the empty field. Both example files show email tasks.

## Adapt it with your agent

Copy this prompt and fill in your topic and audience.

> Rewrite the self-check examples for [topic] and [audience]. Ask for an answer learners could use at work. Keep `{ task, parts: [{ id, label, missed, evidence }], model }`. Email tasks may add `context: { to, initials, subject }` and an optional `placeholder`. Use unique part ids. Evidence must occur exactly once in the model, or be null for a whole-answer part. Write clear part labels and specific hints. Keep English and Québec French together; use vous in French. A model may only choose authored messages. Follow the pattern contract, including state, accessibility and CSS tokens. Update examples and tests. Show both languages for review.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
