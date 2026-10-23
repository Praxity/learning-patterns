/** Freeze answer controls without changing kept controls or the authored Try again button.
 * @param {HTMLElement} scope
 * @returns {() => void} Restore each control's prior state.
 */
export function lock(scope) {
  const controls = [...scope.querySelectorAll('input, textarea, select, button')]
    .map(element => /** @type {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement} */ (element))
    .filter(control => !control.closest('[data-lp-keep], [data-lp-try-again]'));
  const previous = controls.map(control => ({
    control, disabled: control.disabled, hidden: control.hidden,
    readOnly: 'readOnly' in control ? control.readOnly : undefined
  }));
  for (const control of controls) {
    // Use the normalized input type, including an omitted or invalid type's text fallback.
    if ('readOnly' in control && (control.localName === 'textarea'
      || /^(text|search|email|url|tel|password|number|date|month|week|time|datetime-local)$/.test(control.type))) {
      control.readOnly = true;
    } else control.disabled = true;
    if (control.matches('button, input[type=button], input[type=submit], input[type=reset]')
      && control.closest('.lp-actions')) control.hidden = true;
  }
  return () => {
    for (const { control, disabled, hidden, readOnly } of previous) {
      control.disabled = disabled;
      control.hidden = hidden;
      if ('readOnly' in control && readOnly !== undefined) control.readOnly = readOnly;
    }
  };
}
