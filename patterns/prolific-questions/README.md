---
title: Prolific questions
title_fr: Des questions pour continuer à s'exercer
summary: Answer a multi-part knowledge check on a scenario, example or set of statements, then take another set whenever you want.
section: question
ai: no
offline: yes
learners: not tried
---
# Prolific questions

Answer several questions about one case, check your answers, then take another set whenever you want.

## Use it when

- Learners need to answer several questions about each scenario, example or set of statements.
- You can write many cases for the same multi-part knowledge check, so learners can take as many as they want.

## Avoid it when

Use a scored assessment when learners need a pass decision. This activity keeps a running count of sets and correct answers.

## Setting it up

Name the parts and define each in one line. Write a worked example and at least eight complete cases, with one fact for each part in the same order. Each fact names its person so it makes sense when shuffled. The sample practises the WHO's International Classification of Functioning model.

Practice follows the worked example, because novices need a few similar cases before variety helps. All facts and answers are authored.

## How it works

1. Read the worked example and definitions.
2. Choose a part for each shuffled fact, then select "Check".
3. Read the marks and running count. A wrong choice also reveals the correct part.
4. Select "New set" to continue. Every case appears once before any repeats, including across saved sessions. Consecutive sets always use different cases.

Checking freezes only the current answers. New set remains available, with no pass score or completion gate. It clears the answers and marks for the next case without rebuilding the DOM, preserving the running count.

## Evidence

Learners with less prior knowledge learned a math concept better from similar examples. Pretraining on the concept's structure let them benefit from varied ones ([Braithwaite and Goldstone, 2015](https://doi.org/10.1080/07370008.2015.1067215)). The worked example plays that role here. The study did not test this pattern.

The running count records correct placements, without a mastery claim. This pattern has not been tested with learners.

## Accessibility

Follows the shared baseline in the root README.

- Native radio groups have a legend for each fact. Arrow keys change the selected part; Tab moves between groups and actions.
- Missing-answer errors describe unanswered groups and announce once, keeping focus on Check.
- Check moves focus to New set before hiding the action. New set focuses the first answer of the new set after layout settles, inside its fact's group, and scrolls that fact into view. Whether a screen reader also repeats the question depends on the reader and its settings. Restoring checked answers leaves focus where it is.
- One status region announces each result. Marks use words, icons and borders. New set clears the old announcement; the focused first answer and its fact introduce the new set.
- Choices stack in narrow containers. Forced colours retain native radios. Reveals are immediate, with shared reduced-motion support.

Without JavaScript, the worked example and source context remain readable. A native "Answers" disclosure lists every case with its part labels. Practice controls stay hidden.

## Content fields

All text is plain text and escaped at render time. English and Canadian French examples stay together.

| Field | Meaning |
| --- | --- |
| `title` | Scene title, up to 120 characters. |
| `context` | Context and source, up to 1,500 characters. |
| `question` | The multi-part question, up to 400 characters. |
| `parts` | At least two parts, in answer-key order. |
| `parts[].label` | Unique part name, up to 120 characters. |
| `parts[].definition` | One-line definition, up to 160 characters. |
| `workedExample` | One fact per part in part order, up to 400 characters each. |
| `cases` | At least eight complete arrays of facts. Each has one fact per part in part order, up to 400 characters each. |

`validateContent` rejects unknown fields, blank text, duplicate labels and incomplete cases. The schema's `x-uniqueBy` and `x-lengthFrom` annotations describe cross-field rules enforced by `validateContent`; ordinary JSON Schema validators do not enforce them. Authors ensure facts name their person and match the intended part.

## Logic

`logic.js` and `strings.js` have no DOM code or runtime dependencies.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an Error naming the invalid field. |
| `shuffle(values, random = Math.random)` | A shuffled copy. Random must return a value from 0 inclusive to 1 exclusive. |
| `deal(caseCount, previous = { deck: [], last: -1 }, random = Math.random)` | `{ deck, last }`. `last` is the new case index; `deck` contains remaining indices. Requires at least two cases. Rejects duplicate, out-of-range or inconsistent deck entries. Does not mutate the previous deck. |
| `score(order, picks)` | `{ right, total, unanswered }`. `order` is a permutation of part indices in displayed fact order. Picks are part indices or `null`; `unanswered` contains displayed fact indices. Invalid permutations or picks throw. |
| `feedback(strings, { right, total, completed, placed })` | `{ summary, announcement }` for a checked set. Chooses singular and plural wording independently for the set count, current answers and cumulative placements. |
| `validateState(content, value)` | Copied learner state or `null` for invalid state. |

Optional `state: { read, write }` stores `{ deck, last, order, picks, checked, completed, placed }`. Counts include the current set only when checked. Partial answers, the remaining deck and checked results restore silently. Initial dealing, answer changes, checks and new sets write snapshots. Host state errors propagate.

Repeated enhancement returns the same instance. `destroy()` removes listeners, cancels pending focus, clears marks, restores controls and shows the native answers. Destroying an old instance again leaves any newer instance alone.

## Use it

Copy `patterns/prolific-questions/` and `lib/`, preserving relative paths. Link `lib/base.css`, then `patterns/prolific-questions/pattern.css`. Give each instance a unique id prefix.

```js
import { render } from './patterns/prolific-questions/render.js';
import { enhance } from './patterns/prolific-questions/enhance.js';
import { strings } from './patterns/prolific-questions/strings.js';
import content from './patterns/prolific-questions/examples/en.json' with { type: 'json' };

document.querySelector('main').innerHTML = render(content, strings.en, { id: 'practice', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

## Adapt it with your agent

> Adapt prolific-questions to [topic] for [audience]. Keep `{ title, context, question, parts: [{ label, definition }], workedExample: [], cases: [[]] }`. Write a complete worked example and at least eight complete cases, each with one fact per part in part order. Use 160 characters or fewer per definition. Name the person in every fact. Write English and Canadian French together, using vous. Preserve the worked example first, shuffled facts, fair dealing, local marks, running count, saved state, no-JS answers and narrow-screen layout.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
