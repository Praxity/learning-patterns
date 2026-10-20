import { selectLookup } from './20-faq.js';
export { QUESTION_LIMIT } from './20-faq.js';
export const ENTRY_IDS = ['basics', 'needs', 'speaking', 'boundaries', 'conflict', 'practice'];
export const MATCH_GATE = 0.35;
/** @param {unknown} answers */
export function sectionLookup(answers) { return selectLookup(answers, ENTRY_IDS, MATCH_GATE); }
