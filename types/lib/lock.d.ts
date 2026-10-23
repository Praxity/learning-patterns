/** Freeze answer controls, preserving kept controls and authored Try again.
 * Move focus to Try again or a scope fallback before hiding or disabling the focused control.
 * @param {HTMLElement} scope
 * @returns {() => void} Cancel pending focus and restore each control's prior state.
 */
export function lock(scope: HTMLElement): () => void;
