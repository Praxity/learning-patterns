import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { answer, answerText, format, isPick, pickName, score, summary, validateContent, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const en = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const fr = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));
/** @param {(content: typeof en) => void} edit */
const edited = edit => { const content = structuredClone(en); edit(content); return content; };

test('examples validate, share answers, and interface keys match', () => {
  for (const content of [en, fr]) assert.doesNotThrow(() => validateContent(content));
  assert.deepEqual(Object.keys(strings.en), Object.keys(strings.fr));
  assert.equal(fr.better, en.better);
  assert.deepEqual(fr.qualities.map(q => q.sentence), en.qualities.map(q => q.sentence));
  assert.deepEqual([fr.versions.a.length, fr.versions.b.length], [en.versions.a.length, en.versions.b.length]);
});

test('the schema and the validator agree on required fields and counts', () => {
  assert.deepEqual(schema.required, ['title', 'context', 'versions', 'better', 'qualities']);
  for (const field of schema.required) assert.throws(() => validateContent(edited(c => { delete c[field]; })), new RegExp(field));
  for (const field of schema.properties.qualities.items.required) assert.throws(() => validateContent(edited(c => { delete c.qualities[0][field]; })), new RegExp(`qualities\\[0\\]\\.${field}`));
  assert.deepEqual([schema.properties.qualities.minItems, schema.properties.qualities.maxItems], [2, 4]);
  assert.deepEqual([schema.properties.versions.properties.a.minItems, schema.properties.versions.properties.a.maxItems], [2, 5]);
  assert.deepEqual(schema.properties.better.enum, ['a', 'b']);
});

test('each version has two to five sentences of text', () => {
  assert.throws(() => validateContent(edited(c => { c.versions.a = c.versions.a.slice(0, 1); })), /versions\.a/);
  assert.throws(() => validateContent(edited(c => { c.versions.b = [...c.versions.b, 'Four.', 'Five.', 'Six.']; })), /versions\.b/);
  assert.doesNotThrow(() => validateContent(edited(c => { c.versions.b = [...c.versions.b, 'Four.', 'Five.']; })));
  assert.throws(() => validateContent(edited(c => { c.versions.a[1] = ' '; })), /versions\.a\[1\]/);
  assert.throws(() => validateContent(edited(c => { c.versions.c = ['x', 'y']; })), /versions\.c/);
  assert.throws(() => validateContent(edited(c => { c.better = 'c'; })), /better/);
});

test('content rejects unknown fields, blank text and wrong shapes', () => {
  assert.throws(() => validateContent(null), /content/);
  assert.throws(() => validateContent(edited(c => { c.extra = 1; })), /content\.extra/);
  assert.throws(() => validateContent(edited(c => { c.qualities[0].extra = 1; })), /qualities\[0\]\.extra/);
  for (const field of ['title', 'context']) for (const value of ['', ' ', 1, null]) assert.throws(() => validateContent(edited(c => { c[field] = value; })), new RegExp(field));
  for (const field of ['question', 'reason', 'note']) assert.throws(() => validateContent(edited(c => { c.qualities[1][field] = ' '; })), new RegExp(`qualities\\[1\\]\\.${field}`));
  assert.throws(() => validateContent(edited(c => { c.qualities = c.qualities.slice(0, 1); })), /qualities/);
  assert.throws(() => validateContent(edited(c => { c.qualities = [...c.qualities, ...c.qualities].map((q, i) => ({ ...q, sentence: i < 3 ? i + 1 : null })); })), /qualities/);
});

test('every sentence answer is a sentence of the better version, used once, and one must exist', () => {
  for (const sentence of [0, 4, 1.5, '2']) assert.throws(() => validateContent(edited(c => { c.qualities[0].sentence = sentence; })), /qualities\[0\]\.sentence/);
  // Sentence 3 exists in Version B; it is free in the sample.
  assert.doesNotThrow(() => validateContent(edited(c => { c.qualities[0].sentence = 3; })));
  assert.throws(() => validateContent(edited(c => { c.qualities[2].sentence = 2; })), /qualities\[2\]\.sentence: another quality/);
  assert.throws(() => validateContent(edited(c => { for (const q of c.qualities) q.sentence = null; })), /at least one/);
  // Counting follows the better version: Version A has three sentences here, so a fourth fails.
  const longer = edited(c => { c.versions.b.push('Four.'); c.qualities[0].sentence = 4; });
  assert.doesNotThrow(() => validateContent(longer));
  assert.throws(() => validateContent({ ...longer, better: 'a' }), /qualities\[0\]\.sentence/);
});

test('the sample phone numbers cannot break at their hyphens', () => {
  assert.ok(en.versions.b[1].includes('514-\u2060555-\u20600142'));
  assert.ok(fr.versions.b[1].includes('514 555-\u20600142'));
});

