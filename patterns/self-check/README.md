# Self-check

Write an answer, check which parts you included, then compare it with authored feedback and a model answer.

## When to use it

Use it when learners can judge their own answers against a short list of clear parts. It also works as an offline fallback or a comparison condition when testing automated feedback. The pattern does not judge the learner's text.

## How it works

1. Write an answer and select "Check my answer". An empty answer gets an error next to the text box.
2. Tick the parts your answer includes.
3. Select "Show feedback". Read the count, the message for each part and the model answer. You can edit your answer and ticks, then submit again.
4. Select "Start again" to clear the answer, ticks and result.

Without JavaScript, open "Check your own answer" to read every part's hint and the model answer.

## Content fields

All content fields are plain text. HTML characters are escaped.

| Field | Meaning |
| --- | --- |
| `task` | The writing task. |
| `parts` | At least one part, in display order. |
| `parts[].id` | A unique identity using letters, digits, underscores or hyphens. |
| `parts[].label` | The checkbox label. |
| `parts[].met` | The message when the learner ticks this part. |
| `parts[].missed` | The hint when the learner leaves this part unticked. |
| `model` | The model answer. |

Strings must be nonempty. `validateContent` rejects unknown fields and duplicate part identities. The schema's `x-uniqueBy` annotation describes identity uniqueness. Ordinary JSON Schema tools need this extra check from `validateContent`.

## Use it

Copy `patterns/self-check/` and `lib/`, preserving their relative paths. Include `patterns/self-check/pattern.css` in your page. Give each instance its own id prefix. This ten-line example shows the server and browser calls together. In a server-rendered project, send the rendered HTML to the browser before calling `enhance`.

```js
import { render } from './patterns/self-check/render.js';
import { enhance } from './patterns/self-check/enhance.js';
import { strings } from './patterns/self-check/strings.js';
const content = {
  task: 'Explain why you need another day.',
  parts: [{ id: 'reason', label: 'Reason', met: 'Reason included.', missed: 'Explain the delay.' }],
  model: 'The data arrived late. Could I have until Tuesday?'
};
document.querySelector('main').innerHTML = render(content, strings.en, { id: 'practice', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

Pass optional `state: { read, write }` to store `{ answer, ticked, shown }` in your host. Invalid saved values are ignored. A nonempty saved draft opens the checklist. A shown result is rebuilt from the saved ticks without an announcement. Editing preserves the visible result until the next submission. Call `instance.destroy()` to remove listeners and restore the native fallback.

## Accessibility

Automated tests check axe's WCAG 2.0, 2.1 and 2.2 AA rules at load, checklist and feedback stages in Chromium, WebKit and Firefox. Keyboard tests check errors, focus, reset and one status text change per submission. Tests also cover French language, no JavaScript, two instances, saved state, 320 CSS pixels with text spacing, and Chromium forced colours. Results use visible words and decorative icons. There is no animation or time limit.

Screen reader passes: not yet

## Evidence

Feedback explains each part with authored messages. In a meta-analysis of computer-based learning, explanatory feedback had larger effects than right-or-wrong feedback. That supports useful hints rather than a count alone. It does not establish an effect for this pattern. [Van der Kleij, Feskens and Eggen, 2015](https://doi.org/10.3102/0034654314564881).

Self-explanation prompts can help learning. A tutor study found no overall advantage for writing explanations over choosing them from a menu. Use a self-check comparison when evaluating automated feedback, since the prompt and checklist may do some of the work. [Bisra et al., 2018](https://doi.org/10.1007/s10648-018-9434-x), [Aleven et al., 2004](https://link.springer.com/chapter/10.1007/978-3-540-30139-4_42).

Access to answers can improve practice without improving later independent performance. A mathematics study found that safeguards using teacher-designed hints reduced this risk. This pattern shows its model after an attempt and a self-check. It does not require a revision, and its no-JavaScript fallback makes the model available in native details. Those are weaker guards. [Bastani et al., 2025](https://doi.org/10.1073/pnas.2422633122).

The offline fallback keeps the checklist and model available when scripts or network services are unavailable. Its usefulness for learners still needs testing.

Logic unit tested. Not tried with learners.

## Adapt it with your agent

Copy this prompt and fill in your topic and audience.

> Rewrite the self-check example content for my topic: [topic]. My learners are [audience]. Ask them to write an answer they could use in their work. Keep the pattern contract and plain-text content shape `{ task, parts: [{ id, label, met, missed }], model }`. Keep unique part ids. Write every learner-facing message, including specific hints for unticked parts. Keep English and Québec French together and address French learners with vous. A model may only choose authored messages. Keep the render, enhancement, state, accessibility and CSS token contracts. Update the examples and tests. Show me both languages for review.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
