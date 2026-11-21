/** @param {HTMLElement} button @param {HTMLElement} status @param {string} text Typeset busy message. */
export function pendingCheck(button: HTMLElement, status: HTMLElement, text: string): {
    readonly active: boolean;
    start(): void;
    stop(): void;
};