test('answers, names and the answer text', () => {
  assert.deepEqual(en.qualities.map((_, i) => answer(en, i)), ['b2', 'neither', 'b1']);
  assert.equal(pickName(en, strings.en, 'a3'), 'Version A, sentence 3');
  assert.equal(pickName(fr, strings.fr, 'b2'), 'Version B, phrase 2');
  assert.equal(pickName(en, strings.en, 'neither'), 'Neither version does this');
  assert.equal(answerText(en, strings.en, 0), 'Version B, sentence 2: For an urgent order, call Jo Mensah at 514-\u2060555-\u20600142.');
  assert.equal(answerText(en, strings.en, 1), 'Neither version does this.');
  for (const pick of ['a1', 'b3', 'neither']) assert.equal(isPick(en, pick), true, pick);
  for (const pick of ['a0', 'a4', 'c1', 'b01', 'B1', '', null, 2]) assert.equal(isPick(en, pick), false, String(pick));
});

test('score gives one count: a pick is right only when it is the answer sentence, or Neither when neither does it', () => {
  assert.deepEqual(score(en, []), { results: [], right: 0, total: 3, done: false });
  assert.deepEqual(score(en, ['b2', 'neither', 'b1']), { results: [true, true, true], right: 3, total: 3, done: true });
  // The right version with the wrong sentence, and a sentence where neither version does it, both count as wrong.
  assert.deepEqual(score(en, ['b3', 'a2', 'b1']), { results: [false, false, true], right: 1, total: 3, done: true });
  assert.deepEqual(score(en, ['neither', 'b2']), { results: [false, false], right: 0, total: 3, done: false });
  assert.throws(() => score(en, ['b9']), /picks\[0\]/);
  assert.throws(() => score(en, ['b1', 'b1', 'b1', 'b1']), /picks/);
});

test('the summary lists the better version with a note on each answer sentence, then what both miss', () => {
  assert.deepEqual(summary(en), {
    version: 'b',
    sentences: [
      { text: en.versions.b[0], note: 'Whether you\'ll read email' },
      { text: en.versions.b[1], note: 'Who to call for an urgent order' },
      { text: en.versions.b[2], note: null }
    ],
    missing: ['What counts as urgent']
  });
  assert.deepEqual(summary(edited(c => { c.qualities[1].sentence = 3; })).missing, []);
});

test('saved state is copied when valid and ignored otherwise', () => {
  for (const saved of [{ at: 0, picks: [] }, { at: 0, picks: ['a1'] }, { at: 1, picks: ['a1'] }, { at: 2, picks: ['a1', 'neither', 'b3'] }, { at: 3, picks: ['b2', 'neither', 'b1'] }]) {
    const copy = validateState(en, saved);
    assert.deepEqual(copy, saved);
    assert.notEqual(copy.picks, saved.picks);
  }
  for (const value of [undefined, null, 'x', [], {}, { at: 0 }, { picks: [] }, { at: -1, picks: [] }, { at: 4, picks: ['b2', 'b2', 'b2'] },
    { at: 1, picks: [] }, { at: 0, picks: ['a1', 'a2'] }, { at: 3, picks: ['b2', 'neither'] }, { at: 0, picks: ['z9'] }, { at: 1.5, picks: ['a1'] }, { at: 0, picks: [], shown: true }]) {
    assert.equal(validateState(en, value), null, JSON.stringify(value));
  }
});

test('format replaces placeholders once and leaves inserted text literal', () => {
  assert.equal(format('{a} of {b}', { a: '{b}', b: 2 }), '{b} of 2');
  assert.equal(format('{missing}', {}), '{missing}');
});

