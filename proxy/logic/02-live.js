import { band } from './shared.js';

export const ANSWER_LIMIT = 1200;
export const CRITERION_KEYS = ['three_actions', 'observable', 'when', 'commitments'];

/** The original confidence gates apply to every criterion independently.
 * @param {unknown} answers
 * @returns {{ items: { key: string, state: 'met' | 'missed' | 'unsure' }[], met: number, allMet: boolean }}
 */
export function liveFeedback(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers) || Object.keys(answers).length !== CRITERION_KEYS.length) throw new Error('Invalid answers');
  const values = /** @type {Record<string, { noul?: unknown }>} */ (answers);
  const items = CRITERION_KEYS.map(key => {
    const value = Object.hasOwn(values, key) ? values[key]?.noul : undefined;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new Error(`Invalid answers.${key}`);
    return { key, state: band(value) };
  });
  const met = items.filter(item => item.state === 'met').length;
  return { items, met, allMet: met === items.length };
}
