/** @param {import('./data-notice.js').NoticeConfig} config @param {string} lang @param {string} id @param {'answer' | 'question'} [subject] */
export function renderDataNotice(config: import("./data-notice.js").NoticeConfig, lang: string, id: string, subject?: "answer" | "question"): string;
/** @param {CapReason} reason @param {string} lang */
export function renderCapNotice(reason: CapReason, lang: string): string;
/** @param {unknown} error @param {HTMLElement} root @param {HTMLElement} fallback @param {HTMLElement} status */
export function showCapNotice(error: unknown, root: HTMLElement, fallback: HTMLElement, status: HTMLElement): boolean;
/** @typedef {'ip_daily' | 'budget'} CapReason */
export const CAP_MESSAGES: Readonly<{
    ip_daily: {
        en: string;
        fr: string;
    };
    budget: {
        en: string;
        fr: string;
    };
}>;
export type CapReason = "ip_daily" | "budget";
