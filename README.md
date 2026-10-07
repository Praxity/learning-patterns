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

## Theme tokens

Every pattern uses the same custom properties. Override them on a pattern's root (`.lp-<name>`) or on any ancestor.

| Token | Default |
| --- | --- |
| `--lp-text` | `#202124` |
| `--lp-muted` | `#50555a` |
| `--lp-surface` | `#fff` |
| `--lp-border` | `#62676c` |
| `--lp-accent` | `#174f78` |
| `--lp-on-accent` | `#fff` |
| `--lp-error` | `#9f2020` |
| `--lp-focus` | `#005fcc` |
| `--lp-space` | `1rem` |
| `--lp-radius` | `.25rem` |
| `--lp-font` | System font stack |
| `--lp-font-size` | `1rem` |
| `--lp-line-height` | `1.5` |

## Licence

[MIT](LICENSE). Keep the licence notice with copied code.
