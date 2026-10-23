import { validateTextLengths } from '../../lib/text-limits.js';

/** @typedef {{ label: string, definition: string }} Part */
/** @typedef {{ title: string, context: string, question: string, parts: Part[], workedExample: string[], cases: string[][] }} Content */
/** @typedef {{ deck: number[], last: number }} Deck */
/** @typedef {Deck & { order: number[], picks: (number | null)[], checked: boolean, completed: number, placed: number }} LearnerState */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {Record<string, unknown>} value @param {string[]} allowed @param {string} path */
function fields(value, allowed, path) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Invalid ${path}.${key}`);
}

/** @param {unknown} value @param {string} path */
function text(value, path) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid ${path}`);
}

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  validateTextLengths(content, { title: 120, context: 1500, question: 400, parts: [{ label: 120, definition: 160 }], workedExample: [400], cases: [[400]] });
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['title', 'context', 'question', 'parts', 'workedExample', 'cases'], 'content');
  for (const key of ['title', 'context', 'question']) text(content[key], key);
  if (!Array.isArray(content.parts) || content.parts.length < 2) throw new Error('Invalid parts');
  const labels = new Set();
  Array.from(content.parts).forEach((part, i) => {
    const path = `parts[${i}]`;
    if (!object(part)) throw new Error(`Invalid ${path}`);
    fields(part, ['label', 'definition'], path);
    text(part.label, `${path}.label`);
    text(part.definition, `${path}.definition`);
    if (labels.has(part.label)) throw new Error(`Invalid ${path}.label: duplicate`);
    labels.add(part.label);
  });
  const count = content.parts.length;
  /** Each case stays complete and in part order; displayed facts may be shuffled.
   * @param {unknown} value @param {string} path */
  function facts(value, path) {
    if (!Array.isArray(value) || value.length !== count) throw new Error(`Invalid ${path}: one fact per part`);
    Array.from(value).forEach((fact, i) => text(fact, `${path}[${i}]`));
  }
  facts(content.workedExample, 'workedExample');
  if (!Array.isArray(content.cases) || content.cases.length < 8) throw new Error('Invalid cases: at least eight complete cases');
  Array.from(content.cases).forEach((value, i) => facts(value, `cases[${i}]`));
}

/** @param {unknown} value @param {number} count @returns {value is number} */
function index(value, count) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < count;
}

/** @param {unknown} value @param {number} count @returns {value is number[]} */
function permutation(value, count) {
  return Array.isArray(value) && value.length === count && new Set(value).size === count && Array.from(value).every(n => index(n, count));
}

/** @param {unknown} value @param {number} count @returns {value is Deck} */
function validDeck(value, count) {
  return object(value) && Array.isArray(value.deck) && value.deck.length < count
    && (index(value.last, count) || (value.last === -1 && !value.deck.length))
    && new Set(value.deck).size === value.deck.length
    && Array.from(value.deck).every(n => index(n, count) && n !== value.last);
}

/** Shuffle a copy; the injected random source makes deal rules reproducible.
 * @template T @param {T[]} values @param {() => number} [random] @returns {T[]} */
export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Invalid random: expected [0, 1)');
    const j = Math.floor(value * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Every case once before any repeats; a new round never starts with the case just shown.
 * @param {number} caseCount @param {Deck} [previous] @param {() => number} [random] @returns {Deck} */
export function deal(caseCount, previous = { deck: [], last: -1 }, random = Math.random) {
  if (!Number.isSafeInteger(caseCount) || caseCount < 2) throw new Error('Invalid caseCount');
  if (!validDeck(previous, caseCount)) throw new Error('Invalid deck');
  const deck = previous.deck.length ? [...previous.deck] : shuffle(Array.from({ length: caseCount }, (_, i) => i), random);
  if (deck.at(-1) === previous.last) deck.unshift(/** @type {number} */ (deck.pop()));
  return { deck, last: /** @type {number} */ (deck.pop()) };
}

/** Compare each displayed fact's part with the learner's choice. Null means unanswered.
 * @param {number[]} order @param {(number | null)[]} picks */
export function score(order, picks) {
  if (!order.length || !permutation(order, order.length)) throw new Error('Invalid order');
  if (!Array.isArray(picks) || picks.length !== order.length || !Array.from(picks).every(n => n === null || index(n, order.length))) throw new Error('Invalid picks');
  return {
    right: picks.filter((pick, i) => pick === order[i]).length,
    total: order.length,
    unanswered: picks.flatMap((pick, i) => pick === null ? [i] : [])
  };
}

/** Format a checked set and its running count, choosing French plurals independently.
 * @param {import('./strings.js').Strings} strings
 * @param {{ right: number, total: number, completed: number, placed: number }} counts */
export function feedback(strings, { right, total, completed, placed }) {
  const placements = (placed < 2 ? strings.placedOne : strings.placedMany)
    .replace('{placed}', String(placed)).replace('{facts}', String(completed * total));
  const summary = (completed === 1 ? strings.summaryOne : strings.summaryMany)
    .replace('{sets}', String(completed)).replace('{placements}', placements);
  const announcement = (right < 2 ? strings.resultOne : strings.resultMany)
    .replace('{right}', String(right)).replace('{total}', String(total)).replace('{summary}', summary);
  return { summary, announcement };
}

/** Ignore invalid saved values and copy valid arrays. Counts include the current set only when checked.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content, value) {
  const count = content.parts.length;
  if (!validDeck(value, content.cases.length) || value.last < 0) return null;
  const saved = /** @type {Record<string, unknown>} */ (value);
  if (!permutation(saved.order, count) || !Array.isArray(saved.picks) || saved.picks.length !== count
    || !Array.from(saved.picks).every(pick => pick === null || index(pick, count)) || typeof saved.checked !== 'boolean') return null;
  const completed = saved.completed, placed = saved.placed;
  if (typeof completed !== 'number' || !Number.isSafeInteger(completed) || completed < 0 || completed > Math.floor(Number.MAX_SAFE_INTEGER / count)
    || typeof placed !== 'number' || !Number.isSafeInteger(placed) || placed < 0 || placed > completed * count) return null;
  const outcome = score(saved.order, saved.picks);
  if (saved.checked && (outcome.unanswered.length || completed < 1 || placed < outcome.right || placed > (completed - 1) * count + outcome.right)) return null;
  const dealt = completed + (saved.checked ? 0 : 1);
  if (value.deck.length !== (content.cases.length - dealt % content.cases.length) % content.cases.length) return null;
  return { deck: [...value.deck], last: value.last, order: [...saved.order], picks: [...saved.picks], checked: saved.checked, completed, placed };
}
