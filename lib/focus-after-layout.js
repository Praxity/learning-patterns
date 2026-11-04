/**
 * Let the browser expose newly visible content before moving screen-reader focus.
 * @param {HTMLElement} target
 * @param {() => void} afterFocus
 * @param {AbortSignal} signal
 * @param {() => void} [focus] Optional focus action after layout.
 * @returns {() => void} Cancel a pending focus move.
 */
export function focusAfterLayout(target, afterFocus, signal, focus = () => target.focus()) {
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      if (signal.aborted || !target.isConnected) return;
      focus();
      afterFocus();
    });
  });
  return () => cancelAnimationFrame(frame);
}
