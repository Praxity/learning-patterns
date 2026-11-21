/** @param {HTMLElement} scope
 * @param {{ focus?: boolean }} [options] Set focus to false when restoring saved state.
 * @returns {() => void} Cancel pending focus and restore each control's prior state. */
export function lock(scope: HTMLElement, { focus }?: {
    focus?: boolean;
}): () => void;
