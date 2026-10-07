/** @typedef {{ id: string, label: string, missed: string }} Part */
/** @typedef {{ task: string, parts: Part[], model: string }} Content */
/** @typedef {{ answer: string, ticked: string[], shown: boolean }} LearnerState */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {Record<string, unknown>} value @param {string[]} fields @param {string} path */
function fields(value, fields, path) {
  for (const field of Object.keys(value)) {
    if (!fields.includes(field)) throw new Error(`Invalid ${path}.${field}`);
  }
}

/** Validate authored plain text. Whitespace is allowed; empty strings are not.
 * @param {unknown} content
 * @returns {asserts content is Content}
 */
export function validateContent(content) {
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['task', 'parts', 'model'], 'content');
  for (const field of ['task', 'model']) {
    if (typeof content[field] !== 'string' || content[field].length === 0) throw new Error(`Invalid ${field}`);
  }
  if (!Array.isArray(content.parts) || content.parts.length === 0) throw new Error('Invalid parts');
  const known = new Set();
  content.parts.forEach((part, index) => {
    const path = `parts[${index}]`;
    if (!object(part)) throw new Error(`Invalid ${path}`);
    fields(part, ['id', 'label', 'missed'], path);
    for (const field of ['id', 'label', 'missed']) {
      if (typeof part[field] !== 'string' || part[field].length === 0) throw new Error(`Invalid ${path}.${field}`);
    }
    if (typeof part.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(part.id) || known.has(part.id)) throw new Error(`Invalid ${path}.id`);
    known.add(part.id);
  });
}

/** @param {Content} content @param {string[]} ticked */
export function feedback(content, ticked) {
  validateContent(content);
  const known = new Set(content.parts.map(part => part.id));
  for (const id of ticked) if (!known.has(id)) throw new Error(`Unknown part: ${id}`);
  const included = new Set(ticked);
  return {
    count: included.size,
    total: content.parts.length,
    items: content.parts.map(part => ({
      id: part.id,
      included: included.has(part.id),
      label: part.label,
      hint: included.has(part.id) ? null : part.missed
    }))
  };
}

/** Ignore invalid host state; return an independent copy of a valid value.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content, value) {
  if (!object(value) || typeof value.answer !== 'string' || typeof value.shown !== 'boolean' || !Array.isArray(value.ticked)) return null;
  const known = new Set(content.parts.map(part => part.id));
  if (value.ticked.some(id => typeof id !== 'string' || !known.has(id)) || new Set(value.ticked).size !== value.ticked.length) return null;
  return { answer: value.answer, ticked: [...value.ticked], shown: value.shown };
}
