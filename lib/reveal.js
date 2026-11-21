/** @param {HTMLElement} element */
export function reveal(element) {
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (!view) throw new Error('Reveal needs a document with a window');
  element.hidden = false;
  const rect = element.getBoundingClientRect();
  const top = parseFloat(view.getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  if (rect.top < top - 1 || rect.bottom > view.innerHeight + 1
    || rect.left < -1 || rect.right > view.innerWidth + 1) {
    const reduce = view.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollIntoView({ block: 'nearest', behavior: reduce ? 'instant' : 'smooth' });
  }
}
