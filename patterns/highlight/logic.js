/** @typedef {{ id: string, text: string, key?: boolean, note?: string }} Chunk */
/** @typedef {{ mode: 'key' | 'evidence', title: string, question?: string, maxMarks?: number, paragraphs: Chunk[][] }} Content */
/** @typedef {{ marked: string[], shown: boolean }} LearnerState */
/** @typedef {{ id: string, text: string, marked: boolean, outcome: 'correct' | 'missed' | 'wrong' | 'unmarked', note: string | null }} Outcome */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {Record<string, unknown>} value @param {string[]} allowed @param {string} path */
function fields(value, allowed, path) {
  for (const field of allowed) {
    if (field in value && !Object.hasOwn(value, field)) throw new Error(`Invalid ${path}.${field}`);
  }
  for (const field of Object.keys(value)) {
    if (!allowed.includes(field)) throw new Error(`Invalid ${path}.${field}`);
  }
}

/** @param {unknown} value @param {string} field */
function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid ${field}`);
}

/** Validate authored content, including identities across every paragraph.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content) {
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['mode', 'title', 'question', 'maxMarks', 'paragraphs'], 'content');
  for (const field of ['mode', 'title', 'paragraphs']) if (!Object.hasOwn(content, field)) throw new Error(`Invalid ${field}`);
  if (content.mode !== 'key' && content.mode !== 'evidence') throw new Error('Invalid mode');
  text(content.title, 'title');
  if (content.mode === 'evidence' && !Object.hasOwn(content, 'question')) throw new Error('Invalid question');
  if (Object.hasOwn(content, 'question')) text(content.question, 'question');
  if (Object.hasOwn(content, 'maxMarks') && (typeof content.maxMarks !== 'number' || !Number.isInteger(content.maxMarks) || content.maxMarks <= 0)) throw new Error('Invalid maxMarks');
  if (!Array.isArray(content.paragraphs) || !content.paragraphs.length) throw new Error('Invalid paragraphs');
  const known = new Set();
  let targets = 0;
  Array.from(content.paragraphs).forEach((paragraph, p) => {
    const path = `paragraphs[${p}]`;
    if (!Array.isArray(paragraph) || !paragraph.length) throw new Error(`Invalid ${path}`);
    Array.from(paragraph).forEach((chunk, c) => {
      const field = `${path}[${c}]`;
      if (!object(chunk)) throw new Error(`Invalid ${field}`);
      fields(chunk, ['id', 'text', 'key', 'note'], field);
      for (const name of ['id', 'text']) if (!Object.hasOwn(chunk, name)) throw new Error(`Invalid ${field}.${name}`);
      if (typeof chunk.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(chunk.id) || known.has(chunk.id)) throw new Error(`Invalid ${field}.id`);
      known.add(chunk.id);
      text(chunk.text, `${field}.text`);
      if (typeof chunk.text === 'string' && chunk.text !== chunk.text.trim()) throw new Error(`Invalid ${field}.text`);
      if (Object.hasOwn(chunk, 'key') && typeof chunk.key !== 'boolean') throw new Error(`Invalid ${field}.key`);
      if (Object.hasOwn(chunk, 'note')) text(chunk.note, `${field}.note`);
      if (Object.hasOwn(chunk, 'key') && chunk.key === true) targets++;
    });
  });
  if (!targets) throw new Error('Invalid paragraphs: at least one key is required');
}

/** Maximum selected chunks. Pass validated content.
 * @param {Content} content @returns {number}
 */
export function markLimit(content) {
  return content.maxMarks ?? (content.paragraphs.flat().filter(chunk => chunk.key === true).length + (content.mode === 'key' ? 1 : 0));
}

/** Compare marks with the author's targets. Duplicate marks count once.
 * @param {Content} content @param {string[]} markedIds
 * @returns {{ found: number, total: number, marked: number, wrong: number, items: Outcome[] }}
 */
export function check(content, markedIds) {
  validateContent(content);
  if (!Array.isArray(markedIds) || Array.from(markedIds).some(id => typeof id !== 'string')) throw new Error('Invalid markedIds');
  const chunks = content.paragraphs.flat();
  const known = new Set(chunks.map(chunk => chunk.id));
  for (const id of markedIds) if (!known.has(id)) throw new Error(`Unknown chunk: ${id}`);
  const marked = new Set(markedIds);
  if (marked.size > markLimit(content)) throw new Error('Invalid markedIds: exceeds maxMarks');
  const found = chunks.filter(chunk => chunk.key === true && marked.has(chunk.id)).length;
  return {
    found, total: chunks.filter(chunk => chunk.key === true).length, marked: marked.size, wrong: marked.size - found,
    items: chunks.map(chunk => ({
      id: chunk.id, text: chunk.text, marked: marked.has(chunk.id),
      outcome: chunk.key === true ? (marked.has(chunk.id) ? 'correct' : 'missed') : (marked.has(chunk.id) ? 'wrong' : 'unmarked'),
      note: chunk.note ?? null
    }))
  };
}

/** Ignore invalid host state and copy valid marks.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content, value) {
  if (!object(value) || !Object.hasOwn(value, 'marked') || !Object.hasOwn(value, 'shown') || Object.keys(value).some(key => !['marked', 'shown'].includes(key)) || !Array.isArray(value.marked) || typeof value.shown !== 'boolean') return null;
  const known = new Set(content.paragraphs.flat().map(chunk => chunk.id));
  if (value.marked.length > markLimit(content) || Array.from(value.marked).some(id => typeof id !== 'string' || !known.has(id)) || new Set(value.marked).size !== value.marked.length) return null;
  return { marked: [...value.marked], shown: value.shown };
}
