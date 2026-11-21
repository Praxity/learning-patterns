import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { answer, answerText, format, isPick, pickName, score, summary, validateContent, validateState } from './logic.js';
import { render } from './render.js';
import { escapeHtml as html } from '../../lib/html.js';
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
  for (const version of ['a', 'b']) assert.deepEqual(fr.versions[version].body.map(p => p.length), en.versions[version].body.map(p => p.length));
});

test('the schema and the validator agree on required fields and counts', () => {
  assert.deepEqual(schema.required, ['title', 'context', 'versions', 'better', 'qualities']);
  for (const field of schema.required) assert.throws(() => validateContent(edited(c => { delete c[field]; })), new RegExp(field));
  for (const field of schema.properties.qualities.items.required) assert.throws(() => validateContent(edited(c => { delete c.qualities[0][field]; })), new RegExp(`qualities\\[0\\]\\.${field}`));
  assert.deepEqual([schema.properties.qualities.minItems, schema.properties.qualities.maxItems], [2, 4]);
  const email = schema.$defs.email;
  assert.deepEqual(email.required, ['subject', 'greeting', 'body', 'signoff']);
  for (const field of email.required) assert.throws(() => validateContent(edited(c => { delete c.versions.b[field]; })), new RegExp(`versions\\.b\\.${field}`));
  assert.deepEqual([email.properties.body.minItems, email.properties.body.maxItems], [1, 3]);
  assert.deepEqual(schema.properties.versions.properties.a, { $ref: '#/$defs/email' });
  assert.deepEqual(schema.properties.better.enum, ['a', 'b']);
});

