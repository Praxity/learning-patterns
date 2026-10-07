/** Key A belongs to the right answer; wrong options start at index 1.
 * @param {number} index @returns {string}
 */
export function optionKey(index: number): string;
/** Validate plain authored content and its misconception references.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content: unknown): asserts content is Content;
/** Field errors use codes so every learner-facing message lives in strings.js.
 * Length is checked before normalization, matching HTML maxlength.
 * @param {Content} content @param {LearnerOption[]} options
 * @returns {{ ok: false, errors: FieldError[] } | { ok: true, options: LearnerOption[] }}
 */
export function validateOptions(content: Content, options: LearnerOption[]): {
    ok: false;
    errors: FieldError[];
} | {
    ok: true;
    options: LearnerOption[];
};
/** @param {Content} content @param {AuthorOption | LearnerOption} option @returns {string} */
export function targetOf(content: Content, option: AuthorOption | LearnerOption): string;
/** Compare tags, never infer a misconception from the learner's answer text.
 * @param {Content} content @param {LearnerOption[]} options
 */
export function coverage(content: Content, options: LearnerOption[]): {
    targeted: string[];
    missed: string[];
    extra: string[];
    matches: boolean[];
};
/** Return comparison counts and labels; the host formats learner-facing text.
 * @param {Content} content @param {LearnerOption[]} options
 * @returns {{ authorTargeted: number, authorTotal: number, ownExtra: number, untargeted: string[] }}
 */
export function coverageMessage(content: Content, options: LearnerOption[]): {
    authorTargeted: number;
    authorTotal: number;
    ownExtra: number;
    untargeted: string[];
};
/** Accept incomplete drafts; shown results must pass submission validation.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** @typedef {{ id: string, label: string }} Misconception */
/** @typedef {{ text: string, misconception: string }} AuthorOption */
/** @typedef {{ question: string, rightAnswer: string, misconceptions: Misconception[], authorOptions: AuthorOption[], count: number }} Content */
/** @typedef {{ text: string, misconception: string, custom: string }} LearnerOption */
/** @typedef {{ answer: string, hadIt: boolean | null, options: LearnerOption[], shown: boolean }} LearnerState */
/** @typedef {'text' | 'misconception' | 'custom'} Field */
/** @typedef {'empty' | 'longText' | 'right' | 'duplicate' | 'choose' | 'describe' | 'longCustom'} ErrorCode */
/** @typedef {{ option: number, field: Field, code: ErrorCode }} FieldError */
export const OTHER: "other";
export const MAX_OPTION: 300;
export const MAX_CUSTOM: 120;
export type Misconception = {
    id: string;
    label: string;
};
export type AuthorOption = {
    text: string;
    misconception: string;
};
export type Content = {
    question: string;
    rightAnswer: string;
    misconceptions: Misconception[];
    authorOptions: AuthorOption[];
    count: number;
};
export type LearnerOption = {
    text: string;
    misconception: string;
    custom: string;
};
export type LearnerState = {
    answer: string;
    hadIt: boolean | null;
    options: LearnerOption[];
    shown: boolean;
};
export type Field = "text" | "misconception" | "custom";
export type ErrorCode = "empty" | "longText" | "right" | "duplicate" | "choose" | "describe" | "longCustom";
export type FieldError = {
    option: number;
    field: Field;
    code: ErrorCode;
};
