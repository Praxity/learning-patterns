---
title: Feedback, status and notice
title_fr: Rétroaction, statut et avis
summary: Result lines with an icon and a word, error and notice text, and the hidden status region that announces each message once.
---
# Feedback, status and notice

The parts that tell learners what happened: a result line next to the answer it is about, a summary list at the end, an error message, a short notice, and one hidden status region that announces each message once.

## Use it when

- Learners need the result of a check next to the answer it is about.
- A message must reach screen reader users without moving their focus.

## Avoid it when

- When a message would only praise or celebrate, leave it out and say what was right or wrong and why.

## Markup

A result line next to an answer, and a summary list at the end:

```html
<div class="lp-outcome lp-missed"><svg class="lp-icon" aria-hidden="true" focusable="false">…</svg><p class="lp-outcome-word">Incorrect</p><p class="lp-outcome-detail">A holiday you plan for is a savings goal.</p></div>

<ul class="lp-outcomes">
  <li class="lp-outcome lp-met"><svg class="lp-icon" aria-hidden="true" focusable="false">…</svg><span class="lp-outcome-word">Correct</span><span class="lp-outcome-detail">What is an emergency fund for?</span></li>
</ul>
```

An error, a notice and the status region:

```html
<p class="lp-error-text"><svg class="lp-icon" aria-hidden="true" focusable="false">…</svg><span>Choose an answer for every question, then check again.</span></p>
<p class="lp-small">Your answer is sent to a decision model to give instant feedback.</p>
<p class="lp-visually-hidden" role="status" aria-atomic="true"></p>
```

- Results take one of three tones, each with its icon from `lib/icons.js`: `lp-met` with `check`, `lp-missed` with `x` and `lp-neutral` with `circle-dashed`. Errors use `alert-circle`. [en.html](en.html) has the full SVGs.
- The word says the result and the detail says why. Authors write both.
- When a notice describes a button, such as a notice that an answer is sent to a model, link it to the button with `aria-describedby`.
- Keep exactly one status region per activity, empty in server HTML. To announce a message, a script sets the region's text once. Nothing is announced at page load.
- To show hidden feedback, patterns call `reveal(element)` from `lib/reveal.js`, which unhides it and scrolls it into view.

[en.html](en.html) and [fr.html](fr.html) show a result line, a summary list, a notice and an error.

## Accessibility

- Each result has an icon and a word, so it never relies on colour. Icons are decorative.
- The status region is polite and reads the whole message, so a screen reader announces it once without moving focus. It is hidden from sight but not from screen readers.
- Error text is body size, semibold and in the error colour, with its icon.
- In forced colours, the text takes the system colours, and the icons and words still carry the result.
- Lines wrap at 320px wide, and long words in a detail break instead of overflowing.

## Copy these files

- `lib/base.css`: the result, error, notice and hidden-text styles.
- `lib/icons.js`, if your server or a script writes the icons. Otherwise copy the SVGs from the example.
- `lib/reveal.js`, if a script shows hidden feedback.

Patterns that send answers to a model write their notice and daily-limit message with `lib/notice-ui.js`. Copy it only with one of those patterns.

## Used by

Every pattern has one status region. Every pattern except [Highlight the key passage](../../patterns/highlight/README.md) and [Questions inside the reading](../../patterns/review-prompts/README.md) writes its errors with the error text. [Answer with confidence](../../patterns/answer-with-confidence/README.md) uses the result line. [Spot the misconception](../../patterns/misconception/README.md) and [Estimate magnitude](../../patterns/estimate-magnitude/README.md) style their own result lines with an icon and a word.

## Licence

[MIT](../../LICENSE). Keep the licence notice with copied code.
