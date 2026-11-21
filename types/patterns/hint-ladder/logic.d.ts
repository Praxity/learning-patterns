/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @returns {LearnerState} */
export function start(): LearnerState;
/** @param {Content} content @param {LearnerState} state @returns {Progress} */
export function progress(content: Content, state: LearnerState): Progress;
/** @param {Content} content @param {LearnerState} state @param {string} option @returns {LearnerState} */
export function tryFirst(content: Content, state: LearnerState, option: string): LearnerState;
/** @param {Content} content @param {LearnerState} state @returns {LearnerState} */
export function openHelp(content: Content, state: LearnerState): LearnerState;
/** @param {Content} content @param {LearnerState} state @param {string} option @returns {LearnerState} */
export function tryFollowUp(content: Content, state: LearnerState, option: string): LearnerState;
/** @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** @param {Content} content @param {LearnerState} state @param {SummaryStrings} strings */
export function summarize(content: Content, state: LearnerState, strings: SummaryStrings): string;
/** @param {string} template @param {Record<string, string | number>} values */
export function format(template: string, values: Record<string, string | number>): string;
export type Option = {
    id: string;
    text: string;
    feedback?: string;
};
export type FollowUp = {
    question: string;
    options: {
        id: string;
        text: string;
    }[];
    correct: string;
    explanation: string;
};
export type Content = {
    title: string;
    context?: string;
    question: string;
    options: Option[];
    correct: string;
    hints: string[];
    worked: string;
    followUp: FollowUp;
};
export type LearnerState = {
    tries: string[];
    opened: number;
    followUp: string | null;
};
export type Progress = {
    first: "open" | "solved" | "shown";
    tries: number;
    hints: number;
    next: "hint" | "worked" | null;
    gated: boolean;
    followUp: "right" | "wrong" | null;
    done: boolean;
};
export type SummaryStrings = {
    tryOne: string;
    tryMany: string;
    hintNone: string;
    hintOne: string;
    hintMany: string;
    firstSolved: string;
    firstShown: string;
    followUpRight: string;
    followUpWrong: string;
    summary: string;
};
