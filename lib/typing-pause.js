export const MIN_CHARS = 10;

/** Dhakal et al., CHI 2018 reports mean gaps of 239 ms, over 480 ms for slow typists.
 * https://doi.org/10.1145/3173574.3174220
 * Nielsen's 1 s flow limit informs the ceiling, not a guarantee of response time.
 * https://www.nngroup.com/articles/response-times-3-important-limits/
 * Three gaps start adaptation; the last nine keep a long thinking pause from dominating.
 * @param {{ minChars?: number, questionMark?: boolean }} [options]
 */
export function typingPause({ minChars = MIN_CHARS, questionMark = true } = {}) {
  /** @type {number[]} */
  const gaps = [];
  /** @type {number | undefined} */
  let previous;
  const wait = () => {
    if (gaps.length < 3) return 700;
    const sorted = [...gaps].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    return Math.max(400, Math.min(900, 2.5 * median));
  };
  return {
    /** @param {number} time Monotonic keydown time in milliseconds. */
    key(time) {
      if (previous !== undefined && time > previous) {
        gaps.push(time - previous);
        if (gaps.length > 9) gaps.shift();
      }
      previous = time;
    },
    wait,
    /** @param {string} text @param {string} checked @param {boolean} [enter]
     * @returns {number | null} Delay in ms, or null when no check is due.
     */
    delay(text, checked, enter = false) {
      const trimmed = text.trim();
      if (trimmed.length < minChars || trimmed === checked) return null;
      return enter || (questionMark && trimmed.endsWith('?')) ? 0 : wait();
    }
  };
}
