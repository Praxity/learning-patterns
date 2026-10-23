---
title: Draw your guess
title_fr: Tracez votre estimation
summary: Set the next few points of a line chart, then see the real line over your guess.
section: question
ai: no
offline: yes
learners: not tried
---
# Draw your guess

Set the next few points of a line chart, then see the real line over your guess.

## Use it when

- The lesson turns on a trend, such as what happened after a change, a launch or a new rule.
- Learners tend to expect a straight line where the real one bends or levels off.

## Avoid it when

Use another interaction when exact numeric accuracy matters more than the shape of the trend. This pattern compares the direction of the guess and gives authored feedback, without a numeric grade.

## Setting it up

Write the question, unit, known points and real values for the points to guess, with their source. Use three to six known points and three to six points to guess. Set the scale's top and step, then explain why the real line has its shape. Write one comparison message for each possible guess trend.

## How it works

1. Read the context and known points.
2. Tap a month's column to set its point, or drag across the columns. With a keyboard, tab to each month and use the arrow keys. Home and End reach the bottom and top of the scale.
3. Select "Show the real line" after setting every point.
4. Compare your dashed line and circles with the solid real line and squares. Read the explanation and summary.
5. Select "Try again" to clear your guesses.

## Evidence

This sequence has not been tested with learners. The example's figures are made up. A similar line shape does not establish an accurate numeric prediction.

## Accessibility

Follows the shared baseline in the root README.

- Each month to guess has a named native range input. Its value text says whether it is set and, after checking, gives the guess and real value with the unit.
- The focused month has a 3 px ring around its column. Tapping offers an alternative to dragging.
- Known points and the final comparison also have visually hidden text. Squares and a solid line distinguish real values from circles and a dashed guess line, including in forced colours.
- One status region announces validation errors, the final summary and reset. Native sliders announce their own changes; the status region does not repeat them.
- Checking locks the response and moves focus to Try again. Try again restores focus to the first month after layout. Saved state restores silently.
- The chart scales with the available width. Reveals are immediate; the shared reveal helper respects reduced motion when scrolling.

## Content fields

All text is plain text. Rendering escapes HTML characters. Keep English and Canadian French examples together, using vous in French.

| Field | Meaning |
| --- | --- |
| `title` | One scene title. |
| `context` | The situation before the question. |
| `question` | The fieldset legend. |
| `unit` | Unit used in slider descriptions and the fallback table. |
| `known`, `future` | Three to six points each, in display order. Future points hold the real answers. |
| `known[].label`, `future[].label` | Short axis label. |
| `known[].name`, `future[].name` | Full accessible name and fallback row label. |
| `known[].value`, `future[].value` | Finite real value between zero and `top`. Real values need not be multiples of `step`. |
| `top` | Positive safe integer at the top of the scale. The bottom is zero. |
| `step` | Positive safe integer that divides `top`. Guesses use this increment. |
| `changeLabel` | Label over the shaded region where guessing starts. |
| `realLabel` | Real-series legend and fallback caption. |
| `resultTitle` | Heading above the revealed explanation. |
| `explanationLabel`, `explanation` | Explanation's run-in label and body. |
| `source` | Source of the real values. |
| `feedback` | Six complete authored summaries, keyed by `changedDirection`, `fell`, `rose`, `flat`, `fellThenFlat` and `roseThenFlat`. |

Titles and labels allow 120 characters, the question 400, and context, explanation, source and each summary 1,500. Required text cannot be blank. Unknown fields are rejected. The schema's `x-maximumField` and `x-dividesField` annotations describe cross-field rules that require `validateContent`; ordinary schema validators do not enforce them.

## Logic

`logic.js`, `strings.js` and the schema have no DOM code. Studio can use them independently.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an Error naming the invalid field. |
| `snap(content, value)` | Guess rounded to the nearest step and clamped to zero through `top`. Half steps round up. Non-finite input throws. Pass validated content. |
| `x(i, count)`, `y(value, top)` | Horizontal point centre and vertical position, as fractions of plot width and height. Vertical positions are measured from the top. |
| `compare(content, guesses)` | `{ trend, summary, differences }`. Summary is the authored message for the trend. Differences are guess minus real value, in future-point order. Incomplete or off-step guesses throw. |
| `validateState(content, value)` | Copied `{ guesses, shown }` or `null`. Unset guesses are `null`; shown state requires every point. Pass validated content. |
| `format(template, values)` | String with known placeholders replaced once; inserted text stays literal. |
| `trends` | The six supported comparison keys in the order listed above. |

Trend comparison starts at the last known point. Both positive and negative changes mean `changedDirection`. All zero changes mean `flat`. Otherwise the line rose or fell; a final zero change adds `ThenFlat`. Real values supply the overlay and signed differences; authors describe their shape in the six feedback messages. The sample keeps "fell then levelled off" for the gradual flattening of its real line.

The guess line stops at the first unset point, while each set point remains visible. An untouched slider starts at the last known value, snapped to the step, so the first arrow press moves from there. Real squares draw after guess circles so matching values remain distinguishable. Axis ticks use multiples of the authored step, including zero and the scale's top. Displayed numbers use `Intl.NumberFormat` with `fr-CA` for French and `en-CA` otherwise, preserving real-value precision.

Without JavaScript, learners see the context and known line. Open "Show the real values" for all known and future values, the explanation and source. JavaScript-dependent controls stay hidden.

Optional `state: { read, write }` stores `{ guesses: (number | null)[], shown: boolean }`. Invalid saved values are ignored. Input, check and Try again write state; host errors propagate. Repeated enhancement returns the same instance. `destroy()` removes listeners, cancels focus moves, unlocks controls and restores the native answer disclosure. Try again resets the existing DOM.

## Use it

Copy `patterns/draw-your-guess/` and `lib/`, keeping their relative paths. Link `lib/base.css`, then `patterns/draw-your-guess/pattern.css`. Use a unique id prefix for each instance.

```js
import { render } from './patterns/draw-your-guess/render.js';
import { enhance } from './patterns/draw-your-guess/enhance.js';
import { strings } from './patterns/draw-your-guess/strings.js';
import content from './patterns/draw-your-guess/examples/en.json' with { type: 'json' };

// Render on the server; enhance its existing markup in the browser.
document.querySelector('main').innerHTML = render(content, strings.en, { id: 'prediction', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern]'), { content, strings: strings.en });
```

## Adapt it with your agent

> Adapt the draw-your-guess examples for [topic] and [audience]. Keep the content fields above, with three to six known points and three to six future points. Provide a source and enough context to make a prediction. Write all six feedback messages about the real trend. Keep English and Canadian French together, using vous in French. Preserve keyboard and pointer input, state, the native answer disclosure, one summary announcement and reflow. Update examples and tests.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
