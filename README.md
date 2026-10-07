# Learning patterns

Small learning interactions you copy into your own project. MIT.

Each pattern has pure logic, server-rendered HTML, CSS and an optional DOM enhancer. Patterns use ES modules and have no runtime dependencies. They work in your own pages or in Astro at build time. Praxity Studio imports only `logic.js`, `content.schema.json` and `strings.js` and builds its own UI.

Pattern pages will live at [praxity.io/en/patterns/](https://praxity.io/en/patterns/).

## Use a pattern

Copy its folder under `patterns/` and the shared `lib/` folder. Keep their relative paths. Include the pattern's CSS, call `render` on the server, then call `enhance` in the browser. See the pattern's README for the content shape and example.

## Patterns

| Pattern | What it does |
| --- | --- |
| [Self-check](patterns/self-check/README.md) | Compare your written answer with an authored checklist and model answer. |

## Theme tokens

Override these custom properties on `.lp-self-check`.

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
