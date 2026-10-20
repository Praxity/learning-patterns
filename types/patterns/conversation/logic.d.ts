/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content: unknown): asserts content is Content;
/** @param {unknown} answers @param {string} [model] @returns {Branch | 'unsure' | 'off_script'} */
export function feedback(answers: unknown, model?: string): Branch | "unsure" | "off_script";
/** Restore only a coherent two-round conversation. @param {unknown} value @returns {LearnerState | null} */
export function validateState(value: unknown): LearnerState | null;
/** @returns {ConversationState} */
export function start(): ConversationState;
/** @param {Content} content @param {ConversationState} state @param {Branch | 'unsure' | 'off_script'} branch @param {string} reply */
export function turn(content: Content, state: ConversationState, branch: Branch | "unsure" | "off_script", reply: string): {
    state: ConversationState;
    line: string;
    note: string;
};
export type Branch = "acknowledge" | "defend" | "attack" | "withdraw" | "pause";
export type Replies = Record<Branch, string>;
export type BranchContent = {
    line: string;
    endings: Replies;
    move: string;
    debrief: string;
};
export type Content = {
    setup: string;
    person: {
        name: string;
        role: string;
        initial: string;
    };
    opening: string;
    branches: Record<Branch, BranchContent>;
    examples: Record<"opening" | Branch, Replies>;
    stageNotes: Record<string, string>;
    pauseNote: string;
    unsure: string;
    offScript: string;
};
export type Move = {
    branch: Branch;
    reply: string;
};
export type ConversationState = {
    node: "opening" | Branch;
    round: number;
    history: Move[];
    end: boolean;
};
export type LearnerState = {
    conversation: ConversationState;
    draft: string;
};
import { BRANCHES } from '../../proxy/logic/03-contract.js';
import { REPLY_LIMIT } from '../../proxy/logic/03-contract.js';
export { BRANCHES, REPLY_LIMIT };
