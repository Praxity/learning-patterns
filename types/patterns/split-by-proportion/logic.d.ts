/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** Start near an equal split. @param {Content} content @returns {number[]} */
export function initialDividers(content: Content): number[];
/** @param {Content} content @param {number[]} dividers @returns {number[]} */
export function shares(content: Content, dividers: number[]): number[];
/** @param {Content} content @param {number[]} dividers @param {number} index @param {number} value */
export function moveDivider(content: Content, dividers: number[], index: number, value: number): number[];
/** @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content: Content, value: unknown): LearnerState | null;
/** Largest absolute gap; the first option wins ties. @param {Content} content @param {number[]} dividers */
export function compare(content: Content, dividers: number[]): {
    mine: number[];
    real: number[];
    gaps: number[];
    biggest: number;
    exact: boolean;
    close: boolean;
};
/** Insert values once, keeping inserted braces literal. @param {string} template @param {Record<string, string | number>} values */
export function format(template: string, values: Record<string, string | number>): string;
/** @param {number} value @param {Content} content @param {string} lang */
export function quantity(value: number, content: Content, lang: string): string;
export type Option = {
    label: string;
    share: number;
};
export type Content = {
    title: string;
    context: string;
    question: string;
    resultTitle: string;
    optionHeading: string;
    source: string;
    total: number;
    unit: string;
    unitOne?: string;
    step: number;
    close: number;
    options: Option[];
};
export type LearnerState = {
    dividers: number[];
    touched: boolean;
    shown: boolean;
};
