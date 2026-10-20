/** Session state: reload keeps it, closing the tab clears it. Denied/full/corrupt storage throws on use.
 * @param {{ pattern: string, lang: string, id: string, storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> }} options
 */
export function browserState({ pattern, lang, id, storage }: {
    pattern: string;
    lang: string;
    id: string;
    storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}): {
    /** @returns {unknown} */
    read(): unknown;
    /** @param {unknown} value */
    write(value: unknown): void;
    clear(): void;
};
