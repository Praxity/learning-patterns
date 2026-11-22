---
title: Progress line
title_fr: Ligne de progression
summary: Text that tells learners where they are, such as Question 2 of 5, with a decorative bar under it.
---
# Progress line

A line of text that tells learners where they are in an activity, such as Question 2 of 5, with a thin bar under it that shows the same thing at a glance.

## Use it when

- An activity shows its questions or steps one at a time, and learners need to know how many are left.

## Avoid it when

- When all the questions are on the page at once, number them in their legends instead, as ["I don't know" as an answer](../../patterns/dont-know/README.md) does.

## Markup

```html
<p class="lp-progress"><span>Question 2 of 5</span><span class="lp-progress-bar" aria-hidden="true"><span style="inline-size: 40%"></span></span></p>
```

- Put the line just before the question it counts.
- Set the inner bar's width to the share of the activity shown so far, as a percentage. When the step changes, a script updates the text and the width together.
- The line is not a live region. When a script moves to the next question, it moves focus to the question. If learners need the count at that point, also start the question's label with it, as [Which is better, and why](../../patterns/which-is-better/README.md) does.

[en.html](en.html) and [fr.html](fr.html) show the line above a question.

## Accessibility

- The count is plain text in reading order, so screen readers read it before the question. The bar is hidden from screen readers and adds nothing to hear.
- Changes are not announced, so they never interrupt what a screen reader is reading.
- The text is small and in the secondary text colour, which keeps a contrast ratio above 4.5:1 on the default card.
- In forced colours, the bar gets a border and its fill uses the system text colour.
- The bar doesn't move or animate.

## Copy these files

- `lib/base.css`: the shared tokens and text styles.
- `atoms/progress/atom.css`: the line and bar. `lib/base.css` has no progress styles.

## Used by

No pattern uses it yet. [Which is better, and why](../../patterns/which-is-better/README.md) shows "Question 1 of 3" in its question line, and [Questions inside the reading](../../patterns/review-prompts/README.md) shows how many questions learners have reviewed. Both could adopt it. [Check your own answer](../../patterns/self-check/README.md) shows the parts ticked so far with a ring, which the bar could replace.

## Licence

[MIT](../../LICENSE). Keep the licence notice with copied code.
