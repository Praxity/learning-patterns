/** Session state: reload keeps it, closing the tab clears it. Denied/full/corrupt storage throws on use.
 * @param {{ pattern: string, lang: string, id: string, storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> }} options
 */
export function browserState({ pattern, lang, id, storage }) {
  for (const part of [pattern, lang, id]) {
    if (typeof part !== 'string' || !part || part.includes(':')) throw new Error('browserState needs a pattern, language and instance id without colons');
  }
  const key = `lp:${pattern}:${lang}:${id}`;
  const store = () => storage ?? globalThis.sessionStorage;
  return {
    /** @returns {unknown} */
    read() { const raw = store().getItem(key); return raw === null ? null : JSON.parse(raw); },
    /** @param {unknown} value */
    write(value) { store().setItem(key, JSON.stringify(value)); },
    clear() { store().removeItem(key); }
  };
}
