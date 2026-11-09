# Native radio contract spike

`radio-group.js` owns eight sourced expectations. `radio-group-runner.js` checks
those expectations unchanged against a binding. `radio-contract.spec.js` binds
`dont-know` and `test-out`, in English and French, for every example question,
with no selection and with the second option selected. Both modes run with and
without JavaScript in all three projects from `playwright.config.js`.

The binding supplies authored names, legend text and expected selection, rather
than deriving expected answers from the DOM. Native fieldsets expose `group`,
not `radiogroup`, following [HTML-AAM](https://www.w3.org/TR/html-aam-1.0/#el-fieldset).
Stable option names and the no-JavaScript baseline are adopted library requirements;
the cited WCAG criteria explain the user outcomes, not a claim that WCAG mandates
one implementation. The root README and each bound pattern's Accessibility section
require usable server HTML. Static expectations are group name, radio names and
checked state. The same runner also exercises native interaction without scripting.

Tab checks use temporary buttons immediately before and after the fieldset. They
check group mechanics, while existing workflow tests still check page focus order.
Reverse entry is checked with a selected option. The APG radio keyboard section
explicitly notes variation in native reverse entry when nothing is selected; the
spike does not prescribe a reverse-entry target for that case. There are no
engine-specific exceptions.

Focus checks use keyboard modality and the computed outline of the radio or its
associated label. They enforce the repository's 3px focus ring requirement. This
is a limited browser style check, not proof of contrast, clipping, unobscured focus,
or screen reader speech. Existing forced-colour, reflow, theme, browse-text and axe
tests remain. Axe is broader than this radio contract and no axe scan was removed.
Locked result states stay in the existing pattern tests because the interaction
expectations apply to operable choices.

`radio-contract-violations.spec.js` runs the same assertions against conforming
controls and mutations: missing legend, wrong role, missing checked state, trapped
Tab, inert arrows, inert Space, changing names and removed focus ring. The three
static mutations also run with JavaScript disabled. Each rejection must match its
assertion, so a fixture timeout is not accepted as proof of detection.
`tests/radio-contract.test.js` checks the contract data with node:test.

## Assertions replaced

- `dont-know.spec.js`: native radio count, native selection assertion, and the
  individual accessible-name assertion in the decorative-letter test. The latter
  retains its CSS and browse-text snapshot checks.
- `section-test-out.spec.js`: native radio count and selection action in the
  no-JavaScript test. Its fallback answers and explanation checks remain.

## Origin and scope

The idea comes from Meta's MIT-licensed
[Astryx a11y-spec](https://github.com/meta/astryx/tree/349d3a8e6f0769ce87bce24674cfd0cce6487c64/internal/a11y-spec)
and [AST-020](https://github.com/meta/astryx/blob/349d3a8e6f0769ce87bce24674cfd0cce6487c64/docs/specs/AST-020/spec.md).
This is an independent plain JavaScript implementation. No Astryx source code was
copied. It adds no dependency or general widget framework.
