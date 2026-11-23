# 0005: Components

## Status

Accepted on 2026-11-22.

2026-11-22, owner: renamed these parts to components (French: composants), a term designers and developers already know.

## Context

Praxity distributes copy-in components instead of a course builder (owner, 2026-11-21). Patterns are whole learning interactions. Course authors and their AI agents also need the smaller parts the patterns are built from, so they can build their own activities and course pages in the same look. Those parts already exist in `lib/base.css`, a few `lib/` helpers and markup repeated across pattern renderers, but nothing documents them as parts to copy.

## Decision

- A component is a documented part, not a module. Each `components/<name>/` folder holds `README.md`, `README.fr.md`, `en.html` and `fr.html`, and `component.css` only when `lib/base.css` lacks the styles it needs.
- The examples are static pages that work without JavaScript. They link `../../lib/base.css`, use only `lp` classes and copy their icons unchanged from `lib/icons.js`. The English and French pages have the same structure.
- Components hold no logic: no grading, scoring or saving. Where a script is needed, the README names the existing `lib/` helper (`choice-mark.js`, `lock.js`, `reveal.js`) and the copy imports it relatively. No helper is copied into a component folder.
- Where patterns already render a part, the component documents the markup the patterns use. Changing the patterns to match a component is separate work.
- `component.css` uses the same `lp-<name>` prefix rule as `pattern.css`, so a class says which file owns it.
- The README front matter has `title`, `title_fr` and `summary`. `readComponentMeta` in `scripts/pattern-meta.mjs` reads it, beside the unchanged `readMeta`, so praxity.io can list components without changing how it reads pattern meta.
- README sections are fixed: Use it when, Avoid it when, Markup, Accessibility, Copy these files, Used by, Licence. `README.fr.md` holds the French Use it when and Avoid it when, as for patterns.
- `tests/components.test.js` checks the folder contract, examples and READMEs. `scripts/build-demo.mjs` copies the example pages into the demo so `tests/browser/components.spec.js` can run axe on them.

## Consequences

Adding a component means adding its folder, its row in the root README and its name in `tests/components.test.js`. A part with its own state or logic is a pattern, not a component. When a pattern changes markup a component documents, update the component's README and examples in the same change.
