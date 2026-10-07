---
title: Write the wrong options
title_fr: Rédigez les mauvaises réponses
summary: Write wrong answers, tag the misconceptions behind them, then compare their coverage with the author's options.
section: question
ai: no
offline: yes
learners: not tried
---
# Write the wrong options

Write plausible wrong answers to a given question. Tag the misconception behind each one, then compare with the author's wrong options.

## When to use it

Use it after learners have seen the right answer and can name common misconceptions. Authors can review learner submissions to find possible distractors for a quiz. The pattern compares tags. A person must judge whether a wrong option actually expresses its tag and would tempt a learner.

## How it works

1. Read the question and right answer. Write the requested number of wrong options.
2. Choose the misconception each option targets. "Something else" opens a field for your own description.
3. Select "Compare with the author's". Errors appear beside their fields, focus moves to the first error, and the status announces the number of fields needing attention.
4. Read how many author misconceptions you targeted and how many of your own you added. Below the author's options, a list shows the author misconceptions you did not target. Each of your options says whether its tag matches an author option.
5. "Start over" appears after a successful comparison. It empties the fields and returns focus to the first textarea. Editing a field hides the comparison until you submit again.

Without JavaScript, the question and right answer remain visible. Open "The author's wrong options" to read the options and their misconceptions.

## Content fields

All content fields are plain text. HTML characters are escaped.

| Field | Meaning |
| --- | --- |
| `question` | Given question. |
| `rightAnswer` | Given right answer, displayed throughout. |
| `misconceptions` | At least one named misconception, in select order. |
| `misconceptions[].id` | Unique letters, digits, underscores or hyphens. `other` is reserved for "Something else". |
| `misconceptions[].label` | Select label and target name in results. |
| `authorOptions` | At least one wrong option for comparison. |
| `authorOptions[].text` | Authored wrong answer. |
| `authorOptions[].misconception` | An ID in `misconceptions`. |
| `count` | Positive safe integer, the number of wrong options to write. The example uses two. Keep this small. |

Strings must be nonempty. Unknown fields, duplicate IDs, and unknown author references throw errors naming the field. The schema annotations `x-uniqueBy` and `x-reference` document relational checks. Use `validateContent` alongside an ordinary JSON Schema validator for these checks.

## Logic

`logic.js` has no DOM code. Hosts can use these functions to build their own interface.

| Function | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `validateOptions(content, options)` | `{ ok: true, options }` with clean text, or `{ ok: false, errors }`. Each error has `{ option, field, code }`, with a zero-based option index. |
| `targetOf(content, option)` | The named target's label or the learner's custom description. Throws for an unknown target. |
| `coverage(content, options)` | `{ targeted, missed, extra, matches }`. The first three fields hold unique target labels. `matches` holds one boolean per learner option. |
| `coverageMessage(content, options)` | `{ authorTargeted, authorTotal, ownExtra, untargeted }`. Counts unique targets in the author's options and the learner's extra targets. `untargeted` holds missed author labels in author-option order. |
| `validateState(content, value)` | A copy of valid `{ options, shown }` state, or `null` for invalid state. |

Each submitted option has `{ text, misconception, custom }`. Named targets use an empty `custom` string. Exported constants `MAX_OPTION`, `MAX_CUSTOM` and `OTHER` are `300`, `120` and `'other'`. Length checks run before trimming and collapsing whitespace. Comparison rejects the right answer and duplicate options after ignoring case and extra whitespace.

Coverage compares tags after ignoring case and extra whitespace. A custom tag that repeats an authored label matches it. Duplicate tags count once. `missed` lists only targets from the author's options; `extra` lists learner targets those options do not cover. The enhancer formats counts with `coverageOne` or `coverageMany`, then lists missed labels or "None."

## Use it

Copy this folder and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/write-distractors/pattern.css`. Render on your server with a unique id prefix for each instance.

```js
import { render } from './patterns/write-distractors/render.js';
import { strings } from './patterns/write-distractors/strings.js';
const markup = render(content, strings.en, { id: 'breaks', lang: 'en' });
```

After inserting the server markup, enable the fields in the browser.

```js
import { enhance } from './patterns/write-distractors/enhance.js';
const instance = enhance(document.querySelector('[data-lp-pattern="write-distractors"]'), {
  content, strings: strings.en,
  state: { read: () => saved, write: value => { saved = value; } }
});
// Remove listeners and restore the native details when the host removes the interaction.
instance.destroy();
```

The optional state adapter stores `{ options: [{ text, misconception, custom }], shown }`. It saves drafts on input and selection, normalized options on success, and empty options on Start over. The host decides how to collect submissions for the author. This pattern uses no localStorage and keeps no suggestion list. Invalid state is ignored. Valid results restore without announcements. State adapter errors propagate to the host. Repeated enhancement returns the same instance.

Override the root's `--lp-*` tokens for colours, radius, fonts and focus. See the root README for the token defaults.

## Accessibility

Each option has a borderless fieldset and legend. Every field has a visible label and an error linked through `aria-describedby`. Errors use an alert icon beside the message. The selected misconception stays in the native select. Results repeat its full label. The single status region starts empty and announces the short coverage summary once per submission. Successful comparison keeps focus on the submit button. Start over returns focus to the first textarea. Results show the summary and a note about tag comparison, the author's options, untargeted misconceptions, and your options. Each learner option shows a check or dashed circle beside its match label, followed by its target.

The English and French examples, two-instance page, errors, results, state restoration and native fallback have automated axe and keyboard checks in Chromium, Firefox and WebKit. Checks cover 320 CSS pixels with text spacing, equivalent to reflow at 400% zoom from 1280 pixels, and Chromium forced colours. Human screen-reader passes remain a separate check. There are no time limits or animations.

## Evidence

[Eedi's misconception mapping work](https://www.eedi.com/news/from-wrong-answers-to-real-insights-how-we-used-a-kaggle-challenge-to-map-student-misconceptions) associates distractors with named misconceptions. [Two-tier diagnostic items](https://www.lifescied.org/doi/10.1187/cbe.10-03-0048) pair an answer with a reason. These support making the misconception explicit, but do not establish that asking learners to write distractors improves learning.

[Schroeder and Kucera's refutation-text review](https://doi.org/10.1007/s10648-021-09656-z) concerns texts that name and correct misconceptions with explanations. This pattern shows the right answer and compares tags; its content contract contains no separate refutation for each tag. Do not treat a tag match as evidence that a learner holds that misconception, or as a correction of it. Learners writing distractors has not been tested here.

Logic unit tested. Not tried with learners.

## Adapt it with your agent

Give your agent this README, the example content and your question's correct answer. Ask it to draft misconception labels and plausible wrong options for author review. Keep learner-facing feedback authored in `strings.js`. Check the labels against real learner errors before adopting them. Run the logic, schema, type, budget and browser checks after changing the content contract.

## Licence

[MIT](../../LICENSE). Keep the licence notice with copied code.
