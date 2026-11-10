import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { REMINDER_MINUTES, calendarFile, choose, emptyState, format, sentence, startError, validateContent, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const en = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const fr = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const copy = () => structuredClone(en);

test('examples validate, share ids and vague options, and interface keys match', () => {
  for (const content of [en, fr]) assert.doesNotThrow(() => validateContent(content));
  assert.deepEqual(Object.keys(strings.en), Object.keys(strings.fr));
  for (const step of ['when', 'will']) {
    const shape = content => content[step].options.map(option => [option.id, 'vague' in option]);
    assert.deepEqual(shape(en), shape(fr));
    // The sample shows the recommended mix: three concrete options and one vague one.
    assert.equal(en[step].options.filter(option => !('vague' in option)).length, 3);
  }
});

test('content guards name the bad field', () => {
  /** @type {[(content: any) => void, RegExp][]} */
  const planted = [
    [c => { c.extra = 1; }, /extra/],
    [c => { c.title = ' '; }, /title/],
    [c => { delete c.context; }, /context/],
    [c => { c.dateLabel = 5; }, /dateLabel/],
    [c => { c.when = []; }, /when/],
    [c => { c.when.hint = 'x'; }, /when/],
    [c => { c.will.options = c.will.options.slice(0, 2); }, /will\.options/],
    [c => { c.will.options = [...c.will.options, { id: 'e', text: 'e' }, { id: 'f', text: 'f' }]; }, /will\.options/],
    [c => { c.when.options[1].id = 'problem'; }, /when\.options\[1\]\.id/],
    [c => { c.when.options[0].id = 'a b'; }, /when\.options\[0\]\.id/],
    [c => { c.when.options[0].text = ''; }, /when\.options\[0\]\.text/],
    [c => { c.when.options[2].vague = ' '; }, /when\.options\[2\]\.vague/],
    [c => { c.when.options[0].correct = true; }, /when\.options\[0\]\.correct/],
    // One concrete option leaves no choice, so the plan would not be the learner's.
    [c => { c.will.options[0].vague = 'Why'; c.will.options[2].vague = 'Why'; }, /will\.options: at least two/]
  ];
  for (const [plant, message] of planted) {
    const content = copy(); plant(content);
    assert.throws(() => validateContent(content), message);
  }
  assert.throws(() => validateContent(null), /content/);
  const five = copy(); five.when.options.push({ id: 'fifth', text: 'the meeting starts' });
  assert.doesNotThrow(() => validateContent(five));
  const none = copy(); delete none.when.options[2].vague;
  assert.doesNotThrow(() => validateContent(none));
});

test('a concrete option joins the plan and a vague one returns its reason', () => {
  assert.deepEqual(choose(en, 'when', 'problem'), { ok: true, text: 'Sam starts to describe a problem' });
  assert.deepEqual(choose(en, 'when', 'spare'), { ok: false, reason: 'A spare moment may never come. Choose something Sam says or does, so you know when to act.' });
  assert.deepEqual(choose(en, 'will', 'patient'), { ok: false, reason: 'Nobody can see or hear you "be more patient". Choose one thing you would say or do.' });
  assert.throws(() => choose(en, 'will', 'problem'), /Unknown will option/);
});

test('the sentence grows from the stem to the whole plan in both languages', () => {
  assert.equal(sentence(en, strings.en, { when: null, will: null }), 'When…');
  assert.equal(sentence(en, strings.en, { when: 'problem', will: null }), 'When Sam starts to describe a problem, I will…');
  assert.equal(sentence(en, strings.en, { when: 'problem', will: 'open' }), 'When Sam starts to describe a problem, I will ask one open question before I suggest anything.');
  assert.equal(sentence(fr, strings.fr, { when: 'quiet', will: null }), 'Quand Sam se tait, je vais…');
  assert.equal(sentence(fr, strings.fr, { when: 'quiet', will: 'repeat' }), 'Quand Sam se tait, je vais reformuler ce que j’ai entendu avant de répondre.');
  assert.throws(() => sentence(en, strings.en, { when: 'spare', will: null }), /Invalid when/);
  assert.throws(() => sentence(en, strings.en, { when: 'problem', will: 'patient' }), /Invalid will/);
  // Every concrete pairing in the sample is meant to read as a sentence; none may leave a placeholder.
  for (const content of [en, fr]) for (const when of content.when.options) for (const will of content.will.options) {
    if (when.vague || will.vague) continue;
    assert.doesNotMatch(sentence(content, content === en ? strings.en : strings.fr, { when: when.id, will: will.id }), /[{}]/);
  }
});

test('saved state is copied when valid and rejected when damaged', () => {
  assert.deepEqual(emptyState(), { when: null, will: null, start: '' });
  const saved = { when: 'asks', will: 'tried', start: '2026-11-12T10:00' };
  const restored = validateState(en, saved);
  assert.deepEqual(restored, saved);
  assert.notEqual(restored, saved);
  for (const good of [emptyState(), { when: 'asks', will: null, start: '' }, { when: 'asks', will: 'tried', start: '' }]) assert.deepEqual(validateState(en, good), good);
  for (const bad of [
    null, undefined, 'x', [], {}, { when: null, will: null }, { ...saved, extra: 1 },
    { when: 'spare', will: null, start: '' }, { when: 'nope', will: null, start: '' }, { when: 'asks', will: 'patient', start: '' },
    { when: null, will: 'tried', start: '' }, { when: 'asks', will: null, start: '2026-11-12T10:00' },
    { ...saved, start: 'Thursday' }, { ...saved, start: '2026-13-45T10:00' }, { ...saved, start: 5 }, { when: 1, will: null, start: '' }
  ]) assert.equal(validateState(en, bad), null, JSON.stringify(bad));
});

test('a start time must be a real time after now', () => {
  assert.equal(startError(NaN, 1000), 'invalid');
  assert.equal(startError(Infinity, 1000), 'invalid');
  assert.equal(startError(999, 1000), 'past');
  assert.equal(startError(1000, 1000), 'past');
  assert.equal(startError(1001, 1000), null);
});

const event = {
  plan: 'When Sam goes quiet, I will ask what Sam has already tried.',
  note: 'You made this plan in "Plan your next one-on-one with Sam".',
  start: Date.UTC(2026, 10, 12, 15, 0), now: Date.UTC(2026, 10, 9, 20, 30, 5), uid: 'abc@if-then-plan'
};

test('the calendar file holds the plan in an entry that ends at the chosen time', () => {
  assert.equal(REMINDER_MINUTES, 10);
  assert.equal(calendarFile(event), [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Praxity//Learning patterns: if-then plan//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:abc@if-then-plan',
    'DTSTAMP:20261109T203005Z',
    'DTSTART:20261112T145000Z',
    'DTEND:20261112T150000Z',
    'SUMMARY:When Sam goes quiet\\, I will ask what Sam has already tried.',
    // The fold falls before the second "\n" escape instead of through it.
    'DESCRIPTION:When Sam goes quiet\\, I will ask what Sam has already tried.\\n',
    ' \\nYou made this plan in "Plan your next one-on-one with Sam".',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:When Sam goes quiet\\, I will ask what Sam has already tried.',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].join('\r\n'));
});

test('calendar text is escaped and folded at 75 octets without splitting a character', () => {
  const plan = 'Quand Sam commence à décrire un problème; déjà, je vais poser une question ouverte avant de proposer quoi que ce soit \\ été.';
  const file = calendarFile({ ...event, plan, note: '' });
  const lines = file.split('\r\n');
  const bytes = new TextEncoder();
  for (const line of lines) assert.ok(bytes.encode(line).length <= 75, line);
  // Decoding each line alone fails if a fold split a multi-byte character.
  const strict = new TextDecoder('utf-8', { fatal: true });
  for (const line of lines) assert.doesNotThrow(() => strict.decode(bytes.encode(line)));
  for (const line of lines) assert.doesNotMatch(line, /(?<!\\)(?:\\\\)*\\$/, 'no line ends inside an escape');
  const unfolded = file.replaceAll('\r\n ', '').split('\r\n');
  const escaped = plan.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,');
  assert.ok(unfolded.includes(`SUMMARY:${escaped}`));
  assert.ok(unfolded.includes(`DESCRIPTION:${escaped}`));
  assert.ok(lines.length > unfolded.length, 'long lines fold');
});

test('the calendar file refuses a time that is missing or not in the future', () => {
  assert.throws(() => calendarFile({ ...event, start: NaN }), /invalid/);
  assert.throws(() => calendarFile({ ...event, start: event.now }), /past/);
  assert.throws(() => calendarFile({ ...event, plan: ' ' }), /event/);
  assert.throws(() => calendarFile({ ...event, uid: '' }), /event/);
});

test('format keeps inserted text literal and unknown placeholders in place', () => {
  assert.equal(format('{a} and {b}', { a: '{b}' }), '{b} and {b}');
  assert.equal(format('{minutes} minutes', { minutes: 10 }), '10 minutes');
});

for (const [lang, content] of /** @type {const} */ ([['en', en], ['fr', fr]])) {
  test(`server markup works without JavaScript (${lang})`, () => {
    const markup = render(content, strings[lang], { id: 'plan', lang });
    assert.match(markup, new RegExp(`^<section class="lp lp-if-then-plan" data-lp-pattern="if-then-plan" lang="${lang}">`));
    assert.equal((markup.match(/role="status"/g) ?? []).length, 1);
    assert.match(markup, /<p class="lp-visually-hidden" role="status" aria-atomic="true"><\/p>/);
    // Scenario card: the title, then the context, then the questions; no scene header.
    assert.doesNotMatch(markup, /lp-scene/);
    assert.ok(markup.indexOf('<h2 class="lp-heading">') < markup.indexOf('<p class="lp-context">'));
    assert.ok(markup.indexOf('<p class="lp-context">') < markup.indexOf('<fieldset'));
    const legends = [...markup.matchAll(/<legend class="lp-stem" data-lp-stem>(.*?)<\/legend>/g)].map(match => match[1]);
    assert.deepEqual(legends, [strings[lang].whenStem, strings[lang].willStem]);
    for (const step of ['when', 'will']) {
      assert.match(markup, new RegExp(`<fieldset class="lp-choices" id="plan-${step}" data-lp-step="${step}" aria-describedby="plan-${step}-hint">`));
      assert.equal((markup.match(new RegExp(`type="radio" id="plan-${step}-\\d" name="plan-${step}"`, 'g')) ?? []).length, content[step].options.length);
    }
    for (const id of [...markup.matchAll(/ id="([^"]+)"/g)].map(match => match[1])) assert.ok(id.startsWith('plan-'), id);
    assert.doesNotMatch(markup, /checked/);
    // Controls that need script stay hidden or disabled; the fallback shows.
    assert.match(markup, /<button class="lp-button" type="button" data-lp-add hidden>/);
    assert.match(markup, /<div class="lp-section" data-lp-result hidden>/);
    assert.match(markup, /data-lp-calendar disabled>/);
    assert.match(markup, /data-lp-restart hidden>/);
    assert.match(markup, /<div class="lp-section" data-lp-fallback>/);
    assert.match(markup, /<input class="lp-input lp-if-then-plan-start" type="datetime-local" id="plan-start" aria-describedby="plan-start-hint" data-lp-start>/);
    const fallback = markup.split('data-lp-fallback>')[1];
    assert.equal((fallback.match(/<li>/g) ?? []).length, 2);
    assert.ok(fallback.includes(lang === 'en' ? '<p class="lp-stem">When …, I will…</p>' : '<p class="lp-stem">Quand …, je vais…</p>'));
    assert.ok(markup.includes(lang === 'en' ? 'your plan 10\u00a0minutes before.' : 'votre plan 10\u00a0minutes avant.'));
    // The plan has no box of its own: no nested card, quote or panel class.
    assert.doesNotMatch(markup, /lp-box|lp-quote|lp-unboxed/);
  });
}

test('authored text is escaped and French text gets its spaces', () => {
  const content = copy();
  content.title = '<b>Plan</b> & "more"';
  content.when.options[0].text = '<i>Sam</i> asks';
  const markup = render(content, strings.en, { id: 'x', lang: 'en' });
  assert.ok(markup.includes('&lt;b&gt;Plan&lt;/b&gt; &amp; &quot;more&quot;'));
  assert.ok(markup.includes('<span>&lt;i&gt;Sam&lt;/i&gt; asks</span>'));
  const french = render(fr, strings.fr, { id: 'x', lang: 'fr' });
  assert.ok(french.includes('«\u00a0faire preuve de plus de patience\u00a0»'));
  assert.throws(() => render({ ...en, title: '' }, strings.en, { id: 'x', lang: 'en' }), /title/);
});
