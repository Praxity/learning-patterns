# Learning blocks

Small learning interactions you copy into your own project. MIT.

Each block has pure logic, server-rendered HTML, CSS and an optional DOM enhancer. Blocks use ES modules and have no runtime dependencies. They work in your own pages, in Astro at build time, or in a course compiler with learner state supplied by the host.

## Use a block

Copy its folder under `blocks/` and the shared `lib/` folder. Keep their relative paths. Include the block's CSS, call `render` on the server, then call `enhance` in the browser. See the block's README for the content shape and example.

## Blocks

| Block | What it does |
| --- | --- |
| [Self-check](blocks/self-check/README.md) | Compare your written answer with an authored checklist and model answer. |

## Theme tokens

Override these custom properties on `.lb-self-check`.

| Token | Default |
| --- | --- |
| `--lb-text` | `#202124` |
| `--lb-muted` | `#50555a` |
| `--lb-surface` | `#fff` |
| `--lb-border` | `#62676c` |
| `--lb-accent` | `#174f78` |
| `--lb-on-accent` | `#fff` |
| `--lb-error` | `#9f2020` |
| `--lb-focus` | `#005fcc` |
| `--lb-space` | `1rem` |
| `--lb-radius` | `.25rem` |
| `--lb-font` | System font stack |
| `--lb-font-size` | `1rem` |
| `--lb-line-height` | `1.5` |

## Licence

[MIT](LICENSE). Keep the licence notice with copied code.