test('each version is an email with one to three paragraphs and two to six sentences in all', () => {
  assert.throws(() => validateContent(edited(c => { c.versions.a.body = [['One.']]; })), /versions\.a\.body: write two to six/);
  assert.doesNotThrow(() => validateContent(edited(c => { c.versions.a.body = [['One.', 'Two.']]; })));
  assert.throws(() => validateContent(edited(c => { c.versions.b.body = [['1.', '2.'], ['3.', '4.'], ['5.', '6.', '7.']]; })), /versions\.b\.body: write two to six/);
  assert.doesNotThrow(() => validateContent(edited(c => { c.versions.b.body = [['1.', '2.'], ['3.', '4.'], ['5.', '6.']]; })));
  assert.throws(() => validateContent(edited(c => { c.versions.b.body = [['1.'], ['2.'], ['3.'], ['4.']]; })), /versions\.b\.body: write one to three/);
  assert.throws(() => validateContent(edited(c => { c.versions.b.body = []; })), /versions\.b\.body/);
  assert.throws(() => validateContent(edited(c => { c.versions.b.body.push([]); })), /versions\.b\.body\[1\]/);
  assert.throws(() => validateContent(edited(c => { c.versions.b.body = [['1.', '2.'], '3.']; })), /versions\.b\.body\[1\]/);
  assert.throws(() => validateContent(edited(c => { c.versions.a.body[0][1] = ' '; })), /versions\.a\.body\[0\]\[1\]/);
  for (const field of ['subject', 'greeting', 'signoff']) assert.throws(() => validateContent(edited(c => { c.versions.a[field] = ' '; })), new RegExp(`versions\\.a\\.${field}`));
  assert.throws(() => validateContent(edited(c => { c.versions.a = ['One.', 'Two.']; })), /versions\.a/);
  assert.throws(() => validateContent(edited(c => { c.versions.a.from = 'Sam'; })), /versions\.a\.from/);
  assert.throws(() => validateContent(edited(c => { c.versions.c = c.versions.a; })), /versions\.c/);
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

test('every sentence answer is a body sentence of the better version, counted across paragraphs, used once, and one must exist', () => {
  for (const sentence of [0, 3, 1.5, '2']) assert.throws(() => validateContent(edited(c => { c.qualities[0].sentence = sentence; })), /qualities\[0\]\.sentence/);
  assert.doesNotThrow(() => validateContent(edited(c => { c.versions.b.body.push(['Three.']); c.qualities[0].sentence = 3; })));
  assert.throws(() => validateContent(edited(c => { c.qualities[2].sentence = 2; })), /qualities\[2\]\.sentence: another quality/);
  assert.throws(() => validateContent(edited(c => { for (const q of c.qualities) q.sentence = null; })), /at least one/);
  const longer = edited(c => { c.versions.b.body.push(['Three.', 'Four.']); c.qualities[0].sentence = 4; });
  assert.doesNotThrow(() => validateContent(longer));
  assert.throws(() => validateContent({ ...longer, better: 'a' }), /qualities\[0\]\.sentence/);
});

test('the sample phone numbers cannot break at their hyphens', () => {
  assert.ok(en.versions.b.body[0][1].includes('514-\u2060555-\u20600142'));
  assert.ok(fr.versions.b.body[0][1].includes('514\u00a0555-\u20600142'));
});

test('the English title keeps "out-of-office" on one line with non-breaking hyphens', () => {
  const hyphen = String.fromCodePoint(0x2011);
  assert.ok(en.title.includes(`out${hyphen}of${hyphen}office`));
  assert.doesNotMatch(en.title, /-/);
});

test('answers, names and the answer text', () => {
  assert.deepEqual(en.qualities.map((_, i) => answer(en, i)), ['b2', 'neither', 'b1']);
  assert.equal(pickName(en, strings.en, 'a2'), 'Version A');
  assert.equal(pickName(fr, strings.fr, 'b2'), 'Version B');
  assert.equal(pickName(en, strings.en, 'neither'), 'Neither version does this');
  assert.equal(answerText(en, strings.en, 0), 'Correct answer, in Version B: For an urgent order, call Jo Mensah at 514-\u2060555-\u20600142.');
  assert.equal(answerText(en, strings.en, 2), "Correct answer, in Version B: I'm away until Monday, October 14, and not reading email.");
  assert.equal(answerText(en, strings.en, 1), 'Correct answer: Neither version does this.');
  assert.equal(answerText(fr, strings.fr, 1), 'Bonne réponse : Aucune des deux versions ne le fait.');
  assert.equal(answerText(fr, strings.fr, 2), `Bonne réponse, dans la version B : ${fr.versions.b.body[0][0]}`);
  for (const pick of ['a1', 'a2', 'b2', 'neither']) assert.equal(isPick(en, pick), true, pick);
  for (const pick of ['a0', 'a3', 'b3', 'c1', 'b01', 'B1', '', null, 2]) assert.equal(isPick(en, pick), false, String(pick));
});

test('score gives one count: a pick is right only when it is the answer sentence, or Neither when neither does it', () => {
  assert.deepEqual(score(en, []), { results: [], right: 0, total: 3, done: false });
  assert.deepEqual(score(en, ['b2', 'neither', 'b1']), { results: [true, true, true], right: 3, total: 3, done: true });
  assert.deepEqual(score(en, ['b1', 'a2', 'b1']), { results: [false, false, true], right: 1, total: 3, done: true });
  assert.deepEqual(score(en, ['neither', 'b2']), { results: [false, false], right: 0, total: 3, done: false });
  assert.throws(() => score(en, ['b3']), /picks\[0\]/);
  assert.throws(() => score(en, ['b1', 'b1', 'b1', 'b1']), /picks/);
});

test('the summary gives the better version paragraph by paragraph with a note on each answer sentence, then what both miss', () => {
  const [[first, second]] = en.versions.b.body;
  assert.deepEqual(summary(en), {
    version: 'b',
    paragraphs: [[{ text: first, note: 'Whether you\'ll read email' }, { text: second, note: 'Who to call for an urgent order' }]],
    missing: ['What counts as urgent']
  });
  const third = edited(c => { c.versions.b.body.push(['Three.']); });
  assert.deepEqual(summary(third).paragraphs[1], [{ text: 'Three.', note: null }]);
  assert.deepEqual(summary(edited(c => { c.versions.b.body.push(['Three.']); c.qualities[1].sentence = 3; })).missing, []);
});

test('saved state is copied when valid and ignored otherwise', () => {
  for (const saved of [{ at: 0, picks: [] }, { at: 0, picks: ['a1'] }, { at: 1, picks: ['a2'] }, { at: 2, picks: ['a1', 'neither', 'b2'] }, { at: 3, picks: ['b2', 'neither', 'b1'] }]) {
    const copy = validateState(en, saved);
    assert.deepEqual(copy, saved);
    assert.notEqual(copy.picks, saved.picks);
  }
  for (const value of [undefined, null, 'x', [], {}, { at: 0 }, { picks: [] }, { at: -1, picks: [] }, { at: 4, picks: ['b2', 'b2', 'b2'] },
    { at: 1, picks: [] }, { at: 0, picks: ['a1', 'a2'] }, { at: 3, picks: ['b2', 'neither'] }, { at: 0, picks: ['z9'] }, { at: 0, picks: ['b3'] }, { at: 1.5, picks: ['a1'] }, { at: 0, picks: [], shown: true }]) {
    assert.equal(validateState(en, value), null, JSON.stringify(value));
  }
});

test('format replaces placeholders once and leaves inserted text literal', () => {
  assert.equal(format('{a} of {b}', { a: '{b}', b: 2 }), '{b} of 2');
  assert.equal(format('{missing}', {}), '{missing}');
});

for (const [lang, content] of [['en', en], ['fr', fr]]) {
  test(`server HTML: both emails and the answers for no JavaScript, the step and summary hidden until enhanced (${lang})`, () => {
    const output = render(content, strings[lang], { id: 'pair', lang });
    assert.match(output, new RegExp(`^<section class="lp lp-which-is-better" data-lp-pattern="which-is-better" lang="${lang}">`));
    assert.equal((output.match(/role="status"/g) ?? []).length, 1);
    assert.match(output, /<p class="lp-visually-hidden" role="status" aria-atomic="true"><\/p>/);
    assert.match(output, /<div class="lp-stack" data-lp-step hidden>/);
    assert.match(output, /<div class="lp-stack" data-lp-summary hidden>/);
    const fallback = output.slice(output.indexOf('data-lp-fallback'), output.indexOf('data-lp-step'));
    assert.equal((fallback.match(/<div class="lp-which-is-better-email">/g) ?? []).length, 2);
    assert.equal((fallback.match(/<div class="lp-quote lp-which-is-better-body">/g) ?? []).length, 2);
    assert.equal((fallback.match(/<details class="lp-details">/g) ?? []).length, 3);
    assert.doesNotMatch(fallback, /<button|role="button"|tabindex|<details[^>]*open/);
    const ids = [...output.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(ids, ['pair-question', 'pair-hint', 'pair-a', 'pair-b', 'pair-error']);
    assert.match(output, /<span class="lp-label"><span data-lp-progress>[^<]+<\/span><span class="lp-visually-hidden">, <\/span><\/span><span data-lp-question-text>/);
  });

  test(`each email has a plain header, then its body in a quote block; only body sentences are toggles (${lang})`, () => {
    const output = render(content, strings[lang], { id: 'pair', lang });
    const step = output.slice(output.indexOf('data-lp-step'), output.indexOf('data-lp-summary'));
    const toggles = [...step.matchAll(/<span class="lp-which-is-better-chunk" role="button" tabindex="0" aria-pressed="false" data-lp-pick="([^"]+)">([^<]*)<\/span>/g)];
    assert.deepEqual(toggles.map(match => match[1]), ['a1', 'a2', 'b1', 'b2']);
    assert.equal(toggles[3][2], html(content.versions.b.body[0][1], lang));
    const b = content.versions.b, subject = lang === 'fr' ? 'Objet\u00a0:' : 'Subject:';
    assert.ok(step.includes(`<div class="lp-which-is-better-email" role="group" aria-labelledby="pair-b"><h3 class="lp-run-in" id="pair-b">Version B</h3><p class="lp-which-is-better-subject"><span class="lp-which-is-better-field">${subject}</span> ${html(b.subject, lang)}</p><div class="lp-quote lp-which-is-better-body"><p>${html(b.greeting, lang)}</p><p><span class="lp-which-is-better-chunk"`));
    assert.equal((step.match(/<p><span class="lp-which-is-better-chunk"/g) ?? []).length, 2);
    assert.equal((step.match(/<\/span> <span class="lp-which-is-better-chunk"/g) ?? []).length, 2);
    assert.ok(step.includes(`</span></p><p>${html(b.signoff, lang)}</p></div></div>`));
    assert.match(step, new RegExp(`<button class="lp-choice lp-which-is-better-neither" type="button" aria-pressed="false" data-lp-pick="neither"><span class="lp-choice-key" aria-hidden="true"><svg[^]*?</svg><svg[^]*?</svg></span><span>${strings[lang].neither}</span></button>`));
    assert.equal((step.match(/lp-choice-key/g) ?? []).length, 1);
    assert.match(step, /<p class="lp-run-in lp-which-is-better-hint" id="pair-hint">[^<]+<\/p>\s*<div class="lp-which-is-better-choices" role="group" data-lp-choices aria-labelledby="pair-question" aria-describedby="pair-hint">\s*<div class="lp-which-is-better-pair">/);
    assert.match(step, /<\/div>\s*<p class="lp-error-text" id="pair-error" data-lp-error hidden>.*?<\/p>\s*<div class="lp-actions"><button class="lp-button" type="button" data-lp-check>/s);
  });

  test(`the instruction names both ways to answer: a sentence or Neither (${lang})`, () => {
    assert.ok(strings[lang].chooseOne.startsWith(lang === 'fr' ? 'Surlignez une phrase' : 'Highlight one sentence'));
    assert.ok(strings[lang].chooseOne.includes(strings[lang].neither));
  });
}

test('authored text is escaped, and French typography applies', () => {
  const content = edited(c => { c.title = '<b>Pair</b>'; c.versions.a.body[0][0] = 'A <script> & "quote"'; c.versions.a.subject = '<u>s</u>'; c.qualities[0].note = '<i>n</i>'; });
  const output = render(content, strings.en, { id: 'x"y', lang: 'en' });
  assert.doesNotMatch(output, /<script>|<b>|<i>|<u>/);
  assert.ok(output.includes('&lt;b&gt;Pair&lt;/b&gt;'));
  assert.ok(output.includes('id="x&quot;y-question"'));
  const french = render(fr, strings.fr, { id: 'f', lang: 'fr' });
  assert.ok(french.includes('Quelle phrase précise ce qui compte comme une commande urgente\u202f?'));
  assert.ok(french.includes('Bonne réponse\u00a0: Aucune des deux versions ne le fait.'));
  assert.ok(french.includes('Bonne réponse, dans la version B\u00a0: Pour une commande urgente'));
  assert.ok(french.includes('<span class="lp-which-is-better-field">Objet\u00a0:</span>'));
  assert.throws(() => render({ ...content, qualities: [] }, strings.en, { id: 'x', lang: 'en' }), /qualities/);
});

test('a sign-off keeps its line break', () => {
  assert.ok(render(en, strings.en, { id: 's', lang: 'en' }).includes('<p>Thanks,\nSam Rivera</p>'));
});

test('the summary shows the better email with each answer sentence marked and its note after it in reading order', () => {
  const output = render(en, strings.en, { id: 's', lang: 'en' });
  const end = output.slice(output.indexOf('data-lp-summary'));
  assert.match(end, /<h3 class="lp-stem">What makes Version B better<\/h3>/);
  assert.match(end, /^data-lp-summary hidden>\s*<p tabindex="-1" data-lp-result><\/p>\s*<h3 class="lp-stem">/);
  assert.equal((end.match(/<mark>/g) ?? []).length, 2);
  assert.match(end, /<div class="lp-which-is-better-email"><p class="lp-visually-hidden">Version B<\/p><p class="lp-which-is-better-subject">/);
  const [[first, second]] = en.versions.b.body;
  const noted = (text, note) => `<mark>${html(text)}</mark><span class="lp-which-is-better-note"><span class="lp-visually-hidden">This sentence shows: </span>${html(note)}</span>`;
  assert.ok(end.includes(`<p>${noted(first, en.qualities[2].note)} ${noted(second, en.qualities[0].note)}</p>`));
  const plain = render(edited(c => { c.versions.b.body[0].push('Three.'); }), strings.en, { id: 's', lang: 'en' });
  assert.ok(plain.includes(`${noted(second, en.qualities[0].note)} Three.</p>`));
  assert.ok(end.includes('<p class="lp-label">Missing from both versions</p>\n      <ul class="lp-which-is-better-missing" role="list"><li>What counts as urgent</li></ul>'));
  assert.doesNotMatch(render(edited(c => { c.versions.b.body[0].push('Three.'); c.qualities[1].sentence = 3; }), strings.en, { id: 's', lang: 'en' }), /Missing from both/);
  const better = render({ ...en, better: 'a', qualities: en.qualities.map(q => ({ ...q, sentence: q.sentence && 3 - q.sentence })) }, strings.en, { id: 's', lang: 'en' });
  assert.match(better, /What makes Version A better/);
  assert.ok(better.slice(better.indexOf('data-lp-summary')).includes(`<mark>${html(en.versions.a.body[0][1])}</mark>`));
});

test('the pattern stylesheet keeps its prefix, the highlighter and forced-colour cues', async () => {
  const css = await readFile(new URL('./pattern.css', import.meta.url), 'utf8');
  assert.match(css, /--lp-which-is-better-mark: #ffe49a/);
  assert.match(css, /\.lp-which-is-better-chunk\[aria-pressed="true"\],\s*\.lp-which-is-better-body mark \{[^}]*background: var\(--lp-which-is-better-mark\)/);
  assert.match(css, /\.lp-which-is-better-chunk\[data-lp-mark="correct"\] \{ text-decoration: underline solid var\(--lp-success-ink\)/);
  assert.match(css, /\.lp-which-is-better-chunk\[data-lp-mark="missed"\] \{ text-decoration: underline dashed/);
  assert.doesNotMatch(css, /data-lp-mark="missed"\][^{]*\{[^}]*background/);
  assert.doesNotMatch(css, /\.lp-which-is-better-chunk\[data-lp-mark="wrong"\]/);
  assert.match(css, /\.lp-which-is-better-body \.lp-choice-mark,\s*\.lp-which-is-better-note \{ display: block;[^}]*margin: 2px 0 var\(--lp-gap-stem\) 12px;[^}]*background: none;/);
  assert.match(css, /\.lp-which-is-better-body \.lp-choice-mark \{ display: flex;/);
  assert.match(css, /\.lp-which-is-better-pair > \.lp-which-is-better-email \{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.doesNotMatch(css, /\.lp-which-is-better-(chunk|body mark)[^{]*\{[^}]*padding: \d+px \d+px/);
  assert.doesNotMatch(css, /2060/);
  assert.match(css, /\.lp-which-is-better-hint \{[^}]*font-weight: 400;/);
  assert.match(css, /\.lp-which-is-better-hint \+ \.lp-which-is-better-choices \{ margin-block-start: var\(--lp-gap-group\); \}/);
  assert.match(css, /\.lp-which-is-better-neither:is\(\[aria-pressed="true"\]:not\(\[data-lp-mark\]\), \[data-lp-mark="correct"\]\) > \.lp-choice-key > \.lp-icon:first-child,\s*\.lp-which-is-better-neither\[data-lp-mark="wrong"\] > \.lp-choice-key > \.lp-icon:last-child \{ display: block; \}/);
  assert.match(css, /\.lp-which-is-better-neither > span:not\(\.lp-choice-key, \.lp-choice-mark\) \{ text-wrap: balance; \}/);
  assert.doesNotMatch(css, /\.lp-which-is-better-body mark \{[^}]*display: block/);
  assert.doesNotMatch(css, /\.lp-which-is-better-(email|body) \{[^}]*(border:|box-shadow)/);
  assert.match(css, /@container \(max-width: 40rem\)/);
  assert.match(css, /forced-colors: active[^]*\.lp-which-is-better-chunk\[aria-pressed="true"\],\s*\.lp-which-is-better-body mark \{ forced-color-adjust: none; color: MarkText; background: Mark/);
  assert.match(css, /forced-colors: active[^]*\[aria-pressed="true"\]:not\(\[data-lp-mark\]\) \{ border: 2px solid Highlight/);
  for (const [, name] of css.matchAll(/\.(lp-[a-z-]+)/g)) assert.ok(name.startsWith('lp-which-is-better') || ['lp-choice', 'lp-choices', 'lp-choice-key', 'lp-choice-mark', 'lp-error-text', 'lp-icon'].includes(name), name);
});
