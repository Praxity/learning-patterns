---
title: Split by proportion
title_fr: Répartir un total
summary: Split a fixed total across a few options by dragging the dividers on one bar, then compare your split with the real one.
section: question
ai: no
offline: yes
learners: not tried
---
# Split by proportion

Split a fixed total across two to six options by moving dividers on one bar. Compare your split with the real one.

## Use it when

- The answer is a mix, such as where complaints, costs or errors come from.
- Learners should spread their confidence across several outcomes instead of betting on one.
- Learners set priorities within a fixed budget of time or money.

## Avoid it when

Use separate questions when the values do not share one total. Supply enough context for a learner to make an informed estimate.

## Setting it up

Write two to six options and the real split, with its source. Choose the total, unit, step and largest gap that counts as close. The total can be 100%, 10 points or a 40-hour week. The example's figures are made up.

Write the option-column heading for your topic, such as "Cause" or "Work". English labels are lowercased in the summary; start them with a common noun and avoid acronyms or proper names that need their original capitals. French summaries quote labels as authored.

## How it works

1. Drag a divider or tap the bar to move the nearest divider. A divider pushes any neighbours in its way.
2. With a keyboard, Tab to a divider. Arrow keys move by one step; Home and End move to the ends of the bar.
3. Select "Check my split". Two bars and a table compare your split with the real one. A one-line summary names the largest gap, or an exact match. Answers lock.
4. Select "Try again" to restore the near-equal starting split and focus the first divider.

## Evidence

This pattern makes a learner's estimate visible before revealing the answer. It has not been tested with learners. A close estimate does not establish mastery.

## Accessibility

Follows the shared baseline in the root README. Every divider is a native, labelled range input. Its value text names the adjacent options and every option a push changes. Slider changes use that native announcement alone; check and reset use one status region. Pointer tapping provides an alternative to dragging. Letters, outlines, names and numbers accompany colour. The table is the legend and text equivalent of the charts. Focus moves through the shared locking and layout helpers. Saved results restore silently.

The layout wraps at 320px. Forced colours retain segment boundaries, letters and the focus ring. Reveals are immediate; the shared reveal helper respects reduced motion when scrolling.

Without JavaScript, the question, context and option labels remain visible so learners can form an estimate. Learners can open "Compare with the real split" for a table of all real values and the source. Interactive controls and starting shares stay hidden.

## Content fields

All text is plain text and escaped on render. Keep English and Canadian French examples together.

| Field | Meaning |
| --- | --- |
| `title` | Scene title, at most 120 characters. |
| `context` | Situation, at most 1,500 characters. |
| `question` | Task legend, at most 400 characters. |
| `resultTitle` | Heading above the comparison, at most 120 characters. |
| `optionHeading` | Required option-column heading for both tables, at most 60 characters. |
| `source` | Source of the real split, at most 1,500 characters. |
| `total` | Positive finite total in the chosen unit. |
| `unit` | Unit suffix, at most 120 characters. `%` attaches to the number in English. |
| `unitOne` | Optional unit suffix for exactly 1, at most 120 characters, such as `hour` when `unit` is `hours`. Defaults to `unit`. |
| `step` | Positive finite increment dividing the total into a safe integer number of steps. |
| `close` | Largest absolute option gap counted as close, from zero to the total, inclusive. |
| `options` | Two to six options in bar order. |
| `options[].label` | Unique nonblank label, at most 300 characters. |
| `options[].share` | Real amount, from zero to the total. All amounts must sum to the total. |

`validateContent` enforces cross-field constraints, finite numbers, nonblank text and unknown-field rejection. Standard schema validators enforce local limits; the `x-divides`, `x-maximumField`, `x-uniqueBy` and `x-sum` annotations require `validateContent`. Real shares need not be multiples of the learner's step.

## Logic

`logic.js`, `strings.js` and the schema contain no DOM code.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing; throws an Error naming the invalid field. |
| `initialDividers(content)` | Divider positions rounded to the nearest step for a near-equal split. |
| `shares(content, dividers)` | Option amounts totalling `content.total`. |
| `moveDivider(content, dividers, index, value)` | New positions, snapped to step and clamped to the total, pushing neighbours. |
| `compare(content, dividers)` | `{ mine, real, gaps, biggest, exact, close }`. `biggest` is the first option with the largest absolute gap; the close boundary is inclusive. Rejects invalid positions. |
| `validateState(content, value)` | Independent `{ dividers, touched, shown }` copy or `null`. Rejects unordered, out-of-range and off-step dividers, and shown results without a move. |
| `format(template, values)` | Placeholder substitution preserving inserted text literally. |
| `quantity(value, content, lang)` | Localized number and authored unit, using `unitOne` for exactly 1 when present. |

Divider arrays contain one fewer value than options. Use validated content and valid positions with `shares` and `moveDivider`. A successful move counts as touched even if later moves return to the starting split.

Optional host `state: { read, write }` stores `{ dividers, touched, shown }`. Moves, check and Try again write state. Invalid saved values are ignored. State errors propagate. Repeated enhancement returns the same instance; `destroy()` removes listeners, cancels pending focus, unlocks controls and restores the no-JavaScript answer disclosure without rebuilding the DOM.

## Use it

Copy `patterns/split-by-proportion/` and `lib/`, keeping relative paths. Link `lib/base.css` before `patterns/split-by-proportion/pattern.css`. Use a unique id prefix per instance.

```js
import { render } from './patterns/split-by-proportion/render.js';
import { enhance } from './patterns/split-by-proportion/enhance.js';
import { strings } from './patterns/split-by-proportion/strings.js';
import content from './patterns/split-by-proportion/examples/en.json' with { type: 'json' };

document.querySelector('main').innerHTML = render(content, strings.en, { id: 'tickets', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

Pattern colour tokens `--lp-split-by-proportion-a` through `--lp-split-by-proportion-f` provide six brand colours without requiring host brand variables. Rose and purple are slightly lighter to keep at least 8.4:1 contrast with the default ink. Keep ink text contrast and segment outlines when overriding them.

## Adapt it with your agent

> Adapt the examples to [topic] for [audience]. Keep the content fields and two to six options. Cite the source of the real split. Choose a total, unit, step and close threshold that fit the task. Keep every real share nonnegative and the sum equal to the total. Write English and Canadian French together using vous. Preserve divider pushing, tap and keyboard access, the no-JavaScript answer table, one status region, saved state and reflow.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
