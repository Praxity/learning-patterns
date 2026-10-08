/** @typedef {{ en: string, fr: string }} Notice */
/** @typedef {{ providerName: string, dataNotice: Notice, questionNotice?: Notice }} NoticeConfig */
/** The proxy owns the notice and publishes it in /config.
 * @param {string} provider @returns {NoticeConfig}
 */
export function noticeConfig(provider: string): NoticeConfig;
/** Render the configured notice under an input. All configuration text stays plain text.
 * Patterns where the learner asks rather than answers pass 'question'; configs without that wording fall back to the answer notice.
 * @param {NoticeConfig} config @param {string} lang @param {string} id @param {'answer' | 'question'} [subject] @returns {string}
 */
export function renderDataNotice(config: NoticeConfig, lang: string, id: string, subject?: "answer" | "question"): string;
export type Notice = {
    en: string;
    fr: string;
};
export type NoticeConfig = {
    providerName: string;
    dataNotice: Notice;
    questionNotice?: Notice;
};
