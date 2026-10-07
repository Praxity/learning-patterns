# Learning patterns

Small learning interactions you copy into your own project. MIT.

Each pattern has pure logic, server-rendered HTML, CSS and an optional DOM enhancer. Patterns use ES modules and have no runtime dependencies. They work in your own pages or in Astro at build time. Praxity Studio imports only `logic.js`, `content.schema.json` and `strings.js` and builds its own UI.

Pattern pages will live at [praxity.io/en/patterns/](https://praxity.io/en/patterns/).

## Use a pattern

Copy its folder under `patterns/` and the shared `lib/` folder. Keep their relative paths. Include the pattern's CSS, call `render` on the server, then call `enhance` in the browser. See the pattern's README for the content shape and example.

## Patterns

| Pattern | What it does |
| --- | --- |
| [Check your own answer](patterns/self-check/README.md) | Write an answer, tick the parts it includes, then see a hint for each part you missed and a model answer. |
| ["I don't know" as an answer](patterns/dont-know/README.md) | Multiple choice where "I don't know" scores zero and a wrong answer costs a point, so guesses don't hide gaps. |
| [Questions inside the reading](patterns/review-prompts/README.md) | Short recall questions between sections of text, each with a next review date. |
| [Your first answer comes back](patterns/first-answer/README.md) | Save an answer at the start of a course and compare it with a new one at the end. |
| [Write the wrong options](patterns/write-distractors/README.md) | Write wrong options for a question, tag the misconception behind each, and compare with the author's. |

## Look and theme tokens

`lib/base.css` gives every pattern the same plain course look: one bordered box per activity, sections split by space and a rule, status shown by an icon and a word as well as colour. Link it before a pattern's own CSS. To restyle, override these custom properties on `.lp` or any ancestor.

| Token | Default | Use |
| --- | --- | --- |
| `--lp-paper` | `#fff` | Page and activity background |
| `--lp-paper-2` | `#f4f5f7` | Read-only fields |
| `--lp-ink` | `#1b1e23` | Text |
| `--lp-ink-2` | `#4a505a` | Secondary text |
| `--lp-line` | `#7d838d` | Control borders (3:1 or more) |
| `--lp-rule` | `#d7dae0` | Activity box and section rules |
| `--lp-accent` | `#1d3d6b` | Primary button, selection, focus |
| `--lp-on-accent` | `#fff` | Text on the accent |
| `--lp-success-ink` | `#146c43` | Correct and included |
| `--lp-error-ink` | `#a3262c` | Wrong answers and errors |
| `--lp-focus` | the accent | Focus ring |
| `--lp-font-body` | Source Sans 3, then system sans | Body text |
| `--lp-font-heading` | Source Serif 4, then Georgia | Question stems |
| `--lp-type-small`, `--lp-type-body`, `--lp-type-h3` | 15, 19 and 24 px | Type sizes |
| `--lp-radius-box`, `--lp-radius-control` | 8 and 6 px | Corners |

Fonts are not bundled. Load Source Sans 3 and Source Serif 4 yourself, or set the font tokens to your own.

## Licence

[MIT](LICENSE). Keep the licence notice with copied code.
