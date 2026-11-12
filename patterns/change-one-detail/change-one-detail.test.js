import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { format, rounds, score, validateContent, validateState } from './logic.js';
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
  assert.deepEqual(fr.options.map(o => o.id), en.options.map(o => o.id));
  assert.deepEqual([fr.correct, ...fr.changes.map(c => c.correct)], [en.correct, ...en.changes.map(c => c.correct)]);
});

test('the schema and the validator agree on required fields and caps', () => {
  assert.deepEqual(schema.required, ['title', 'case', 'question', 'options', 'correct', 'explanation', 'changes', 'rule']);
  for (const field of schema.required) assert.throws(() => validateContent(edited(c => { delete c[field]; })), new RegExp(field));
  assert.doesNotThrow(() => validateContent(edited(c => { delete c.context; })));
  assert.deepEqual([schema.properties.options.minItems, schema.properties.options.maxItems], [2, 4]);
  assert.deepEqual([schema.properties.changes.minItems, schema.properties.changes.maxItems], [1, 3]);
});

test('content needs two to four options with unique ids and a known correct answer', () => {
  assert.throws(() => validateContent(edited(c => { c.options = c.options.slice(0, 1); })), /options/);
  assert.throws(() => validateContent(edited(c => { c.options = [...c.options, { id: 'd', text: 'D' }, { id: 'e', text: 'E' }]; })), /options/);
  assert.doesNotThrow(() => validateContent(edited(c => { c.options = [...c.options, { id: 'd', text: 'D' }]; })));
  assert.throws(() => validateContent(edited(c => { c.options[1].id = 'billing'; })), /options\[1\]\.id/);
  assert.throws(() => validateContent(edited(c => { c.options[0].id = 'has space'; })), /options\[0\]\.id/);
  assert.throws(() => validateContent(edited(c => { c.correct = 'nobody'; })), /correct/);
  assert.throws(() => validateContent(edited(c => { c.changes[0].correct = 'nobody'; })), /changes\[0\]\.correct/);
});

test('content rejects unknown fields, blank text and wrong shapes', () => {
  assert.throws(() => validateContent(null), /content/);
  assert.throws(() => validateContent(edited(c => { c.extra = 1; })), /content\.extra/);
  assert.throws(() => validateContent(edited(c => { c.options[0].note = 'x'; })), /options\[0\]\.note/);
  assert.throws(() => validateContent(edited(c => { c.changes[0].note = 'x'; })), /changes\[0\]\.note/);
  for (const field of ['title', 'context', 'case', 'question', 'explanation', 'rule']) {
    for (const value of ['', ' ', 1, null]) assert.throws(() => validateContent(edited(c => { c[field] = value; })), new RegExp(field));
  }
  assert.throws(() => validateContent(edited(c => { c.changes[1].explanation = ' '; })), /changes\[1\]\.explanation/);
});

test('a case takes one to three changes', () => {
  assert.throws(() => validateContent(edited(c => { c.changes = []; })), /changes/);
  const third = { from: 'card ending 4411', to: 'card ending 9920', correct: 'billing', explanation: 'Still the customer\'s own bill.' };
  assert.doesNotThrow(() => validateContent(edited(c => { c.changes.push(third); })));
  assert.throws(() => validateContent(edited(c => { c.changes.push(third, third); })), /changes/);
});

test('each change names wording that appears exactly once in the case and replaces it', () => {
  assert.throws(() => validateContent(edited(c => { c.changes[0].from = 'That is my address.'; })), /changes\[0\]\.from/);
  // "a" appears many times, so the place would be a guess.
  assert.throws(() => validateContent(edited(c => { c.changes[0].from = 'a'; })), /changes\[0\]\.from/);
  assert.throws(() => validateContent(edited(c => { c.changes[0].to = c.changes[0].from; })), /changes\[0\]\.to/);
});

