---
title: Estimate magnitude
title_fr: Estimez l'ordre de grandeur
summary: Slide a range until it holds your estimate, then see which answers your ranges caught.
section: question
ai: no
offline: yes
learners: not tried
---
# Estimate magnitude

Slide a range until it holds your estimate, then see which answers your ranges caught.

## Use it when

- Learners estimate costs, durations or counts at work and tend to give one confident number.
- Getting the size right matters more than the exact figure: tens, hundreds or thousands.

## Avoid it when

Use another interaction for quantities below one or when learners need an exact answer.

## How it works

1. Read the context and three to five questions.
2. Move each band with the arrow keys, Home or End. You can also tap the track or drag the band.
3. Select "Check my ranges" to see each real answer on its track, with its source and "Caught" or "Missed" feedback.
4. Read how many answers your ranges caught. Select "Try again" to reset all ranges.

By default, every band spans ten times its low end, such as 50 to 500. Authors can set the ratio to 10, 100 or 1,000. The ratio stays fixed while learners move their bands. A width control is later work for courses that also want to practise choosing how wide a range should be.

## Evidence

This interaction has not been tested with learners. Its score counts answers inside fixed ranges. It does not measure how well learners choose a range's width or estimate their own uncertainty.

People's ranges for a quantity are often too narrow for how sure they say they are ([Soll and Klayman, 2004](https://doi.org/10.1037/0278-7393.30.2.299)). This pattern fixes the width to practise order of magnitude.

The sample figures and records are made up. The quantities can be reasoned toward from 120 staff, about 3% off sick, about one support ticket each month and about one cup each working day.

## Accessibility

Follows the shared baseline in the root README.

- Each question has a fieldset and legend. The legend names the group. Its band is a button with slider semantics and its own short name, "Range for question 1", so screen readers say the question once and lists of controls tell the bands apart.
- Arrow keys move one stop. Home and End select the first and last bands. Track taps provide an alternative to dragging.
- `aria-valuetext` gives both bounds and the unit. After checking, it also gives the answer and whether it was caught or missed.
- Each range must be deliberately set before checking, so the middle starting position is not a hint. Missing ranges get linked errors; focus stays on Check.
- Feedback uses words and icons as well as colour. One status region announces validation, the summary or the reset once. Slider changes use their value semantics.
- Check moves focus to Try again through the shared lock helper. Try again restores the existing controls and focuses the first band after layout.
- Forced colours preserve tracks, bands, answer markers and focus outlines. There is no animation; shared reveal scrolling respects reduced motion.
- CSS keeps labels inside the track as it resizes. Range labels use the midpoint of the band's low and high positions; answer labels use the answer's position. Labels shift toward the track's middle near either end, while each answer diamond stays centred on its value.

## Content fields

Content is plain text. Rendering escapes HTML characters. Keep English and Québec French examples together.

| Field | Meaning |
| --- | --- |
| `title` | Task name in the scene header, up to 120 characters. |
| `context` | What learners know before estimating, up to 1,500 characters. |
| `ratio` | Optional high-to-low ratio for every band: 10, 100 or 1,000. Defaults to 10. |
| `questions` | Three to five questions in display order. |
| `questions[].question` | Question legend, up to 400 characters. |
| `questions[].unit` | Unit after the range and answer, up to 120 characters. |
| `questions[].answer` | Finite number from 1 through 1e12. Fractions above one are allowed. |
| `questions[].source` | Source shown with the answer, up to 1,500 characters. |

Required strings must contain visible text. Unknown fields are rejected. Choose quantities a newcomer can reason toward from the context, such as staff numbers or working days.

## Logic

`logic.js` contains pure validation, scale generation and scoring. Studio can import it without a DOM.

| Export | Returns |
| --- | --- |
| `validateContent(content)` | Nothing. Throws an `Error` naming the bad field. |
| `scaleFor(content)` | `{ stops, bands, start, ratio }`. Integer stops follow 1, 5, 10, 50 and so on, ending at the first stop at least `ratio` times the largest answer. Bands are `[low, high]` values; `start` is the middle band's index. |
| `bandsFor(stops, ratio = 10)` | `[low, high][]`, starting at each stop and ending at the furthest stop within the ratio. Pass generated integer stops and a ratio of 10, 100 or 1,000. Generated scales always give full bands. Invalid ratios throw. |
| `positionOf(value, stops)` | Percentage along the logarithmic scale. Pass positive values and generated stops. |
| `score(content, ranges)` | `{ count, total, items }`. Each item is `{ low, high, answer, relation }`, with relation `inside`, `below` or `above`. Both boundaries count as inside. `ranges` contains one valid band index per question. Invalid ranges throw. |
| `validateState(content, value)` | Copied `{ ranges, touched, shown }` or `null`. Checked state requires every range to be touched. Untouched ranges must be at the starting band. |

`render.js` also exports `format(template, values)`, which replaces known placeholders once, and `numberText(value, lang)`, which formats numbers in English or Canadian French.

Without JavaScript, the task, context and question legends remain readable while "Answers" is closed. Open it to read each answer, unit and source. Slider instructions, sliders and Check stay hidden.

Optional `state: { read, write }` stores `{ ranges, touched, shown }`. Range indexes and touched flags follow question order. Keep the content unchanged while reusing state. Invalid saved values are ignored. Saved results restore silently without moving focus. Setting a range, checking and resetting write state. Host state errors propagate.

Repeated enhancement returns the same instance. `destroy()` removes listeners, cancels pending focus, unlocks controls, clears results and restores the native answer disclosure.

## Use it

Copy `patterns/estimate-magnitude/` and `lib/`, keeping relative paths. Link `lib/base.css`, then `patterns/estimate-magnitude/pattern.css`. Give each instance a unique id prefix.

```js
import { render } from './patterns/estimate-magnitude/render.js';
import { enhance } from './patterns/estimate-magnitude/enhance.js';
import { strings } from './patterns/estimate-magnitude/strings.js';
import content from './patterns/estimate-magnitude/examples/en.json' with { type: 'json' };

// Render on the server. Enhance the resulting section in the browser.
const markup = render(content, strings.en, { id: 'office', lang: 'en' });
const instance = enhance(document.querySelector('[data-lp-pattern="estimate-magnitude"]'), { content, strings: strings.en });
```

## Adapt it with your agent

> Adapt the Estimate magnitude examples for [topic] and [audience]. Keep `{ title, context, ratio, questions: [{ question, unit, answer, source }] }`, with optional `ratio` defaulting to 10. Write three to five questions with quantities from 1 through 1e12, using context a newcomer can reason from. Supply each real answer and source. Keep the fixed-ratio bands, logarithmic stops, keyboard and pointer controls, sources, no-JS answers, state and Try again. Write English and Québec French together, using vous. Update examples and tests. Show both languages for review.

## Licence

MIT. Keep the [licence notice](../../LICENSE) with copied code.
