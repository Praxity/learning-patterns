---
title: Write the wrong options
title_fr: Rédigez les mauvaises réponses
summary: Answer from memory, write wrong options and explain the mistaken idea behind each, then compare with the author.
section: question
ai: no
offline: yes
learners: not tried
---
# Write the wrong options

Answer from memory, then write wrong options and name the mistaken idea behind each. Compare your options with the author's.

## When to use it

Use it when learners know enough to answer from memory and explain common mistakes. Authors can review their wrong options for use in quizzes. A person must judge whether each option expresses the chosen misconception and would tempt a learner. Matching labels cannot do that.

## How it works

1. Answer from memory. Select "Check my answer" to see the right answer.
2. Choose "Yes" or "Not quite" to say whether your answer was right. This choice has no score.
3. Write the requested wrong options. Choose the mistaken idea behind each, or choose "Something else" and describe it.
4. Select "Compare with the author's". Fix any fields with errors.
5. Compare your question with the author's. Each wrong option names its mistaken idea. A check mark shows a matching label. The summary counts matching and extra labels.
6. Select "Start over" to clear your work.

## Evidence

Giving your own answer helps you remember more than reading one. The average effect was 0.40 standard deviations across 86 studies ([Bertsch et al., 2007](https://doi.org/10.3758/BF03193441)). University students wrote questions about a lecture. A week later, they recalled about as much as students who answered practice questions ([Ebersbach, Feierabend and Nazari, 2020](https://doi.org/10.1002/acp.3639)). Students who wrote multiple-choice questions for peers tended to do better in exams. Those studies show a link, not that writing questions caused better scores ([Hardy et al., 2014](https://doi.org/10.1080/09500693.2014.916831)).

Linking each wrong option to a named misconception follows diagnostic test design ([Treagust, 1988](https://doi.org/10.1080/0950069880100204); [Eedi](https://www.eedi.com/news/from-wrong-answers-to-real-insights-how-we-used-a-kaggle-challenge-to-map-student-misconceptions)). Texts that explain why a misconception is wrong improved learning in a meta-analysis ([Schroeder and Kucera, 2022](https://doi.org/10.1007/s10648-021-09656-z)).

This pattern shows the right answer but does not explain why each misconception is wrong. Writing wrong options has not been tested as a learning activity.

## Accessibility

Follows the shared baseline in the root README.

- Each wrong option has a fieldset. Its legend names the option's letter and labels its answer field. Error messages name options by that letter. Other fields have visible labels. Errors link to their fields.
- Checking announces the right answer and keeps focus on Check my answer. Choosing Yes or Not quite focuses the next heading.
- An invalid comparison focuses the first error and announces how many fields need fixing. A valid comparison keeps focus on the submit button and announces the matching-label count.
- After comparison, each wrong option shows a summary you can read but cannot edit. It includes the full misconception label. Start over focuses Your answer.

## Content fields

Content is plain text. Rendering escapes HTML characters.

| Field | Meaning |
| --- | --- |
| `question` | Question to answer. |
| `rightAnswer` | Right answer, shown after checking or in the native disclosure. |
| `misconceptions` | At least one named misconception, in select order. |
| `misconceptions[].id` | Unique letters, digits, underscores or hyphens. `other` is reserved for "Something else". |
| `misconceptions[].label` | Label in the select menu and results. |
| `authorOptions` | At least one wrong option for comparison. |
| `authorOptions[].text` | Authored wrong answer. |
| `authorOptions[].misconception` | An ID in `misconceptions`. |
| `count` | Positive safe integer. Number of wrong options to write; keep it small. The example uses two. |

Strings must be nonempty. Unknown fields, duplicate ids and invalid author references throw errors naming the field. Use `validateContent` for the cross-field checks recorded as `x-uniqueBy` and `x-reference`; ordinary JSON Schema tools need these checks.

## Logic

`count` is an integer from one to five, matching the bilingual authored count names.

Authored text is capped at 120 characters for titles and labels, 400 for questions and prompts, 300 for options, and 1,500 for answers, explanations and passage text. The schema gives each field's limit; `validateContent` enforces it.

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

Coverage compares labels, ignoring case and extra whitespace. Custom labels can match authored labels. Repeated labels count once. `missed` lists only labels from the author's options; `extra` lists learner labels absent from those options. `coverageOne` or `coverageMany` formats counts above two question previews. Previews sit side by side at content widths of at least 40rem and stack below that.

Checking locks the first answer. The right answer has letter A; wrong options start at B. The heading writes counts two to five in words and larger counts in digits. The author's question appears after a valid comparison. Without JavaScript, learners can read the question, write an answer and open Right answer and The author's question.

Optional host state stores `{ answer, hadIt, options: [{ text, misconception, custom }], shown }`. `answer` is the learner's text. `hadIt` is `true` for Yes, `false` for Not quite, or `null` before that choice. Input and selection save drafts; comparison saves normalized options; Start over saves empty fields.

A saved draft with `hadIt: null` returns to the answer step, even if previously checked. Legacy state keeps the wrong-option draft and requires the answer step again. Invalid state is ignored. Valid results restore silently. State adapter errors reach the host. Repeated enhancement returns the same instance.

The host decides how to collect submissions. The pattern uses no localStorage and keeps no suggestion list.

Override `--lp-*` tokens for colours, radius, fonts and focus. Defaults are in the root README.

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

Give your agent this README, the examples and your correct answer. Ask for misconception labels and plausible wrong options to review. Keep feedback authored in `strings.js`. Check labels against real learner errors. If you change the content contract, run logic, schema, type, budget and browser checks.

## Licence

[MIT](../../LICENSE). Keep the licence notice with copied code.
