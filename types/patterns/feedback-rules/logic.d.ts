/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** Counts raw predicate agreement. Blame is not inverted into a quality score.
 * Missing results are not run; null results failed. Neither becomes unsure.
 * @param {Content} content @param {Results} results @param {string} model
 */
export function summarize(content: Content, results: Results, model: string): {
    total: number;
    failed: number;
    rows: {
        id: string;
        cells: {
            id: string;
            author: Label;
            model: "unsure" | "met" | "missed" | null;
            outcome: "notRun" | "agree" | "disagree" | "unsure";
        }[];
        failed: boolean;
        review: boolean;
    }[];
    agree: number;
    disagree: number;
    unsure: number;
    notRun: number;
};
/** One request per sample, at most four in flight. The caller validates answers.
 * An error leaves a failed row and the other samples keep running.
 * @param {Fixture[]} fixtures @param {(fixture: Fixture) => Promise<Answers>} ask
 * @param {(id: string, answers: Answers | null) => void} onResult @param {AbortSignal} [signal]
 * @returns {Promise<Results>}
 */
export function runSamples(fixtures: Fixture[], ask: (fixture: Fixture) => Promise<Answers>, onResult: (id: string, answers: Answers | null) => void, signal?: AbortSignal): Promise<Results>;
export { ANSWER_LIMIT };
export type Label = "met" | "missed";
export type Answers = Record<string, {
    noul: number;
}>;
export type Results = Record<string, Answers | null>;
export type Fixture = {
    id: string;
    name: {
        en: string;
        fr: string;
    };
    answer: {
        en: string;
        fr: string;
    };
    expected: Record<string, Label>;
};
export type Content = {
    task: string;
    note: string;
    polarityNote: string;
    criteria: {
        id: string;
        label: string;
        polarity: "positive" | "negative";
    }[];
    fixtures: Fixture[];
    savedRun: {
        date: string;
        model: string;
        modelName: string;
        answers: {
            en: Results;
            fr: Results;
        };
    };
};
import { ANSWER_LIMIT } from '../../proxy/logic/rubric.js';
