---
title: Labelled text response
title_fr: Réponse écrite avec étiquette
summary: A text box with a visible label, an optional hint and an error message linked to the box.
---
# Labelled text response

A multi-line text box for a written answer. A visible label names it, an optional hint under the label says what a good answer looks like, and an error message appears under the box when the answer can't be checked.

## Use it when

- Learners recall, explain or apply an idea in their own words.
- Learners write a draft that they then compare with a model answer or a checklist.

## Avoid it when

- When the answer is one of a few known options, use the [Choice option and answer mark](../choice/README.md).

## Markup

```html
<div>
  <label class="lp-label" for="q2-answer">How would you start an emergency fund?</label>
  <p class="lp-small" id="q2-hint">Two or three sentences are enough.</p>
  <textarea class="lp-input" id="q2-answer" aria-describedby="q2-hint" rows="5"></textarea>
  <p class="lp-error-text" id="q2-error" hidden><svg class="lp-icon" aria-hidden="true" focusable="false">…</svg><span>Write an answer first.</span></p>
</div>
```

- Wrap the label, hint, box and error in one element. `lib/base.css` spaces them.
- When a heading above the box already asks the question, leave out the label and point the box's `aria-labelledby` at the heading's id.
- Put example wording in the hint, not in a `placeholder`, and don't set `maxlength`. Report a length limit as an error instead.
- The error icon is `alert-circle` from `lib/icons.js`. [en.html](en.html) has the full SVG.

When a check fails, a script:

1. Unhides the error.
2. Sets `aria-invalid="true"` on the box and adds the error's id to its `aria-describedby`, after the hint's id.
3. Moves focus to the box and announces the message once through the status region from the [Feedback, status and notice](../feedback/README.md) atom.
4. When the learner types again, hides the error, removes `aria-invalid` and sets `aria-describedby` back to the hint alone.

Add the error's id only while the error shows: screen readers read a description even when its element is hidden. [en.html](en.html) and [fr.html](fr.html) show the box before checking and with an error.

## Accessibility

- The label is tied to the box with `for` and `id`, and screen readers read the hint as the box's description.
- An error shows an icon and text in the error colour, and the box border turns 2px wide in the error colour. Screen readers hear the box as invalid and read the error with the hint.
- The focused box shows a 3px focus ring. In forced colours, the border uses the system text colour and the ring uses the system highlight.
- The box is at least 44px tall and learners can make it taller.
- Without JavaScript, learners can type, but nothing checks the answer.

## Copy these files

- `lib/base.css`: the label, hint, box and error styles.
- `lib/icons.js`, if your server or a script writes the error icon. Otherwise copy the SVG from the example.

## Used by

A visible label: [Your first answer replayed](../../patterns/first-answer/README.md), [Write the wrong options](../../patterns/write-distractors/README.md), [Check your own answer](../../patterns/self-check/README.md) and [Give feedback on a colleague's work](../../patterns/mark-colleague/README.md). A heading as the label: [Spot the misconception](../../patterns/misconception/README.md), [Explain what you learned](../../patterns/explain-back/README.md), [Journal entry with a nudge](../../patterns/journal/README.md), [Feedback while you type](../../patterns/live-feedback/README.md) and [Instant course lookup](../../patterns/course-lookup/README.md). A visually hidden label: [Scenario talk-through](../../patterns/conversation/README.md).

## Licence

[MIT](../../LICENSE). Keep the licence notice with copied code.
