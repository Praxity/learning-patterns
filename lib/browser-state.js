/** Host state for a pattern that keeps its value in this browser, keyed per pattern, language and
 * instance, so a reload gets it back. Storage can be denied, full or corrupt: read and write throw
 * then, and the pattern shows its own notice (the journal says the entry couldn't be saved). Even
 * reaching `localStorage` can throw, so the adapter only touches storage when it is used.
 * @param {{ pattern: string, lang: string, id: string, storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> }} options
 * @returns {{ read(): unknown, write(value: unknown): void, clear(): void }}
 */
export function browserState({ pattern, lang, id, storage }) {
  for (const part of [pattern, lang, id]) {
    if (typeof part !== 'string' || !part || part.includes(':')) throw new Error('browserState needs a pattern, language and instance id without colons');
  }
  const key = `lp:${pattern}:${lang}:${id}`;
  const store = () => storage ?? globalThis.localStorage;
  return {
    read() { const raw = store().getItem(key); return raw === null ? null : JSON.parse(raw); },
    write(value) { store().setItem(key, JSON.stringify(value)); },
    clear() { store().removeItem(key); }
  };
}
