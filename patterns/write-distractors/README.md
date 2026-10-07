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
5. "Clear" appears after a successful comparison. It empties the fields and returns focus to the first textarea. Editing a field hides the comparison until you submit again.

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

Praxity Studio imports `logic.js`, `content.schema.json` and `strings.js` without DOM code. `validateOptions(content, options)` returns either `{ ok: true, options }` with normalized text, or `{ ok: false, errors }`. Each error has `{ option, field, code }`, with a zero-based option index. All submitted options have `{ text, misconception, custom }`. Named targets use an empty `custom` string. Limits are 300 characters for options and 120 for custom tags, checked before normalization. Comparison rejects the right answer and repeated options after case and whitespace normalization.

`coverage(content, options)` returns `{ targeted, missed, extra, matches }`. It compares labels after case and whitespace normalization, so a custom tag that repeats an authored label matches it. `missed` now lists only unique targets from the author's options that the learner did not target, rather than every unused label in `misconceptions`. `extra` lists unique learner targets the author's options do not cover. `matches` keeps one boolean per learner option.

`coverageMessage(content, options)` now returns `{ authorTargeted, authorTotal, ownExtra, untargeted }`. It takes no strings argument and returns no formatted text. `authorTotal` counts unique targets in the author's options. `authorTargeted` counts how many of those the learner targeted. `ownExtra` counts unique learner targets outside the author's options. `untargeted` contains the same labels as `coverage().missed`, in author-option order. Duplicate tags count once, including custom aliases. The enhancer formats these counts with `coverageOne` or `coverageMany` from `strings.js`, then lists the untargeted labels or `None.`. These replace the earlier targeted, missed, addition and closing-summary strings.

## Use it

Copy this folder and `lib/`, keeping their relative paths. Load `pattern.css` and render on your server.

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

The optional state adapter stores `{ options: [{ text, misconception, custom }], shown }`. It saves drafts on input and selection, normalized options on success, and empty options on clear. The host decides how to collect submissions for the author. This pattern uses no localStorage and keeps no suggestion list. Invalid state is ignored. Valid results restore without announcements. State adapter errors propagate to the host. Repeated enhancement returns the same instance.

Override the root's `--lp-*` tokens for colours, spacing, radius, fonts and focus. See the root README for the token defaults.

## Accessibility

Each option has a fieldset and legend. Every field has a visible label and an error linked through `aria-describedby`. The selected misconception stays in the native select. Results repeat its full label. The single status region starts empty and announces the short coverage summary once per submission. Successful comparison keeps focus on the submit button. Clear returns focus to the first textarea. Results show the summary and a note about tag comparison, the author's options, untargeted misconceptions, and your options with text and decorative icons.

The English and French examples, two-instance page, errors, results, state restoration and native fallback have automated axe and keyboard checks in Chromium, Firefox and WebKit. Checks cover 320 CSS pixels with text spacing, equivalent to reflow at 400% zoom from 1280 pixels, and Chromium forced colours. Human screen-reader passes remain a separate check. There are no time limits or animations.

## Evidence

[Eedi's misconception mapping work](https://www.eedi.com/news/from-wrong-answers-to-real-insights-how-we-used-a-kaggle-challenge-to-map-student-misconceptions) associates distractors with named misconceptions. [Two-tier diagnostic items](https://www.lifescied.org/doi/10.1187/cbe.10-03-0048) pair an answer with a reason. These support making the misconception explicit, but do not establish that asking learners to write distractors improves learning.

[Schroeder and Kucera's refutation-text review](https://doi.org/10.1007/s10648-021-09656-z) concerns texts that name and correct misconceptions with explanations. This pattern shows the right answer and compares tags; its content contract contains no separate refutation for each tag. Do not treat a tag match as evidence that a learner holds that misconception, or as a correction of it. Learners writing distractors has not been tested here.

Logic unit tested. Not tried with learners.

## Adapt it with your agent

Give your agent this README, the example content and your question's correct answer. Ask it to draft misconception labels and plausible wrong options for author review. Keep learner-facing feedback authored in `strings.js`. Check the labels against real learner errors before adopting them. Run the logic, schema, type, budget and browser checks after changing the content contract.

## Licence

[MIT](../../LICENSE). Keep the licence notice with copied code.
