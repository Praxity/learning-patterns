/** Show feedback, scrolling only if it crosses the viewport's visible bounds.
 * @param {HTMLElement} element @param {{ focus?: boolean }} [options]
 */
export function reveal(element: HTMLElement, { focus }?: {
    focus?: boolean;
}): void;