for (const [lang, content] of [['en', en], ['fr', fr]]) {
  test(`server HTML: versions and answers for no JavaScript, the step and summary hidden until enhanced (${lang})`, () => {
    const output = render(content, strings[lang], { id: 'pair', lang });
    assert.match(output, new RegExp(`^<section class="lp lp-which-is-better" data-lp-pattern="which-is-better" lang="${lang}">`));
    assert.equal((output.match(/role="status"/g) ?? []).length, 1);
    assert.match(output, /<p class="lp-visually-hidden" role="status" aria-atomic="true"><\/p>/);
    assert.match(output, /<div class="lp-stack" data-lp-step hidden>/);
    assert.match(output, /<div class="lp-stack" data-lp-summary hidden>/);
    const fallback = output.slice(output.indexOf('data-lp-fallback'), output.indexOf('data-lp-step'));
    // Both versions as numbered lists, then each question with its answer behind a closed disclosure.
    assert.equal((fallback.match(/<ol class="lp-which-is-better-plain">/g) ?? []).length, 2);
    assert.equal((fallback.match(/<details class="lp-details">/g) ?? []).length, 3);
    assert.doesNotMatch(fallback, /<button|<details[^>]*open/);
    const ids = [...output.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(ids, ['pair-question', 'pair-hint', 'pair-error']);
    // "Question 1 of 3, " then the question: the comma stays inside the block label.
    assert.match(output, /<span class="lp-label"><span data-lp-progress>[^<]+<\/span><span class="lp-visually-hidden">, <\/span><\/span><span data-lp-question-text>/);
  });

  test(`each sentence is a toggle button named with its version and number, then Neither (${lang})`, () => {
    const output = render(content, strings[lang], { id: 'pair', lang });
    const buttons = [...output.matchAll(/<button class="lp-choice[^"]*" type="button" aria-pressed="false" data-lp-pick="([^"]+)">(.*?)<\/button>/g)];
    assert.deepEqual(buttons.map(match => match[1]), ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'neither']);
    const name = lang === 'fr' ? 'Version B, phrase 2\u00a0: ' : 'Version B, sentence 2: ';
    assert.match(buttons[4][2], new RegExp(`^<span class="lp-choice-key" aria-hidden="true">2</span><span><span class="lp-visually-hidden">${name}</span><span class="lp-which-is-better-text">`));
    assert.equal(buttons[6][2], `<span>${strings[lang].neither}</span>`);
    assert.match(output, /role="group" aria-labelledby="pair-question" aria-describedby="pair-hint">\s*<p class="lp-visually-hidden" id="pair-hint">[^<]+<\/p>\s*<p class="lp-error-text" id="pair-error" data-lp-error hidden>/);
  });
}

test('authored text is escaped, and French typography applies', () => {
  const content = edited(c => { c.title = '<b>Pair</b>'; c.versions.a[0] = 'A <script> & "quote"'; c.qualities[0].note = '<i>n</i>'; });
  const output = render(content, strings.en, { id: 'x"y', lang: 'en' });
  assert.doesNotMatch(output, /<script>|<b>|<i>/);
  assert.ok(output.includes('&lt;b&gt;Pair&lt;/b&gt;'));
  assert.ok(output.includes('id="x&quot;y-question"'));
  const french = render(fr, strings.fr, { id: 'f', lang: 'fr' });
  assert.ok(french.includes('Quelle phrase précise ce qui compte comme une commande urgente ?'));
  assert.ok(french.includes('Bonne réponse : Aucune des deux versions ne le fait.'));
  assert.throws(() => render({ ...content, qualities: [] }, strings.en, { id: 'x', lang: 'en' }), /qualities/);
});

test('the summary marks the answer sentences and puts each note after its sentence in reading order', () => {
  const output = render(en, strings.en, { id: 's', lang: 'en' });
  const end = output.slice(output.indexOf('data-lp-summary'));
  assert.match(end, /<h3 class="lp-stem">What makes Version B better<\/h3>/);
  assert.equal((end.match(/<mark>/g) ?? []).length, 2);
  assert.ok(end.includes('<li><span class="lp-which-is-better-sentence"><mark>For an urgent order, call Jo Mensah at 514-\u2060555-\u20600142.</mark></span><span class="lp-which-is-better-note"><span class="lp-visually-hidden">This sentence shows: </span>Who to call for an urgent order</span></li>'));
  assert.ok(end.includes('<p class="lp-label">Missing from both versions</p>\n      <ul class="lp-which-is-better-missing" role="list"><li>What counts as urgent</li></ul>'));
  // With no Neither question there is nothing missing to list.
  assert.doesNotMatch(render(edited(c => { c.qualities[1].sentence = 3; }), strings.en, { id: 's', lang: 'en' }), /Missing from both/);
  assert.match(render({ ...en, better: 'a', qualities: en.qualities.map(q => ({ ...q, sentence: q.sentence && 4 - q.sentence })) }, strings.en, { id: 's', lang: 'en' }), /What makes Version A better/);
});

test('the pattern stylesheet keeps its prefix, the highlighter and forced-colour cues', async () => {
  const css = await readFile(new URL('./pattern.css', import.meta.url), 'utf8');
  assert.match(css, /--lp-which-is-better-mark: #ffe49a/);
  assert.match(css, /\[aria-pressed="true"\]:not\(\[data-lp-mark\]\) \.lp-which-is-better-text \{[^}]*background: var\(--lp-which-is-better-mark\)/);
  assert.match(css, /forced-colors: active[^]*\[aria-pressed="true"\]:not\(\[data-lp-mark\]\) \{ border: 2px solid Highlight/);
  for (const [, name] of css.matchAll(/\.(lp-[a-z-]+)/g)) assert.ok(name.startsWith('lp-which-is-better') || ['lp-choice', 'lp-choice-key', 'lp-choice-mark', 'lp-error-text'].includes(name), name);
});