// The shared limit test cannot lengthen from alone, since it must still appear in the case.
test('the wording to replace is capped at 120 characters when the case holds it', () => {
  const long = length => edited(c => {
    const from = 'x'.repeat(length);
    c.case = c.case.replace(c.changes[0].from, from);
    c.changes[0].from = from;
  });
  assert.equal(schema.properties.changes.items.properties.from.maxLength, 120);
  assert.doesNotThrow(() => validateContent(long(120)));
  assert.throws(() => validateContent(long(121)), /changes\[0\]\.from: maximum 120 characters/);
});

test('at least one change must move the correct answer', () => {
  assert.throws(() => validateContent(edited(c => { c.changes[0].correct = 'billing'; })), /at least one/);
  assert.doesNotThrow(() => validateContent(edited(c => { c.changes[1].correct = 'ask'; })));
});

test('rounds start with the case, then apply each change to the first case alone', () => {
  const all = rounds(en);
  assert.equal(all.length, 3);
  assert.deepEqual(all[0], { parts: [{ kind: 'same', text: en.case }], correct: 'billing', explanation: en.explanation, moves: null });
  assert.deepEqual(all[1].parts, [
    { kind: 'same', text: 'My invoice page shows a bill for Dana Okafor, card ending 4411. ' },
    { kind: 'before', text: 'That is my name.' },
    { kind: 'now', text: 'That is not my name.' },
    { kind: 'same', text: ' There is a $40 charge I don\'t recognize.' }
  ]);
  assert.equal(all[1].moves, true);
  // The second change leaves the first one out: the name is the customer's own again.
  assert.equal(all[2].parts.map(part => part.kind === 'before' ? '' : part.text).join(''), 'My invoice page shows a bill for Dana Okafor, card ending 4411. That is my name. There is a $400 charge I don\'t recognize.');
  assert.equal(all[2].moves, false);
  assert.equal(all[2].correct, 'billing');
});

test('a change at the start or end of the case leaves no empty part', () => {
  const content = edited(c => { c.case = 'Late. Paid.'; c.changes = [{ from: 'Late.', to: 'On time.', correct: 'security', explanation: 'x' }, { from: 'Paid.', to: 'Unpaid.', correct: 'billing', explanation: 'x' }]; });
  assert.deepEqual(rounds(content)[1].parts.map(part => part.kind), ['before', 'now', 'same']);
  assert.deepEqual(rounds(content)[2].parts.map(part => part.kind), ['same', 'before', 'now']);
});

test('score counts checked decisions against each round and knows when the case is done', () => {
  assert.deepEqual(score(en, []), { results: [], right: 0, total: 3, done: false });
  assert.deepEqual(score(en, ['billing', 'billing']), { results: [true, false], right: 1, total: 3, done: false });
  assert.deepEqual(score(en, ['billing', 'security', 'billing']), { results: [true, true, true], right: 3, total: 3, done: true });
  assert.deepEqual(score(en, ['ask', 'ask', 'security']), { results: [false, false, false], right: 0, total: 3, done: true });
  assert.throws(() => score(en, ['billing', 'nobody']), /picks\[1\]/);
  assert.throws(() => score(en, ['billing', 'billing', 'billing', 'billing']), /picks/);
  assert.throws(() => score(en, { 0: 'billing' }), /picks/);
});

test('saved state is copied when valid and ignored otherwise', () => {
  const saved = { picks: ['billing', 'security'] };
  const copy = validateState(en, saved);
  assert.deepEqual(copy, saved);
  assert.notEqual(copy.picks, saved.picks);
  assert.deepEqual(validateState(en, { picks: [] }), { picks: [] });
  for (const value of [undefined, null, 'x', [], {}, { picks: 'billing' }, { picks: ['nobody'] }, { picks: [1] }, { picks: ['billing', 'billing', 'billing', 'billing'] }, { picks: [], shown: true }]) {
    assert.equal(validateState(en, value), null, JSON.stringify(value));
  }
});

test('format replaces placeholders once and leaves inserted text literal', () => {
  assert.equal(format('{a} of {b}', { a: '{b}', b: 2 }), '{b} of 2');
  assert.equal(format('{missing}', {}), '{missing}');
});

