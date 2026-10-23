import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compare, format, initialDividers, moveDivider, quantity, shares, validateContent, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const en = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const fr = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));

test('examples validate and bilingual interface keys match', () => {
  for (const content of [en, fr]) assert.doesNotThrow(() => validateContent(content));
  assert.deepEqual(Object.keys(strings.en), Object.keys(strings.fr));
});

test('near-equal start, step snapping, clamping and pushing keep the total', () => {
  const d = initialDividers(en);
  assert.deepEqual(d, [25, 50, 75]);
  assert.deepEqual(shares(en, d), [25, 25, 25, 25]);
  assert.deepEqual(moveDivider(en, d, 0, 82), [80, 80, 80]);
  assert.deepEqual(moveDivider(en, d, 0, 82.5), [85, 85, 85]);
  assert.deepEqual(moveDivider(en, d, 0, 105), [100, 100, 100]);
  assert.deepEqual(shares(en, [100, 100, 100]), [100, 0, 0, 0]);
  assert.deepEqual(moveDivider(en, d, 2, -5), [0, 0, 0]);
  assert.deepEqual(shares(en, [0, 0, 0]), [0, 0, 0, 100]);
  assert.deepEqual(moveDivider(en, [0, 0, 0], 0, 5), [5, 5, 5]);
  assert.deepEqual(moveDivider(en, [100, 100, 100], 2, 95), [95, 95, 95]);
  assert.deepEqual(d, [25, 50, 75]);
  assert.throws(() => moveDivider(en, d, -1, 0), /index/);
  assert.throws(() => moveDivider(en, d, 3, 0), /index/);
  assert.throws(() => moveDivider(en, d, .5, 0), /index/);
  assert.throws(() => moveDivider(en, d, 0, NaN), /value/);
});

test('comparison finds an exact match, inclusive close boundary, first largest tie and far gaps', () => {
  assert.deepEqual(compare(en, [35, 55, 70]), {
    mine: [35, 20, 15, 30], real: [35, 20, 15, 30], gaps: [0, 0, 0, 0], biggest: 0, exact: true, close: true
  });
  const boundary = compare(en, [25, 50, 75]);
  assert.equal(boundary.close, true);
  assert.equal(boundary.biggest, 0);
  assert.deepEqual(boundary.gaps, [10, 5, 10, 5]);
  assert.equal(compare(en, [20, 50, 75]).close, false);
  assert.equal(compare({ ...en, close: 0 }, [25, 50, 75]).close, false);
  assert.equal(compare({ ...en, close: 100 }, [0, 0, 0]).close, true);
  for (const d of [[0, 0], [0, 101, 101], [0, 10, 5], [0, 1, 5], [0, NaN, 5]]) assert.throws(() => compare(en, d), /dividers/);
});

test('other totals, fractional steps and two to six options work', () => {
  for (const [total, step, count] of [[40, 1, 2], [10, .5, 6], [.3, .1, 3]]) {
    const options = Array.from({ length: count }, (_, i) => ({ label: `Option ${i}`, share: total / count }));
    const content = { ...en, total, step, close: 0, options };
    assert.doesNotThrow(() => validateContent(content));
    const d = initialDividers(content);
    const pushed = moveDivider(content, d, 0, total);
    assert.equal(shares(content, pushed)[0], total);
    assert.ok(shares(content, d).every(value => value >= 0));
    assert.ok(validateState(content, { dividers: d, touched: false, shown: false }));
  }
  assert.equal(quantity(1.5, { ...en, unit: 'hours' }, 'en'), '1.5\u00a0hours');
  assert.equal(quantity(35, en, 'en'), '35%');
  const fractional = { ...en, total: .3, step: .1, close: 0, options: [{ label: 'A', share: .1 }, { label: 'B', share: .1 }, { label: 'C', share: .1 }] };
  assert.equal(compare(fractional, initialDividers(fractional)).exact, true);
});

test('authored headings describe both tables for another topic', () => {
  const content = { ...en, optionHeading: 'Work', options: [{ label: 'API work', share: 60 }, { label: 'Meetings', share: 40 }] };
  const output = render(content, strings.en, { id: 'week', lang: 'en' });
  assert.equal((output.match(/<th scope="col">Work<\/th>/g) ?? []).length, 2);
  assert.match(output, /<caption[^>]*>Your split and the real split<\/caption>/);
  assert.ok(!output.includes('Cause'));
});

