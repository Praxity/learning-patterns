/** Freeze answer controls, preserving kept controls and authored Try again.
 * After layout, move lost focus to Try again or a fallback before freezing the focused control.
 * Preserve focus moved by the caller, and choose Try again after the caller can unhide it.
 * @param {HTMLElement} scope
 * @param {{ focus?: boolean }} [options] Set focus to false when restoring saved state.
 * @returns {() => void} Cancel pending focus and restore each control's prior state.
 */
export function lock(scope: HTMLElement, { focus }?: {
    focus?: boolean;
}): () => void;
