import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { feedback, format, mixedPairs, principleName, quoteParts, score, validateContent, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const en = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const fr = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));
/** @param {(content: typeof en) => void} edit */
const edited = edit => { const content = structuredClone(en); edit(content); return content; };

test('examples validate, share ids and answers, and interface keys match', () => {
  for (const content of [en, fr]) assert.doesNotThrow(() => validateContent(content));
  assert.deepEqual(Object.keys(strings.en), Object.keys(strings.fr));
  assert.deepEqual(fr.principles.map(p => p.id), en.principles.map(p => p.id));
  assert.deepEqual(fr.cases.map(c => [c.correct, c.lure]), en.cases.map(c => [c.correct, c.lure]));
});

test('the sample answers do not follow the order of the rows, and neighbours differ', () => {
  const answers = en.cases.map(c => c.correct);
  assert.notDeepEqual(answers.slice(0, en.principles.length), en.principles.map(p => p.id));
  for (let i = 1; i < answers.length; i++) assert.notEqual(answers[i], answers[i - 1]);
});

test('the schema and the validator agree on required fields and caps', () => {
  assert.deepEqual(schema.required, ['title', 'question', 'principles', 'cases']);
  for (const field of schema.required) assert.throws(() => validateContent(edited(c => { delete c[field]; })), new RegExp(field));
  assert.doesNotThrow(() => validateContent(edited(c => { delete c.context; })));
  assert.deepEqual([schema.properties.principles.minItems, schema.properties.principles.maxItems], [2, 4]);
  assert.deepEqual([schema.properties.cases.minItems, schema.properties.cases.maxItems], [3, 4]);
  assert.equal(schema.properties.principles.items.properties.rule.maxLength, 120);
  assert.deepEqual(['looksLike', 'decides'].map(key => schema.properties.cases.items.properties[key].maxLength), [150, 150]);
});

test('the schema and the validator agree that blank prose is invalid', () => {
  const principle = schema.properties.principles.items.properties, item = schema.properties.cases.items.properties;
  const prose = [
    ['title', schema.properties.title, (c, v) => { c.title = v; }],
    ['context', schema.properties.context, (c, v) => { c.context = v; }],
    ['question', schema.properties.question, (c, v) => { c.question = v; }],
    ['principles[0].name', principle.name, (c, v) => { c.principles[0].name = v; }],
    ['principles[0].rule', principle.rule, (c, v) => { c.principles[0].rule = v; }],
    ...['text', 'looksLike', 'decides'].map(key => [`cases[0].${key}`, item[key], (c, v) => { c.cases[0][key] = v; }])
  ];
  for (const [path, node, set] of prose) {
    for (const blank of [' ', '\t ']) {
      // minLength alone lets whitespace through, so the schema needs a non-space character as the validator does.
      assert.ok(blank.length >= node.minLength && !new RegExp(node.pattern).test(blank), `schema rejects blank ${path}`);
      assert.throws(() => validateContent(edited(c => set(c, blank))), new RegExp(path.replace(/[[\]]/g, '\\$&')));
    }
  }
  for (const content of [en, fr]) {
    for (const value of [content.title, content.question, ...content.principles.flatMap(p => [p.name, p.rule]), ...content.cases.flatMap(c => [c.text, c.looksLike, c.decides])]) assert.match(value, /\S/);
  }
  for (const key of ['correct', 'lure']) {
    assert.ok(!new RegExp(item[key].pattern).test(' '));
    assert.throws(() => validateContent(edited(c => { c.cases[0][key] = ' '; })), new RegExp(`cases\\[0\\]\\.${key}`));
  }
});

test('content needs two to four principles with unique ids and names', () => {
  const fourth = { id: 'listen', name: 'Listen', rule: 'Let them finish.' };
  const case4 = { text: 'A case.', correct: 'listen', lure: 'name', looksLike: 'A look.', decides: 'A fact.' };
  assert.throws(() => validateContent(edited(c => { c.principles = c.principles.slice(0, 1); c.cases.forEach(x => { x.correct = 'name'; }); })), /principles/);
  assert.doesNotThrow(() => validateContent(edited(c => { c.principles.push(fourth); c.cases[3] = case4; c.cases[1].correct = 'name'; })));
  assert.throws(() => validateContent(edited(c => { c.principles.push(fourth, { ...fourth, id: 'five', name: 'Five' }); })), /principles/);
  assert.throws(() => validateContent(edited(c => { c.principles[1].id = 'name'; })), /principles\[1\]\.id/);
  assert.throws(() => validateContent(edited(c => { c.principles[0].id = 'has space'; })), /principles\[0\]\.id/);
  assert.throws(() => validateContent(edited(c => { c.principles[2].name = c.principles[0].name; })), /principles\[2\]\.name/);
});

