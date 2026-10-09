/** @typedef {{ en: string, fr: string }} Notice */
/** @typedef {{ providerName: string, dataNotice: Notice, questionNotice?: Notice }} NoticeConfig */
/** @param {string} provider @returns {NoticeConfig} */
export function noticeConfig(provider: string): NoticeConfig;
/** @param {NoticeConfig} config @param {string} lang @param {string} id @param {'answer' | 'question'} [subject] */
export function renderDataNotice(config: NoticeConfig, lang: string, id: string, subject?: "answer" | "question"): string;
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
export type Notice = {
    en: string;
    fr: string;
};
export type NoticeConfig = {
    providerName: string;
    dataNotice: Notice;
    questionNotice?: Notice;
};
export type CapReason = "ip_daily" | "budget";
