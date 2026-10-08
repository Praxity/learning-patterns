/** The configured model determines which evaluated Choice gate applies.
 * @param {string} model @returns {number}
 */
export function confidenceGate(model: string): number;
/** @param {{ choice: string, confidence: number }} answer @param {string} model */
export function misconceptionFeedback({ choice, confidence }: {
    choice: string;
    confidence: number;
}, model: string): {
    kind: string;
    sure: boolean;
    log: boolean;
    text: string;
    status: string;
};
export const CONFIDENT: 0.65;
export const CLEF_CONFIDENT: 0.5;
export const INBOX_KEY: "jev-demos:06-inbox";
export const ANSWER_LIMIT: 1500;
export namespace CATALOGUE {
    namespace rereading {
        let label: string;
        let idea: string;
        let why: string;
    }
    namespace highlighting {
        let label_1: string;
        export { label_1 as label };
        let idea_1: string;
        export { idea_1 as idea };
        let why_1: string;
        export { why_1 as why };
    }
    namespace cramming {
        let label_2: string;
        export { label_2 as label };
        let idea_2: string;
        export { idea_2 as idea };
        let why_2: string;
        export { why_2 as why };
    }
    namespace watching {
        let label_3: string;
        export { label_3 as label };
        let idea_3: string;
        export { idea_3 as idea };
        let why_3: string;
        export { why_3 as why };
    }
}
export const MISCONCEPTION_KEYS: string[];
