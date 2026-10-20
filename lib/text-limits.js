/** Check schema character limits without changing authored text. Shape checks belong to each pattern.
 * @param {unknown} value @param {unknown} limits @param {string} [path]
 */
export function validateTextLengths(value, limits, path = 'content') {
  if (typeof limits === 'number') {
    if (typeof value === 'string' && [...value].length > limits) throw new Error(`Invalid ${path}: maximum ${limits} characters`);
  } else if (Array.isArray(limits)) {
    if (Array.isArray(value)) value.forEach((item, i) => validateTextLengths(item, limits[0], `${path}[${i}]`));
  } else if (limits && typeof limits === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    const bounds = /** @type {Record<string, unknown>} */ (limits);
    for (const [key, item] of Object.entries(value)) {
      const next = bounds[key] ?? bounds['*'];
      if (next !== undefined) validateTextLengths(item, next, path === 'content' ? key : `${path}.${key}`);
    }
  }
}
