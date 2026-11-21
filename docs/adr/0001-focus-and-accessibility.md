# 0001: Focus and accessibility

## Status

Accepted. Records existing behaviour.

## Context

Hosts can restyle controls, and browsers expose focus and live-region changes differently. These rules retain the compatibility decisions behind the shared helpers and test drivers.

## Decision

- `lib/ask.js`, `createAsk`: Same-origin transport. No learner text is logged or kept by this client. /config is read once, including failures. Create a new client to retry configuration.
- `lib/base.css`, `.lp :where(h1, h2, h3, h4, h5, h6), .lp-scene-title, .lp-run-in`: Headings keep the pattern's face. Hosts often give h1 to h3 a display face (praxity.io uses Bricolage), and a direct heading rule beats the font .lp sets for inheritance.
- `lib/base.css`, `.lp em`: Hosts that load no italic face and set font-synthesis: none would show `em` upright.
- `lib/base.css`, `.lp :where(.lp-stem:not(legend, [hidden]), .lp-run-in:not(legend, [hidden])) + :where(*), .lp :where(.lp-stem:not(legend, [hidden]), .lp-run-in:not(legend, [hidden])) + :where([hidden]) + :where(*)`: A hidden notice or result does not separate a visible pair. Legends own their bottom gap.
- `lib/base.css`, `select.lp-input`: The select arrow sits 14px inside the border in every engine. Padding doesn't move Chromium's native arrow, so this draws one (stroke is --lp-ink-2, which a data URL can't read).
- `lib/base.css`, `.lp-choice:has(> input[type="radio"]:checked)::before`: Empty CSS alt text keeps the visual key out of screen-reader browse text.
- `lib/base.css`, `@supports not (content: counter(lp-key, upper-alpha) / "")`: Engines without CSS alt text show the native radio instead of a spoken letter.
- `lib/base.css`, `.lp-choice:has(> input[type="radio"])::before, .lp-choice > .lp-choice-key, .lp-choice > :not(input, .lp-choice-mark, .lp-choice-key)`: The first line of text sits optically centred on the key box: the midpoint between its cap height and x-height on the box's centre. Centring the line box looked high, because lowercase text sits below the line's centre (owner, 2026-10-07); aligning to the 13px key letter's baseline still left the 17px text about 2px high (owner, 2026-10-10). The .125em top margin (2px at body size) is retained with the 1.4 line height; later lines and feedback in the text column keep no margin.
- `lib/base.css`, `.lp-icon`: A box one line tall centres the glyph on the first line of its text, at any size or weight, so rows align icons with align-items: start and no per-icon margins. Older browsers keep the 1.15em box.
- `lib/base.css`, `.lp-details`: Disclosures open at once: a rise after the panel has opened reads as a twitch (owner, 2026-10-07).
- `lib/base.css`, `.lp :is(a, button, textarea, select, summary, input:not([type="radio"], [type="checkbox"])):focus, .lp :is([tabindex="-1"], input[type="radio"], input[type="checkbox"]):not(.lp-choice > input):focus-visible`: A 3px ring in the focus colour: the 2px one, or a host's own ring, faded on white cards. Outlines follow each control's corners. A native radio outside a choice row still gets a square ring in Chromium, which ignores border-radius on themed radios; draw the radio in CSS if a pattern needs one.
- `lib/base.css`, `select.lp-input`: In forced colours, use the native select arrow because the drawn arrow does not take system colours.
- `lib/data-notice.js`, `renderDataNotice` re-export: Keep the existing exports so enhancers can import the UI without provider configuration.
- `lib/data-notice.js`, `noticeConfig`: Learner-facing: name the model's job, not the vendor. The privacy page or the course's terms of participation name the provider and say who keeps what (owner, 2026-11-03).
- `lib/focus-after-layout.js`, `focusAfterLayout`: Let the browser expose newly visible content before moving screen-reader focus.
- `lib/html.js`, `escapeHtml`: Escape plain text for HTML text nodes and quoted attributes. Set literal for code, identifiers or text already formatted in context.
- `lib/html.js`, `format`: Keep the extra guillemet spacing rule in `format`: the preceding punctuation rule skips a guillemet after semicolon, exclamation mark or question mark, so a question inside « » needs a separate rule.
- `lib/lock.js`, `lock`: Freeze answer controls, preserving kept controls and authored Try again. After layout, move lost focus to Try again or a fallback before freezing the focused control. Preserve focus moved by the caller, and choose Try again after the caller can unhide it.
- `lib/lock.js`, `lock`: Use the normalized input type, including an omitted or invalid type's text fallback.
- `lib/lock.js`, `frame`: Locking must finish even if focus moved elsewhere or the target disappeared.
- `lib/notice-ui.js`, `renderDataNotice`: Older configs and the offline demo carry only dataNotice.
- `lib/pending-check.js`, `pendingCheck`: Guards a check button while its request runs, without aria-disabled or a new label: Chrome with NVDA reads aria-disabled as only "unavailable", and Firefox reads a new label at once. Native disabled drops keyboard focus in WebKit. A note after the button, hidden from screen readers, shows the wait. Status says it once, after one second.
- `lib/question-errors.js`, `questionLinks`: A focus action must not navigate a host's base URL or hash router on middle-click.
- `lib/reveal.js`, `reveal`: One pixel of slack accommodates fractional layout and whole-pixel scroll positions.
- `lib/typing-pause.js`, `typingPause`: Adapt after three gaps; keep nine so a long thinking pause cannot dominate. Timing evidence and limits are in patterns/course-lookup/README.md.
- `tests/browser/contracts/radio-group.js`, `webkitRadioArrows`: Keep WebKit radio-key expectations bounded at the first and last item. Its NodeTraversal::next/previous traversal returns at the document boundary.
- `tests/browser/course-lookup.spec.js`, `lang`: VoiceOver keeps its cursor on a control that hides before focus moves. Add focuses the new question after layout, while Add is still visible, and only then hides Add.
- `tests/browser/course-lookup.spec.js`, `root`: WebKit skips links on Tab by default, so check the next Tab on the FAQ disclosures.
- `tests/browser/draw-your-guess.spec.js`, test "the pattern itself sets Home and End, so they work when the browser default never runs": A synthetic keydown runs listeners but no default action, as when Safari with VoiceOver skipped End (VO run 2).
- `tests/browser/highlight.spec.js`, test "chunks flow like the source paragraphs across inline boundaries": Vertical page shifts can change Firefox's fractional coordinates by less than 0.01px.
- `tests/browser/hint-ladder.spec.js`, test "a wrong check puts focus on the check button when the checked option held it": Safari does not focus a button on a pointer click. A scripted click activates it the same way, with focus left on the option that the check is about to close.
- `tests/browser/prolific-questions.spec.js`, `oldFacts`: Safari needs fresh fieldsets to discard the previous facts' accessible names.
- `tests/browser/prolific-questions.spec.js`, `fact`: The first answer of the new set takes focus, not the whole question group (NVDA read it all at once).
- `tests/browser/retrieval-sheet.spec.js`, `named`: Name computation may put a space before the hidden comma, because the date span is a block.
- `tests/browser/retrieval-sheet.spec.js`, `hidden`: Visually hidden text is clipped on purpose; Firefox counts it as overflow of its parent, so measure without it.
- `tests/browser/retrieval-sheet.spec.js`, `clipped`: clientWidth is 0 for inline boxes, so only non-inline boxes can report clipping.
- `tests/browser/review-prompts.spec.js`, paragraph line-height assertion: Compare the line-height/font-size ratio rounded to six decimals. WebKit serializes the 1.65 line height at 17px as 28.049999px.
- `tests/browser/section-test-out.spec.js`, test "keyboard validates only this panel, Back keeps picks, changes announce once and reset returns to outline": Only the radios carry the message; describing the fieldset as well made VoiceOver say it twice.
- `tests/browser/text-fields.spec.js`, `mount`: Focus reaches the task heading after layout; typing before then is lost in Firefox.
- `tests/browser/which-is-better.spec.js`, test "the emails sit side by side on a wide card and stack on a phone, and each note sits under its sentence": Half a pixel of slack: Firefox rounds the two boxes' edges differently when they touch.
- `tests/browser/which-is-better.spec.js`, test "choices ring for keyboard focus only, so a tapped sentence does not look chosen twice": WebKit decides focus-visible for script focus by its own rules, so the empty check is asserted elsewhere.
- `tests/browser/write-distractors.spec.js`, test "forced colours keeps focus rings and quiet Start over": Chromium replaces a focused transparent button border in forced colours. Resolve that native border in the active palette, just like system ink.
- `tests/voiceover/journeys.spec.js`, `choose`: Native WebKit radio groups stop at their ends rather than wrapping.
- `tests/voiceover/journeys.spec.js`, `journey`: Shift+Tab into WebKit's date control lands on the year segment, which run 7 proved recoverable by typing.
- `tests/voiceover/journeys.spec.js`, `journey`: Harness-owned: the native print sheet would block WebKit; the page's status write still runs.
- `tests/voiceover/session.js`, `focusBrowser`: Activate the browser once on entry. Repeated AppleScript application activation stalled WebKit during typing.
- `tests/voiceover/session.js`, `seek`: WebKit's default Tab policy skips some buttons. VO navigation reaches them.
- `tests/voiceover/session.js`, `startSession`: Explicit rereads are separate steps; they are not spontaneous duplicate announcements.
- `tests/voiceover/session.js`, `read`: VoiceOver reports tab items as empty cursor strings; only a repeated non-empty cursor means the end.

Sources: the corresponding source files and their recorded rationale at commit `66fc86dc5f9a90f2dc243d6bdc90b75e2583cffa`. Browser and screen-reader observations above are historical evidence recorded in those files, not new checks. Owner decisions retain their dates where recorded.

## Consequences

Preserve these constraints when changing the named symbols. Revisit a browser constraint or provider calibration only with new evidence.
