import { CRITERIA, labelAnswers, ANSWER_LIMIT } from '../../proxy/logic/rubric.js';
export { ANSWER_LIMIT };

/** @typedef {'met' | 'missed'} Label */
/** @typedef {Record<string, { noul: number }>} Answers */
/** @typedef {Record<string, Answers | null>} Results */
/** @typedef {{ id: string, name: { en: string, fr: string }, answer: { en: string, fr: string }, expected: Record<string, Label> }} Fixture */
/** @typedef {{ task: string, note: string, polarityNote: string, criteria: { id: string, label: string, polarity: 'positive' | 'negative' }[], fixtures: Fixture[], savedRun: { date: string, model: string, modelName: string, answers: { en: Results, fr: Results } } }} Content */
/** @param {unknown} value @returns {value is Record<string, any>} */
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {unknown} value @param {string[]} keys @param {string} path */
function fields(value, keys, path) {
  if (!object(value)) throw new Error(`Invalid ${path}`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`Invalid ${path}.${key}`);
  for (const key of keys) if (!(key in value)) throw new Error(`Invalid ${path}.${key}`);
}
/** @param {unknown} value @param {string} path */
function text(value, path) { if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid ${path}`); }

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  fields(content, ['task', 'note', 'polarityNote', 'criteria', 'fixtures', 'savedRun'], 'content');
  const c = /** @type {Content} */ (content);
  for (const key of ['task', 'note', 'polarityNote']) text(c[/** @type {'task'} */ (key)], key);
  if (!Array.isArray(c.criteria) || c.criteria.length !== CRITERIA.length) throw new Error('Invalid criteria');
  c.criteria.forEach((criterion, i) => {
    const path = `criteria[${i}]`; fields(criterion, ['id', 'label', 'polarity'], path); text(criterion.label, `${path}.label`);
    if (criterion.id !== CRITERIA[i].id) throw new Error(`Invalid ${path}.id`);
    if (criterion.polarity !== (criterion.id === 'blame' ? 'negative' : 'positive')) throw new Error(`Invalid ${path}.polarity`);
  });
  if (!Array.isArray(c.fixtures) || !c.fixtures.length) throw new Error('Invalid fixtures');
  const ids = new Set();
  c.fixtures.forEach((fixture, i) => {
    const path = `fixtures[${i}]`; fields(fixture, ['id', 'name', 'answer', 'expected'], path);
    if (typeof fixture.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(fixture.id) || ids.has(fixture.id)) throw new Error(`Invalid ${path}.id`); ids.add(fixture.id);
    for (const key of ['name', 'answer']) {
      const value = fixture[/** @type {'name'} */ (key)]; fields(value, ['en', 'fr'], `${path}.${key}`);
      for (const lang of ['en', 'fr']) { const v = value[/** @type {'en'} */ (lang)]; text(v, `${path}.${key}.${lang}`); if (key === 'answer' && v.length > ANSWER_LIMIT) throw new Error(`Invalid ${path}.answer.${lang}`); }
    }
    fields(fixture.expected, CRITERIA.map(c => c.id), `${path}.expected`);
    for (const { id } of CRITERIA) if (!['met', 'missed'].includes(fixture.expected[id])) throw new Error(`Invalid ${path}.expected.${id}`);
  });
  const run = c.savedRun; fields(run, ['date', 'model', 'modelName', 'answers'], 'savedRun');
  text(run.model, 'savedRun.model'); text(run.modelName, 'savedRun.modelName');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(run.date) || !Number.isFinite(Date.parse(run.date)) || new Date(run.date).toISOString().slice(0, 10) !== run.date) throw new Error('Invalid savedRun.date');
  fields(run.answers, ['en', 'fr'], 'savedRun.answers');
  for (const lang of ['en', 'fr']) checkResults(c, run.answers[/** @type {'en'} */ (lang)], run.model);
}

/** @param {Content} content @param {Results} results @param {string} model */
function checkResults(content, results, model) {
  if (!object(results)) throw new Error('Invalid results');
  for (const [id, answer] of Object.entries(results)) {
    if (!content.fixtures.some(f => f.id === id)) throw new Error(`Invalid results.${id}`);
    if (answer !== null) labelAnswers(answer, model);
  }
}

/** Counts raw predicate agreement. Blame is not inverted into a quality score.
 * Missing results are not run; null results failed. Neither becomes unsure.
 * @param {Content} content @param {Results} results @param {string} model
 */
export function summarize(content, results, model) {
  checkResults(content, results, model);
  const rows = content.fixtures.map(fixture => {
    const answer = Object.hasOwn(results, fixture.id) ? results[fixture.id] : undefined, actual = answer ? labelAnswers(answer, model) : null;
    const cells = content.criteria.map(({ id }) => ({ id, author: fixture.expected[id], model: actual?.[id] ?? null,
      outcome: /** @type {'notRun' | 'agree' | 'disagree' | 'unsure'} */ (!actual ? 'notRun' : actual[id] === 'unsure' ? 'unsure' : actual[id] === fixture.expected[id] ? 'agree' : 'disagree') }));
    return { id: fixture.id, cells, failed: answer === null, review: cells.some(c => c.outcome === 'disagree' || c.outcome === 'unsure') };
  });
  const counts = { agree: 0, disagree: 0, unsure: 0, notRun: 0 };
  for (const row of rows) for (const cell of row.cells) counts[cell.outcome]++;
  return { ...counts, total: rows.length * content.criteria.length, failed: rows.filter(r => r.failed).length, rows };
}

/** One request per sample, at most four in flight. The caller validates answers.
 * An error leaves a failed row and the other samples keep running.
 * @param {Fixture[]} fixtures @param {(fixture: Fixture) => Promise<Answers>} ask
 * @param {(id: string, answers: Answers | null) => void} onResult @param {AbortSignal} [signal]
 * @returns {Promise<Results>}
 */
export async function runSamples(fixtures, ask, onResult, signal) {
  /** @type {Results} */ const results = Object.create(null); let next = 0;
  async function lane() {
    while (next < fixtures.length) {
      signal?.throwIfAborted(); const fixture = fixtures[next++];
      /** @type {Answers | null} */ let answer;
      try { answer = await ask(fixture); } catch (error) { signal?.throwIfAborted(); answer = null; }
      signal?.throwIfAborted(); results[fixture.id] = answer; onResult(fixture.id, answer);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, fixtures.length) }, lane)); return results;
}
