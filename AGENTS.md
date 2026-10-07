# Learning blocks

Small learning interactions people copy into their projects. Read a block's README before changing it.

## Block contract

Each `blocks/<name>/` contains pure `logic.js`, server `render.js`, DOM `enhance.js`, `block.css`, bilingual `strings.js`, `content.schema.json`, examples and tests.

- `validateContent(content)` throws an Error naming the bad field.
- `render(content, strings, { id, lang })` returns complete, escaped HTML usable without JavaScript. Prefix every element id with the instance id. The section has class `lb-<name>`, `data-lb-block="<name>"` and `lang`.
- `enhance(root, { content, strings, state })` keeps server markup, reveals hidden controls and returns `{ destroy() }`. Repeated calls return the same instance. Optional host state has `read()` and `write(value)`. Ignore invalid saved values.
- Import shared helpers relatively from `lib/`. A block has no framework or runtime dependencies.
- Prefix CSS classes with the block name. Use the root's `--lb-*` tokens for colours, spacing, radius, font and focus.
- Keep English and French together with identical string keys. Authors write every learner-facing message. A model may only pick which one.

## Accessibility and feedback

Show feedback on submit. Keep one empty `role="status"` region in server HTML. Announce each message once without moving focus. Use French `lang`, text and decorative icons for results, and visible keyboard focus. Support no JavaScript, 400% zoom, text spacing and forced colours. Use no time limits or celebratory motion. End the interaction with a short summary.

Write a fail-first interface test for each behaviour change. Test planted violations for guards. Run node tests and the three-engine axe and keyboard browser checks. Screen reader passes are a separate human check.

## Commands

Use Node 22 and npm. Run `npm test`, `npm run typecheck`, `npm run types:check`, `npm run budget`, `npm run demo` and `npm run test:browser`. After changing JSDoc types, run `npm run types` and commit `types/`.

This repo will be public: no machine paths, no client material, no private links.
