import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MAX_LENGTH, format, result, validateContent, validateFeedback, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const en = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const fr = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const copy = () => structuredClone(en);

test('examples validate, share issue ids and string keys', () => {
  for (const content of [en, fr]) assert.doesNotThrow(() => validateContent(content));
  assert.deepEqual(Object.keys(strings.en), Object.keys(strings.fr));
  assert.deepEqual(en.issues.map(issue => issue.id), fr.issues.map(issue => issue.id));
  assert.equal(en.messages.length, fr.messages.length);
});

test('content guards name the bad field', () => {
  /** @type {[(content: any) => void, RegExp][]} */
  const planted = [
    [c => { c.extra = 1; }, /extra/],
    [c => { c.title = ''; }, /title/],
    [c => { delete c.context; }, /context/],
    [c => { c.colleague = 3; }, /colleague/],
    [c => { c.messages = []; }, /messages/],
    [c => { c.messages = [...c.messages, ...c.messages]; }, /messages/],
    [c => { c.messages[0] = 'Hi'; }, /messages\[0\]/],
    [c => { c.messages[1].from = 'Priya'; }, /messages\[1\]\.from/],
    [c => { delete c.messages[1].body; }, /messages\[1\]\.body/],
    [c => { c.messages[0].subject = ''; }, /messages\[0\]\.subject/],
    [c => { c.messages[0].heading = null; }, /messages\[0\]\.heading/],
    [c => { c.issues = c.issues.slice(0, 1); }, /issues/],
    [c => { c.issues = [...c.issues, ...['d', 'e', 'f'].map(id => ({ id, label: id, explanation: id }))]; }, /issues/],
    [c => { c.issues[1].id = 'no_reason'; }, /issues\[1\]\.id/],
    [c => { c.issues[0].id = 'a b'; }, /issues\[0\]\.id/],
    [c => { c.issues[2].label = ''; }, /issues\[2\]\.label/],
    [c => { delete c.issues[0].explanation; }, /issues\[0\]\.explanation/],
    [c => { c.issues[0].hint = 'Look again'; }, /issues\[0\]\.hint/]
  ];
  for (const [plant, message] of planted) {
    const content = copy(); plant(content);
    assert.throws(() => validateContent(content), message);
  }
  assert.throws(() => validateContent(null), /content/);
  const plain = copy(); delete plain.messages[0].subject; plain.messages.shift();
  assert.doesNotThrow(() => validateContent(plain));
});

test('feedback must be written and stay within the limit', () => {
  assert.equal(MAX_LENGTH, 2000);
  assert.deepEqual(validateFeedback('  Say why.  '), { ok: true, text: 'Say why.' });
  assert.deepEqual(validateFeedback(' \n '), { ok: false, error: 'empty' });
  assert.deepEqual(validateFeedback(undefined), { ok: false, error: 'empty' });
  assert.deepEqual(validateFeedback('x'.repeat(2000)), { ok: true, text: 'x'.repeat(2000) });
  assert.deepEqual(validateFeedback('x'.repeat(2001)), { ok: false, error: 'tooLong' });
});

test('the result counts raised issues and keeps every issue in author order', () => {
  const two = result(en, ['vague_next_step', 'no_reason']);
  assert.equal(two.count, 2);
  assert.equal(two.total, 3);
  assert.equal(two.key, 'some');
  assert.deepEqual(two.items.map(item => [item.id, item.raised]), [['no_reason', true], ['no_alternative', false], ['vague_next_step', true]]);
  assert.equal(two.items[1].explanation, en.issues[1].explanation);
  assert.equal(two.items[1].label, en.issues[1].label);
  assert.equal(result(en, []).key, 'none');
  assert.equal(result(en, ['no_reason']).key, 'some');
  assert.equal(result(en, en.issues.map(issue => issue.id)).key, 'all');
  assert.throws(() => result(en, ['tone']), /Unknown issue: tone/);
  assert.throws(() => result(en, ['no_reason', 'no_reason']), /Duplicate issue: no_reason/);
});

test('the result sentence for none, one, two and all three', () => {
  const sentence = (lang, ticked) => {
    const outcome = result(en, ticked);
    const key = /** @type {'resultAll' | 'resultSome' | 'resultNone'} */ ({ all: 'resultAll', some: 'resultSome', none: 'resultNone' }[outcome.key]);
    return format(strings[lang][key], { count: outcome.count, total: outcome.total });
  };
  assert.equal(sentence('en', []), 'Your feedback raised none of the 3 issues.');
  assert.equal(sentence('en', ['no_alternative']), 'Your feedback raised 1 of 3 issues.');
  assert.equal(sentence('en', ['no_alternative', 'no_reason']), 'Your feedback raised 2 of 3 issues.');
  assert.equal(sentence('en', ['no_reason', 'no_alternative', 'vague_next_step']), 'Your feedback raised all 3 issues.');
  assert.equal(sentence('fr', ['no_reason']), 'Votre rétroaction relève 1 des 3 points à corriger.');
  // Inserted text stays literal, even when it looks like a placeholder.
  assert.equal(format('{colleague} and {other}', { colleague: '{other}' }), '{other} and {other}');
});

