export const MIN_CHARS = 10;

/** Adapt after three gaps; keep nine so a long thinking pause cannot dominate.
 * Timing evidence and limits are in patterns/course-lookup/README.md.
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
