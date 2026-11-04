/**
 * Let the browser expose newly visible content before moving screen-reader focus.
 * @param {HTMLElement} target
 * @param {() => void} afterFocus
 * @param {AbortSignal} signal
 * @param {() => void} [focus] Optional focus action after layout.
 * @returns {() => void} Cancel a pending focus move.
 */
export function focusAfterLayout(target: HTMLElement, afterFocus: () => void, signal: AbortSignal, focus?: () => void): () => void;
