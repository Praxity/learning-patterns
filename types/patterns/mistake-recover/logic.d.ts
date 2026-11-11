/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @returns {LearnerState} */
export function start(): LearnerState;
/** Where the learner is, and what each payment's status line says. Approving opens the request's
 * recovery; holding it opens the colleague's payment, so every learner recovers once.
 * @param {Content} content @param {LearnerState} state @returns {Progress} */
export function progress(content: Content, state: LearnerState): Progress;
/** Approve or hold the request.
 * @param {Content} content @param {LearnerState} state @param {Decision} decision @returns {LearnerState} */
export function decide(content: Content, state: LearnerState, decision: Decision): LearnerState;
/** Check the recovery steps chosen for the payment that is open. Recovery is checked once.
 * @param {Content} content @param {LearnerState} state @param {0 | 1} item @param {string[]} ids @returns {LearnerState} */
export function recover(content: Content, state: LearnerState, item: 0 | 1, ids: string[]): LearnerState;
/** Ignore invalid saved values and copy valid state. A value is valid when the learner's own steps
 * could have produced it.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** The closing sentence: the decision, then whether the payment it put at risk was stopped.
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
    request: Request;
    colleague: Colleague;
};
export type Decision = "approve" | "hold";
/**
 * `decision` holds the choice on the request. `steps` holds the step ids checked on the request and
 * on the colleague's payment, or null where no recovery was checked.
 */
export type LearnerState = {
    decision: Decision | null;
    steps: (string[] | null)[];
};
/**
 * What each payment's status line says, or null while it is not on screen.
 */
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
