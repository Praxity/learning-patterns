/** Scroll the question into view without letting input focus hide its legend.
 * @param {HTMLElement} fieldset
 */
export function focusQuestion(fieldset) {
  const legend = fieldset.querySelector('legend');
  const input = fieldset.querySelector('input');
  if (!legend || !input) throw new Error('Missing question legend or option');
  legend.scrollIntoView({ block: 'start' });
  input.focus({ preventScroll: true });
}

/** Keep unanswered links beside Check. Callers reveal a hidden panel before focus.
 * @param {HTMLElement} summary
 * @param {{ fieldset: HTMLElement, text: string, focus(): void }[]} questions
 */
export function questionLinks(summary, questions) {
  const list = summary.ownerDocument.createElement('ul');
  for (const { fieldset, text, focus } of questions) {
    const item = summary.ownerDocument.createElement('li');
    const link = summary.ownerDocument.createElement('a');
    link.href = `#${fieldset.id}`;
    link.textContent = text;
    link.tabIndex = 0;
    link.addEventListener('click', event => { event.preventDefault(); focus(); });
    item.append(link); list.append(item);
  }
  summary.append(list);
}
