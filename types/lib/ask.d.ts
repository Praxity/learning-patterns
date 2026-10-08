/** Same-origin transport. No learner text is logged or kept by this client.
 * /config is read once, including failures. Create a new client to retry configuration.
 * @param {{ endpoint?: string, fetch?: typeof globalThis.fetch }} [options]
 * @returns {Ask}
 */
export function createAsk({ endpoint, fetch }?: {
    endpoint?: string;
    fetch?: typeof globalThis.fetch;
}): Ask;
/** @typedef {'offline' | 'refused' | 'busy' | 'budget' | 'invalid'} ErrorType */
/** @typedef {{ noul: number } | { choice: string, confidence: number }} Answer */
/** @typedef {Record<string, Answer>} Answers */
/** @typedef {import('./data-notice.js').NoticeConfig & { siteKey: string, provider: string }} Config */
/** @typedef {{ challengeSlot?: HTMLElement, signal?: AbortSignal }} AskOptions */
/** @typedef {((block: string, fields: Record<string, string>, options?: AskOptions) => Promise<Answers>) & { config(): Promise<Config> }} Ask */
/** @typedef {{ render(slot: HTMLElement, options: Record<string, unknown>): string, remove(id: string): void }} Turnstile */
export class AskError extends Error {
    /** @param {ErrorType} type */
    constructor(type: ErrorType);
    type: ErrorType;
}
export type ErrorType = "offline" | "refused" | "busy" | "budget" | "invalid";
export type Answer = {
    noul: number;
} | {
    choice: string;
    confidence: number;
};
export type Answers = Record<string, Answer>;
export type Config = import("./data-notice.js").NoticeConfig & {
    siteKey: string;
    provider: string;
};
export type AskOptions = {
    challengeSlot?: HTMLElement;
    signal?: AbortSignal;
};
export type Ask = ((block: string, fields: Record<string, string>, options?: AskOptions) => Promise<Answers>) & {
    config(): Promise<Config>;
};
export type Turnstile = {
    render(slot: HTMLElement, options: Record<string, unknown>): string;
    remove(id: string): void;
};
