---
title: Sort cases by principle
title_fr: Classer des cas par principe
summary: Choose which principle each short case needs, one case at a time, read what decides it, then see which principles you mixed up.
section: question
ai: no
offline: yes
learners: not tried
---
# Sort cases by principle

Choose which of a few principles each short case needs, one case at a time. After each check, read the fact in the case that decides it. A learner who picked the principle a surface detail points to also reads which detail that was. The activity ends with a score and the pairs of principles the learner mixed up.

## Use it when

- Learners can state each principle but choose the wrong one for a new case, such as which privacy rule, accounting treatment or first-aid step applies.
- A surface detail, such as a familiar keyword, a large amount or who is asking, pulls learners toward the wrong principle.
- A course teaches several principles in turn, and learners need practice choosing among them before they apply them.

## Avoid it when

- When one fact decides between two answers, use [Change one detail](../change-one-detail/README.md). It shows that fact changing in one case.
- When learners need to recall facts, use a quiz such as ["I don't know" as an answer](../dont-know/README.md).
- When the principles can apply to the same case together, write rules that rule each other out first. If you can't, this pattern will mark defensible answers wrong.

## Before you use it

Write two to four principles. Give each a short name and a one-line rule that says when it applies, so a learner can decide every case from the rules alone. Rules that turn on what is already settled, such as "the facts are agreed, but the cause is not known", rule each other out more easily than rules about what to do.

Write three or four cases of one or two lines each. Each principle must be the answer to at least one case. Give each case a fact that decides it under the rules, and a surface detail that points to a different principle, its lure. For each case write:

- `looksLike`: the surface detail and the principle it points to. Only a learner who chose that principle reads it.
- `decides`: the fact that settles the case and what to do. Every learner reads it.

Then check every wrong principle against its own rule: it must be wrong under that rule as written, so a learner can see why from the card. Put the cases in an order where the answers don't follow the order of the principles, and where two cases with different surfaces share an answer.

## How it works

1. The learner reads a case and chooses one principle. Each choice shows the principle's name and its rule.
2. "Check my answer" marks their choice "Correct" or "Incorrect", and marks the correct principle "Correct answer" after a miss. The feedback under the choices gives the deciding fact, after the surface detail if they chose the lure. Each case takes one try.
3. "Next case" opens the next case in place of this one.
4. After the last case, one sentence gives their score, such as "You got 2 of 4 cases right.", and a list names each pair of principles they mixed up, such as "*Ask an open question* and *Agree the next action*: 2 cases".
5. "Start over" clears every answer and opens the first case.

Learners cannot go back to an earlier case, because each miss is explained when it happens.

## Evidence

