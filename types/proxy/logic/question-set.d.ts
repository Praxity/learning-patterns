/** @overload @param {{sets: {providers: {perplexity: unknown}, feedback: Record<string, {en: string, fr: string}>, selfCheck: {en: string, fr: string}}[]}} value @returns {LegacyQuestionSet[]} */
export function readQuestionSets(value: {
    sets: {
        providers: {
            perplexity: unknown;
        };
        feedback: Record<string, {
            en: string;
            fr: string;
        }>;
        selfCheck: {
            en: string;
            fr: string;
        };
    }[];
}): LegacyQuestionSet[];
/** @overload @param {unknown} value @returns {QuestionSet[]} */
export function readQuestionSets(value: unknown): QuestionSet[];
/** @param {AcceptanceRecord} record @param {AcceptanceBar} [bar] */
export function acceptancePasses(record: AcceptanceRecord, bar?: AcceptanceBar): boolean;
/** @param {unknown} error @returns {string[]} */
export function bundleIssuePaths(error: unknown): string[];
/** @param {QuestionSet} set */
export function isV2QuestionSet(set: QuestionSet): boolean;
/** @param {QuestionSet} set @param {ProviderName} provider @param {string | undefined} model @param {Language | undefined} language */
export function hasAcceptedVariant(set: QuestionSet, provider: ProviderName, model: string | undefined, language: Language | undefined): boolean;
/** @param {QuestionSet} set @param {Language} language */
export function supportsLanguage(set: QuestionSet, language: Language): boolean;
/** @param {unknown} value @returns {string} */
export function canonicalJson(value: unknown): string;
/** @param {Pick<AcceptanceRecord, 'publicDigest' | 'holdoutDigest' | 'bar' | 'generation'>} record */
export function acceptanceFingerprint(record: Pick<AcceptanceRecord, "publicDigest" | "holdoutDigest" | "bar" | "generation">): Promise<string>;
/** @param {QuestionSet} set @param {ProviderName} provider @param {Language} language
 * @param {{requestTemplateVersion: string, selfCheckContentRevision: string, aiFields: unknown}} authoring */
export function questionSetDigest(set: QuestionSet, provider: ProviderName, language: Language, authoring: {
    requestTemplateVersion: string;
    selfCheckContentRevision: string;
    aiFields: unknown;
}): Promise<string>;
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
/** @typedef {Record<string, {type: 'noul', instructions: string | {situation: string, question: string}, criteria?: {true: string, false: string}} | {type: 'choice', instructions: string | {situation: string, question: string}, criteria: Record<string, string>}>} Questions */
/** @typedef {'perplexity' | 'clef'} ProviderName */
/** @typedef {'en' | 'fr'} Language */
/** @typedef {{en?: string, fr?: string}} LocalizedText */
/** @typedef {{maxUndueCredit: number, maxDefiniteDisagreementsPer12: number, maxUnsureRate: number}} AcceptanceBar */
/** @typedef {{questions: Questions, confidenceGates: Record<string, {missed: number, met: number} | {confidence: number}>, model?: string, questionOrder?: string[], acceptance?: {en?: AcceptanceRecord, fr?: AcceptanceRecord}}} Variant */
/** @typedef {{total: number, definiteDisagreements: number, unsure: number, undueCredit: number}} LanguageCounts */
/** @typedef {{honest: number, partial: number, paraphrase: number, otherLanguage: number, irrelevant: number, gaming: number, injection: number}} CaseKindCoverage */
/** @typedef {{provider: ProviderName, model: string, language: Language, publicDigest: string, holdoutDigest: string, fingerprint: string, bar: AcceptanceBar, generation: string, counts: LanguageCounts, caseKindCoverage: CaseKindCoverage, evaluator: string, date: string}} AcceptanceRecord */
/** @typedef {{block: string, fields: Record<string, number>, context: string, providers: {perplexity?: Variant, clef?: Variant}, outcomes: {when: Record<string, string>, feedback: string}[], feedback: Record<string, LocalizedText>, defaultFeedback: string, selfCheck: LocalizedText, dataNotice: {en: string, fr: string}}} QuestionSet */
/** @typedef {QuestionSet & {providers: {perplexity: Variant, clef?: Variant}, feedback: Record<string, {en: string, fr: string}>, selfCheck: {en: string, fr: string}}} LegacyQuestionSet */
/** @typedef {{type: 'noul', noul: number} | {type: 'choice', choice: string, confidence: number, probabilities?: Record<string, number>}} Answer */
/** @typedef {Record<string, Answer>} Answers */
/** @typedef {(string | number)[]} Path */
/** @typedef {{paths: Path[], aborted: boolean}} Validation */
/** @typedef {(value: any, path: Path, state: Validation) => any} Reader */
export const DEFAULT_ACCEPTANCE_BAR: Readonly<{
    maxUndueCredit: 0;
    maxDefiniteDisagreementsPer12: 1;
    maxUnsureRate: 0.2;
}>;
export const MIN_ACCEPTANCE_COVERAGE: Readonly<{
    gaming: 2;
    injection: 2;
}>;
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
export type ProviderName = "perplexity" | "clef";
export type Language = "en" | "fr";
export type LocalizedText = {
    en?: string;
    fr?: string;
};
export type AcceptanceBar = {
    maxUndueCredit: number;
    maxDefiniteDisagreementsPer12: number;
    maxUnsureRate: number;
};
export type Variant = {
    questions: Questions;
    confidenceGates: Record<string, {
        missed: number;
        met: number;
    } | {
        confidence: number;
    }>;
    model?: string;
    questionOrder?: string[];
    acceptance?: {
        en?: AcceptanceRecord;
        fr?: AcceptanceRecord;
    };
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
    provider: ProviderName;
    model: string;
    language: Language;
    publicDigest: string;
    holdoutDigest: string;
    fingerprint: string;
    bar: AcceptanceBar;
    generation: string;
    counts: LanguageCounts;
    caseKindCoverage: CaseKindCoverage;
    evaluator: string;
    date: string;
};
export type QuestionSet = {
    block: string;
    fields: Record<string, number>;
    context: string;
    providers: {
        perplexity?: Variant;
        clef?: Variant;
    };
    outcomes: {
        when: Record<string, string>;
        feedback: string;
    }[];
    feedback: Record<string, LocalizedText>;
    defaultFeedback: string;
    selfCheck: LocalizedText;
    dataNotice: {
        en: string;
        fr: string;
    };
};
export type LegacyQuestionSet = QuestionSet & {
    providers: {
        perplexity: Variant;
        clef?: Variant;
    };
    feedback: Record<string, {
        en: string;
        fr: string;
    }>;
    selfCheck: {
        en: string;
        fr: string;
    };
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
