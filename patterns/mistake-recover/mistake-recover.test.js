import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { decide, progress, recover, start, summarize, validateContent, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));
const nbsp = /[  ]/g;

/** Apply steps in order: 'approve' or 'hold' decides the request, an array checks recovery steps. */
const play = (...moves) => moves.reduce((state, move) => {
  const { stage, item } = progress(content, state);
  return Array.isArray(move) ? recover(content, state, item, move) : stage === 'decide' ? decide(content, state, move) : assert.fail(`no decision at ${stage}`);
}, start());

// Mirror only the schema keywords used here, including the documented cross-field annotations.
function matches(value, rule) {
  if (rule.$ref) rule = schema.$defs[rule.$ref.split('/').at(-1)];
  if (Object.hasOwn(rule, 'const')) return value === rule.const;
  if (rule.type === 'boolean') return typeof value === 'boolean';
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (rule.required.some(key => !Object.hasOwn(value, key))) return false;
    if (Object.keys(value).some(key => !Object.hasOwn(rule.properties, key))) return false;
    return Object.entries(rule.properties).every(([key, child]) => !Object.hasOwn(value, key) || matches(value[key], child));
  }
  if (rule.type === 'array') {
    if (!Array.isArray(value) || value.length < rule.minItems || value.length > rule.maxItems) return false;
    if (rule['x-uniqueBy'] && new Set(value.map(item => item?.id)).size !== value.length) return false;
    if (!value.every(item => matches(item, rule.items))) return false;
    // One step stops the harm, and it is a correct step; a list needs a correct and an incorrect step.
    if (rule['x-oneStoppingStep']) {
      const stopping = value.filter(step => step.stops);
      return stopping.length === 1 && stopping[0].correct && value.some(step => step.correct) && value.some(step => !step.correct);
    }
    return true;
  }
  // JSON Schema counts code points and does not trim, so blank text must fail the field's pattern.
  return typeof value === 'string' && [...value].length >= rule.minLength && [...value].length <= rule.maxLength && (!rule.pattern || new RegExp(rule.pattern, 'u').test(value));
}

test('the examples share ids, correct steps and stopping steps, and stay short', () => {
  assert.equal(content.title, 'Approve supplier payments');
  assert.equal(french.title, 'Approuvez les paiements aux fournisseurs');
  const shape = example => [example.request, example.colleague].map(item => item.steps.map(step => [step.id, step.correct, step.stops ?? false]));
  assert.deepEqual(shape(french), shape(content));
  for (const example of [content, french]) {
    assert.deepEqual([example.request, example.colleague].map(item => item.checks.length), [4, 3]);
    // The setup is at most two sentences.
    assert.equal(example.context.split(/(?<=\.) /).length, 2);
    // Recovery lists differ in length and in where the incorrect step sits, and only Cancel repeats across them.
    const lists = [example.request, example.colleague].map(item => item.steps);
    assert.deepEqual(lists.map(steps => steps.length), [3, 4]);
    assert.deepEqual(lists.map(steps => steps.findIndex(step => !step.correct)), [0, 2]);
    const texts = lists.flat().map(step => step.text);
    assert.deepEqual([...new Set(texts.filter((text, n) => texts.indexOf(text) !== n))], [lists[0][2].text]);
  }
});

