---
title: Buttons and action row
title_fr: Boutons et rangée d’actions
summary: One primary button, secondary and quiet buttons, and the row that holds them and wraps on narrow screens.
---
# Buttons and action row

The buttons learners press to move through an activity, in a row that wraps. An activity has one primary button for its main step, such as Check my answer. Secondary buttons hold other steps, and a quiet button with an icon holds Try again or Start over.

## Use it when

- Learners take a step inside the activity, such as checking an answer, asking for a hint or starting again.

## Avoid it when

- When the action takes learners to another page, use a link.

## Markup

```html
<section class="lp" lang="en">
  <div class="lp-actions">
    <button class="lp-button" type="button">Check my answer</button>
    <button class="lp-button lp-button-secondary" type="button">Show a hint</button>
  </div>
  <div class="lp-actions">
    <button class="lp-button lp-button-quiet" type="button"><svg class="lp-icon" aria-hidden="true" focusable="false">…</svg>Try again</button>
  </div>
</section>
```

- Keep the markup inside an element with the `lp` class, as the snippet does. `lib/base.css` defines the `--lp-*` colour, spacing and type tokens on `.lp`, so outside it the buttons lose their colours and focus ring. A pattern's root section already has the class.
- Use `lp-button` for one main step per activity, `lp-button-secondary` for the others and `lp-button-quiet` with the `refresh` icon from `lib/icons.js` for Try again and Start over. [en.html](en.html) has the full SVG.
- A secondary button that switches something on and off takes `aria-pressed`, and shows as pressed when it is `"true"`.
- A button that only works with JavaScript starts `hidden` in server HTML, and the script unhides it. A row whose buttons are all hidden takes no space.
- To stop a button for a while, use `disabled`. Use `aria-disabled="true"` instead when learners still need to reach it to read a message linked to it. The attribute only changes what screen readers announce: the button still takes focus and fires clicks, so its click handler must return early while the attribute is `"true"`, as the suggestion button's handler in [`patterns/journal/enhance.js`](../../patterns/journal/enhance.js) does.

[en.html](en.html) and [fr.html](fr.html) show a row before checking and after.

## Accessibility

- Each is a real `button`, so Enter and Space press it and its text is its name. Icons are decorative.
- Buttons are at least 44px tall, and long labels wrap instead of overflowing.
- The focused button shows a 3px focus ring. In forced colours, buttons use the system button colours and the quiet button uses the link colour.
- When the card is narrower than 30rem, primary and secondary buttons fill the row.
- A pressed button shrinks slightly for 150 ms. With reduced motion, nothing moves.

## Copy these files

- `lib/base.css`: the button and row styles.
- `lib/icons.js`, if your server or a script writes the icon. Otherwise copy the SVG from the example.

## Used by

Every pattern except [Instant course lookup](../../patterns/course-lookup/README.md) and [Feedback while you type](../../patterns/live-feedback/README.md) uses the action row. Try again and Start over use the quiet button in patterns such as [Answer with confidence](../../patterns/answer-with-confidence/README.md), [Change one detail](../../patterns/change-one-detail/README.md) and [Scenario talk-through](../../patterns/conversation/README.md).

## Licence

[MIT](../../LICENSE). Keep the licence notice with copied code.
