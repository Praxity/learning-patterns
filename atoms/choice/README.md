---
title: Choice option and answer mark
title_fr: Option de réponse et marque de résultat
summary: Full-width answer rows for one answer or several, and the mark a row gets after the learner checks.
---
# Choice option and answer mark

A group of full-width answer rows. Learners pick one answer with radio buttons or several with checkboxes. After they check, each row they need to know about gets a mark: an icon and a word.

## Use it when

- Learners recognise the right answer among a few plausible options.
- Each wrong option reflects a mistake learners actually make.

## Avoid it when

- When learners need to recall or explain the answer themselves, use the [Labelled text response](../text-response/README.md).

## Markup

```html
<section class="lp" lang="en">
  <fieldset class="lp-choices" id="q1">
    <legend class="lp-stem">What is an emergency fund for?</legend>
    <div class="lp-choices">
      <label class="lp-choice" for="q1-option-0"><input type="radio" id="q1-option-0" name="q1" value="costs"><span>Costs you can't plan for, such as a car repair</span></label>
      <label class="lp-choice" for="q1-option-1"><input type="radio" id="q1-option-1" name="q1" value="holiday"><span>A holiday you are planning for next year</span></label>
    </div>
  </fieldset>
</section>
```

- Keep the markup inside an element with the `lp` class, as the snippet does. `lib/base.css` defines the `--lp-*` colour, spacing and type tokens on `.lp`, so outside it the rows lose their borders, colours and focus ring. A pattern's root section already has the class.
- Put the rows in a `div.lp-choices` inside the fieldset, as [Spot the misconception](../../patterns/misconception/README.md) does. `lib/base.css` shows the outer fieldset as a plain block, and the inner list spaces the rows. When the fieldset itself is the grid, WebKit keeps the legend at the width it had before the window narrowed, so after zooming in or rotating a phone the question runs off the page.
- Write one `label.lp-choice` per option: the input first, then the option text in a `span`.
- For "choose all that apply", use `type="checkbox"`. The row then draws a box instead of a letter.
- Radio rows show the letters A, B, C, drawn by `lib/base.css`.
- Start every id with your instance id, so two copies on one page don't clash.

After the learner checks, a script:

1. Disables the inputs. Patterns call `lock(scope)` from `lib/lock.js`.
2. Marks rows with `markChoice(row, kind, strings, lang)` from `lib/choice-mark.js`: `correct` for a right answer the learner chose, `wrong` for a wrong answer the learner chose, `missed` for a right answer the learner didn't choose. Leave other rows unmarked. Server HTML uses `renderChoiceMark(kind, word, lang)` for the same markup, and `clearChoice(row)` removes a mark.
3. Puts the explanation in a paragraph after the group. The mark holds only its word.

The words are "Correct", "Incorrect" and "Correct answer" in English and "Correct", "Incorrect" and "Bonne réponse" in French. [en.html](en.html) and [fr.html](fr.html) show a group before and after checking.

## Accessibility

- The legend names the group and each label names its option. Clicking anywhere on the row selects it.
- Tab moves into the group, the arrow keys move between radio buttons and Space ticks a checkbox. The focused row shows a 3px focus ring.
- A selected row gets a thicker accent border and a tint. Screen readers don't read the letters A, B, C.
- Each mark has an icon and a word, so the result never relies on colour. The row for a missed answer has a dashed border.
- In forced colours, the native radio buttons and checkboxes come back, the selected row uses the system highlight, marked rows get a double border and the missed row stays dashed.
- Rows are at least 48px tall. On a narrow card, the mark moves under the option text.
- Without JavaScript, learners can still choose answers.

## Copy these files

- `lib/base.css`: every style for the rows and marks.
- `lib/choice-mark.js`, `lib/icons.js` and `lib/html.js`, if a script or your server adds marks. `choice-mark.js` imports the other two.
- `lib/lock.js`, if a script freezes the rows after checking.

Keep the files in a `lib/` folder and keep their relative imports. The example pages are for reference: copy the markup, not the page.

## Used by

Choice rows appear in [Answer with confidence](../../patterns/answer-with-confidence/README.md), [Change one detail](../../patterns/change-one-detail/README.md), ["I don't know" as an answer](../../patterns/dont-know/README.md), [Explain what you learned](../../patterns/explain-back/README.md), [Finish a worked example](../../patterns/finish-worked-example/README.md), [Your first answer replayed](../../patterns/first-answer/README.md), [Hint ladder](../../patterns/hint-ladder/README.md), [Build an if-then plan](../../patterns/if-then-plan/README.md), [Give feedback on a colleague's work](../../patterns/mark-colleague/README.md), [Spot the misconception](../../patterns/misconception/README.md), [Make a mistake and recover](../../patterns/mistake-recover/README.md), [Prolific questions](../../patterns/prolific-questions/README.md), [Printable retrieval sheet](../../patterns/retrieval-sheet/README.md), [Check your own answer](../../patterns/self-check/README.md), [Sort cases by principle](../../patterns/sort-by-principle/README.md) and [Pre-test to skip sections](../../patterns/test-out/README.md).

## Licence

[MIT](../../LICENSE). Keep the licence notice with copied code.
