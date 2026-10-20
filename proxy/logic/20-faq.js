export const QUESTION_LIMIT = 500;
export const ENTRY_IDS = ['deadline', 'certificate', 'time', 'help', 'assertive', 'interruptions', 'no', 'timeout'];
export const MATCH_GATE = 0.35;
export const CLOSE_GAP = 0.2;

/** Validate a complete Choice distribution, then choose at most two authored entries.
 * `none` winning always suppresses suggestions. Inclusive gates permit a split decision.
 * @param {unknown} answers @param {string[]} ids @param {number} gate
 * @returns {{ ids: string[] }}
 */
export function selectLookup(answers, ids, gate) {
  const object = /** @type {Record<string, any> | null} */ (answers);
  if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).length !== 1) throw new Error('Invalid lookup answers');
  const answer = object.lookup, options = [...ids, 'none'];
  /** @param {unknown} value */
  const probability = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
  if (!answer || !options.includes(answer.choice) || !probability(answer.confidence) || !answer.probabilities || typeof answer.probabilities !== 'object' || Array.isArray(answer.probabilities)) throw new Error('Invalid lookup answers');
  const scores = answer.probabilities;
  if (Object.keys(scores).length !== options.length || !options.every(id => Object.hasOwn(scores, id) && probability(scores[id])) || Math.abs(options.reduce((sum, id) => sum + scores[id], 0) - 1) >= 0.001) throw new Error('Invalid lookup probabilities');
  const ranked = ids.map(id => ({ id, score: scores[id] })).sort((a, b) => b.score - a.score || ids.indexOf(a.id) - ids.indexOf(b.id));
  if (scores[answer.choice] < Math.max(...options.map(id => scores[id])) - 1e-12) throw new Error('Invalid lookup choice');
  if (answer.choice === 'none' || answer.confidence < gate || scores.none >= ranked[0].score || ranked[0].score < gate) return { ids: [] };
  const selected = [ranked[0].id];
  if (ranked[1].score >= gate && ranked[0].score - ranked[1].score <= CLOSE_GAP + 1e-12) selected.push(ranked[1].id);
  return { ids: selected };
}

/** @param {unknown} answers */
export function faqLookup(answers) { return selectLookup(answers, ENTRY_IDS, MATCH_GATE); }
