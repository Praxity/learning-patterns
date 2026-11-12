---
title: Change one detail
title_fr: Changer un détail
summary: Decide a case, decide again after one stated detail changes, then see which detail the rule turns on.
section: question
ai: no
offline: yes
learners: not tried
---
# Change one detail

Decide a short case. Decide again after one stated detail changes, then see which detail the rule turns on.

## Use it when

- Learners confuse two situations that look alike but call for different responses.
- One fact decides which rule applies, and people miss it.
- A detail that feels important, such as a large amount, does not change the answer, and learners treat it as if it did.

## Avoid it when

- When learners need to recall separate facts, use a quiz such as ["I don't know" as an answer](../dont-know/README.md).
- When the mistake is a wrong belief and not a missed detail, use [Spot the misconception](../misconception/README.md).
- When the answer depends on several details together, write separate cases. One changed detail cannot show that.

## Before you use it

Write one short case, one question with two to four options, and one to three changes. Each change replaces a few words of the case and has its own correct answer and reason. At least one change must move the correct answer. A change that looks important and leaves the answer where it was is worth adding, so learners cannot assume every change moves it. Write the rule as one sentence.

Give the learner enough in the context line to make the first decision, such as who handles what.

## How it works

1. The learner reads a short case, chooses an answer and selects "Check my answer".
2. Their choice is marked and the reason appears under it. The decision stays on the page, locked.
3. The case appears again with one detail changed. The old wording is struck through and the new wording is highlighted.
4. The learner answers the same question again, then sees whether the answer changed and why.
5. After the last change, a summary gives their score and the rule in one sentence.
6. "Start over" clears every decision.

Every change starts from the first case, so each version differs from it in one detail only.

## Evidence

