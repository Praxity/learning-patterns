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
engine-specific exceptions for reverse Tab entry.

WebKit's native arrow keys stop at the first/last radio. Chromium and Firefox
retain APG wrapping. The WebKit expectation cites
[`RadioInputType::handleKeydownEvent`](https://github.com/WebKit/WebKit/blob/67d931686f9e8cd74deeadd0da510cafd8686ba5/Source/WebCore/html/RadioInputType.cpp#L116-L158),
which traverses nodes in one direction without wrapping. Each arrow press is a
named step, including the endpoint press, so failures identify the key and index.

A numbered legend's complete authored name is matched with an anchored expression.
Only whitespace around the caption/comma boundary and between words can vary.
No word, punctuation or question number is omitted. See the CSS-dependent joining
note in [AccName 4.3.2](https://www.w3.org/TR/accname-1.2/#computation-steps).
CI prints the computed group names from `ariaSnapshot` for all unselected
`dont-know` questions, both languages and scripting modes in every engine.

The bindings register one test per pattern, language and scripting mode: 24 tests
across three engines. Each test loads six question/selection fixtures and runs all
eight expectations in named steps. Before each expectation, fixture setup resets
native checked properties to the declared state without synthetic events or page
navigation. Assertions have a one-second retry limit and actions a three-second
limit. Every expectation checks the expected radio count before any loop.

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
assertion, so an unrelated setup exception is not accepted as proof of detection.
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

## CI evidence from the first browser run

[Run 42706338771](https://github.com/Praxity/learning-patterns/actions/runs/42706338771)
at head `07eaa0f` captured these first-question names in Chromium, Firefox and
WebKit, with JavaScript both enabled and disabled:

- English: `Question 1 of 3 , What is an emergency fund for?`
- French: `Question 1 sur 3 , ? quoi sert un fonds d?urgence ?`

The extra space before the comma changes no word or meaning for the listener.
`ci-evidence.json` records every question's captured name by engine, language and
scripting mode, with the report attachment identifiers. The WebKit trace shows
that the third ArrowRight press fails the old wrap expectation, after the first
two presses successfully move focus and selection forward.

The initial run also failed an existing WebKit French slider assertion in
`split-by-proportion.spec.js`. That pattern is outside this spike's scope.
