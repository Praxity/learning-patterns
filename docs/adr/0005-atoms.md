# 0005: Atoms

## Status

Accepted on 2026-11-22.

## Context

Praxity distributes copy-in components instead of a course builder (owner, 2026-11-21). Patterns are whole learning interactions. Course authors and their AI agents also need the smaller parts the patterns are built from, so they can build their own activities and course pages in the same look. Those parts already exist in `lib/base.css`, a few `lib/` helpers and markup repeated across pattern renderers, but nothing documents them as parts to copy.

## Decision

- An atom is a documented part, not a module. Each `atoms/<name>/` folder holds `README.md`, `README.fr.md`, `en.html` and `fr.html`, and `atom.css` only when `lib/base.css` lacks the styles it needs.
- The examples are static pages that work without JavaScript. They link `../../lib/base.css`, use only `lp` classes and copy their icons unchanged from `lib/icons.js`. The English and French pages have the same structure.
- Atoms hold no logic: no grading, scoring or saving. Where a script is needed, the README names the existing `lib/` helper (`choice-mark.js`, `lock.js`, `reveal.js`) and the copy imports it relatively. No helper is copied into an atom folder.
- Where patterns already render a part, the atom documents the markup the patterns use. Changing the patterns to match an atom is separate work.
- `atom.css` uses the same `lp-<name>` prefix rule as `pattern.css`, so a class says which file owns it.
- The README front matter has `title`, `title_fr` and `summary`. `readAtomMeta` in `scripts/pattern-meta.mjs` reads it, beside the unchanged `readMeta`, so praxity.io can list atoms without changing how it reads pattern meta.
- README sections are fixed: Use it when, Avoid it when, Markup, Accessibility, Copy these files, Used by, Licence. `README.fr.md` holds the French Use it when and Avoid it when, as for patterns.
- `tests/atoms.test.js` checks the folder contract, examples and READMEs. `scripts/build-demo.mjs` copies the example pages into the demo so `tests/browser/atoms.spec.js` can run axe on them.

## Consequences

Adding an atom means adding its folder, its row in the root README and its name in `tests/atoms.test.js`. A part with its own state or logic is a pattern, not an atom. When a pattern changes markup an atom documents, update the atom's README and examples in the same change.
