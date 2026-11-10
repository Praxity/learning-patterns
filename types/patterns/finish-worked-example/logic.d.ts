/** The limits keep a case short enough to finish: two to four steps, three or four cases, one-line facts.
 * @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** Steps of one case the learner does, in order.
 * @param {Content} content @param {number} caseIndex @returns {number[]} */
export function learnerSteps(content: Content, caseIndex: number): number[];
/** @param {Content} content @returns {LearnerState} */
export function emptyState(content: Content): LearnerState;
/** The step the learner answers next in a case, or -1 once the case is finished.
 * @param {Content} content @param {LearnerState} state @param {number} caseIndex @returns {number} */
export function nextStep(content: Content, state: LearnerState, caseIndex: number): number;
/** The furthest case the learner may open: the first unfinished one, or the last.
 * @param {Content} content @param {LearnerState} state @returns {number} */
export function reach(content: Content, state: LearnerState): number;
/** Record the learner's answer to the next step. Steps are answered in order and never changed.
 * @param {Content} content @param {LearnerState} state @param {number} caseIndex @param {number} step @param {number} pick
 * @returns {LearnerState} */
export function answer(content: Content, state: LearnerState, caseIndex: number, step: number, pick: number): LearnerState;
/** Open a case the learner has reached.
 * @param {Content} content @param {LearnerState} state @param {number} caseIndex @returns {LearnerState} */
export function move(content: Content, state: LearnerState, caseIndex: number): LearnerState;
/** Count the learner's own steps across every case.
 * @param {Content} content @param {LearnerState} state @returns {{ right: number, total: number, done: boolean }} */
export function result(content: Content, state: LearnerState): {
    right: number;
    total: number;
    done: boolean;
};
/** Copy valid saved state, or return null. Answers must follow the order the pattern allows.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** Replace `{name}` placeholders; inserted text is kept literally.
 * @param {string} template @param {Record<string, string | number>} values @returns {string} */
export function format(template: string, values: Record<string, string | number>): string;
export type Step = {
    question: string;
    options: string[];
};
export type CaseStep = {
    answer: number;
    reason: string;
    worked: boolean;
};
export type Case = {
    facts: {
        label: string;
        text: string;
    }[];
    steps: CaseStep[];
};
export type Content = {
    title: string;
    context: string;
    steps: Step[];
    cases: Case[];
};
export type LearnerState = {
    at: number;
    picks: (number | null)[][];
};
