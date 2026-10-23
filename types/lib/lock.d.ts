/** Freeze answer controls without changing kept controls or the authored Try again button.
 * @param {HTMLElement} scope
 * @returns {() => void} Restore each control's prior state.
 */
export function lock(scope: HTMLElement): () => void;
