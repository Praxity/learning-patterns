/** @typedef {typeof strings.en} Strings */
/** Format numbers in authored messages, including repeated placeholders.
 * @param {string} template @param {Record<string, number>} values @param {string} lang @returns {string}
 */
export function formatText(template: string, values: Record<string, number>, lang: string): string;
/** @param {Strings} strings @param {number} total @param {number} flagged @param {string} lang @returns {string} */
export function summaryText(strings: Strings, total: number, flagged: number, lang: string): string;
export namespace strings {
    namespace en {
        let authorView: string;
        let instruction: string;
        let words: string;
        let narrationSeconds: string;
        let questions: string;
        let breakdown: string;
        let breakdownOne: string;
        let minutes: string;
        let warning: string;
        let noEstimate: string;
        let invalid: string;
        let tooLarge: string;
        let estimateTooLarge: string;
        let fix: string;
        let total: string;
        let flaggedOne: string;
        let flaggedMany: string;
        let noneFlagged: string;
        let assumptions: string;
    }
    namespace fr {
        let authorView_1: string;
        export { authorView_1 as authorView };
        let instruction_1: string;
        export { instruction_1 as instruction };
        let words_1: string;
        export { words_1 as words };
        let narrationSeconds_1: string;
        export { narrationSeconds_1 as narrationSeconds };
        let questions_1: string;
        export { questions_1 as questions };
        let breakdown_1: string;
        export { breakdown_1 as breakdown };
        let breakdownOne_1: string;
        export { breakdownOne_1 as breakdownOne };
        let minutes_1: string;
        export { minutes_1 as minutes };
        let warning_1: string;
        export { warning_1 as warning };
        let noEstimate_1: string;
        export { noEstimate_1 as noEstimate };
        let invalid_1: string;
        export { invalid_1 as invalid };
        let tooLarge_1: string;
        export { tooLarge_1 as tooLarge };
        let estimateTooLarge_1: string;
        export { estimateTooLarge_1 as estimateTooLarge };
        let fix_1: string;
        export { fix_1 as fix };
        let total_1: string;
        export { total_1 as total };
        let flaggedOne_1: string;
        export { flaggedOne_1 as flaggedOne };
        let flaggedMany_1: string;
        export { flaggedMany_1 as flaggedMany };
        let noneFlagged_1: string;
        export { noneFlagged_1 as noneFlagged };
        let assumptions_1: string;
        export { assumptions_1 as assumptions };
    }
}
export type Strings = typeof strings.en;
