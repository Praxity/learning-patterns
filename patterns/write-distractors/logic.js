/** @typedef {{ id: string, label: string }} Misconception */
/** @typedef {{ text: string, misconception: string }} AuthorOption */
/** @typedef {{ question: string, rightAnswer: string, misconceptions: Misconception[], authorOptions: AuthorOption[], count: number }} Content */
/** @typedef {{ text: string, misconception: string, custom: string }} LearnerOption */
/** @typedef {{ answer: string, hadIt: boolean | null, options: LearnerOption[], shown: boolean }} LearnerState */
/** @typedef {'text' | 'misconception' | 'custom'} Field */
/** @typedef {'empty' | 'longText' | 'right' | 'duplicate' | 'choose' | 'describe' | 'longCustom'} ErrorCode */
/** @typedef {{ option: number, field: Field, code: ErrorCode }} FieldError */

export const OTHER = 'other';
export const MAX_OPTION = 300;
export const MAX_CUSTOM = 120;

/** Key A belongs to the right answer; wrong options start at index 1.
 * @param {number} index @returns {string}
 */
export function optionKey(index) {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid option index');
  let value = index + 1, label = '';
  while (value > 0) {
    value--;
    label = String.fromCharCode(65 + value % 26) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {Record<string, unknown>} value @param {string[]} keys @param {string} path */
function fields(value, keys, path) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error(`Invalid ${path}.${key}`);
  for (const key of keys) if (!Object.hasOwn(value, key)) throw new Error(`Invalid ${path}.${key}`);
}
/** @param {string} value */
const normal = value => value.trim().replace(/\s+/g, ' ');
/** @param {string} value */
const key = value => normal(value).toLowerCase();

/** Validate plain authored content and its misconception references.
 * @param {unknown} content @returns {asserts content is Content}
 */
export function validateContent(content) {
  if (!object(content)) throw new Error('Invalid content');
  fields(content, ['question', 'rightAnswer', 'misconceptions', 'authorOptions', 'count'], 'content');
  for (const field of ['question', 'rightAnswer']) {
    if (typeof content[field] !== 'string' || content[field].length === 0) throw new Error(`Invalid ${field}`);
  }
  if (!Number.isSafeInteger(content.count) || typeof content.count !== 'number' || content.count < 1) throw new Error('Invalid count');
  if (!Array.isArray(content.misconceptions) || !content.misconceptions.length) throw new Error('Invalid misconceptions');
  const known = new Set();
  content.misconceptions.forEach((item, index) => {
    const path = `misconceptions[${index}]`;
    if (!object(item)) throw new Error(`Invalid ${path}`);
    fields(item, ['id', 'label'], path);
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.id) || item.id === OTHER || known.has(item.id)) throw new Error(`Invalid ${path}.id`);
    if (typeof item.label !== 'string' || !item.label.length) throw new Error(`Invalid ${path}.label`);
    known.add(item.id);
  });
  if (!Array.isArray(content.authorOptions) || !content.authorOptions.length) throw new Error('Invalid authorOptions');
  content.authorOptions.forEach((item, index) => {
    const path = `authorOptions[${index}]`;
    if (!object(item)) throw new Error(`Invalid ${path}`);
    fields(item, ['text', 'misconception'], path);
    if (typeof item.text !== 'string' || !item.text.length) throw new Error(`Invalid ${path}.text`);
    if (typeof item.misconception !== 'string' || !known.has(item.misconception)) throw new Error(`Invalid ${path}.misconception`);
  });
}

/** @param {unknown} value @returns {value is LearnerOption} */
function isOption(value) {
  return object(value) && Object.keys(value).length === 3 && typeof value.text === 'string'
    && typeof value.misconception === 'string' && typeof value.custom === 'string';
}

/** Field errors use codes so every learner-facing message lives in strings.js.
 * Length is checked before normalization, matching HTML maxlength.
 * @param {Content} content @param {LearnerOption[]} options
 * @returns {{ ok: false, errors: FieldError[] } | { ok: true, options: LearnerOption[] }}
 */