test('content takes three or four cases, each with a known answer and a different lure', () => {
  assert.throws(() => validateContent(edited(c => { c.cases = c.cases.slice(0, 2); })), /cases/);
  assert.doesNotThrow(() => validateContent(edited(c => { c.cases = c.cases.slice(0, 3); })));
  assert.throws(() => validateContent(edited(c => { c.cases.push(c.cases[0]); })), /cases/);
  assert.throws(() => validateContent(edited(c => { c.cases[0].correct = 'nobody'; })), /cases\[0\]\.correct/);
  assert.throws(() => validateContent(edited(c => { c.cases[0].lure = 'nobody'; })), /cases\[0\]\.lure/);
  assert.throws(() => validateContent(edited(c => { c.cases[0].lure = c.cases[0].correct; })), /cases\[0\]\.lure/);
});

test('every principle is the answer to at least one case', () => {
  // Case 1 is the only Agree case.
  assert.throws(() => validateContent(edited(c => { c.cases[0].correct = 'name'; })), /principle agree is the correct answer to no case/);
});

test('content rejects unknown fields, blank text and wrong shapes', () => {
  assert.throws(() => validateContent(null), /content/);
  assert.throws(() => validateContent(edited(c => { c.extra = 1; })), /content\.extra/);
  assert.throws(() => validateContent(edited(c => { c.principles[0].note = 'x'; })), /principles\[0\]\.note/);
  assert.throws(() => validateContent(edited(c => { c.cases[0].note = 'x'; })), /cases\[0\]\.note/);
  for (const field of ['title', 'context', 'question']) {
    for (const value of ['', ' ', 1, null]) assert.throws(() => validateContent(edited(c => { c[field] = value; })), new RegExp(field));
  }
  for (const field of ['text', 'looksLike', 'decides']) assert.throws(() => validateContent(edited(c => { c.cases[2][field] = ' '; })), new RegExp(`cases\\[2\\]\\.${field}`));
  assert.throws(() => validateContent(edited(c => { c.principles[1].rule = ''; })), /principles\[1\]\.rule/);
});

test('feedback always gives the deciding fact, and the surface detail only after the lure', () => {
  const [first] = en.cases;
  assert.deepEqual(feedback(en, 0, 'agree'), { right: true, correct: 'agree', looksLike: null, decides: first.decides });
  assert.deepEqual(feedback(en, 0, 'ask'), { right: false, correct: 'agree', looksLike: first.looksLike, decides: first.decides });
  // Name the behaviour is wrong here but is not the lure, so the line about a question would not fit.
  assert.deepEqual(feedback(en, 0, 'name'), { right: false, correct: 'agree', looksLike: null, decides: first.decides });
  assert.throws(() => feedback(en, 4, 'name'), RangeError);
  assert.throws(() => feedback(en, 0, 'nobody'), /picks/);
});

test('score counts checked cases and knows when the activity is done', () => {
  assert.deepEqual(score(en, []), { results: [], right: 0, total: 4, done: false });
  assert.deepEqual(score(en, ['agree', 'agree']), { results: [true, false], right: 1, total: 4, done: false });
  assert.deepEqual(score(en, ['agree', 'name', 'ask', 'name']), { results: [true, true, true, true], right: 4, total: 4, done: true });
  assert.throws(() => score(en, ['agree', 'name', 'ask', 'name', 'name']), /picks/);
  assert.throws(() => score(en, ['nobody']), /picks\[0\]/);
});

test('mixed-up pairs ignore direction, count each pair and list the most frequent first', () => {
  assert.deepEqual(mixedPairs(en, ['agree', 'name', 'ask', 'name']), []);
  // Ask for Agree, Agree for Name, Agree for Ask, Ask for Name.
  assert.deepEqual(mixedPairs(en, ['ask', 'agree', 'agree', 'ask']), [
    { first: 'ask', second: 'agree', count: 2 },
    { first: 'name', second: 'ask', count: 1 },
    { first: 'name', second: 'agree', count: 1 }
  ]);
  assert.deepEqual(mixedPairs(en, ['agree', 'ask']), [{ first: 'name', second: 'ask', count: 1 }]);
});

