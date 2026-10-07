---
title: Highlight the passage
title_fr: Surlignez le passage
summary: Mark key ideas or evidence for a question, then compare your marks with the author's targets in the passage.
section: reading
ai: no
offline: yes
learners: not tried
---
# Highlight the passage

Read a short passage, mark chunks of text, and check them against the author's targets. The article stays in place: checks identify matched targets, dashed underlines identify missed targets, and neutral feedback explains selected text that is not a target.

## When to use it

Use key mode to compare the ideas a learner notices with an author's selection. Use evidence mode when the learner needs to find a passage that answers a specific question. Keep passages short and split them at meaningful boundaries. Learners choose whole chunks, not individual words.

## How it works

1. Read the article. In key mode, highlight the key ideas. In evidence mode, read the question and highlight the text that answers it.
2. Click or tap chunks to mark or unmark them. The count below the article updates without an announcement.
3. Select "Check". Correct marks, missed targets and selected non-targets receive feedback beside their text. A one-line summary gives the number of targets found. Marks are locked until reset.
4. Select "Start over" to clear the marks and feedback and return to the first chunk.

Without JavaScript, the article is plain text. Native "Answer" details lists the target passages and every authored note.

## Content fields

All learner-facing content is authored plain text. HTML characters are escaped.

| Field | Meaning |
| --- | --- |
| `mode` | `key` or `evidence`. Both use `key: true` as the target. |
| `title` | The article title. |
| `question` | Required in evidence mode. Optional in key mode; shown above the passage when present. |
| `paragraphs` | A nonempty array of paragraphs; each paragraph is a nonempty array of chunks. |
| `paragraphs[][].id` | Unique across all paragraphs; letters, digits, underscores and hyphens only. |
| `paragraphs[][].text` | The chunk's text, with no leading or trailing whitespace. Adjacent chunks are joined by one space. |
| `paragraphs[][].key` | Optional boolean. `true` marks a target. At least one target is required. |
| `paragraphs[][].note` | Optional explanation for a selected non-target. In key mode it follows "Not a key idea"; in evidence mode it replaces the default wrong-selection message. Notes also appear in the native answer. |

Text fields must contain non-whitespace text. Unknown fields and duplicate identities are rejected. The schema describes the shape, conditional question requirement and at least one target; its `x-uniqueChunkIds` annotation needs the global identity check in `validateContent`.

`examples/en.json` and `fr.json` are evidence examples. `en-key.json` and `fr-key.json` mark key ideas in the same passage. The demo uses evidence mode.

## Logic

`logic.js`, `strings.js` and `content.schema.json` have no DOM dependencies. Praxity Studio can build another interface using them.

| Function | Returns |
| --- | --- |
| `validateContent(content)` | Nothing; throws an `Error` naming the first bad field. |
| `check(content, markedIds)` | `{ found, total, marked, wrong, items }`. Counts are unique selected targets, all targets, unique selected chunks, and selected non-targets. `items` follows paragraph and chunk order; each item is `{ id, text, marked, outcome, note }`, with `outcome` one of `correct`, `missed`, `wrong`, `unmarked`, and `note` the authored string or `null`. Duplicate marks count once; unknown IDs or invalid mark arrays throw. |
| `validateState(content, value)` | An independent `{ marked: string[], shown: boolean }` or `null`. Unknown IDs, duplicate marks, extra fields and invalid shapes are ignored. Pass validated content. |

## Use it

Copy `patterns/highlight/` and `lib/`, preserving their relative paths. Link `lib/base.css` before `patterns/highlight/pattern.css`. Render on the server, then enhance the resulting root in the browser:

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

Use a different id prefix per instance. Optional `state: { read(), write(value) }` stores `{ marked, shown }`. Valid saved results rebuild without an announcement; invalid saved values are ignored. State adapter errors propagate to the host. Repeated enhancement returns the same instance. `instance.destroy()` removes listeners, clears interaction attributes and restores the plain passage and native answer; the same root can be enhanced again.

## Accessibility

The passage has one tab stop. Left/Up and Right/Down move to the previous or next chunk, wrapping at the ends; Home/End jump to the first/last chunk. Space/Enter toggles a mark. Instructions describe pointer and keyboard use and are associated with every chunk. Each chunk has `role="button"`, `aria-pressed`, a visible focus ring, and `aria-disabled` after checking. Disabled chunks remain readable and navigable. Only checking updates the single status region, once, without moving focus. Reset focuses the first chunk and makes no announcement. Result feedback uses words and decorative icons as well as colour.

Automated browser checks cover both languages, both modes, keyboard navigation, axe at each stage, saved state, independent instances, repeated enhancement, destruction, no JavaScript, 320 CSS pixels, 400% zoom, text spacing and forced colours in the supported engines. Screen reader passes: not yet.

## Evidence

Dunlosky and colleagues rated highlighting low utility: it did not consistently improve students' performance across the conditions they reviewed. [Dunlosky et al., 2013, Improving students' learning with effective learning techniques](https://doi.org/10.1177/1529100612453266), [author's institutional record and abstract](https://scholars.duke.edu/publication/954654).

This pattern adds a question in evidence mode and a comparison with authored targets. Searching visible text is not retrieval practice. This combination has not been tested with learners; the review does not establish a learning benefit for it.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.

Logic unit tested. Not tried with learners.
