/** @param {HTMLElement} fieldset */
export function focusQuestion(fieldset) {
  const legend = fieldset.querySelector('legend');
  const input = fieldset.querySelector('input');
  if (!legend || !input) throw new Error('Missing question legend or option');
  const view = fieldset.ownerDocument.defaultView;
  if (!view) throw new Error('Question focus needs a window');
  const top = parseFloat(view.getComputedStyle(fieldset.ownerDocument.documentElement).scrollPaddingTop) || 0;
  if (legend.getBoundingClientRect().top < top - 1 || (input.closest('label') ?? input).getBoundingClientRect().bottom > view.innerHeight + 1) {
    legend.scrollIntoView({ block: 'start' });
  }
  input.focus({ preventScroll: true });
}

/** @param {HTMLElement} summary
 * @param {{ fieldset: HTMLElement, text: string, focus(): void }[]} questions */
export function questionLinks(summary, questions) {
  const list = summary.ownerDocument.createElement('ul');
  for (const { fieldset, text, focus } of questions) {
    const item = summary.ownerDocument.createElement('li');
    const link = summary.ownerDocument.createElement('button');
    link.type = 'button';
    link.className = 'lp-button lp-button-quiet';
    item.dataset.lpQuestionTarget = fieldset.id;
    link.textContent = text;
    link.tabIndex = 0;
    link.addEventListener('click', event => { event.preventDefault(); focus(); });
    item.append(link); list.append(item);
  }
  summary.append(list);
}

/** @param {HTMLElement} summary
 * @param {HTMLElement} fieldset */
export function clearQuestionLink(summary, fieldset) {
  for (const item of summary.querySelectorAll('li')) {
    if (item.dataset.lpQuestionTarget === fieldset.id) item.remove();
  }
  summary.hidden = !summary.querySelector('li');
}
