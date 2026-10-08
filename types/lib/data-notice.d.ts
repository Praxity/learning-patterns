/** @typedef {{ providerName: string, dataNotice: { en: string, fr: string } }} NoticeConfig */
/** The proxy owns the notice and publishes it in /config.
 * @param {string} provider @returns {NoticeConfig}
 */
export function noticeConfig(provider: string): NoticeConfig;
/** Render the configured notice under an input. All configuration text stays plain text.
 * @param {NoticeConfig} config @param {string} lang @param {string} id @returns {string}
 */
export function renderDataNotice(config: NoticeConfig, lang: string, id: string): string;
export type NoticeConfig = {
    providerName: string;
    dataNotice: {
        en: string;
        fr: string;
    };
};
