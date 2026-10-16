/**
 * Guards a check button while its request runs, without aria-disabled or a new label: Chrome with
 * NVDA reads aria-disabled as only "unavailable", and Firefox reads a new label at once. A note after
 * the button, hidden from screen readers, shows the wait. Status says it once, after one second.
 * @param {HTMLElement} button @param {HTMLElement} status @param {string} text Typeset busy message.
 */
export function pendingCheck(button: HTMLElement, status: HTMLElement, text: string): {
    readonly active: boolean;
    start(): void;
    /** Clears the busy message if no result replaced it. */
    stop(): void;
};
