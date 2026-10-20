import { validateTextLengths } from '../../lib/text-limits.js';
/** @typedef {{ id: string, label: string, missed: string, evidence: string | null }} Part */
/** @typedef {{ task: string, context?: { to: string, initials: string, subject: string, placeholder?: string }, parts: Part[], model: string }} Content */
/** @typedef {{ text: string, partIndex: number | null, included: boolean }} Segment */
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
  validateTextLengths(content, {
    task: 400,
    model: 1500,
    parts: [{"id": 120, "label": 120, "missed": 1500, "evidence": 1500}],
    context: {"to": 120, "initials": 120, "subject": 120, "placeholder": 120},
  });
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['task', 'context', 'parts', 'model'], 'content');
  for (const field of ['task', 'model']) {
    if (typeof content[field] !== 'string' || content[field].length === 0) throw new Error(`Invalid ${field}`);
  }
  if (Object.hasOwn(content, 'context')) {
    if (!object(content.context)) throw new Error('Invalid context');
    fields(content.context, ['to', 'initials', 'subject', 'placeholder'], 'context');
    for (const field of ['to', 'initials', 'subject']) {
      if (typeof content.context[field] !== 'string' || content.context[field].length === 0) throw new Error(`Invalid context.${field}`);
    }
    if (Object.hasOwn(content.context, 'placeholder') && typeof content.context.placeholder !== 'string') throw new Error('Invalid context.placeholder');
  }
  if (!Array.isArray(content.parts) || content.parts.length === 0) throw new Error('Invalid parts');
  const known = new Set();
  content.parts.forEach((part, index) => {
    const path = `parts[${index}]`;
    if (!object(part)) throw new Error(`Invalid ${path}`);
    fields(part, ['id', 'label', 'missed', 'evidence'], path);
    for (const field of ['id', 'label', 'missed']) {
      if (typeof part[field] !== 'string' || part[field].length === 0) throw new Error(`Invalid ${path}.${field}`);
    }
    if (typeof part.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(part.id) || known.has(part.id)) throw new Error(`Invalid ${path}.id`);
    known.add(part.id);
    if (part.evidence !== null) {
      if (typeof part.evidence !== 'string' || !part.evidence.length) throw new Error(`Invalid ${path}.evidence`);
      const model = /** @type {string} */ (content.model);
      const start = model.indexOf(part.evidence);
      if (start < 0 || model.indexOf(part.evidence, start + 1) >= 0) throw new Error(`Invalid ${path}.evidence: must occur exactly once in model`);
    }
  });
}

/** Segment validated model text in reading order. Whole-answer parts stay in the legend.
 * When evidence overlaps, the first span in model order owns that text.
 * @param {string} model @param {Part[]} parts @param {string[]} includedIds
 * @returns {Segment[]}
 */
export function annotate(model, parts, includedIds) {
  const included = new Set(includedIds);
  const spans = parts.flatMap((part, partIndex) => part.evidence === null ? [] : [{
    partIndex, start: model.indexOf(part.evidence), length: part.evidence.length, included: included.has(part.id)
  }]).sort((a, b) => a.start - b.start);
  /** @type {Segment[]} */
  const segments = [];
  let at = 0;
  for (const span of spans) {
    if (span.start < at) continue;
    if (span.start > at) segments.push({ text: model.slice(at, span.start), partIndex: null, included: false });
    at = span.start + span.length;
    segments.push({ text: model.slice(span.start, at), partIndex: span.partIndex, included: span.included });
  }
  if (at < model.length) segments.push({ text: model.slice(at), partIndex: null, included: false });
  return segments;
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
