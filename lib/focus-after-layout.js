/**
 * Let the browser expose newly visible content before moving screen-reader focus.
 * @param {HTMLElement} target
 * @param {() => void} afterFocus
 * @param {AbortSignal} signal
 * @returns {() => void} Cancel a pending focus move.
 */
export function focusAfterLayout(target, afterFocus, signal) {
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      if (signal.aborted || !target.isConnected) return;
      target.focus();
      afterFocus();
    });
  });
  return () => cancelAnimationFrame(frame);
}