test('content validator and schema agree, with planted violations for every guard', () => {
  const one = content.request, other = content.colleague;
  const request = value => ({ ...content, request: { ...one, ...value } });
  const colleague = value => ({ ...content, colleague: { ...other, ...value } });
  const { request: _, ...noRequest } = content;
  const fixtures = [[content, true], [french, true]];
  fixtures.push([request({ checks: one.checks.slice(0, 2) }), true], [request({ checks: [...other.checks] }), true]);
  fixtures.push([request({ steps: [...one.steps, { id: 'extra', text: 'Tell finance', correct: false, feedback: 'No.' }] }), true]);
  const bad = (value, field) => fixtures.push([value, false, field]);
  bad(null, 'content'); bad([], 'content'); bad({ ...content, extra: '' }, 'extra');
  for (const field of ['title', 'context']) for (const value of ['', ' ', null, 3, undefined]) bad({ ...content, [field]: value }, field);
  // The card takes exactly one request, as an object. A list of requests is rejected.
  for (const value of [[one], [one, one], null, 'request', undefined]) bad({ ...content, request: value }, 'request');
  bad({ ...noRequest, requests: [one] }, 'requests');
  bad(request({ extra: 1 }), 'request.extra');
  for (const field of ['title', 'summary', 'held', 'approved', 'stopped', 'notStopped']) for (const value of ['', ' ', null, 3, undefined]) bad(request({ [field]: value }), `request.${field}`);
  for (const value of [[], null, undefined, one.checks.slice(0, 1), [...one.checks, other.checks[0]]]) bad(request({ checks: value }), 'request.checks');
  bad(request({ checks: [null, ...one.checks.slice(1)] }), 'request.checks[0]');
  bad(request({ checks: [{ ...one.checks[0], extra: 1 }, ...one.checks.slice(1)] }), 'request.checks[0].extra');
  for (const field of ['label', 'value']) for (const value of ['', ' ', null, undefined]) bad(request({ checks: [{ ...one.checks[0], [field]: value }, ...one.checks.slice(1)] }), `request.checks[0].${field}`);
  const steps = value => request({ steps: value });
  for (const value of [[], null, undefined, one.steps.slice(0, 2), [...one.steps, ...other.steps.slice(0, 3)]]) bad(steps(value), 'request.steps');
  bad(steps([null, ...one.steps.slice(1)]), 'request.steps[0]');
  bad(steps([{ ...one.steps[0], extra: 1 }, ...one.steps.slice(1)]), 'request.steps[0].extra');
  for (const field of ['id', 'text', 'feedback']) for (const value of ['', ' ', null, undefined]) bad(steps([{ ...one.steps[0], [field]: value }, ...one.steps.slice(1)]), `request.steps[0].${field}`);
  for (const value of ['yes', 1, null, undefined]) bad(steps([{ ...one.steps[0], correct: value }, ...one.steps.slice(1)]), 'request.steps[0].correct');
  for (const value of [false, 'yes', 1, null]) bad(steps([{ ...one.steps[0], stops: value }, ...one.steps.slice(1)]), 'request.steps[0].stops');
  bad(steps([{ ...one.steps[0], id: 'bad id' }, ...one.steps.slice(1)]), 'request.steps[0].id');
  bad(steps([one.steps[0], one.steps[0], one.steps[2]]), 'request.steps[1].id');
  // Exactly one step stops the harm, and it is correct. A list needs a correct and an incorrect step.
  const { stops, ...cancel } = one.steps[2];
  bad(steps([one.steps[0], one.steps[1], cancel]), 'request.steps');
  bad(steps([one.steps[0], { ...one.steps[1], stops: true }, one.steps[2]]), 'request.steps');
  bad(steps([{ ...one.steps[0], stops: true }, one.steps[1], cancel]), 'request.steps');
  bad(steps(one.steps.map(step => ({ ...step, correct: true }))), 'request.steps');
  for (const value of [null, [], 'colleague', undefined]) bad({ ...content, colleague: value }, 'colleague');
  bad(colleague({ extra: 1 }), 'colleague.extra');
  bad(colleague({ held: 'Held.' }), 'colleague.held');
  for (const field of ['name', 'title', 'summary', 'approved', 'stopped', 'notStopped']) for (const value of ['', ' ', null, undefined]) bad(colleague({ [field]: value }), `colleague.${field}`);
  bad(colleague({ checks: [] }), 'colleague.checks');
  bad(colleague({ steps: other.steps.map(step => ({ ...step, correct: true })) }), 'colleague.steps');
  for (const [value, valid, field] of fixtures) {
    assert.equal(matches(value, schema), valid, `schema: ${field}`);
    if (valid) assert.doesNotThrow(() => validateContent(value));
    else assert.throws(() => validateContent(value), error => error instanceof Error && error.message.includes(field), field);
  }
});

test('approving the request opens its recovery; holding it opens the payment the colleague approved', () => {
  assert.deepEqual(start(), { decision: null, steps: [null, null] });
  assert.deepEqual(progress(content, start()), { stage: 'decide', item: 0, statuses: ['pending', null] });
  const approved = play('approve');
  assert.deepEqual(approved, { decision: 'approve', steps: [null, null] });
  assert.deepEqual(progress(content, approved), { stage: 'recover', item: 0, statuses: ['approved', null] });
  assert.throws(() => decide(content, approved, 'hold'), /not open/);
  assert.throws(() => recover(content, approved, 1, ['cancel']), /not open/);
  const fixed = recover(content, approved, 0, ['call', 'cancel']);
  assert.deepEqual(fixed.steps, [['call', 'cancel'], null]);
  assert.deepEqual(progress(content, fixed), { stage: 'done', item: null, statuses: ['stopped', null] });
  assert.throws(() => recover(content, fixed, 0, ['call']), /not open/);
  assert.deepEqual(progress(content, play('approve', ['call', 'update'])).statuses, ['notStopped', null]);
  // A learner who holds the request still recovers once, on the colleague's payment.
  const held = play('hold');
  assert.deepEqual(progress(content, held), { stage: 'recover', item: 1, statuses: ['held', 'approved'] });
  assert.throws(() => recover(content, held, 0, ['cancel']), /not open/);
  assert.deepEqual(progress(content, recover(content, held, 1, ['cancel', 'leave'])), { stage: 'done', item: null, statuses: ['held', 'stopped'] });
  assert.deepEqual(progress(content, play('hold', ['tell'])).statuses, ['held', 'notStopped']);
  // Transitions return new states and leave the old one alone.
  assert.deepEqual(approved, { decision: 'approve', steps: [null, null] });
});

