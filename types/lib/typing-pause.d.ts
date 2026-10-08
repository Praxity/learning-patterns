/** Dhakal et al., CHI 2018 reports mean gaps of 239 ms, over 480 ms for slow typists.
 * https://doi.org/10.1145/3173574.3174220
 * Nielsen's 1 s flow limit informs the ceiling, not a guarantee of response time.
 * https://www.nngroup.com/articles/response-times-3-important-limits/
 * Three gaps start adaptation; the last nine keep a long thinking pause from dominating.
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
