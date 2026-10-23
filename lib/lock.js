import { focusAfterLayout } from './focus-after-layout.js';

/** Freeze answer controls, preserving kept controls and authored Try again.
 * Move focus to Try again or a scope fallback before hiding or disabling the focused control.
 * @param {HTMLElement} scope
 * @returns {() => void} Cancel pending focus and restore each control's prior state.
 */
export function lock(scope) {
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
  const active = scope.ownerDocument.activeElement;
  const lifetime = new AbortController();
  let cancelFocus = () => {};
  let restoreTabIndex = () => {};
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
    if (control === active && !typed) freezeFocused = freeze;
    else freeze();
  }
  if (freezeFocused) {
    /** @param {HTMLElement} element */
    const available = element => element !== active && !element.matches(':disabled')
      && !element.closest('[inert]') && element.getClientRects().length > 0
      && scope.ownerDocument.defaultView?.getComputedStyle(element).visibility === 'visible';
    const target = [...scope.querySelectorAll('[data-lp-try-again]')].map(element => /** @type {HTMLElement} */ (element)).find(available)
      ?? [...scope.querySelectorAll('a[href], button, input, textarea, select, summary, [tabindex], [contenteditable="true"]')]
        .map(element => /** @type {HTMLElement} */ (element)).find(available)
      ?? scope;
    if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) {
      target.tabIndex = -1;
      restoreTabIndex = () => target.removeAttribute('tabindex');
    }
    cancelFocus = focusAfterLayout(target, freezeFocused, lifetime.signal);
  }
  return () => {
    lifetime.abort();
    cancelFocus();
    restoreTabIndex();
    for (const { control, disabled, hidden, readOnly } of previous) {
      control.disabled = disabled;
      control.hidden = hidden;
      if ('readOnly' in control && readOnly !== undefined) control.readOnly = readOnly;
    }
  };
}
