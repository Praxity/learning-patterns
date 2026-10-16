/**
 * Guards a check button while its request runs, without aria-disabled or a new label: Chrome with
 * NVDA reads aria-disabled as only "unavailable", and Firefox reads a new label at once. A note after
 * the button, hidden from screen readers, shows the wait. Status says it once, after one second.
 * @param {HTMLElement} button @param {HTMLElement} status @param {string} text Typeset busy message.
 */
export function pendingCheck(button, status, text) {
  const note = button.ownerDocument.createElement('span');
  note.className = 'lp-small'; note.setAttribute('aria-hidden', 'true'); note.textContent = text;
  let active = false;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  return {
    get active() { return active; },
    start() { active = true; button.after(note); timer = setTimeout(() => { status.textContent = text; }, 1000); },
    /** Clears the busy message if no result replaced it. */
    stop() { active = false; clearTimeout(timer); note.remove(); if (status.textContent === text) status.textContent = ''; }
  };
}
