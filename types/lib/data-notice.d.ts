/** @typedef {import('./notice-ui.js').CapReason} CapReason */
/** @typedef {{ en: string, fr: string }} Notice */
/** @typedef {{ providerName: string, dataNotice: Notice, questionNotice?: Notice }} NoticeConfig */
/** @param {string} provider @returns {NoticeConfig} */
export function noticeConfig(provider: string): NoticeConfig;
export type CapReason = import("./notice-ui.js").CapReason;
export type Notice = {
    en: string;
    fr: string;
};
export type NoticeConfig = {
    providerName: string;
    dataNotice: Notice;
    questionNotice?: Notice;
};
export { renderDataNotice, CAP_MESSAGES, renderCapNotice, showCapNotice } from "./notice-ui.js";
