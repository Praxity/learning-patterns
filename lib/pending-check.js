/**
 * Guards a check button while its request runs, without aria-disabled or a new label: Chrome with
 * NVDA reads aria-disabled as only "unavailable", and Firefox reads a new label at once. Native
 * disabled drops keyboard focus in WebKit. A note after the button, hidden from screen readers,
 * shows the wait. Status says it once, after one second.
 * @param {HTMLElement} button @param {HTMLElement} status @param {string} text Typeset busy message.
 */
export function pendingCheck(button, status, text) {
  const note = button.ownerDocument.createElement('span');
  note.className = 'lp-small'; note.setAttribute('aria-hidden', 'true'); note.textContent = text;
  let active = false;
  /** @type {Text | undefined} */
  let said;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  return {
    get active() { return active; },
    start() {
      active = true; button.after(note);
      timer = setTimeout(() => { said = button.ownerDocument.createTextNode(text); status.replaceChildren(said); }, 1000);
    },
    /** Clears the busy message only while status still holds the node it wrote; a result with the same text stays. */
    stop() {
      active = false; clearTimeout(timer); note.remove();
      if (said && status.childNodes.length === 1 && status.firstChild === said) status.replaceChildren();
      said = undefined;
    }
  };
}
