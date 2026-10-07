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

You mark key ideas or answers in a passage, then compare your marks with the author's choices beside the text.

## When to use it

Use it to compare the ideas a learner notices with the author's selection, or to find text that answers a question. Keep passages short and split them at meaningful boundaries. Do not use it when learners need to select individual words, since they choose whole chunks. Searching visible text does not test recall.

## How it works

1. You read the passage and any question above it.
2. You mark the key ideas or the text that answers the question. You can select a marked piece again to remove the mark.
3. You select "Check" and read the feedback beside your marks and any targets you missed.
4. You read how many targets you found, then select "Start over" if you want to try again.

## Evidence

Dunlosky and colleagues rated highlighting low utility. It did not consistently improve students' performance across the conditions they reviewed. [Dunlosky et al., 2013, Improving students' learning with effective learning techniques](https://doi.org/10.1177/1529100612453266), [author's institutional record and abstract](https://scholars.duke.edu/publication/954654).

This pattern adds a question in evidence mode and compares marks with authored targets. Searching visible text is not recall practice. The combination has not been tested with learners. The review does not establish a learning benefit for it.

Logic unit tested. Not tried with learners.

## Accessibility

Meets the shared baseline in the root README.

- The passage has one tab stop. Left or Up and Right or Down move between chunks and wrap at the ends; Home and End jump to the first and last.
- Space or Enter toggles a mark. Each chunk exposes its pressed state and has linked keyboard instructions.
- Checked chunks remain readable and navigable. Feedback beside each chunk explains correct marks, missed targets and other selections.
- Checking announces the target count. If Check has focus when it hides, focus moves to Start over. Reset focuses the first chunk without an announcement.

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

Without JavaScript, the article is plain text. Native "Answer" details lists the target passages and every authored note.

After checking, marks are locked until reset. Mark counts update silently.

Use a different id prefix per instance. Optional `state: { read(), write(value) }` stores `{ marked, shown }`. Valid saved results rebuild without an announcement; invalid saved values are ignored. State adapter errors propagate to the host. Repeated enhancement returns the same instance. `instance.destroy()` removes listeners, clears interaction attributes and restores the plain passage and native answer; the same root can be enhanced again.

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

## Adapt it with your agent

> Adapt the highlight examples to [topic] for [audience]. Keep `{ mode, title, question?, paragraphs: [[{ id, text, key?, note? }]] }`. Choose key ideas or evidence for a focused question. Split the passage at meaningful boundaries, keep ids unique and include at least one target. Write notes that explain selected non-targets. Keep English and Québec French together, using vous in French. Preserve the plain passage and native answer, keyboard navigation, local feedback, state, escaping and CSS token contracts. Make no claim that highlighting or searching visible text tests recall. Update examples and tests. Show both languages for review.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