test('saved state is copied when valid and rejected when damaged', () => {
  const saved = { feedback: 'Say why.', ticked: ['no_reason'], stage: 'compare' };
  const restored = validateState(en, saved);
  assert.deepEqual(restored, saved);
  assert.notEqual(restored, saved);
  assert.notEqual(restored?.ticked, saved.ticked);
  // A draft longer than the limit is kept, so restoring never loses text; checking reports it.
  assert.deepEqual(validateState(en, { feedback: 'x'.repeat(2001), ticked: [], stage: 'write' })?.feedback.length, 2001);
  assert.deepEqual(validateState(en, { feedback: 'x'.repeat(2001), ticked: ['no_reason'], stage: 'compare' })?.feedback.length, 2001);
  // A finished state needs feedback a live check would have accepted.
  assert.deepEqual(validateState(en, { feedback: 'x'.repeat(2000), ticked: [], stage: 'done' })?.stage, 'done');
  assert.equal(validateState(en, { feedback: '   ', ticked: ['no_reason'], stage: 'done' }), null);
  assert.equal(validateState(en, { feedback: 'x'.repeat(2001), ticked: [], stage: 'done' }), null);
  for (const damaged of [
    null, 'text', [], {},
    { feedback: 1, ticked: [], stage: 'write' },
    { feedback: '', ticked: 'no_reason', stage: 'compare' },
    { feedback: '', ticked: ['tone'], stage: 'compare' },
    { feedback: '', ticked: ['no_reason', 'no_reason'], stage: 'done' },
    { feedback: '', ticked: [], stage: 'finished' },
    // Ticks exist only once the checklist has been shown.
    { feedback: 'Say why.', ticked: ['no_reason'], stage: 'write' },
    { feedback: '', ticked: [], stage: 'write', extra: true }
  ]) assert.equal(validateState(en, damaged), null, JSON.stringify(damaged));
});

test('server markup works without JavaScript and keeps the reading order', () => {
  const html = render(en, strings.en, { id: 'mc', lang: 'en' });
  assert.match(html, /^<section class="lp lp-mark-colleague" data-lp-pattern="mark-colleague" lang="en">/);
  assert.ok(html.includes('<h2 class="lp-heading">Give Priya feedback on her reply</h2>'));
  // Each email's heading sits one level below the card title and carries the mail icon.
  assert.equal((html.match(/<h3 class="lp-mark-colleague-from">/g) ?? []).length, 2);
  assert.match(html, /<h3 class="lp-mark-colleague-from"><svg[^>]*aria-hidden="true"/);
  assert.ok(html.includes('Priya&#39;s draft reply'));
  assert.ok(html.includes('Subject: Re: Refund request'));
  assert.ok(html.includes('<p>Thanks, Alex</p>'));
  assert.ok(html.includes('<label class="lp-stem" for="mc-feedback">What would you tell Priya to change, and why?</label>'));
  assert.doesNotMatch(html, /lp-quote|maxlength|placeholder/);
  const order = ['lp-context', 'Email from Alex', 'draft reply', 'mc-feedback', 'data-lp-fallback', 'data-lp-ticks', 'data-lp-result', 'role="status"'].map(text => html.indexOf(text));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(order.every(index => index > 0));
  // The fallback lists every issue with its explanation in a closed disclosure.
  const fallback = html.slice(html.indexOf('data-lp-fallback'), html.indexOf('data-lp-flow'));
  assert.match(fallback, /<summary>Show the issues<\/summary>/);
  assert.doesNotMatch(fallback, /<details[^>]*open/);
  for (const issue of en.issues) assert.ok(fallback.includes(issue.explanation.replaceAll('"', '&quot;').replaceAll("'", '&#39;')));
  // Script-only controls start hidden.
  assert.match(html, /<button class="lp-button" type="button" data-lp-check hidden>Check my feedback<\/button>/);
  assert.match(html, /<div data-lp-flow hidden>/);
  assert.match(html, /<p class="lp-visually-hidden" role="status" aria-atomic="true"><\/p>/);
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.ok(ids.every(id => id.startsWith('mc-')));
  assert.equal(new Set(ids).size, ids.length);
});

test('authored text with markup characters renders literally', () => {
  const content = copy();
  content.title = 'Review <b>this</b> & that';
  content.colleague = 'Sam <i>';
  content.messages[1].heading = 'Draft <script>x</script>';
  content.messages[1].subject = 'Q&A';
  content.messages[1].body = 'Use <em>this</em> & "that"\nBest, Sam';
  content.issues[0].label = 'The <b>reason</b>';
  content.issues[0].explanation = 'Say why & how <br>';
  const html = render(content, strings.en, { id: 'mc', lang: 'en' });
  for (const literal of ['Review &lt;b&gt;this&lt;/b&gt; &amp; that', 'tell Sam &lt;i&gt; to change', 'Draft &lt;script&gt;x&lt;/script&gt;', 'Subject: Q&amp;A',
    '<p>Use &lt;em&gt;this&lt;/em&gt; &amp; &quot;that&quot;</p>', 'The &lt;b&gt;reason&lt;/b&gt;', 'Say why &amp; how &lt;br&gt;']) assert.ok(html.includes(literal), literal);
  assert.doesNotMatch(html, /<(b|i|em|script|br)>/);
});

test('French markup uses French strings and typography', () => {
  const html = render(fr, strings.fr, { id: 'mc', lang: 'fr' });
  assert.ok(html.includes('lang="fr"'));
  assert.ok(html.includes('Que demanderiez-vous à Priya de modifier, et pourquoi ?'));
  assert.ok(html.includes('Objet : RE : Demande de remboursement'));
  assert.ok(html.includes('« veuillez communiquer avec notre équipe »'));
});
