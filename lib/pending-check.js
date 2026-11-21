/** @param {HTMLElement} button @param {HTMLElement} status @param {string} text Typeset busy message. */
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
    stop() {
      active = false; clearTimeout(timer); note.remove();
      if (said && status.childNodes.length === 1 && status.firstChild === said) status.replaceChildren();
      said = undefined;
    }
  };
}