test('quoted principle names are split out whole, longest first', () => {
  assert.deepEqual(quoteParts(en, en.cases[1].looksLike), [
    { text: '"From now on" sounds like ', principle: false },
    { text: 'Agree on the next action', principle: true },
    { text: '.', principle: false }
  ]);
  assert.deepEqual(quoteParts(en, 'No names here.'), [{ text: 'No names here.', principle: false }]);
  const nested = edited(c => { c.principles[2].name = 'Name the behaviour again'; });
  assert.deepEqual(quoteParts(nested, 'Try Name the behaviour again.'), [{ text: 'Try ', principle: false }, { text: 'Name the behaviour again', principle: true }, { text: '.', principle: false }]);
  assert.equal(principleName(en, 'ask'), 'Ask an open question');
});

test('saved state is copied when valid and ignored otherwise', () => {
  const saved = { picks: ['agree'] };
  const copy = validateState(en, saved);
  assert.deepEqual(copy, saved);
  assert.notEqual(copy?.picks, saved.picks);
  for (const value of [null, 'x', { picks: 'agree' }, { picks: ['nobody'] }, { picks: ['agree', 'name', 'ask', 'name', 'name'] }, { picks: [], extra: 1 }]) assert.equal(validateState(en, value), null);
});

test('format replaces known placeholders once and leaves inserted text literal', () => {
  assert.equal(format('{a} and {b}', { a: '{b}', b: 'x' }), '{b} and x');
  assert.equal(format('{missing}', {}), '{missing}');
});

test('server HTML: every case, its rows with rules, hidden checks and answers without JavaScript', () => {
  const markup = render(en, strings.en, { id: 'sort', lang: 'en' });
  assert.match(markup, /^<section class="lp lp-sort-by-principle" data-lp-pattern="sort-by-principle" lang="en">/);
  assert.equal((markup.match(/data-lp-case>/g) || []).length, 4);
  assert.equal((markup.match(/type="radio"/g) || []).length, 12);
  assert.equal((markup.match(/role="status"/g) || []).length, 1);
  assert.ok(markup.includes('Case 3 of 4'));
  assert.ok(markup.includes('<span class="lp-sort-by-principle-name">Ask an open question</span><span class="lp-visually-hidden">. </span><span class="lp-sort-by-principle-rule">The facts are agreed, but the cause is not known. Ask what got in the way.</span>'));
  assert.ok(markup.includes('<summary>Answer for case 2</summary>'));
  assert.ok(markup.includes('<strong>Correct answer: Name the behaviour.</strong>'));
  assert.ok(markup.includes('&quot;From now on&quot; sounds like <em>Agree on the next action</em>.'));
  assert.match(markup, /<div class="lp-actions" data-lp-actions hidden>/);
  assert.match(markup, /<div class="lp-section" data-lp-result hidden>/);
  // Only the last case has no Next button.
  assert.equal((markup.match(/data-lp-next/g) || []).length, 3);
  for (const idAttr of markup.matchAll(/ id="([^"]+)"/g)) assert.ok(idAttr[1].startsWith('sort-'), idAttr[1]);
});

test('authored text is escaped, and the context is optional', () => {
  const hostile = edited(c => { c.title = '<b>x</b>'; c.cases[0].text = 'a & <i>b</i>'; delete c.context; });
  const markup = render(hostile, strings.en, { id: 'x', lang: 'en' });
  assert.ok(markup.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(markup.includes('a &amp; &lt;i&gt;b&lt;/i&gt;'));
  assert.ok(!markup.includes('lp-context'));
});

test('French renders with French typography', () => {
  const markup = render(fr, strings.fr, { id: 'fr', lang: 'fr' });
  assert.ok(markup.includes('Quel principe devez-vous appliquer maintenant\u202f?'));
  // A question quoted in « » keeps its closing guillemet on the same line.
  assert.ok(markup.includes('qu’allez-vous changer\u202f?\u00a0»'));
  assert.ok(!/[?!;] »/.test(markup));
  assert.ok(markup.includes('Bonne réponse : Nommer le comportement.'));
  assert.ok(markup.includes('Cas 1 sur 4'));
});
