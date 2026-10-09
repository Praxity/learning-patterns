---
title: Highlight the key passage
title_fr: Mettre en évidence le passage clé
summary: Mark key ideas or text that answers a question, then compare with the author's choices.
section: reading
ai: no
offline: yes
learners: not tried
---
# Highlight the key passage

Mark key ideas or text that answers a question. Then compare your marks with the author's choices in the passage.

## When to use it

Use it to find key ideas or evidence for a question. Keep passages short and split them into meaningful pieces. Learners select whole pieces, so use another pattern for selecting individual words. Searching visible text does not test recall.

## How it works

1. Read the passage and the question, if there is one.
2. Mark key ideas or text that answers the question. The counter shows your marks and the limit. Select marked text again to unmark it.
3. Select "Check". Read feedback beside your marks and any text you missed.
4. Read how many you found. Select "Start over" to try again.

## Evidence

Highlighting alone is a weak study strategy. A major review rated it low utility ([Dunlosky et al., 2013](https://doi.org/10.1177/1529100612453266)). A meta-analysis of 36 articles found that marking text yourself improved memory but not comprehension. Text highlighted by an instructor improved both ([Ponce, Mayer and Méndez, 2022](https://doi.org/10.1007/s10648-021-09654-1)). Students often mark too much or choose the wrong text. Short training helps them choose what to mark ([Miyatsu, Nguyen and McDaniel, 2018](https://doi.org/10.1177/1745691617710510); [Leutner, Leopold and den Elzen-Rump, 2007](https://doi.org/10.1027/0044-3409.215.3.174)).

This pattern asks learners to find key ideas or answer a question, then compare with the author's choices. Comparing answers with a correct standard helped students judge their learning more accurately in several experiments ([Lipko et al., 2009](https://doi.org/10.1037/a0017599); [Rawson, O'Neil and Dunlosky, 2011](https://doi.org/10.1037/a0024749)). Finding evidence in visible text practises reading, not recall. This combination has not been tested.

## Accessibility

Follows the shared baseline in the root README.

- Each chunk is an inline span with a button role and its own tab stop. Tab and Shift+Tab follow passage order. Space or Enter toggles a mark, including in screen-reader browse mode.
- Arrow shortcuts work when the screen reader passes them to the page. Left or Up moves back; Right or Down moves forward. They wrap at the ends. Home and End jump to the first and last chunks. Each chunk exposes its pressed state and links to keyboard instructions.
- Checked chunks stay readable and navigable, with feedback beside correct marks, missed targets and other selections.
- At the limit, selecting another chunk shows and announces a message below the passage. Removing a mark clears it.
- Found targets have green highlights and solid underlines; missed targets have dashed underlines and no highlight. Other selections stay yellow, with readable notes in neutral pills. Icons and words identify outcomes, including in forced colours.
- Check announces the target count. If Check has focus when it hides, focus moves to Start over. Reset focuses the first chunk silently.
- Known screen reader behaviour: when NVDA reads line by line and a chunk wraps onto the next line, it says "toggle button, not pressed" again at the start of that line. NVDA does the same for any link that wraps. The chunks stay inline so the passage reads as paragraphs.

## Content fields

Authors write plain text. Rendering escapes HTML characters.

| Field | Meaning |
| --- | --- |
| `mode` | `key` or `evidence`. Both use `key: true` for targets. |
| `title` | Article title. |
| `question` | Required in evidence mode; optional in key mode. Appears above the passage. |
| `maxMarks` | Optional positive integer. Defaults to the target count in evidence mode, or that count plus one in key mode. |
| `paragraphs` | Nonempty array of paragraphs, each a nonempty array of chunks. |
| `paragraphs[][].id` | Unique across the passage. Letters, digits, underscores and hyphens only. |
| `paragraphs[][].text` | Text without leading or trailing whitespace. One space joins adjacent chunks. |
| `paragraphs[][].key` | Optional boolean. `true` marks a target. At least one target is required. |
| `paragraphs[][].note` | Optional explanation for a selected non-target. Follows "Not a key idea" in key mode; replaces default wrong-selection feedback in evidence mode. Also appears in the native answer. |

Text fields must contain non-whitespace text. Unknown fields and duplicate ids are rejected. The schema describes the shape, question requirement and required target. Its `x-uniqueChunkIds` annotation needs the global id check in `validateContent`.

`examples/en.json` and `fr.json` use evidence mode, as does the demo. `en-key.json` and `fr-key.json` use key mode with the same passage.

## Logic

`logic.js`, `strings.js` and `content.schema.json` have no DOM dependencies. Praxity Studio can use them with its own interface.

| Function | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `markLimit(content)` | Maximum marked chunks, using `maxMarks` or the mode default. Requires validated content. |
| `check(content, markedIds)` | `{ found, total, marked, wrong, items }`. Counts selected targets, all targets, selected chunks and selected non-targets. Duplicate marks count once. Items follow passage order and contain `{ id, text, marked, outcome, note }`. `outcome` is `correct`, `missed`, `wrong` or `unmarked`; `note` is authored text or `null`. Unknown ids, invalid arrays and selections over the limit throw. |
| `validateState(content, value)` | Copied `{ marked: string[], shown: boolean }` or `null`. Rejects unknown ids, duplicate or excess marks, extra fields and invalid shapes. Requires validated content. |

Without JavaScript, the passage is plain text. Native "Answer" details lists targets and all authored notes.

Check locks marks until reset. Mark counts update silently. Use a unique id prefix per instance.

Optional `state: { read(), write(value) }` stores `{ marked, shown }`. Valid results restore silently; invalid values are ignored. Adapter errors propagate to the host.

Enhancement adds button roles, tab stops and pressed states to the existing spans. It preserves paragraphs and feedback nodes. Repeated enhancement returns the same instance. `instance.destroy()` removes listeners and interaction attributes and restores the plain passage and native answer. The root can then be enhanced again.

## Use it

Copy `patterns/highlight/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/highlight/pattern.css`. Render on the server, then enhance in the browser.

```js
import { render } from './patterns/highlight/render.js';
import { enhance } from './patterns/highlight/enhance.js';
import { strings } from './patterns/highlight/strings.js';
const content = {
  mode: 'evidence', title: 'Taking a break', question: 'Why say you will return?',
  paragraphs: [[
    { id: 'pause', text: 'You need a moment to think.' },
    { id: 'return', text: 'They know you will return.', key: true }
  ]]
};
const markup = render(content, strings.en, { id: 'practice', lang: 'en' });
// Send markup to the browser, then:
const instance = enhance(document.querySelector('[data-lp-pattern="highlight"]'), {
  content, strings: strings.en
});
```

## Adapt it with your agent

> Adapt the highlight examples to [topic] for [audience]. Keep `{ mode, title, question?, maxMarks?, paragraphs: [[{ id, text, key?, note? }]] }`. Choose key ideas or evidence for one focused question. Split the passage into meaningful pieces. Keep ids unique and at least one target. Explain selected non-targets in notes. Write English and Québec French together, using vous. Preserve the plain passage, native answer, keyboard controls, local feedback, state, escaping and CSS tokens. Do not claim that searching visible text tests recall. Update examples and tests. Show both languages for review.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