for (const [lang, content] of [['en', en], ['fr', fr]]) {
  // What the renderer does to plain text: French no-break spaces and escaped apostrophes.
  const text = value => (lang === 'fr' ? value.replace(/ (?=[:$])/g, '\u00a0') : value).replaceAll("'", '&#39;');
  test(`server HTML shows the first case and keeps later rounds hidden until enhanced (${lang})`, () => {
    const output = render(content, strings[lang], { id: 'route', lang });
    assert.match(output, new RegExp(`^<section class="lp lp-change-one-detail" data-lp-pattern="change-one-detail" lang="${lang}">`));
    assert.equal((output.match(/role="status"/g) ?? []).length, 1);
    assert.match(output, /<p class="lp-visually-hidden" role="status" aria-atomic="true"><\/p>/);
    assert.equal((output.match(/<div class="lp-stack" data-lp-round>/g) ?? []).length, 1);
    assert.equal((output.match(/<div class="lp-section" data-lp-round hidden>/g) ?? []).length, 2);
    // Title first, then the context, then the case, then the question as the legend.
    const order = ['<h2 class="lp-heading">', '<p class="lp-context">', '<p class="lp-quote lp-change-one-detail-case">', '<legend class="lp-stem">'].map(marker => output.indexOf(marker));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
    assert.ok(order.every(at => at >= 0));
    // Three rounds of three options; ids carry the instance prefix and never repeat.
    const ids = [...output.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
    assert.equal(ids.length, 3 * (1 + 3 + 1));
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every(id => id.startsWith('route-')));
    assert.equal((output.match(/<input type="radio"/g) ?? []).length, 9);
    assert.equal((output.match(/data-lp-check hidden/g) ?? []).length, 3);
    // Start over sits inside the hidden summary, so it comes into view with it.
    assert.match(output, /data-lp-result hidden>(?:(?!data-lp-result)[^])*data-lp-restart>/);
    assert.doesNotMatch(output, /data-lp-restart[^>]*hidden/);
    assert.equal((output.match(/data-lp-feedback hidden/g) ?? []).length, 3);
  });

  test(`a changed case strikes the old wording and highlights the new, with words for screen readers (${lang})`, () => {
    const output = render(content, strings[lang], { id: 'route', lang });
    const [first, second] = content.changes;
    const before = lang === 'fr' ? 'Avant\u00a0:' : 'Before:', now = lang === 'fr' ? 'Maintenant\u00a0:' : 'Now:';
    for (const change of [first, second]) {
      const marked = `<del><span class="lp-visually-hidden">${before} </span>${text(change.from)}</del> <ins><span class="lp-visually-hidden">${now} </span>${text(change.to)}</ins>`;
      // Once in its hidden round and once in the no-JavaScript list.
      assert.equal(output.split(marked).length, 3, marked);
    }
    // The first case itself carries no change marks.
    const firstCase = output.slice(output.indexOf('<p class="lp-quote'), output.indexOf('</p>', output.indexOf('<p class="lp-quote')));
    assert.doesNotMatch(firstCase, /<del|<ins/);
    assert.equal((output.match(new RegExp(strings[lang].changeFirst, 'g')) ?? []).length, 2);
    assert.equal((output.match(new RegExp(strings[lang].changeNext, 'g')) ?? []).length, 2);
  });

  test(`without JavaScript each answer waits behind its own disclosure, in step order (${lang})`, () => {
    const output = render(content, strings[lang], { id: 'route', lang });
    const fallback = output.slice(output.indexOf('data-lp-fallback'), output.indexOf('data-lp-result'));
    assert.equal((fallback.match(/<details class="lp-details/g) ?? []).length, 4);
    assert.doesNotMatch(fallback, /<details[^>]*open/);
    const option = id => content.options.find(o => o.id === id).text;
    const answer = id => text(strings[lang].correct.replace('{option}', option(id)));
    const steps = [
      `<p>${answer(content.correct)}</p><p>${text(content.explanation)}</p>`,
      `<p><strong>${text(strings[lang].moves)}</strong> ${answer(content.changes[0].correct)}</p>`,
      `<p><strong>${text(strings[lang].stays)}</strong> ${answer(content.changes[1].correct)}</p>`,
      `<summary>${strings[lang].ruleLabel}</summary><p>${text(content.rule)}</p>`
    ].map(step => fallback.indexOf(step));
    assert.ok(steps.every(at => at >= 0), JSON.stringify(steps));
    assert.deepEqual(steps, [...steps].sort((a, b) => a - b));
  });
}

test('feedback says whether the answer moved, and the first case makes no such claim', () => {
  const output = render(en, strings.en, { id: 'route', lang: 'en' });
  const feedback = [...output.matchAll(/<p class="lp-change-one-detail-feedback" tabindex="-1" data-lp-feedback hidden><span class="lp-visually-hidden" data-lp-verdict><\/span>(.*?)<\/p>/g)].map(match => match[1]);
  assert.deepEqual(feedback, [
    'The bill is the customer&#39;s own, so this is a question about a charge, and billing reviews charges. The message already names the bill and the charge, so you don&#39;t need more detail.',
    '<strong>This detail changes the answer.</strong> The customer saw another person&#39;s name and card digits. Those are personal details shown to the wrong person, so the message goes to security.',
    '<strong>This detail doesn&#39;t change the answer.</strong> A larger amount is still a charge on the customer&#39;s own bill, so the message goes to billing.'
  ]);
});

test('the reminder that the rest matches the start shows from the second change on', () => {
  for (const lang of ['en', 'fr']) {
    const content = lang === 'en' ? en : fr;
    const output = render(content, strings[lang], { id: 'route', lang });
    const same = `<p class="lp-small">${strings[lang].same}</p>`;
    // The second change appears once in its round and once in the no-JavaScript list; the first change never carries it.
    assert.equal(output.split(same).length - 1, 2);
    const firstChange = output.slice(output.indexOf(strings[lang].changeFirst), output.indexOf(strings[lang].changeNext));
    assert.ok(!firstChange.includes(same));
  }
});

test('authored text is escaped, and the context is optional', () => {
  const content = edited(c => {
    delete c.context;
    c.title = '<b>Route</b>';
    c.case = 'A <script> tag & "quotes". That is my name.';
    c.changes = [{ from: 'That is my name.', to: '<i>not</i> mine', correct: 'security', explanation: 'x < y' }];
    c.options[0].text = '<em>Billing</em>';
    c.rule = 'a & b';
  });
  const output = render(content, strings.en, { id: 'x"y', lang: 'en' });
  assert.doesNotMatch(output, /<script>|<b>|<i>|<em>|lp-context/);
  assert.ok(output.includes('&lt;b&gt;Route&lt;/b&gt;'));
  assert.ok(output.includes('<ins><span class="lp-visually-hidden">Now: </span>&lt;i&gt;not&lt;/i&gt; mine</ins>'));
  assert.ok(output.includes('id="x&quot;y-round-0"'));
  assert.equal((output.match(/data-lp-round/g) ?? []).length, 2);
  assert.throws(() => render({ ...content, changes: [] }, strings.en, { id: 'x', lang: 'en' }), /changes/);
});

test('the pattern stylesheet shows the change without colour alone', async () => {
  const css = await readFile(new URL('./pattern.css', import.meta.url), 'utf8');
  assert.match(css, /\.lp-change-one-detail-case del \{[^}]*text-decoration: line-through/);
  assert.match(css, /\.lp-change-one-detail-case ins \{[^}]*font-weight: 600/);
  assert.match(css, /forced-colors: active[^]*\.lp-change-one-detail-case ins \{[^}]*text-decoration: underline/);
  // Class names stay inside the pattern's prefix.
  for (const [, name] of css.matchAll(/\.(lp-[a-z-]+)/g)) assert.ok(name.startsWith('lp-change-one-detail') || ['lp-button-quiet'].includes(name), name);
});
