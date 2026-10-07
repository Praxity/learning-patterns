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
4. Read which misconceptions you targeted and left untargeted, plus any the author did not cover. Compare the author's options and your own. Each of yours says whether its tag matches an author option.
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

`coverage(content, options)` returns `{ targeted, missed, extra, matches }`. It compares normalized labels, so a custom tag that repeats an authored label matches it. `missed` lists the authored misconceptions the learner did not target; `extra` lists learner targets the author's options do not cover. `coverageMessage(content, options, strings)` formats this result. The demo's "same ones" message now says the author covers every learner target, which remains accurate for a subset. Arbitrary counts support more than two additions.

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

Each option has a fieldset and legend. Every field has a visible label and an error linked through `aria-describedby`. A wrapped line repeats the selected misconception so a long native select label remains readable at narrow widths. The single status region starts empty and announces one coverage message per submission. Successful comparison keeps focus on the submit button. Clear returns focus to the first textarea. Results include text and decorative icons, with a short closing summary.

The English and French examples, two-instance page, errors, results, state restoration and native fallback have automated axe and keyboard checks in Chromium, Firefox and WebKit. Checks cover 320 CSS pixels with text spacing, equivalent to reflow at 400% zoom from 1280 pixels, and Chromium forced colours. Human screen-reader passes remain a separate check. There are no time limits or animations.

## Evidence

[Eedi's misconception mapping work](https://www.eedi.com/news/from-wrong-answers-to-real-insights-how-we-used-a-kaggle-challenge-to-map-student-misconceptions) associates distractors with named misconceptions. [Two-tier diagnostic items](https://www.lifescied.org/doi/10.1187/cbe.10-03-0048) pair an answer with a reason. These support making the misconception explicit, but do not establish that asking learners to write distractors improves learning.

[Schroeder and Kucera's refutation-text review](https://doi.org/10.1007/s10648-021-09656-z) concerns texts that name and correct misconceptions with explanations. This pattern shows the right answer and compares tags; its content contract contains no separate refutation for each tag. Do not treat a tag match as evidence that a learner holds that misconception, or as a correction of it. Learners writing distractors has not been tested here.

Logic unit tested. Not tried with learners.

## Adapt it with your agent

Give your agent this README, the example content and your question's correct answer. Ask it to draft misconception labels and plausible wrong options for author review. Keep learner-facing feedback authored in `strings.js`. Check the labels against real learner errors before adopting them. Run the logic, schema, type, budget and browser checks after changing the content contract.

## Licence

[MIT](../../LICENSE). Keep the licence notice with copied code.
