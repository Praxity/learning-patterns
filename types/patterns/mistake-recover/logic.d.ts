/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @returns {LearnerState} */
export function start(): LearnerState;
/** @param {Content} content @param {LearnerState} state @returns {Progress} */
export function progress(content: Content, state: LearnerState): Progress;
/** @param {Content} content @param {LearnerState} state @param {Decision} decision @returns {LearnerState} */
export function decide(content: Content, state: LearnerState, decision: Decision): LearnerState;
/** @param {Content} content @param {LearnerState} state @param {0 | 1} item @param {string[]} ids @returns {LearnerState} */
export function recover(content: Content, state: LearnerState, item: 0 | 1, ids: string[]): LearnerState;
/** @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** @param {Content} content @param {LearnerState} state @param {SummaryStrings} strings */
export function summarize(content: Content, state: LearnerState, strings: SummaryStrings): string;
/** @param {string} template @param {Record<string, string | number>} values */
export function format(template: string, values: Record<string, string | number>): string;
export type Check = {
    label: string;
    value: string;
};
export type Step = {
    id: string;
    text: string;
    correct: boolean;
    stops?: true;
    feedback: string;
};
export type Request = {
    title: string;
    summary: string;
    checks: Check[];
    held: string;
    approved: string;
    stopped: string;
    notStopped: string;
    steps: Step[];
};
export type Colleague = {
    name: string;
    title: string;
    summary: string;
    checks: Check[];
    approved: string;
    stopped: string;
    notStopped: string;
    steps: Step[];
};
export type Content = {
    title: string;
    context: string;
    request: Request;
    colleague: Colleague;
};
export type Decision = "approve" | "hold";
export type LearnerState = {
    decision: Decision | null;
    steps: (string[] | null)[];
};
export type Status = "pending" | "held" | "approved" | "stopped" | "notStopped" | null;
export type Progress = {
    stage: "decide" | "recover" | "done";
    item: 0 | 1 | null;
    statuses: Status[];
};
export type SummaryStrings = {
    approvedStopped: string;
    approvedGoes: string;
    heldStopped: string;
    heldGoes: string;
};