This pattern comes from research on contrasting cases, where learners compare cases that differ to see which features matter. Comparing cases teaches more than studying them one at a time. Across 57 experiments, comparing cases led to more learning than studying cases one after another or singly, and than traditional instruction (d = 0.50). The gain was larger when the principle came after the comparison ([Alfieri, Nokes-Malach and Schunn, 2013](https://doi.org/10.1080/00461520.2013.775712)). This pattern gives the rule after the decisions for that reason. The gain was also larger when learners looked for what cases share, and this pattern asks about a difference. Its versions arrive one after another, and the earlier ones stay on the page so the learner can compare them.

A case that differs in one detail shows what a rule depends on. Adding a "near miss", an example that differed from a problem's solution in one critical respect, helped people describe that solution more fully, and an unrelated extra example did not ([Gick and Paterson, 1992](https://doi.org/10.1037/h0084333)). Students in grades 7 and 8 learned more from comparing worked algebra examples when the examples differed in a feature that mattered ([Rittle-Johnson and Star, 2009](https://doi.org/10.1037/a0014224)). Both studies used problem solving, not workplace decisions.

Studies disagree on who should find the difference. College students who worked out the differences between cases themselves, then heard a lecture, predicted new results better than students who read about those differences first ([Schwartz and Bransford, 1998](https://doi.org/10.1207/s1532690xci1604_4)). In a later experiment, students who were given the comparisons learned more concepts from the explanation that followed than students who were prompted to make them ([Roelle and Berthold, 2015](https://doi.org/10.1080/07370008.2015.1063636)). Here the page states what changed, and the learner works out what it means for the decision before reading the rule.

Stating one change and asking for the decision again has not been tested as a design, and this pattern has not been tried with learners.

## Accessibility

Follows the shared baseline in the root README.

Keep each change to a few words, and write each reason so it makes sense without seeing the highlight. Without JavaScript, learners see the first case and its options, then each change in turn. Each answer and reason sits behind its own "Show the answer" disclosure, and the rule sits behind the last one.

## Content fields

Authors write plain text. Rendering escapes HTML characters. Keep English and Canadian French examples together, with the same option ids and correct answers.

| Field | Meaning |
| --- | --- |
| `title` | Card heading that names the task, at most 120 characters. |
| `context` | Optional. The learner's role and what they need to make the first decision, at most 400 characters. |
| `case` | The case itself, at most 600 characters. Keep it short enough to read in one look. |
| `question` | The question asked in every round, at most 400 characters. |
| `options` | Two to four options, the same in every round. |
| `options[].id` | Unique id using letters, digits, underscores or hyphens. |
| `options[].text` | Option text, at most 300 characters. Leave off a closing period, because feedback adds one after the option ("Correct answer: Security."). |
| `correct` | Id of the correct option for the first case. |
| `explanation` | Why that option is correct, at most 600 characters. |
| `changes` | One to three changes, in the order learners meet them. |
| `changes[].from` | Wording to replace, at most 120 characters. It must appear exactly once in `case`. |
| `changes[].to` | The new wording, at most 120 characters. It must differ from `from`. |
| `changes[].correct` | Id of the correct option once this detail has changed. |
| `changes[].explanation` | Why, at most 600 characters. The page adds "The answer changes." or "The answer stays the same." before it. |
| `rule` | The rule in one sentence, at most 400 characters. Every learner sees it at the end. |

`validateContent` rejects unknown fields, blank strings, duplicate option ids and unknown correct-option references. It also makes the checks ordinary JSON Schema tools cannot: `x-uniqueBy`, `x-optionReference`, `x-occursOnceIn` (the wording appears exactly once in the case) and `x-oneDiffers` (at least one change has a different correct answer from the first case).

## Logic

`logic.js`, `strings.js` and the schema contain no DOM code. Hosts can build their own interface.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `rounds(content)` | One entry per decision: the first case, then each change. Each is `{ parts, correct, explanation, moves }`. `parts` is the case text as `{ kind: 'same' \| 'before' \| 'now', text }` pieces. `moves` is `null` for the first case, then whether the correct answer differs from the first case's. |
| `score(content, picks)` | `{ results, right, total, done }` for the checked decisions. `picks` holds option ids in round order. Invalid picks throw. |
| `validateState(content, value)` | Copied `{ picks }`, or `null` for invalid state. |
| `format(template, values)` | Placeholder substitution that keeps inserted text literal. |

Every change applies to the first case alone. Changes do not build on each other.

Optional host `state: { read, write }` stores `{ picks }`, the option ids of the decisions checked so far. Each check and "Start over" write it. A choice that has not been checked stays in memory. Invalid saved values are ignored. A valid value restores the checked rounds, locked, and opens the next one, without an announcement or a focus move. Without an adapter, decisions last for the mounted instance.

Repeated `enhance` calls return the same instance. `destroy()` removes listeners, clears the decisions and restores the no-JavaScript view without rebuilding the DOM.

## Use it

Copy `patterns/change-one-detail/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/change-one-detail/pattern.css`. Use a unique id prefix per instance.

```js
import { render } from './patterns/change-one-detail/render.js';
import { enhance } from './patterns/change-one-detail/enhance.js';
import { strings } from './patterns/change-one-detail/strings.js';
import content from './patterns/change-one-detail/examples/en.json' with { type: 'json' };

document.querySelector('main').innerHTML = render(content, strings.en, { id: 'route', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern="change-one-detail"]'), { content, strings: strings.en });
```

The highlight colour is `--lp-change-one-detail-mark`. Keep at least 4.5:1 contrast with `--lp-ink` when overriding it.

### Accessibility details

- The changed case marks the old wording with `del` and the new wording with `ins`. Each starts with a visually hidden "Before:" or "Now:", so the change is read in words where a screen reader does not announce deletions and insertions.
- The change does not rely on colour. The old wording is struck through and the new wording is heavier. In forced colours the new wording is underlined.
- Checking with nothing chosen shows "Choose an answer" in the question group, links it as the group's description and focuses the first option.
- Checking a decision moves focus to its feedback, which starts with a visually hidden "Correct." or "Incorrect. Correct answer: …". Reading on from there reaches the next change. The status region stays empty, so the result is read once.
- After the last decision, focus moves to that decision's feedback and the status region announces the score and the rule once.
- "Start over" focuses the first option of the first case and announces "Answers cleared."
- Checked options are disabled and keep their marks: "Correct", "Incorrect", or "Correct answer" on a correct option the learner did not choose.

## Adapt it with your agent

> Adapt the change-one-detail examples to [topic] for [audience]. Keep the content fields. Write one short case, one question with two to four options, and one to three changes. Each change replaces wording that appears exactly once in the case. At least one change moves the correct answer, and a change that leaves it in place is welcome. Write a reason for every decision and the rule as one sentence. Write English and Québec French together, using vous, with the same option ids and correct answers. Preserve the locked earlier decisions, the struck and highlighted change with its hidden labels, the no-JavaScript disclosures, one status region, saved state and CSS tokens. Update examples and tests. Show both languages for review.

## Related patterns

- ["I don't know" as an answer](../dont-know/README.md) asks separate questions about separate facts. This pattern asks one question about one case several times, so the learner sees what moves the answer.
- [Pre-test to skip sections](../test-out/README.md) uses choice questions to decide what a learner can skip. This pattern teaches where one rule stops applying.
- [Spot the misconception](../misconception/README.md)

## Help improve this pattern

Tried it with learners? [Tell us what happened](https://github.com/Praxity/learning-patterns/issues/new?template=pattern-feedback.yml&pattern=Change%20one%20detail). You can also [suggest a change to this page](https://github.com/Praxity/learning-patterns/edit/main/patterns/change-one-detail/README.md).

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
