# Learning patterns

Small learning interactions you copy into your own project. MIT.

Each pattern has pure logic, server-rendered HTML, CSS and an optional DOM enhancer. Patterns use ES modules and have no runtime dependencies. They work in your own pages or in Astro at build time. Praxity Studio imports only `logic.js`, `content.schema.json` and `strings.js` and builds its own UI.

Pattern pages will live at [praxity.io/en/patterns/](https://praxity.io/en/patterns/).

## Use a pattern

Copy its folder under `patterns/` and the shared `lib/` folder. Keep their relative paths. Include the pattern's CSS, call `render` on the server, then call `enhance` in the browser. See the pattern's README for the content shape and example.

## Run the demos

With Node 22, run `npm ci` and `npm run demo`, then `node scripts/serve-demo.mjs` and open http://127.0.0.1:4173. Every pattern has an English page, a French page and a page with two copies of the pattern. AI patterns use fixed feedback in this build. To put the pages online with live AI feedback, set up the proxy as [proxy/README.md](proxy/README.md) describes and set your own `name` in `wrangler.jsonc`. Then sign in with `npx wrangler login` and run `npm run preview:deploy`, which builds with `npm run demo:live` and deploys to your Cloudflare account.

## Patterns

| Pattern | What it does |
| --- | --- |
| [Check your own answer](patterns/self-check/README.md) | Write an answer, tick the parts it includes, then see a hint for each part you missed and a model answer. |
| [Explain it back](patterns/explain-back/README.md) | Explain a short lesson, check its three key ideas, then reread the parts to add. |
| ["I don't know" as an answer](patterns/dont-know/README.md) | Multiple choice where "I don't know" scores zero and a wrong answer costs a point, so guesses don't hide gaps. |
| [Questions inside the reading](patterns/review-prompts/README.md) | Short recall questions between sections of text, each with a next review date. |
| [Printable retrieval sheet](patterns/retrieval-sheet/README.md) | Print questions on the front and answers on the back to test yourself on a chosen date, with no connection needed. |
| [Highlight the passage](patterns/highlight/README.md) | Mark the parts of a passage that answer a question, or its key ideas, then compare with the author's choices in place. |
| [Your first answer comes back](patterns/first-answer/README.md) | Save an answer at the start of a course and compare it with a new one at the end. |
| [Test out of sections](patterns/test-out/README.md) | A short placement check marks which sections of a course you can skip; passing an advanced section credits the sections it builds on. |
| [Write the wrong options](patterns/write-distractors/README.md) | Answer a question, write wrong options and the misconception behind each, then compare with the author's. |

## Look and theme tokens

`lib/base.css` gives every pattern the same look: one card per activity, quiet sections inside it, keyed choice rows, and status shown by an icon and a word as well as colour. Link it before a pattern's own CSS. To restyle, override these custom properties on `.lp` or any ancestor.

| Token | Default | Use |
| --- | --- | --- |
| `--lp-paper`, `--lp-paper-2` | `#fff`, `#f7f8fa` | Card; quiet panels and read-only fields |
| `--lp-ink`, `--lp-ink-2` | `#16181d`, `#555c67` | Text and secondary text |
| `--lp-line` | `#868d98` | Control borders (3:1 or more) |
| `--lp-line-mid`, `--lp-rule` | `#d5d9df`, `#e6e8ec` | Choice rows; card border and section rules |
| `--lp-accent`, `--lp-accent-ink`, `--lp-accent-soft` | `#2c55c9`, `#1c3c94`, `#eef2fd` | Primary button, selection and focus; text on tints; selection tint |
| `--lp-on-accent` | `#fff` | Text on the accent |
| `--lp-success-ink`, `--lp-success-soft` | `#12704f`, `#e6f4ee` | Correct and included |
| `--lp-error-ink`, `--lp-error-soft` | `#b42318`, `#fdeceb` | Wrong answers and errors |
| `--lp-warning-ink`, `--lp-warning-soft` | `#a24a07`, `#fdf1e4` | Missed or to add |
| `--lp-focus` | the accent | Focus ring |
| `--lp-font-body`, `--lp-font-heading` | Source Sans 3, then system sans | All text |
| `--lp-type-small`, `--lp-type-body`, `--lp-type-h3` | 15, 17 and 21 px | Type sizes |
| `--lp-radius-box`, `--lp-radius-control` | 16 and 10 px | Corners |
| `--lp-shadow` | a soft two-layer shadow | Cards only |

Fonts are not bundled. Load Source Sans 3 yourself, or set the font tokens to your own.

## Accessibility baseline

Every pattern follows this shared baseline. The [browser tests](tests/browser/) run in Chromium, WebKit and Firefox, as set in the [Playwright configuration](playwright.config.js).

- Automated axe checks cover WCAG 2.2 AA rules, including the WCAG 2.0 and 2.1 rules, at the interaction's tested stages.
- Keyboard journeys check the learner's steps, errors and focus.
- One empty status region is present at load. Each result is announced once through that region or a prescribed focus move; tests check status updates and focus without duplicate speech.
- Layout checks use 320 CSS pixels, equivalent to reflow at 400% zoom from a 1280-pixel viewport. They apply WCAG 1.4.12 text spacing and check for overflow and clipped text.
- Forced-colour checks in Chromium check visible controls, marks and keyboard focus.
- Shared styles remove transitions and animations under reduced motion. Patterns with scripted view changes also check that setting.
- Every pattern has a working version without JavaScript. Its README describes which steps remain available.
- English and French content, labels and feedback have checks in both languages.

Automated checks cover only part of accessibility. Screen reader passes with VoiceOver and NVDA are not yet done.

## Licence

[MIT](LICENSE). Keep the licence notice with copied code.
