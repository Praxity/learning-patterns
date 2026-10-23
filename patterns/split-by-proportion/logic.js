import { validateTextLengths } from '../../lib/text-limits.js';

/** @typedef {{ label: string, share: number }} Option */
/** @typedef {{ title: string, context: string, question: string, resultTitle: string, optionHeading: string, source: string, total: number, unit: string, unitOne?: string, step: number, close: number, options: Option[] }} Content */
/** @typedef {{ dividers: number[], touched: boolean, shown: boolean }} LearnerState */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
/** @param {number} value */
const clean = value => Number(value.toPrecision(15));
/** @param {number} value @param {number} other */
const equal = (value, other) => Math.abs(value - other) <= Number.EPSILON * 16 * Math.max(Math.abs(value), Math.abs(other));

/** @param {unknown} content @returns {asserts content is Content} */
export function validateContent(content) {
  if (!object(content)) throw new Error('Invalid content');
  const keys = ['title', 'context', 'question', 'resultTitle', 'optionHeading', 'source', 'total', 'unit', 'unitOne', 'step', 'close', 'options'];
  for (const key of Object.keys(content)) if (!keys.includes(key)) throw new Error(`Invalid ${key}`);
  validateTextLengths(content, { title: 120, context: 1500, question: 400, resultTitle: 120, optionHeading: 60, source: 1500, unit: 120, unitOne: 120, options: [{ label: 300 }] });
  for (const key of ['title', 'context', 'question', 'resultTitle', 'optionHeading', 'source', 'unit']) {
    if (typeof content[key] !== 'string' || !content[key].trim()) throw new Error(`Invalid ${key}`);
  }
  if ('unitOne' in content && (typeof content.unitOne !== 'string' || !content.unitOne.trim())) throw new Error('Invalid unitOne');
  for (const key of ['total', 'step', 'close']) {
    if (typeof content[key] !== 'number' || !Number.isFinite(content[key])) throw new Error(`Invalid ${key}`);
  }
  const { total, step, close } = /** @type {Content} */ (content);
  if (total <= 0) throw new Error('Invalid total');
  const ticks = total / step;
  if (step <= 0 || step > total || !Number.isSafeInteger(Math.round(ticks)) || !equal(ticks, Math.round(ticks))) throw new Error('Invalid step: must divide total');
  if (close < 0 || close > total) throw new Error('Invalid close');
  if (!Array.isArray(content.options) || content.options.length < 2 || content.options.length > 6) throw new Error('Invalid options: use two to six');
  const labels = new Set();
  [...content.options].forEach((option, i) => {
    const path = `options[${i}]`;
    if (!object(option)) throw new Error(`Invalid ${path}`);
    for (const key of Object.keys(option)) if (!['label', 'share'].includes(key)) throw new Error(`Invalid ${path}.${key}`);
    if (typeof option.label !== 'string' || !option.label.trim() || labels.has(option.label)) throw new Error(`Invalid ${path}.label`);
    labels.add(option.label);
    if (typeof option.share !== 'number' || !Number.isFinite(option.share) || option.share < 0 || option.share > total) throw new Error(`Invalid ${path}.share`);
  });
  if (!equal(content.options.reduce((sum, option) => sum + option.share, 0), total)) throw new Error('Invalid options.share: must sum to total');
}

/** Start near an equal split. @param {Content} content @returns {number[]} */
export function initialDividers(content) {
  return Array.from({ length: content.options.length - 1 }, (_, i) => clean(Math.round((i + 1) * (content.total / content.step) / content.options.length) * content.step));
}

/** @param {Content} content @param {number[]} dividers @returns {number[]} */
export function shares(content, dividers) {
  return content.options.map((_, i) => clean((dividers[i] ?? content.total) - (dividers[i - 1] ?? 0)));
}

// Every divider spans the whole bar. Crossing neighbours pushes them, so one move can give A the whole total.
/** @param {Content} content @param {number[]} dividers @param {number} index @param {number} value */
export function moveDivider(content, dividers, index, value) {
  if (!Number.isInteger(index) || index < 0 || index >= dividers.length) throw new Error('Invalid divider index');
  if (!Number.isFinite(value)) throw new Error('Invalid divider value');
  const next = [...dividers];
  const position = clean(Math.min(content.total, Math.max(0, Math.round(value / content.step) * content.step)));
  next[index] = position;
  for (let i = index + 1; i < next.length; i++) next[i] = Math.max(next[i], position);
  for (let i = index - 1; i >= 0; i--) next[i] = Math.min(next[i], position);
  return next;
}

/** @param {Content} content @param {unknown} value @returns {LearnerState | null} */
export function validateState(content, value) {
  if (!object(value) || !Array.isArray(value.dividers) || value.dividers.length !== content.options.length - 1
    || typeof value.touched !== 'boolean' || typeof value.shown !== 'boolean' || (value.shown && !value.touched)) return null;
  const dividers = [...value.dividers];
  if (dividers.some((v, i) => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > content.total
    || (i > 0 && v < dividers[i - 1]) || !equal(v / content.step, Math.round(v / content.step)))) return null;
  if (!value.touched && dividers.some((v, i) => v !== initialDividers(content)[i])) return null;
  return { dividers: [...dividers], touched: value.touched, shown: value.shown };
}

/** Largest absolute gap; the first option wins ties. @param {Content} content @param {number[]} dividers */
export function compare(content, dividers) {
  validateContent(content);
  if (!validateState(content, { dividers, touched: true, shown: false })) throw new Error('Invalid dividers');
  const mine = shares(content, dividers);
  const real = content.options.map(option => option.share);
  const gaps = mine.map((value, i) => clean(Math.abs(value - real[i])));
  const gap = Math.max(...gaps);
  return { mine, real, gaps, biggest: gaps.indexOf(gap), exact: gap === 0, close: gap <= content.close };
}

/** Insert values once, keeping inserted braces literal. @param {string} template @param {Record<string, string | number>} values */
export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => Object.hasOwn(values, key) ? String(values[key]) : match);
}

/** @param {number} value @param {Content} content @param {string} lang */
export function quantity(value, content, lang) {
  const unit = value === 1 ? content.unitOne ?? content.unit : content.unit;
  return `${new Intl.NumberFormat(/^fr(?:-|$)/i.test(lang) ? 'fr-CA' : 'en', { maximumFractionDigits: 12 }).format(value)}${unit === '%' ? '' : ' '}${unit}`;
}
