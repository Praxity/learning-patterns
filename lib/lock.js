/** Freeze answer controls, preserving kept controls and authored Try again.
 * After layout, move lost focus to Try again or a fallback before freezing the focused control.
 * Preserve focus moved by the caller, and choose Try again after the caller can unhide it.
 * @param {HTMLElement} scope
 * @param {{ focus?: boolean }} [options] Set focus to false when restoring saved state.
 * @returns {() => void} Cancel pending focus and restore each control's prior state.
 */
export function lock(scope, { focus = true } = {}) {
  const controls = [...scope.querySelectorAll('input, textarea, select, button')]
    .map(element => /** @type {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement} */ (element))
    .filter(control => {
      const kept = control.closest('[data-lp-keep], [data-lp-try-again]');
      return !kept || !scope.contains(kept);
    });
  const previous = controls.map(control => ({
    control, disabled: control.disabled, hidden: control.hidden,
    readOnly: 'readOnly' in control ? control.readOnly : undefined
  }));
  const document = scope.ownerDocument, active = document.activeElement;
  let cancelled = false;
  let cancelFocus = () => {};
  /** @type {HTMLElement[]} */
  const temporaryTabIndexes = [];
  /** @type {(() => void) | undefined} */
  let freezeFocused;
  for (const control of controls) {
    // Use the normalized input type, including an omitted or invalid type's text fallback.
    const typed = 'readOnly' in control && (control.localName === 'textarea'
      || /^(text|search|email|url|tel|password|number|date|month|week|time|datetime-local)$/.test(control.type));
    const actions = control.closest('.lp-actions');
    const hide = control.matches('button, input[type=button], input[type=submit], input[type=reset]')
      && actions && scope.contains(actions);
    const freeze = () => {
      if (typed && 'readOnly' in control) control.readOnly = true;
      else control.disabled = true;
      if (hide) control.hidden = true;
    };
    if (focus && control === active && !typed) freezeFocused = freeze;
    else freeze();
  }
  if (focus && (freezeFocused || active === document.body)) {
    const focusable = 'a[href], button, input, textarea, select, summary, [tabindex], [contenteditable="true"]';
    /** @param {HTMLElement} element */
    const available = element => element !== active && !element.matches(':disabled')
      && !element.closest('[inert]') && element.getClientRects().length > 0
      && document.defaultView?.getComputedStyle(element).visibility === 'visible';
    /** @param {HTMLElement} element */
    const moveFocus = element => {
      if (element.tabIndex < 0 && !element.hasAttribute('tabindex')) {
        element.tabIndex = -1;
        temporaryTabIndexes.push(element);
      }
      element.focus();
    };
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        try {
          if (document.activeElement !== active && document.activeElement !== document.body) return;
          const retry = [...scope.querySelectorAll('[data-lp-try-again]')]
            .flatMap(element => element.matches(focusable) ? [element] : [...element.querySelectorAll(focusable)])
            .map(element => /** @type {HTMLElement} */ (element)).find(available);
          if (!freezeFocused && !retry) return;
          const target = retry
            ?? [...scope.querySelectorAll(focusable)]
              .map(element => /** @type {HTMLElement} */ (element)).find(available)
            ?? scope;
          moveFocus(target);
          if (cancelled) return;
          if (document.activeElement !== target) {
            moveFocus(scope);
            if (cancelled) return;
          }
        } finally {
          // Locking must finish even if focus moved elsewhere or the target disappeared.
          if (!cancelled) freezeFocused?.();
        }
      });
    });
    cancelFocus = () => cancelAnimationFrame(frame);
  }
  return () => {
    cancelled = true;
    cancelFocus();
    for (const element of temporaryTabIndexes) element.removeAttribute('tabindex');
    for (const { control, disabled, hidden, readOnly } of previous) {
      control.disabled = disabled;
      control.hidden = hidden;
      if ('readOnly' in control && readOnly !== undefined) control.readOnly = readOnly;
    }
  };
}
