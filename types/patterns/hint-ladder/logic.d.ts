/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @returns {LearnerState} */
export function start(): LearnerState;
/** Where the learner is. The first question ends when they answer it (`solved`) or when its worked
 * answer shows (`shown`): they opened it, or only the correct option was left to try.
 * @param {Content} content @param {LearnerState} state @returns {Progress} */
export function progress(content: Content, state: LearnerState): Progress;
/** Check an option on the first question. A checked option cannot be checked again.
 * @param {Content} content @param {LearnerState} state @param {string} option @returns {LearnerState} */
export function tryFirst(content: Content, state: LearnerState, option: string): LearnerState;
/** Open the next help step: a hint, or the worked answer once every hint is open.
 * @param {Content} content @param {LearnerState} state @returns {LearnerState} */
export function openHelp(content: Content, state: LearnerState): LearnerState;
/** Check the question without hints. It takes one answer.
 * @param {Content} content @param {LearnerState} state @param {string} option @returns {LearnerState} */
export function tryFollowUp(content: Content, state: LearnerState, option: string): LearnerState;
/** Ignore invalid saved values and copy valid state. A value is valid when the learner's own steps
 * could have produced it.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** The closing sentence: how the first question went, then the one without hints.
 * @param {Content} content @param {LearnerState} state @param {SummaryStrings} strings */
export function summarize(content: Content, state: LearnerState, strings: SummaryStrings): string;
/** Replace authored placeholders in a single pass so inserted content stays literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
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
/**
 * `tries` holds the options checked on the first question, in order. `opened` counts help steps
 * opened: the hints, then the worked answer. `followUp` is the option checked on the last question.
 */
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
