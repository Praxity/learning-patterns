/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @returns {LearnerState} */
export function start(): LearnerState;
/** Where the learner is, and what each payment's status line says. Requests come in order; an
 * approved request is recovered before the next. Holding both opens the colleague's payment.
 * @param {Content} content @param {LearnerState} state @returns {Progress} */
export function progress(content: Content, state: LearnerState): Progress;
/** Approve or hold the request that is open.
 * @param {Content} content @param {LearnerState} state @param {0 | 1} item @param {Decision} decision @returns {LearnerState} */
export function decide(content: Content, state: LearnerState, item: 0 | 1, decision: Decision): LearnerState;
/** Check the recovery steps chosen for the payment that is open. Recovery is checked once.
 * @param {Content} content @param {LearnerState} state @param {0 | 1 | 2} item @param {string[]} ids @returns {LearnerState} */
export function recover(content: Content, state: LearnerState, item: 0 | 1 | 2, ids: string[]): LearnerState;
/** Ignore invalid saved values and copy valid state. A value is valid when the learner's own steps
 * could have produced it.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** The closing sentence: each decision, then whether each payment that needed recovery was stopped.
 * @param {Content} content @param {LearnerState} state @param {SummaryStrings} strings */
export function summarize(content: Content, state: LearnerState, strings: SummaryStrings): string;
/** Replace authored placeholders in a single pass so inserted content stays literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
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
    requests: [Request, Request];
    colleague: Colleague;
};
export type Decision = "approve" | "hold";
/**
 * `decisions` holds the choice on each request. `steps` holds the step ids checked on request 1,
 * request 2 and the colleague's payment, or null where no recovery was checked.
 */
export type LearnerState = {
    decisions: (Decision | null)[];
    steps: (string[] | null)[];
};
/**
 * What each payment's status line says, or null while it is not on screen.
 */
export type Status = "pending" | "held" | "approved" | "stopped" | "notStopped" | null;
export type Progress = {
    stage: "decide" | "recover" | "done";
    item: 0 | 1 | 2 | null;
    statuses: Status[];
};
export type SummaryStrings = {
    heldBoth: string;
    approvedFirst: string;
    approvedSecond: string;
    approvedBoth: string;
    colleagueStopped: string;
    colleagueGoes: string;
    oneStopped: string;
    oneGoes: string;
    bothStopped: string;
    oneOfTwoStopped: string;
    bothGo: string;
    summary: string;
};
