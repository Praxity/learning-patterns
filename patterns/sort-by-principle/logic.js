import { validateTextLengths } from '../../lib/text-limits.js';
/** @typedef {{ id: string, name: string, rule: string }} Principle */
/** @typedef {{ text: string, correct: string, lure: string, looksLike: string, decides: string }} Case */
/** @typedef {{ title: string, context?: string, question: string, principles: Principle[], cases: Case[] }} Content */
/** @typedef {{ right: boolean, correct: string, looksLike: string | null, decides: string }} Feedback */
/** @typedef {{ first: string, second: string, count: number }} Pair */
/** @typedef {{ text: string, principle: boolean }} Part */
/** @typedef {{ picks: string[] }} LearnerState */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {Record<string, unknown>} value @param {string[]} allowed @param {string} path */
function fields(value, allowed, path) {
  for (const field of Object.keys(value)) if (!allowed.includes(field)) throw new Error(`Invalid ${path}.${field}`);
}

/** @param {unknown} value @param {string} path @returns {asserts value is string} */
function text(value, path) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Invalid ${path}`);
}

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  validateTextLengths(content, {
    title: 120, context: 400, question: 200,
    principles: [{ id: 60, name: 60, rule: 120 }],
    cases: [{ text: 300, correct: 60, lure: 60, looksLike: 150, decides: 150 }]
  });
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['title', 'context', 'question', 'principles', 'cases'], 'content');
  text(content.title, 'title'); text(content.question, 'question');
  if (Object.hasOwn(content, 'context')) text(content.context, 'context');
  if (!Array.isArray(content.principles) || content.principles.length < 2 || content.principles.length > 4) throw new Error('Invalid principles: write two to four');
  const ids = new Set(), names = new Set();
  content.principles.forEach((principle, index) => {
    const path = `principles[${index}]`;
    if (!object(principle)) throw new Error(`Invalid ${path}`);
    fields(principle, ['id', 'name', 'rule'], path);
    text(principle.id, `${path}.id`); text(principle.name, `${path}.name`); text(principle.rule, `${path}.rule`);
    if (!/^[a-zA-Z0-9_-]+$/.test(principle.id) || ids.has(principle.id)) throw new Error(`Invalid ${path}.id`);
    // The pair lines name principles, so two with one name could not be told apart.
    if (names.has(principle.name)) throw new Error(`Invalid ${path}.name: names must differ`);
    ids.add(principle.id); names.add(principle.name);
  });
  if (!Array.isArray(content.cases) || content.cases.length < 3 || content.cases.length > 4) throw new Error('Invalid cases: write three or four');
  const used = new Set();
  content.cases.forEach((item, index) => {
    const path = `cases[${index}]`;
    if (!object(item)) throw new Error(`Invalid ${path}`);
    fields(item, ['text', 'correct', 'lure', 'looksLike', 'decides'], path);
    for (const field of ['text', 'correct', 'lure', 'looksLike', 'decides']) text(item[field], `${path}.${field}`);
    if (!ids.has(item.correct)) throw new Error(`Invalid ${path}.correct`);
    if (!ids.has(item.lure) || item.lure === item.correct) throw new Error(`Invalid ${path}.lure: name a principle other than correct`);
    used.add(item.correct);
  });
  // A principle that is never right teaches the learner never to pick it.
  for (const id of ids) if (!used.has(id)) throw new Error(`Invalid cases: principle ${id} is the correct answer to no case`);
}

/** @param {Content} content @param {string} id */
function principle(content, id) {
  return /** @type {Principle} */ (content.principles.find(item => item.id === id));
}

/** Validate checked cases at the host boundary: principle ids in case order.
 * @param {Content} content @param {unknown} picks @returns {asserts picks is string[]}
 */
function validatePicks(content, picks) {
  if (!Array.isArray(picks) || picks.length > content.cases.length) throw new Error('Invalid picks');
  picks.forEach((pick, index) => {
    if (!content.principles.some(item => item.id === pick)) throw new Error(`Invalid picks[${index}]`);
  });
}

/** What a learner reads after checking a case. The deciding fact always shows; the surface
 * detail shows only to a learner who picked the principle it points to, since it names that one.
 * @param {Content} content @param {number} index @param {string} pick @returns {Feedback}
 */
export function feedback(content, index, pick) {
  validateContent(content);
  const item = content.cases[index];
  if (!item) throw new RangeError(`Invalid case ${index}`);
  validatePicks(content, [pick]);
  return { right: pick === item.correct, correct: item.correct, looksLike: pick === item.lure ? item.looksLike : null, decides: item.decides };
}

/** @param {Content} content @param {string[]} picks Checked cases, in case order. */
export function score(content, picks) {
  validateContent(content);
  validatePicks(content, picks);
  const results = picks.map((pick, index) => pick === content.cases[index].correct);
  return { results, right: results.filter(Boolean).length, total: content.cases.length, done: picks.length === content.cases.length };
}

/** The pairs of principles the learner mixed up: each miss pairs the pick with the correct
 * principle, in either direction. Most frequent first, then in principle order.
 * @param {Content} content @param {string[]} picks @returns {Pair[]}
 */
export function mixedPairs(content, picks) {
  validateContent(content);
  validatePicks(content, picks);
  const order = content.principles.map(item => item.id);
  /** @type {Map<string, Pair>} */
  const pairs = new Map();
  picks.forEach((pick, index) => {
    const correct = content.cases[index].correct;
    if (pick === correct) return;
    const [first, second] = [pick, correct].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const key = `${first} ${second}`;
    const pair = pairs.get(key) ?? { first, second, count: 0 };
    pair.count += 1;
    pairs.set(key, pair);
  });
  const rank = (/** @type {Pair} */ pair) => order.indexOf(pair.first) * order.length + order.indexOf(pair.second);
  return [...pairs.values()].sort((a, b) => b.count - a.count || rank(a) - rank(b));
}

/** Split feedback text so each principle name it quotes can be set in italics.
 * @param {Content} content @param {string} value @returns {Part[]}
 */
export function quoteParts(content, value) {
  // Longest first, so a name that contains another is matched whole.
  const names = content.principles.map(item => item.name).sort((a, b) => b.length - a.length);
  /** @type {Part[]} */
  const parts = [];
  let at = 0;
  while (at < value.length) {
    let next = -1, name = '';
    for (const candidate of names) {
      const found = value.indexOf(candidate, at);
      if (found !== -1 && (next === -1 || found < next)) { next = found; name = candidate; }
    }
    if (next === -1) break;
    if (next > at) parts.push({ text: value.slice(at, next), principle: false });
    parts.push({ text: name, principle: true });
    at = next + name.length;
  }
  if (at < value.length) parts.push({ text: value.slice(at), principle: false });
  return parts;
}

/** The principle's display name. @param {Content} content @param {string} id */
export function principleName(content, id) {
  return principle(content, id).name;
}

/** Ignore invalid saved values and copy valid state.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content, value) {
  if (!object(value) || Object.keys(value).some(key => key !== 'picks')) return null;
  try { validatePicks(content, value.picks); } catch { return null; }
  return { picks: [...value.picks] };
}

/** Replace authored placeholders in a single pass so inserted content stays literal.
 * @param {string} template @param {Record<string, string | number>} values
 */
export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (token, key) => Object.hasOwn(values, key) ? String(values[key]) : token);
}