test('decisions and recovery steps are checked', () => {
  assert.throws(() => decide(content, start(), 'maybe'), /Invalid decision/);
  const approved = play('approve');
  for (const ids of [[], ['nope'], ['cancel', 'cancel'], 'cancel', [3]]) assert.throws(() => recover(content, approved, 0, ids), /Invalid steps/, JSON.stringify(ids));
  // Each payment's steps are its own: telling Dana belongs to the colleague's payment only.
  assert.throws(() => recover(content, approved, 0, ['tell']), /Invalid steps/);
  assert.throws(() => recover(content, play('hold'), 1, ['call']), /Invalid steps/);
});

test('the closing sentence names the decision and whether the payment at risk was stopped', () => {
  const end = (...moves) => summarize(content, play(...moves), strings.en);
  assert.equal(end('approve', ['call', 'cancel']), 'You approved the request, then stopped it before it went through.');
  assert.equal(end('approve', ['update']), 'You approved the request, and it still goes through.');
  assert.equal(end('hold', ['cancel']), 'You held the request, then stopped the one Dana approved before it went through.');
  assert.equal(end('hold', ['leave', 'tell']), 'You held the request, and the one Dana approved still goes through.');
  const fin = (...moves) => summarize(french, play(...moves), strings.fr).replace(nbsp, ' ');
  assert.equal(fin('approve', ['cancel']), 'Vous avez approuvé la demande, puis vous l’avez arrêtée avant qu’elle soit exécutée.');
  assert.equal(fin('approve', ['call']), 'Vous avez approuvé la demande, et elle sera quand même exécutée.');
  assert.equal(fin('hold', ['cancel']), 'Vous avez mis la demande en attente, puis vous avez arrêté celle que Dana avait approuvée avant qu’elle soit exécutée.');
  assert.equal(fin('hold', ['tell']), 'Vous avez mis la demande en attente, mais celle que Dana avait approuvée sera quand même exécutée.');
  assert.throws(() => summarize(content, play('hold'), strings.en), /No summary/);
});

test('every finished path has a complete sentence in both languages', () => {
  const walk = state => {
    const { stage, item } = progress(content, state);
    if (stage === 'done') {
      for (const lang of ['en', 'fr']) assert.doesNotMatch(summarize(content, state, strings[lang]), /undefined|NaN|[{}]/);
      return 1;
    }
    if (stage === 'decide') return walk(decide(content, state, 'approve')) + walk(decide(content, state, 'hold'));
    const ids = (item === 1 ? content.colleague : content.request).steps.map(step => step.id);
    return walk(recover(content, state, item, ids)) + walk(recover(content, state, item, ids.filter(id => id !== 'cancel')));
  };
  // Approve or hold, then two recovery outcomes for the payment that needs one.
  assert.equal(walk(start()), 4);
});

test('saved state is copied when the learner could have reached it, and ignored otherwise', () => {
  const valid = [start(), play('approve'), play('approve', ['cancel']), play('hold'), play('hold', ['tell', 'cancel']), play('approve', ['call', 'update'])];
  for (const value of valid) {
    const copy = validateState(content, value);
    assert.deepEqual(copy, value);
    assert.notEqual(copy.steps, value.steps);
  }
  const invalid = [
    null, [], 'state', {}, { decision: null }, { ...start(), extra: 1 },
    { decision: null, steps: [null] }, { decision: null, steps: [null, null, null] }, { decision: 'maybe', steps: [null, null] },
    // The saved shape from when the card held two requests.
    { decisions: [null, null], steps: [null, null, null] }, { decisions: ['hold', 'hold'], steps: [null, null] },
    // Recovery belongs to the approved request, or to the colleague's payment after a hold.
    { decision: null, steps: [['cancel'], null] }, { decision: 'hold', steps: [['cancel'], null] }, { decision: 'approve', steps: [null, ['cancel']] },
    { decision: 'approve', steps: [[], null] }, { decision: 'approve', steps: [['nope'], null] }, { decision: 'approve', steps: [['cancel', 'cancel'], null] }
  ];
  for (const value of invalid) assert.equal(validateState(content, value), null, JSON.stringify(value));
});