export function validateOptions(content, options) {
  validateContent(content);
  if (!Array.isArray(options) || options.length !== content.count) throw new Error('Invalid options.count');
  const known = new Set(content.misconceptions.map(item => item.id));
  const seen = new Set();
  /** @type {FieldError[]} */
  const errors = [];
  const clean = options.map((option, index) => {
    if (!isOption(option)) throw new Error(`Invalid options[${index}]`);
    const text = normal(option.text), custom = normal(option.custom);
    /** @param {Field} field @param {ErrorCode} code */
    const error = (field, code) => errors.push({ option: index, field, code });
    if (!text) error('text', 'empty');
    else if (option.text.length > MAX_OPTION) error('text', 'longText');
    else if (key(text) === key(content.rightAnswer)) error('text', 'right');
    else if (seen.has(key(text))) error('text', 'duplicate');
    seen.add(key(text));
    if (option.misconception !== OTHER && !known.has(option.misconception)) error('misconception', 'choose');
    else if (option.misconception === OTHER && !custom) error('custom', 'describe');
    else if (option.misconception === OTHER && option.custom.length > MAX_CUSTOM) error('custom', 'longCustom');
    return { text, misconception: option.misconception, custom: option.misconception === OTHER ? custom : '' };
  });
  return errors.length ? { ok: false, errors } : { ok: true, options: clean };
}

/** @param {Content} content @param {AuthorOption | LearnerOption} option @returns {string} */
export function targetOf(content, option) {
  if (option.misconception === OTHER && 'custom' in option) return normal(option.custom);
  const target = content.misconceptions.find(item => item.id === option.misconception);
  if (!target) throw new Error('Invalid option.misconception');
  return target.label;
}

/** Compare tags, never infer a misconception from the learner's answer text.
 * @param {Content} content @param {LearnerOption[]} options
 */
export function coverage(content, options) {
  const checked = validateOptions(content, options);
  if (!checked.ok) throw new Error('Invalid options for coverage');
  /** @type {Map<string, string>} */
  const author = new Map();
  for (const item of content.authorOptions) {
    const target = targetOf(content, item);
    if (!author.has(key(target))) author.set(key(target), target);
  }
  const targets = checked.options.map(item => targetOf(content, item));
  /** @type {Map<string, string>} */
  const unique = new Map();
  // Preserve the first spelling when two custom tags name the same misconception.
  for (const target of targets) if (!unique.has(key(target))) unique.set(key(target), target);
  return {
    targeted: [...unique.values()],
    missed: [...author].filter(([name]) => !unique.has(name)).map(([, label]) => label),
    extra: [...unique].filter(([name]) => !author.has(name)).map(([, label]) => label),
    matches: targets.map(target => author.has(key(target)))
  };
}

/** Return comparison counts and labels; the host formats learner-facing text.
 * @param {Content} content @param {LearnerOption[]} options
 * @returns {{ authorTargeted: number, authorTotal: number, ownExtra: number, untargeted: string[] }}
 */
export function coverageMessage(content, options) {
  const result = coverage(content, options);
  const authorTargeted = result.targeted.length - result.extra.length;
  return {
    authorTargeted,
    authorTotal: authorTargeted + result.missed.length,
    ownExtra: result.extra.length,
    untargeted: result.missed
  };
}

/** Accept incomplete drafts; shown results must pass submission validation.
 * @param {Content} content @param {unknown} value @returns {LearnerState | null}
 */
export function validateState(content, value) {
  validateContent(content);
  if (!object(value) || typeof value.shown !== 'boolean' || !Array.isArray(value.options) || value.options.length !== content.count) return null;
  const legacy = Object.keys(value).length === 2 && !Object.hasOwn(value, 'answer') && !Object.hasOwn(value, 'hadIt');
  if (!legacy && (Object.keys(value).length !== 4 || typeof value.answer !== 'string'
    || (value.hadIt !== null && typeof value.hadIt !== 'boolean')
    || (value.hadIt !== null && !value.answer.trim()) || (value.shown && value.hadIt === null))) return null;
  const known = new Set(['', OTHER, ...content.misconceptions.map(item => item.id)]);
  if (!value.options.every(item => isOption(item) && item.text.length <= MAX_OPTION && item.custom.length <= MAX_CUSTOM && known.has(item.misconception))) return null;
  const options = /** @type {LearnerOption[]} */ (value.options);
  if (value.shown && !validateOptions(content, options).ok) return null;
  return {
    answer: legacy ? '' : /** @type {string} */ (value.answer),
    hadIt: legacy ? null : /** @type {boolean | null} */ (value.hadIt),
    options: options.map(item => ({ ...item })), shown: legacy ? false : value.shown
  };
}
