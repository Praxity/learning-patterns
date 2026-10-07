/** @typedef {{ words: number, questions: number, narrationSeconds: number }} Counts */
/** @typedef {{ readingWordsPerMinute: number, minutesPerQuestion: number }} Rates */
/** @typedef {Counts & { id: string, title: string }} Section */
/** @typedef {{ title: string, rates: Rates, sections: Section[] }} Content */
/** @typedef {{ authorView: boolean, sections: Record<string, Counts> }} AuthorState */

export const RATES = Object.freeze({ readingWordsPerMinute: 200, minutesPerQuestion: 0.75 });
export const LIMIT_MINUTES = 15;
/** @type {ReadonlyArray<keyof Counts>} */
export const COUNT_FIELDS = Object.freeze(['words', 'narrationSeconds', 'questions']);

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {Record<string, unknown>} value @param {readonly string[]} allowed @param {string} path */
function fields(value, allowed, path) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Invalid ${path}.${key}`);
}
/** @param {unknown} value @param {string} path @returns {asserts value is number} */
function count(value, path) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${path}: enter a safe whole number, 0 or more`);
}
/** @param {unknown} rates @returns {asserts rates is Rates} */
function validateRates(rates) {
  if (!object(rates)) throw new Error('Invalid rates');
  fields(rates, ['readingWordsPerMinute', 'minutesPerQuestion'], 'rates');
  for (const key of ['readingWordsPerMinute', 'minutesPerQuestion']) {
    const value = rates[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER || (key === 'readingWordsPerMinute' && value === 0)) throw new Error(`Invalid rates.${key}`);
  }
}

/** Narration runs during reading. Round up only after adding question time.
 * @param {number} words @param {number} questions @param {number} narrationSeconds
 * @param {Rates} [rates] @returns {number} Whole minutes, including zero for empty content.
 */
export function estimateMinutes(words, questions, narrationSeconds, rates = RATES) {
  count(words, 'words'); count(questions, 'questions'); count(narrationSeconds, 'narrationSeconds'); validateRates(rates);
  const minutes = Math.ceil(Math.max(words / rates.readingWordsPerMinute, narrationSeconds / 60) + rates.minutesPerQuestion * questions);
  count(minutes, 'estimate');
  return minutes;
}
/** @param {number} minutes @returns {boolean} */
export function overLimit(minutes) { count(minutes, 'minutes'); return minutes > LIMIT_MINUTES; }
/** @param {string} text @returns {number | null} */
export function parseCount(text) {
  if (!/^\d+$/.test(text.trim())) return null;
  const value = Number(text.trim());
  return Number.isSafeInteger(value) ? value : null;
}

/** Validate plain authored content and name the first bad field.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content) {
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['title', 'rates', 'sections'], 'content');
  if (typeof content.title !== 'string' || content.title.length === 0) throw new Error('Invalid title');
  validateRates(content.rates);
  const rates = content.rates;
  if (!Array.isArray(content.sections) || content.sections.length === 0) throw new Error('Invalid sections');
  const known = new Set();
  content.sections.forEach((section, index) => {
    const path = `sections[${index}]`;
    if (!object(section)) throw new Error(`Invalid ${path}`);
    fields(section, ['id', 'title', ...COUNT_FIELDS], path);
    if (typeof section.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(section.id) || known.has(section.id)) throw new Error(`Invalid ${path}.id`);
    known.add(section.id);
    if (typeof section.title !== 'string' || section.title.length === 0) throw new Error(`Invalid ${path}.title`);
    for (const key of COUNT_FIELDS) count(section[key], `${path}.${key}`);
    estimateMinutes(/** @type {number} */ (section.words), /** @type {number} */ (section.questions), /** @type {number} */ (section.narrationSeconds), rates);
  });
}

/** @param {Content} content
 * @returns {{ sections: { id: string, minutes: number, overLimit: boolean }[], total: number }}
 */
export function courseEstimate(content) {
  validateContent(content);
  const sections = content.sections.map(section => {
    const minutes = estimateMinutes(section.words, section.questions, section.narrationSeconds, content.rates);
    return { id: section.id, minutes, overLimit: overLimit(minutes) };
  });
  const total = sections.reduce((sum, section) => sum + section.minutes, 0);
  count(total, 'total');
  return { sections, total };
}

/** Ignore invalid snapshots as a whole; copy valid counts so the host cannot mutate them.
 * @param {Content} content @param {unknown} value @returns {AuthorState | null}
 */
export function validateState(content, value) {
  if (!object(value) || Object.keys(value).some(key => !['authorView', 'sections'].includes(key)) || typeof value.authorView !== 'boolean' || !object(value.sections)) return null;
  const records = value.sections;
  if (Object.keys(records).length !== content.sections.length) return null;
  /** @type {[string, Counts][]} */
  const entries = [];
  for (const section of content.sections) {
    if (!Object.hasOwn(records, section.id)) return null;
    const row = records[section.id];
    if (!object(row) || Object.keys(row).some(key => !COUNT_FIELDS.includes(/** @type {keyof Counts} */ (key)))) return null;
    if (COUNT_FIELDS.some(key => typeof row[key] !== 'number' || !Number.isSafeInteger(row[key]) || /** @type {number} */ (row[key]) < 0)) return null;
    entries.push([section.id, { words: /** @type {number} */ (row.words), questions: /** @type {number} */ (row.questions), narrationSeconds: /** @type {number} */ (row.narrationSeconds) }]);
  }
  const sections = Object.fromEntries(entries);
  try { courseEstimate({ ...content, sections: content.sections.map(section => ({ ...section, ...sections[section.id] })) }); }
  catch { return null; } // A stale snapshot may overflow estimates after the author changes rates.
  return { authorView: value.authorView, sections };
}