test('render escapes text and attributes; ids and checkbox groups are instance-specific', () => {
  const hostile = '<script>alert("x")</script> & \'quoted\'';
  const scrub = item => ({ ...item, title: hostile, summary: hostile, approved: hostile, stopped: hostile, notStopped: hostile, ...(item.held ? { held: hostile } : {}), checks: item.checks.map(() => ({ label: hostile, value: hostile })), steps: item.steps.map(step => ({ ...step, text: hostile, feedback: hostile })) });
  const value = { ...content, title: hostile, context: hostile, request: scrub(content.request), colleague: { ...scrub(content.colleague), name: hostile } };
  const output = render(value, Object.fromEntries(Object.keys(strings.en).map(key => [key, hostile])), { id: 'a"b', lang: 'en"x' });
  assert.doesNotMatch(output, /<script|"x"|'quoted'/);
  assert.match(output, /lang="en&quot;x"/);
  assert.match(output, /id="a&quot;b-request-title"/);
  const one = render(content, strings.en, { id: 'one', lang: 'en' }), two = render(content, strings.en, { id: 'two', lang: 'en' });
  const ids = markup => [...markup.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set([...ids(one), ...ids(two)]).size, ids(one).length * 2);
  for (const [, target] of one.matchAll(/ (?:for|aria-labelledby|aria-describedby)="([^"]+)"/g)) for (const id of target.split(' ')) assert.ok(ids(one).includes(id), id);
  assert.throws(() => render({ ...content, request: [content.request] }, strings.en, { id: 'x', lang: 'en' }), /request/);
});

for (const [lang, example] of [['en', content], ['fr', french]]) {
  test(`server HTML works without JavaScript: the request's record, then what approving does and how to recover (${lang})`, () => {
    const s = strings[lang], output = render(example, s, { id: 'pay', lang });
    const text = output.replace(nbsp, ' ');
    assert.match(output, new RegExp(`^<section class="lp lp-mistake-recover" data-lp-pattern="mistake-recover" lang="${lang}">`));
    assert.doesNotMatch(output, /lp-scene|lp-quote|lp-box/);
    assert.ok(output.indexOf('<h2 class="lp-heading">') < output.indexOf('<p class="lp-context">'));
    // Each record is a description list in its own section, with the payment's title as its heading.
    assert.equal((output.match(/<dl class="lp-mistake-recover-record">/g) || []).length, 2);
    assert.equal((output.match(/<h3 /g) || []).length, 2);
    // Buttons, status lines, step groups, the colleague's payment and the result need JavaScript.
    assert.equal((output.match(/<button[^>]*data-lp-(approve|hold|check|restart)[^>]*>/g) || []).length, 2 + 2 + 1);
    for (const [tag] of output.matchAll(/<(?:div|p|section)[^>]*data-lp-(?:decide|status|recover|result|colleague)\b[^>]*>/g)) assert.match(tag, / hidden>$/, tag);
    assert.match(output, /<section class="lp-section lp-stack" aria-labelledby="pay-request-title" data-lp-item="0">/);
    assert.doesNotMatch(output, /<input[^>]*(checked|disabled)/);
    // Two closed disclosures on the request: what approving does, and every step marked with its reason.
    assert.equal((output.match(/<details class="lp-details" data-lp-fallback>/g) || []).length, 2);
    assert.doesNotMatch(output, /<details[^>]* open/);
    const summaries = [...output.matchAll(/<summary>(.*?)<\/summary>/g)].map(match => match[1].replace(nbsp, ' '));
    assert.deepEqual(summaries, [s.ifApprove, s.howRecover].map(value => value.replace(nbsp, ' ')));
    assert.ok(text.includes(`<p>${example.request.approved.replace(nbsp, ' ').replace(/'/g, '&#39;')}</p>`), example.request.approved);
    assert.equal((output.match(/lp-choice-mark lp-met/g) || []).length, 2);
    assert.equal((output.match(/lp-choice-mark lp-missed/g) || []).length, 1);
    // One empty status region, and icons that stay out of the accessibility tree.
    assert.equal((output.match(/role="status"/g) || []).length, 1);
    assert.match(output, /<p class="lp-visually-hidden" role="status" aria-atomic="true"><\/p>/);
    for (const [svg] of output.matchAll(/<svg[^>]*>/g)) assert.match(svg, /aria-hidden="true"/);
  });
}

test('English and French strings have the same keys, and French uses its spacing', () => {
  assert.deepEqual(Object.keys(strings.fr), Object.keys(strings.en));
  for (const lang of ['en', 'fr']) for (const [key, value] of Object.entries(strings[lang])) assert.ok(value.trim(), `${lang}.${key}`);
  // The status before a decision shares no words with Hold, so holding visibly changes it.
  assert.doesNotMatch(strings.fr.pending, /attente/i);
  assert.doesNotMatch(strings.en.pending, /hold/i);
  const output = render(french, strings.fr, { id: 'pay', lang: 'fr' });
  assert.match(output, /Statut :/);
  assert.match(output, /maintenant \?/);
  assert.match(output, /1 150 \$/);
  assert.doesNotMatch(render(content, strings.en, { id: 'pay', lang: 'en' }), / /);
});
