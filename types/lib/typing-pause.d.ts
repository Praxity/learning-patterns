/** Adapt after three gaps; keep nine so a long thinking pause cannot dominate.
 * Timing evidence and limits are in patterns/course-lookup/README.md.
 * @param {{ minChars?: number, questionMark?: boolean }} [options]
 */
export function typingPause({ minChars, questionMark }?: {
    minChars?: number;
    questionMark?: boolean;
}): {
    /** @param {number} time Monotonic keydown time in milliseconds. */
    key(time: number): void;
    wait: () => number;
    /** @param {string} text @param {string} checked @param {boolean} [enter]
     * @returns {number | null} Delay in ms, or null when no check is due.
     */
    delay(text: string, checked: string, enter?: boolean): number | null;
};
export const MIN_CHARS: 10;
