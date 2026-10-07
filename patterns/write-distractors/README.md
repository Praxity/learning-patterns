---
title: Write the wrong options
title_fr: Rédigez les mauvaises réponses
summary: Answer a question, write wrong options and the misconception behind each, then compare with the author's.
section: question
ai: no
offline: yes
learners: not tried
---
# Write the wrong options

You answer a question, write plausible wrong options, name their misconceptions and compare with the author's options.

## When to use it

Use it when learners can recall the topic and name common misconceptions. Authors can review submissions to find possible wrong options for a quiz. Do not use tag matches to judge whether an option expresses its misconception or would tempt a learner, since a person must judge that.

## How it works

1. You write your answer from memory and select "Check my answer" to see the right answer.
2. You choose "Yes" or "Not quite" to say whether you had it. This choice has no score.
3. You write the requested wrong options and choose the wrong idea behind each one. You can choose "Something else" and write your own description.
4. You select "Compare with the author's" and fix any fields with errors.
5. You compare your finished question with the author's question. Each wrong option shows its misconception underneath. Matching misconceptions get a check mark, and the summary counts the author's labels you used and any extra labels.
6. You select "Start over" to clear your work and answer the question again.

## Evidence

Producing an answer yourself improves memory more than reading it, with an average effect of 0.40 standard deviations across 86 studies ([Bertsch et al., 2007](https://doi.org/10.3758/BF03193441)). Writing questions about a lecture helped university students recall it a week later about as much as answering practice questions ([Ebersbach, Feierabend and Nazari, 2020](https://doi.org/10.1002/acp.3639)), and students who wrote multiple-choice questions for their peers tended to do better in exams, though those studies are correlational ([Hardy et al., 2014](https://doi.org/10.1080/09500693.2014.916831)). Tying each wrong option to a named misconception follows diagnostic test design ([Treagust, 1988](https://doi.org/10.1080/0950069880100204); [Eedi](https://www.eedi.com/news/from-wrong-answers-to-real-insights-how-we-used-a-kaggle-challenge-to-map-student-misconceptions)). Texts that state a misconception and explain why it is wrong improved learning in a meta-analysis ([Schroeder and Kucera, 2022](https://doi.org/10.1007/s10648-021-09656-z)). This pattern shows the right answer but does not refute each misconception. Writing wrong options has not been tested as a learning activity.

## Accessibility

Meets the shared baseline in the root README.

- Each wrong-option builder has a fieldset whose legend names its letter key and labels the answer field. Other fields have visible labels. Errors are linked to their fields.
- Checking announces the right answer and keeps focus on Check my answer. A self-report moves focus to the authoring heading.
- Invalid comparisons focus the first error and announce the number of fields needing attention. Successful comparisons keep focus on the submit button and announce coverage.
- After comparison, each builder becomes a read-only summary with its full misconception label. Start over focuses Your answer.

## Content fields

All content fields are plain text. HTML characters are escaped.

| Field | Meaning |
| --- | --- |
| `question` | Given question. |
| `rightAnswer` | Authored right answer, revealed after checking or through the native disclosure. |
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
| `validateState(content, value)` | A copy of valid `{ answer, hadIt, options, shown }` state, or `null`. Legacy `{ options, shown }` restores as a draft with `answer: ''`, `hadIt: null`, `shown: false`. |
| `optionKey(index)` | A letter key for a zero-based index: `0` gives A, `1` gives B, `26` gives AA. Throws for an index that is not a nonnegative safe integer. |

Each submitted option has `{ text, misconception, custom }`. Named targets use an empty `custom` string. Exported constants `MAX_OPTION`, `MAX_CUSTOM` and `OTHER` are `300`, `120` and `'other'`. Length checks run before trimming and collapsing whitespace. Comparison rejects the right answer and duplicate options after ignoring case and extra whitespace.

Coverage compares tags after ignoring case and extra whitespace. A custom tag that repeats an authored label matches it. Duplicate tags count once. `missed` lists only targets from the author's options; `extra` lists learner targets those options do not cover. The enhancer formats counts with `coverageOne` or `coverageMany` above two question previews. The previews sit side by side when the activity's content area is at least 40rem wide, and stack below that.

Checking locks the first answer. The right answer owns letter key A; wrong options start at B. The builder heading writes counts from two to five in words and larger counts in digits. The author's question stays hidden until a valid comparison. Without JavaScript, the question and answer field remain available, with native disclosures for Right answer and The author's question.

The optional state adapter stores `{ answer, hadIt, options: [{ text, misconception, custom }], shown }`. `answer` holds the learner's text. `hadIt` is `true` for Yes, `false` for Not quite, and `null` before self-report. It saves drafts on input and selection, normalized options on comparison, and empty fields on Start over. A saved draft with `hadIt: null` returns to the answer step, even if the answer was checked before leaving. Legacy state preserves the wrong-option draft and requires the answer step again. The host decides how to collect submissions for the author. This pattern uses no localStorage and keeps no suggestion list. Invalid state is ignored. Valid results restore without announcements. State adapter errors propagate to the host. Repeated enhancement returns the same instance.

Override the root's `--lp-*` tokens for colours, radius, fonts and focus. See the root README for the token defaults.

## Use it

Copy this folder and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/write-distractors/pattern.css`. Render on your server with a unique id prefix for each instance.

```js
import { render } from './patterns/write-distractors/render.js';
import { strings } from './patterns/write-distractors/strings.js';
const markup = render(content, strings.en, { id: 'breaks', lang: 'en' });
```

`render.js` also exports `renderQuestionPreview(content, strings, options, { author, matches, heading })`, which returns escaped HTML for a read-only question. `options` holds wrong options; `matches` holds their comparison flags. `author` chooses the author's title, and `heading: false` omits it inside a labelled disclosure.

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

## Adapt it with your agent

Give your agent this README, the example content and your question's correct answer. Ask it to draft misconception labels and plausible wrong options for author review. Keep learner-facing feedback authored in `strings.js`. Check the labels against real learner errors before adopting them. Run the logic, schema, type, budget and browser checks after changing the content contract.

## Licence

[MIT](../../LICENSE). Keep the licence notice with copied code.
