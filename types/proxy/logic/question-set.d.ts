/** @param {unknown} value @returns {QuestionSet[]} */
export function readQuestionSets(value: unknown): QuestionSet[];
/** @param {unknown} error @returns {string[]} */
export function bundleIssuePaths(error: unknown): string[];
/** @param {QuestionSet} set @param {keyof QuestionSet['providers']} [provider] */
export function inputTokenBound(set: QuestionSet, provider?: keyof QuestionSet["providers"]): number;
/** @param {QuestionSet[]} sets */
export function checkBodyLimit(sets: QuestionSet[]): number;
/** @param {QuestionSet} set @param {Answers} answers @param {keyof QuestionSet['providers']} [provider] @returns {Record<string, string>} */
export function questionBands(set: QuestionSet, answers: Answers, provider?: keyof QuestionSet["providers"]): Record<string, string>;
/** @param {QuestionSet} set @param {Answers} answers @param {keyof QuestionSet['providers']} [provider] */
export function chooseFeedback(set: QuestionSet, answers: Answers, provider?: keyof QuestionSet["providers"]): string;
/** @param {QuestionSet[]} sets @param {unknown} input @returns {{set: QuestionSet, fields: Record<string, string>}} */
export function checkInput(sets: QuestionSet[], input: unknown): {
    set: QuestionSet;
    fields: Record<string, string>;
};
/** @param {unknown} value @param {Questions} questions @param {boolean} [strictProvider] @returns {Answers} */
export function readAnswers(value: unknown, questions: Questions, strictProvider?: boolean): Answers;
export type Questions = Record<string, {
    type: "noul";
    instructions: string | {
        situation: string;
        question: string;
    };
    criteria?: {
        true: string;
        false: string;
    };
} | {
    type: "choice";
    instructions: string | {
        situation: string;
        question: string;
    };
    criteria: Record<string, string>;
}>;
export type Variant = {
    questions: Questions;
    confidenceGates: Record<string, {
        missed: number;
        met: number;
    } | {
        confidence: number;
    }>;
};
export type LanguageCounts = {
    total: number;
    definiteDisagreements: number;
    unsure: number;
    undueCredit: number;
};
export type CaseKindCoverage = {
    honest: number;
    partial: number;
    paraphrase: number;
    otherLanguage: number;
    irrelevant: number;
    gaming: number;
    injection: number;
};
export type AcceptanceRecord = {
    publicDigest: string;
    holdoutDigest: string;
    fingerprint: string;
    bar: {
        maxUndueCredit: 0;
        maxDefiniteDisagreementsPer12: number;
        maxUnsureRate: number;
    };
    generation: string;
    counts: {
        en?: LanguageCounts;
        fr?: LanguageCounts;
    };
    caseKindCoverage: {
        en?: CaseKindCoverage;
        fr?: CaseKindCoverage;
    };
    evaluator: string;
    date: string;
};
export type QuestionSet = {
    block: string;
    fields: Record<string, number>;
    context: string;
    providers: {
        perplexity: Variant;
        clef?: Variant;
    };
    outcomes: {
        when: Record<string, string>;
        feedback: string;
    }[];
    feedback: Record<string, {
        en: string;
        fr: string;
    }>;
    defaultFeedback: string;
    selfCheck: {
        en: string;
        fr: string;
    };
    dataNotice: {
        en: string;
        fr: string;
    };
    acceptance?: AcceptanceRecord;
};
export type Answer = {
    type: "noul";
    noul: number;
} | {
    type: "choice";
    choice: string;
    confidence: number;
    probabilities?: Record<string, number>;
};
export type Answers = Record<string, Answer>;
export type Path = (string | number)[];
export type Validation = {
    paths: Path[];
    aborted: boolean;
};
export type Reader = (value: any, path: Path, state: Validation) => any;
