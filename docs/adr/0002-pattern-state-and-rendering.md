# 0002: Pattern state and rendering

## Status

Accepted. Records existing behaviour.

## Context

Patterns must preserve authored meaning, host state and reading order across enhancement and restoration. These rules retain the decisions behind their validation, state and layout.

## Decision

- `patterns/answer-with-confidence/enhance.js`, `enhance`: Prototype-free, so a question id such as "constructor" or "__proto__" is an ordinary key.
- `patterns/answer-with-confidence/enhance.js`, `enhance`: Whether the learner was sure lives here only. It is never written through the state adapter.
- `patterns/answer-with-confidence/enhance.js`, `show`: The pressed button is about to go, so focus moves to the feedback that replaced it, which reads it once.
- `patterns/answer-with-confidence/enhance.js`, `enhance`: Focus on the first option reads the linked message once, so the status region stays silent.
- `patterns/answer-with-confidence/enhance.js`, `enhance`: Restored answers come back without certainty, so they show the plain result and no summary lists.
- `patterns/answer-with-confidence/logic.js`, `validateState`: Ignore invalid saved values and copy valid state. Saved state holds answers only, so a value that carries anything else, certainty included, is rejected.
- `patterns/answer-with-confidence/render.js`, `render`: Every option row keeps room for the widest mark, so a mark never rewraps the option text. All rows reserve the same width, which gives nothing away about the answer.
- `patterns/answer-with-confidence/render.js`, `render`: One feedback block per possible answer. They share one grid cell with the submit control, so the cell is already as tall as the tallest of them and showing one moves nothing.
- `patterns/change-one-detail/render.js`, `render`: One line: paragraphs keep authored line breaks, so a break in this markup would show.
- `patterns/conversation/enhance.js`, `enhance`: Focus is the one announcement for a completed turn; never repeat it in status. Controls update after focus moves: focus on the body makes Chrome with NVDA read the whole activity.
- `patterns/conversation/enhance.js`, `enhance`: Firefox may restore a form value after reload; only the validated host draft wins.
- `patterns/conversation/logic.js`, `validateState`: Drafts have no send limit; the host owns its total storage budget, as documented by `patterns/write-distractors/README.md`.
- `patterns/course-lookup/enhance.js`, `useFallback`: Focus reads the message, so status stays quiet: a status write next to a focus move gets cut off.
- `patterns/course-lookup/enhance.js`, `onClick`: Safari leaves focus on the page for an unfocusable fragment target; VoiceOver, 2026-10-29. A modified click opens another tab or window, so this page keeps its place.
- `patterns/dont-know/enhance.js`, `show`: Explicit tabindex includes review links in WebKit's keyboard navigation on Windows.
- `patterns/dont-know/enhance.js`, `show`: Focus already reads the score; repeating it in status would speak it twice.
- `patterns/draw-your-guess/enhance.js`, `paint`: Squares go last, so a real point stays visible inside a guess that matches it.
- `patterns/draw-your-guess/enhance.js`, `set`: Native range value changes announce themselves; the status region stays quiet here.
- `patterns/draw-your-guess/pattern.css`, `.lp-draw-your-guess-future`: The guess columns take pointer input. Each holds its month's native range input, invisible, so keyboards and screen readers get a real slider; the ring shows on the column it sets.
- `patterns/estimate-magnitude/logic.js`, `scaleFor`: Start in the middle; require a deliberate setting so the start is not taken as a hint.
- `patterns/estimate-magnitude/strings.js`, `strings`: The fieldset legend already names the question; the slider names only itself, by number, so NVDA does not read the question twice.
- `patterns/explain-back/enhance.js`, `useFallback`: Hide the focused button only once focus has reached the first idea, so focus never falls to the page body.
- `patterns/explain-back/enhance.js`, `onCheck`: A judgment belongs to the submitted draft. Discard it if the learner has edited.
- `patterns/explain-back/logic.js`, `validateState`: Restore drafts only, never persist automated judgments. Drafts have no send limit; the host owns its total storage budget, as documented by `patterns/write-distractors/README.md`.
- `patterns/finish-worked-example/enhance.js`, `showAnswer`: The rows already show the verdict. Focus reads this line, so it repeats the verdict for screen readers only.
- `patterns/finish-worked-example/enhance.js`, `check`: Focus moves to the reason before the controls freeze, so it is read once and Tab continues to the next step.
- `patterns/finish-worked-example/pattern.css`, `.lp-finish-worked-example-step > .lp-run-in, .lp-finish-worked-example-step legend > .lp-run-in`: A step question is a sentence, so it wraps like body text; balancing broke French questions at a hyphen.
- `patterns/finish-worked-example/render.js`, `render`: A worked step after one of the learner's would give that answer away, so it starts hidden.
- `patterns/first-answer/enhance.js`, `enhance`: Reread before writes so two course placements cannot overwrite a saved first. Cross-tab/device races need an atomic adapter supplied by the host.
- `patterns/first-answer/enhance.js`, `enhance`: Commit before changing displayed state. A failed write leaves the old record.
- `patterns/first-answer/logic.js`, `isDate`: Full ISO timestamps, including offsets. Date.parse alone normalizes invalid days.
- `patterns/first-answer/logic.js`, `withFirstAnswer`: Save once. An end-only attempt cannot later become a first attempt.
- `patterns/first-answer/logic.js`, `withAnswerNow`: Repeating comparison replaces only now; first and checks keep their values.
- `patterns/highlight/enhance.js`, `enhance`: Read host state before changing the DOM; adapter errors propagate to the host.
- `patterns/highlight/enhance.js`, `show`: The mark word stays short; the author's note carries the explanation after it. A hidden full stop gives screen readers a pause between the word and the note.
- `patterns/highlight/enhance.js`, `enhance`: Inline spans preserve prose flow; every chunk needs a Tab stop in browse mode.
- `patterns/highlight/enhance.js`, `enhance`: A held key repeats keydown; toggle once per press, as a native button does.
- `patterns/highlight/pattern.css`, `.lp-highlight-feedback`: The gap sits on the label, not the chunk: a margin at the end of a chunk that ends a line overflows the paragraph.
- `patterns/highlight/pattern.css`, `.lp-highlight-feedback[data-lp-outcome="correct"], .lp-highlight-feedback[data-lp-outcome="missed"]`: A short label never wraps between its icon and its word. A leading word joiner (silent: empty alt text) also keeps it on the line of its chunk's last word. Wrapped to the next line, it read as a verdict on the sentence after it. A no-wrap wrapper doesn't do this: Chromium and WebKit still break before it.
- `patterns/highlight/strings.js`, `strings`: Deprecated: kept for hosts that read the old keys (Praxity Studio). Use markCorrect for correctKey and correctEvidence, markWrong for wrongKey and wrongEvidence, markAnswer for missed.
- `patterns/hint-ladder/enhance.js`, `enhance`: Safari does not focus a button on a pointer click, so focus may still be on the option this check is about to close. Put it on the button first.
- `patterns/hint-ladder/logic.js`, `validateState`: The order of tries and hints is not saved. Hints open at any time and the worked answer needs a try, so this order replays every state the page can reach.
- `patterns/if-then-plan/enhance.js`, `enhance`: A past time is reported when the learner leaves the field, not on each keystroke.
- `patterns/if-then-plan/enhance.js`, `enhance`: A restored past time explains the disabled button at once; leaving the unchanged field fires no change event.
- `patterns/if-then-plan/logic.js`, `escapeText`: RFC 5545 TEXT (section 3.3.11): escape backslash, semicolon and comma, write every line break as an escaped n, and turn the other control characters, which TEXT does not allow, into spaces.
- `patterns/if-then-plan/logic.js`, `utc`: UTC date-time, so the entry lands on the same instant whatever zone the calendar is in.
- `patterns/if-then-plan/logic.js`, `fold`: Fold at 75 octets without splitting a character, as RFC 5545 section 3.1 requires. A fold may fall inside an escape; readers unfold before they unescape.
- `patterns/if-then-plan/logic.js`, `calendarFile`: An iCalendar file with one entry that shows the plan just before the moment it is for. The entry starts REMINDER_MINUTES before `start`, ends at `start` and raises a notice when it begins.
- `patterns/journal/logic.js`, `validateState`: Only submitted entries are saved, with canonical UTC timestamps. No model judgments.
- `patterns/journal/pattern.css`, `.lp-journal-actions > [data-lp-saved]`: The save message takes its own line under both actions. Under Save it widened that column and pushed the suggestion sideways. A host cap such as p { max-width: 65ch } shrinks the 100% basis and pulls the message back beside the buttons, so lift it.
- `patterns/live-feedback/logic.js`, `validateState`: Drafts have no send limit; the host owns its total storage budget, as documented by `patterns/write-distractors/README.md`.
- `patterns/misconception/enhance.js`, `enhance`: Choice gates are model-specific; older host clients may provide only the provider.
- `patterns/misconception/logic.js`, `validateState`: Drafts have no send limit; the host owns its total storage budget, as documented by `patterns/write-distractors/README.md`.
- `lib/base.css`, `fieldset.lp-choices`: Keep choice fieldsets as blocks with an inner `div.lp-choices` grid. WebKit can retain a grid fieldset legend’s wide layout after the viewport narrows. The inner grid inherits the fieldset’s column definition, preserving multi-column choices and retrieval-sheet controls. Shared grid tracks and legend width also constrain long words. The choice atom uses the same rule.
- `patterns/mistake-recover/logic.js`, `validateState`: Every saved value must have been replayed; anything left over could not have been reached.
- `patterns/mistake-recover/pattern.css`, `.lp-mistake-recover-record dt`: A long unbroken name breaks inside its column; otherwise its min-content width widens the track past the card.
- `patterns/mistake-recover/strings.js`, `strings`: A no-break hyphen keeps « prenez‑vous » on one line on a phone.
- `patterns/prolific-questions/enhance.js`, `onNext`: Replace fieldsets because Safari kept the old legend as the group name in VoiceOver run 2.
- `patterns/retrieval-sheet/enhance.js`, `enhance`: Validate all required markup and read host state before changing the server sheet.
- `patterns/retrieval-sheet/enhance.js`, `enhance`: The destination must already be selected when assistive technology sees focus.
- `patterns/retrieval-sheet/enhance.js`, `checkInput`: The status region speaks the error once in every browser. Firefox with NVDA ignores a new description on the focused field and Chrome speaks it as well, so the description is added only once focus leaves.
- `patterns/retrieval-sheet/enhance.js`, `checkInput`: Native date controls may emit more than one change for the same value; leaving the error always speaks the date.
- `patterns/retrieval-sheet/enhance.js`, `enhance`: While a year is being typed, nothing changes; leaving the field with a partial year shows the error.
- `patterns/retrieval-sheet/logic.js`, `isPartialYear`: Whether a date field value is a year still being typed. Chrome reports each partial year as a valid date while the learner types it digit by digit (0002, 0020, 0202), so those aren't dates yet.
- `patterns/retrieval-sheet/logic.js`, `formatDate`: Format a civil date without shifting its day when the learner changes time zones.
- `patterns/retrieval-sheet/logic.js`, `formatShortDate`: Short weekday and date, preserving the civil day across time zones.
- `patterns/retrieval-sheet/pattern.css`, `body:has(.lp-retrieval-sheet) :not(.lp-retrieval-sheet, .lp-retrieval-sheet *, :has(.lp-retrieval-sheet))`: The copied stylesheet hides host chrome without knowing its class names. Ancestors of a sheet stay in flow. Multiple sheets print in document order.
- `patterns/review-prompts/enhance.js`, `enhance`: Formatting the stored civil date in UTC avoids changing its day in another time zone.
- `patterns/review-prompts/enhance.js`, `enhance`: A host receives its own copy so it cannot mutate the current interaction.
- `patterns/review-prompts/logic.js`, `scheduleReview`: Set midnight on the target day: the source day may have a DST gap at midnight.
- `patterns/self-check/enhance.js`, `show`: Typography changes only horizontal spaces; align them without changing evidence ownership.
- `patterns/self-check/logic.js`, `annotate`: Segment validated model text in reading order. Whole-answer parts stay in the legend. When evidence overlaps, the first span in model order owns that text.
- `patterns/sort-by-principle/enhance.js`, `enhance`: Focus reads the feedback once, then the controls freeze. Only the final result uses the status region. Before the last case, Next case comes into view with the feedback just above it; on a narrow screen, revealing the feedback alone left the button below the fold.
- `patterns/sort-by-principle/enhance.js`, `enhance`: On a phone the new case replaces a taller one and can land partly above or below the view. If any part of it, heading to Check, is outside the view, it moves to the top; otherwise nothing moves.
- `patterns/sort-by-principle/logic.js`, `validateContent`: A principle that is never right teaches the learner never to pick it.
- `patterns/sort-by-principle/logic.js`, `quoteParts`: Longest first, so a name that contains another is matched whole.
- `patterns/sort-by-principle/pattern.css`, `.lp-sort-by-principle-enter`: A case change is a view change. Fade only: the page may also scroll to the new case, and a sideways slide on top of that read as a second jump.
- `patterns/split-by-proportion/enhance.js`, `paintSegments`: Only result labels may wrap, and only before a unit word: a number stays joined to % and to its digit groups.
- `patterns/split-by-proportion/enhance.js`, `enhance`: Value text widens to every option a push changed, so each new value is heard once through the slider.
- `patterns/split-by-proportion/enhance.js`, `enhance`: Keep the focused action visible until the newly unlocked slider can receive focus.
- `patterns/split-by-proportion/pattern.css`, `.lp-split-by-proportion`: One colour per option in the bar, key, chart and table. Ink outlines and letters distinguish the pale colours from white and from each other. The first four retain contrast ratios of at least 9.2, 10.9, 13.2 and 8.4:1; lime and purple also exceed 8.4:1 against the default ink. A second pattern using this divider control should share its implementation.
- `patterns/split-by-proportion/pattern.css`, `.lp-split-by-proportion-split`: Pointer input goes to the bar. Each divider has a native range input over its grip for keyboards and screen readers. The input is transparent, with focus drawn on the corresponding grip.
- `patterns/split-by-proportion/pattern.css`, `.lp-split-by-proportion-label`: Wrap at spaces. A wider single word grows the inner label; only the end slots anchor that overflow to the bar's edges.
- `patterns/split-by-proportion/pattern.css`, `.lp-split-by-proportion-answer-table`: overflow-wrap: anywhere lowers the cells' min-content width, so long French headers and labels break only when 320 px and text spacing leave no room, instead of widening the page.
- `patterns/test-out/enhance.js`, `enhance`: Each radio carries the message; describing the fieldset too made VoiceOver read it twice.
- `patterns/which-is-better/enhance.js`, `enhance`: Bring a line to the top of the view unless all of it is visible. On a phone the emails and the button sit a screen below the question, so a new question or an error would open out of sight.
- `patterns/which-is-better/enhance.js`, `marked`: Locked sentences stay in the tab order, as in Highlight the key passage, so the marks can be read.
- `patterns/which-is-better/enhance.js`, `enhance`: A held key repeats keydown; press once, as a native button does.
- `patterns/which-is-better/logic.js`, `validateContent`: The number counts sentences in the better version, so an answer can never sit in the weaker one.
- `patterns/which-is-better/pattern.css`, `.lp-which-is-better-pair > .lp-which-is-better-email`: minmax(0, 1fr): a long unbroken word wraps in its email instead of widening the column past the card.
- `patterns/which-is-better/pattern.css`, `.lp-which-is-better-chunk:focus`: A tapped sentence already shows its highlight, and a ring there reads as a second choice, so sentences ring for keyboard focus only, as the rows do.
- `patterns/which-is-better/pattern.css`, `.lp-which-is-better-body mark`: As in Highlight, the highlight pads only above and below: side padding spilled past the end of a full line.
- `patterns/which-is-better/pattern.css`, `.lp-which-is-better .lp-choice`: Neither is a row button, so the row styles keyed on inputs are restated for it.
- `patterns/which-is-better/pattern.css`, `.lp-which-is-better .lp-choice:focus:not(:focus-visible)`: base.css rings every button on any focus. A tapped row already shows its border, so it rings for keyboard focus only, as radio rows do.
- `patterns/which-is-better/render.js`, `render`: The hidden comma gives screen readers a pause between the progress and the question. It belongs to the progress label, which is a block.
- `patterns/write-distractors/enhance.js`, `enhance`: A throwing host read must not leave partially registered listeners.
- `patterns/write-distractors/enhance.js`, `enhance`: WebKit pointer clicks can leave focus in a builder that is about to hide.
- `patterns/write-distractors/logic.js`, `validateOptions`: Field errors use codes so every learner-facing message lives in strings.js. Length is checked before normalization so whitespace consumes the option limit.
- `patterns/write-distractors/logic.js`, `validateState`: Accept incomplete drafts; shown results must pass submission validation. Drafts have no storage ceiling; the host owns its total storage budget. Oversized options lose comparison results. Oversized answers keep their full text and options but return to the answer step.
- `patterns/write-distractors/pattern.css`, `.lp-write-distractors-body [data-lp-check]`: Swap disabled ink and background together; reset must retain contrast on every frame.
- `patterns/write-distractors/pattern.css`, `.lp-write-distractors-option > div:has(select)`: Contain WebKit's closed select overflow, with room for its 3px focus ring and 2px offset.

Sources: the corresponding source files and their recorded rationale at commit `66fc86dc5f9a90f2dc243d6bdc90b75e2583cffa`. Browser and screen-reader observations above are historical evidence recorded in those files, not new checks. Owner decisions retain their dates where recorded.

## Consequences

Preserve these constraints when changing the named symbols. Revisit a browser constraint or provider calibration only with new evidence.