Novices sort problems by what they mention, experts by the principle that solves them. Physics novices grouped problems by their surface objects, such as inclined planes and springs, and experts by principles such as conservation of energy ([Chi, Feltovich and Glaser, 1981](https://doi.org/10.1207/s15516709cog0502_2)). That study compared experts with novices; it did not test a way to teach. This pattern practises the move it describes: telling cases apart by principle when their surface points elsewhere.

Practice that mixes kinds of problem helps learners choose the right method. Seventh graders whose practice mixed kinds of maths problem scored higher than those who practised one kind at a time, on tests one day later (d = 0.42) and 30 days later (d = 0.79) ([Rohrer, Dedrick and Stershic, 2015](https://doi.org/10.1037/edu0000001)). Mixed practice makes each problem a choice of method; blocked practice gives the method away. That study ran over three months of school maths, not four workplace cases.

This combination, mixed cases with a surface-detail explanation and a list of mixed-up pairs, has not been tested, and this pattern has not been tried with learners.

## Accessibility

Follows the shared baseline in the root README.

Write each case's deciding fact so it makes sense without the surface-detail line before it, since most learners read it alone. Without JavaScript, learners see every case in order with its choices, and each case's correct principle and both feedback lines sit behind an "Answer for case" disclosure. Checking, the score and the mixed-up pairs need JavaScript.

## Content fields

Authors write plain text. Rendering escapes HTML characters. Keep English and Canadian French examples together, with the same principle ids and answers.

| Field | Meaning |
| --- | --- |
| `title` | Card heading that names the task, at most 120 characters. |
| `context` | Optional. The learner's role, at most 400 characters. |
| `question` | The question asked of every case, at most 200 characters. |
| `principles` | Two to four principles, in the order the choices show them. |
| `principles[].id` | Unique id using letters, digits, underscores or hyphens, at most 60 characters. |
| `principles[].name` | Short name, unique, at most 60 characters. Feedback that quotes it exactly sets it in italics. |
| `principles[].rule` | When the principle applies and what to do, at most 120 characters. |
| `cases` | Three or four cases, in the order learners meet them. Each principle must be the answer to at least one. |
| `cases[].text` | The case, at most 300 characters. One or two lines. |
| `cases[].correct` | Id of the principle the case needs. |
| `cases[].lure` | Id of the principle its surface detail points to. It must differ from `correct`. |
| `cases[].looksLike` | The surface detail and the principle it points to, at most 150 characters. Shown only to a learner who chose `lure`. |
| `cases[].decides` | The fact that settles the case and what to do, at most 150 characters. Shown after every check. |

`validateContent` rejects unknown fields, blank strings, duplicate ids or names, unknown principle ids, a lure equal to the answer and a principle that answers no case. It makes the checks ordinary JSON Schema tools cannot, recorded as `x-uniqueBy`, `x-uniqueNames`, `x-principleReference`, `x-differsFrom` and `x-everyPrincipleCorrect`.

## Logic

`logic.js`, `strings.js` and the schema contain no DOM code. Hosts can build their own interface.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the first bad field. |
| `feedback(content, index, pick)` | `{ right, correct, looksLike, decides }` for one checked case. `looksLike` is `null` unless `pick` is that case's lure. Invalid picks and indexes throw. |
| `score(content, picks)` | `{ results, right, total, done }` for the checked cases. `picks` holds principle ids in case order. Invalid picks throw. |
| `mixedPairs(content, picks)` | `[{ first, second, count }]`, one entry per pair of principles confused in either direction, `first` before `second` in principle order. Most frequent first, then in principle order. Empty when every pick is right. |
| `quoteParts(content, text)` | `[{ text, principle }]`, splitting out each principle name the text quotes, so a host can set them in italics. |
| `principleName(content, id)` | The principle's name. |
| `validateState(content, value)` | Copied `{ picks }`, or `null` for invalid state. |
| `format(template, values)` | Placeholder substitution that keeps inserted text literal. |

Optional host `state: { read, write }` stores `{ picks }`, the principle ids of the cases checked so far. Each check and "Start over" write it. A choice that has not been checked stays in memory. Invalid saved values are ignored. A valid value opens the first unchecked case, or the last case with its feedback and the result when all are checked, without an announcement or a focus move. Without an adapter, answers last for the mounted instance.

Repeated `enhance` calls return the same instance. `destroy()` removes listeners, clears the answers and restores the no-JavaScript view without rebuilding the DOM.

## Use it

Copy `patterns/sort-by-principle/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/sort-by-principle/pattern.css`. Use a unique id prefix per instance.

```js
import { render } from './patterns/sort-by-principle/render.js';
import { enhance } from './patterns/sort-by-principle/enhance.js';
import { strings } from './patterns/sort-by-principle/strings.js';
import content from './patterns/sort-by-principle/examples/en.json' with { type: 'json' };

document.querySelector('main').innerHTML = render(content, strings.en, { id: 'feedback-talks', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern="sort-by-principle"]'), { content, strings: strings.en });
```

### Accessibility details

- Each case is a native radio group whose legend is the question. A choice's name holds the principle's name, then its rule. Arrow keys choose; Tab reaches "Check my answer".
- Checking with nothing chosen shows "Choose a principle" in the group, links it as the group's description and focuses the first option.
- Every check moves focus to the feedback under the choices. It starts with a visually hidden "Correct." or "Incorrect. Correct answer: …", then the feedback. The status region stays empty, so the result is read once. Tab goes on to "Next case".
- After the last case, focus still moves to its feedback, and the status region announces the score and each mixed-up pair once.
- "Next case" moves focus to the new case's heading, "Case 2 of 4". "Start over" moves focus to the first case's heading and announces "Answers cleared."
- Checked choices are disabled and keep their marks: "Correct", "Incorrect", or "Correct answer" on the correct principle the learner did not choose.
- A new case fades in over 200 ms, and appears at once under reduced motion. When it does not fit the view, the page scrolls it to the top.

## Adapt it with your agent

> Adapt the sort-by-principle examples to [topic] for [audience]. Keep `{ title, context, question, principles: [{ id, name, rule }], cases: [{ text, correct, lure, looksLike, decides }] }`. Write two to four principles whose one-line rules say when each applies, so they rule each other out. Write three or four cases of one or two lines, each with a fact that decides it and a surface detail that points to another principle, its lure. Each principle answers at least one case, the answers don't follow the order of the principles, and two cases with different surfaces share an answer. Check every wrong principle against its own rule. Write `decides` so it reads alone. Write English and Québec French together, using vous, with the same ids and answers. Preserve one case at a time, one try per case, the deciding fact after every check, the lure line only after the lure, the mixed-up pairs, saved state and the no-JavaScript answers. Update examples and tests. Show both languages for review.

## Related patterns

- [Change one detail](../change-one-detail/README.md) asks the same question of one case as one detail changes, to show where a rule stops applying. This pattern gives a different case each time with the same principles to choose from, so its result can name which principles the learner confuses.
- [Answer with confidence](../answer-with-confidence/README.md) and ["I don't know" as an answer](../dont-know/README.md) ask separate questions with their own options, so their results are per question, not per pair of rules.
- [Scenario talk-through](../conversation/README.md) follows one talk that branches on the learner's replies. Here each case is a separate situation.
- [Spot the misconception](../misconception/README.md) corrects a wrong belief. This pattern corrects a wrong choice between rules the learner already knows.

## Help improve this pattern

Tried it with learners? [Tell us what happened](https://github.com/Praxity/learning-patterns/issues/new?template=pattern-feedback.yml&pattern=Sort%20cases%20by%20principle). You can also [suggest a change to this page](https://github.com/Praxity/learning-patterns/edit/main/patterns/sort-by-principle/README.md).

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