test('optional singular units are validated and used throughout the rendered split', () => {
  const content = { ...en, total: 2, step: 1, close: 0, unit: 'hours', unitOne: 'hour',
    options: [{ label: 'Reading', share: 1 }, { label: 'Writing', share: 1 }] };
  assert.doesNotThrow(() => validateContent(content));
  assert.equal(quantity(1, content, 'en'), '1\u00a0hour');
  assert.equal(quantity(0, content, 'en'), '0\u00a0hours');
  assert.equal(quantity(2, content, 'en'), '2\u00a0hours');
  assert.equal(quantity(1.5, content, 'en'), '1.5\u00a0hours');
  assert.equal(quantity(1, { ...en, unit: 'h' }, 'en'), '1\u00a0h');
  const french = { ...content, unit: 'heures', unitOne: 'heure' };
  for (const [value, expected] of [[0, '0\u00a0heure'], [.5, '0,5\u00a0heure'], [1, '1\u00a0heure'], [1.5, '1,5\u00a0heure'], [2, '2\u00a0heures']]) {
    assert.equal(quantity(value, french, 'fr-CA'), expected);
  }
  const output = render(content, strings.en, { id: 'hours', lang: 'en' });
  assert.match(output, /aria-valuetext="Reading 1\u00a0hour, Writing 1\u00a0hour"/);
  assert.match(output, /data-lp-share hidden>1\u00a0hour<\/strong>/);
  assert.match(output, /<td>1\u00a0hour<\/td>/);
  for (const value of ['', ' ', null, 1]) {
    assert.throws(() => validateContent({ ...en, unitOne: value }), /unitOne/);
  }
});

test('unit suffixes enforce the same 40-character boundary in validation and schema', async () => {
  const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));
  for (const field of ['unit', 'unitOne']) {
    assert.doesNotThrow(() => validateContent({ ...en, [field]: 'x'.repeat(40) }));
    assert.throws(() => validateContent({ ...en, [field]: 'x'.repeat(41) }), new RegExp(field));
    assert.equal(schema.properties[field].maxLength, 40);
  }
});

test('reset describes starting shares even when step rounding makes them unequal', () => {
  const content = { ...en, options: [{ label: 'A', share: 35 }, { label: 'B', share: 30 }, { label: 'C', share: 35 }] };
  assert.deepEqual(shares(content, initialDividers(content)), [35, 30, 35]);
  assert.equal(strings.en.cleared, 'Split reset to the starting shares.');
  assert.equal(strings.fr.cleared, 'Répartition de départ rétablie.');
});

test('format substitutes only own properties and preserves unknown placeholders', () => {
  assert.equal(format('{constructor} {toString} {missing}', {}), '{constructor} {toString} {missing}');
  assert.equal(format('{constructor} {zero}', { constructor: 'authored', zero: 0 }), 'authored 0');
});

test('content rejects planted violations and names each field', () => {
  for (const value of [null, [], 1, 'content']) assert.throws(() => validateContent(value), /content/);
  for (const field of ['title', 'context', 'question', 'resultTitle', 'optionHeading', 'source', 'unit', 'total', 'step', 'close', 'options']) {
    const content = structuredClone(en); delete content[field];
    assert.throws(() => validateContent(content), new RegExp(field));
  }
  for (const field of ['title', 'context', 'question', 'resultTitle', 'optionHeading', 'source', 'unit']) {
    for (const value of ['', ' ', null, 1]) assert.throws(() => validateContent({ ...en, [field]: value }), new RegExp(field));
  }
  assert.throws(() => validateContent({ ...en, optionHeading: 'x'.repeat(61) }), /optionHeading/);
  for (const [field, values] of [
    ['total', [0, -1, NaN, Infinity, '100']],
    ['step', [0, -1, 3, 101, NaN, Infinity, '5', 1e-20]],
    ['close', [-1, 101, NaN, Infinity, '10']],
    ['options', [null, [], [en.options[0]], Array(7).fill(en.options[0])]]
  ]) for (const value of values) assert.throws(() => validateContent({ ...en, [field]: value }), new RegExp(field));
  assert.throws(() => validateContent({ ...en, extra: true }), /extra/);
  for (const [value, field] of [
    [null, 'options\\[0\\]'], [{ label: 'X' }, 'share'], [{ share: 35 }, 'label'],
    [{ label: '', share: 35 }, 'label'], [{ label: ' ', share: 35 }, 'label'],
    [{ label: en.options[1].label, share: 35 }, 'label'],
    [{ ...en.options[0], extra: true }, 'extra'],
    ...[-1, 101, NaN, Infinity, '35'].map(share => [{ ...en.options[0], share }, 'share'])
  ]) assert.throws(() => validateContent({ ...en, options: [value, ...en.options.slice(1)] }), new RegExp(field));
  assert.throws(() => validateContent({ ...en, options: en.options.map(o => ({ ...o, share: 0 })) }), /share/);
  assert.doesNotThrow(() => validateContent({ ...en, options: [{ label: 'A', share: 0 }, { label: 'B', share: 100 }] }));
  assert.throws(() => validateContent({ ...en, options: [, { label: 'B', share: 100 }] }), /options\[0\]/);
});

test('invalid host state is ignored and valid state is copied', () => {
  const saved = { dividers: [35, 55, 70], touched: true, shown: true };
  const copy = validateState(en, saved);
  assert.deepEqual(copy, saved);
  copy.dividers[0] = 0;
  assert.equal(saved.dividers[0], 35);
  for (const value of [null, [], {}, { ...saved, shown: 1 }, { ...saved, touched: 'yes' }, { ...saved, touched: false },
    { ...saved, dividers: [5, 0, 0] }, { ...saved, dividers: [0, 5] }, { ...saved, dividers: [0, 1, 5] },
    { ...saved, dividers: [0, Infinity, 100] }, { ...saved, dividers: ['0', 5, 10] },
    { dividers: [0, 5, 10], touched: false, shown: false }]) assert.equal(validateState(en, value), null);
  assert.deepEqual(validateState(en, { dividers: [25, 50, 75], touched: false, shown: false }), { dividers: [25, 50, 75], touched: false, shown: false });
  assert.equal(validateState(en, { ...saved, dividers: new Array(3) }), null);
});

test('render has one empty status, prefixed ids, hidden controls and a complete no-JS answer', () => {
  const output = render(en, strings.en, { id: 'tickets', lang: 'en' });
  assert.match(output, /class="lp lp-split-by-proportion" data-lp-pattern="split-by-proportion" lang="en"/);
  assert.equal((output.match(/role="status"/g) ?? []).length, 1);
  assert.match(output, /role="status" aria-atomic="true"><\/p>/);
  assert.ok([...output.matchAll(/\bid="([^"]+)"/g)].every(match => match[1].startsWith('tickets-')));
  assert.match(output, /data-lp-interaction hidden/);
  assert.match(output, /data-lp-check hidden/);
  assert.match(output, /data-lp-try-again hidden/);
  const beforeAnswer = output.split('<details')[0];
  const interaction = beforeAnswer.split('<div data-lp-interaction hidden>')[1];
  let depth = 1, end = 0;
  for (const tag of interaction.matchAll(/<\/?div\b[^>]*>/g)) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    if (depth === 0) { end = tag.index; break; }
  }
  assert.ok(end > 0);
  assert.ok(!interaction.slice(0, end).includes('lp-split-by-proportion-key'));
  for (const option of en.options) assert.ok(beforeAnswer.includes(option.label));
  assert.equal((beforeAnswer.match(/data-lp-share hidden/g) ?? []).length, en.options.length);
  const fallback = output.match(/<details[^>]*data-lp-fallback>([\s\S]*?)<\/details>/)[1];
  for (const option of en.options) {
    assert.ok(fallback.includes(option.label));
    assert.ok(fallback.includes(`${option.share}%`));
  }
  assert.ok(fallback.includes(en.source));
  assert.ok(output.includes(en.question));
});

test('render escapes authored text, interface text, ids and language', () => {
  const unsafe = '<script>"&\'';
  const content = { ...en, title: unsafe, context: unsafe, question: unsafe, resultTitle: unsafe, optionHeading: unsafe, source: unsafe, unit: unsafe, unitOne: unsafe,
    options: en.options.map((o, i) => ({ ...o, label: unsafe + i })) };
  const output = render(content, { ...strings.en, check: unsafe, divider: unsafe }, { id: unsafe, lang: unsafe });
  assert.ok(!output.includes('<script>'));
  assert.ok(!output.includes('lang="<'));
  assert.match(output, /&lt;script&gt;&quot;&amp;&#39;/);
  assert.equal(format('{label} {mine}', { label: '{mine}', mine: '$&' }), '{mine} $&');
});

test('French render uses French text and nonbreaking punctuation', () => {
  const output = render(fr, strings.fr, { id: 'fr', lang: 'fr-CA' });
  assert.match(output, /lang="fr-CA"/);
  assert.ok(output.includes('Vérifier ma répartition'));
  assert.ok(output.includes('Contexte\u202f:'));
  assert.ok(output.includes('35\u202f%'));
  assert.ok(output.includes('cause\u202f?'));
  assert.ok(output.includes('Registre des demandes de soutien du mois dernier.'));
  assert.ok(output.includes('elle a traité 400 demandes.'));
});

test('all six pattern colours meet the contrast floor with the shared default ink', async () => {
  const css = await readFile(new URL('./pattern.css', import.meta.url), 'utf8');
  const base = await readFile(new URL('../../lib/base.css', import.meta.url), 'utf8');
  const luminance = colour => colour.match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const ink = luminance(base.match(/--lp-ink: #([0-9a-f]{6})/)[1]);
  const colours = [...css.matchAll(/--lp-split-by-proportion-[a-f]: #([0-9a-f]{6})/g)];
  assert.equal(colours.length, 6);
  for (const [i, minimum] of [9.2, 10.9, 13.2, 8.4, 8.4, 8.4].entries()) {
    assert.ok((luminance(colours[i][1]) + .05) / (ink + .05) >= minimum, `Option ${i + 1} contrast`);
  }
});
