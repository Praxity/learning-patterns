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

/** Apply steps in order: 'approve' or 'hold' decides the next request, an array checks recovery steps. */
const play = (...moves) => moves.reduce((state, move) => {
  const { stage, item } = progress(content, state);
  return Array.isArray(move) ? recover(content, state, item, move) : stage === 'decide' ? decide(content, state, item, move) : assert.fail(`no decision at ${stage}`);
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
  return typeof value === 'string' && value.trim().length >= rule.minLength && [...value].length <= rule.maxLength && (!rule.pattern || new RegExp(rule.pattern).test(value));
}

test('the examples share ids, correct steps and stopping steps, and stay short', () => {
  assert.equal(content.title, 'Approve supplier payments');
  assert.equal(french.title, 'Approuver les paiements aux fournisseurs');
  const shape = example => [...example.requests, example.colleague].map(item => item.steps.map(step => [step.id, step.correct, step.stops ?? false]));
  assert.deepEqual(shape(french), shape(content));
  assert.deepEqual([...french.requests, french.colleague].map(item => item.checks.length), [3, 4, 2]);
  assert.deepEqual([...content.requests, content.colleague].map(item => item.checks.length), [3, 4, 2]);
  for (const example of [content, french]) {
    // The setup is at most two sentences.
    assert.equal(example.context.split(/(?<=\.) /).length, 2);
    // Recovery lists differ in length and in where the incorrect step sits, and only Cancel repeats across them.
    const lists = [...example.requests, example.colleague].map(item => item.steps);
    assert.deepEqual(lists.map(steps => steps.length), [4, 3, 4]);
    assert.deepEqual(lists.map(steps => steps.findIndex(step => !step.correct)), [1, 1, 2]);
    const texts = lists.flat().map(step => step.text);
    assert.deepEqual([...new Set(texts.filter((text, n) => texts.indexOf(text) !== n))], [lists[0][0].text]);
  }
});

test('content validator and schema agree, with planted violations for every guard', () => {
  const [one, two] = content.requests;
  const request = (value, n = 0) => ({ ...content, requests: content.requests.map((item, i) => i === n ? { ...item, ...value } : item) });
  const colleague = value => ({ ...content, colleague: { ...content.colleague, ...value } });
  const fixtures = [[content, true], [french, true]];
  fixtures.push([request({ checks: one.checks.slice(0, 2) }), true], [request({ checks: [...two.checks] }), true]);
  fixtures.push([request({ steps: [...one.steps, { id: 'extra', text: 'Tell finance', correct: false, feedback: 'No.' }] }), true]);
  const bad = (value, field) => fixtures.push([value, false, field]);
  bad(null, 'content'); bad([], 'content'); bad({ ...content, extra: '' }, 'extra');
  for (const field of ['title', 'context']) for (const value of ['', ' ', null, 3, undefined]) bad({ ...content, [field]: value }, field);
  for (const value of [[], null, 'requests', undefined, [one], [one, two, one]]) bad({ ...content, requests: value }, 'requests');
  bad({ ...content, requests: [null, two] }, 'requests[0]');
  bad(request({ extra: 1 }), 'requests[0].extra');
  for (const field of ['title', 'summary', 'held', 'approved', 'stopped', 'notStopped']) for (const value of ['', ' ', null, 3, undefined]) bad(request({ [field]: value }, 1), `requests[1].${field}`);
  for (const value of [[], null, undefined, one.checks.slice(0, 1), [...two.checks, one.checks[0]]]) bad(request({ checks: value }), 'requests[0].checks');
  bad(request({ checks: [null, ...one.checks.slice(1)] }), 'requests[0].checks[0]');
  bad(request({ checks: [{ ...one.checks[0], extra: 1 }, ...one.checks.slice(1)] }), 'requests[0].checks[0].extra');
  for (const field of ['label', 'value']) for (const value of ['', ' ', null, undefined]) bad(request({ checks: [{ ...one.checks[0], [field]: value }, ...one.checks.slice(1)] }), `requests[0].checks[0].${field}`);
  const steps = (value, n = 0) => request({ steps: value }, n);
  for (const value of [[], null, undefined, one.steps.slice(0, 2), [...one.steps, ...two.steps.slice(0, 2)]]) bad(steps(value), 'requests[0].steps');
  bad(steps([null, ...one.steps.slice(1)]), 'requests[0].steps[0]');
  bad(steps([{ ...one.steps[0], extra: 1 }, ...one.steps.slice(1)]), 'requests[0].steps[0].extra');
  for (const field of ['id', 'text', 'feedback']) for (const value of ['', ' ', null, undefined]) bad(steps([{ ...one.steps[0], [field]: value }, ...one.steps.slice(1)]), `requests[0].steps[0].${field}`);
  for (const value of ['yes', 1, null, undefined]) bad(steps([{ ...one.steps[0], correct: value }, ...one.steps.slice(1)]), 'requests[0].steps[0].correct');
  for (const value of [false, 'yes', 1, null]) bad(steps([{ ...one.steps[0], stops: value }, ...one.steps.slice(1)]), 'requests[0].steps[0].stops');
  bad(steps([{ ...one.steps[0], id: 'bad id' }, ...one.steps.slice(1)]), 'requests[0].steps[0].id');
  bad(steps([one.steps[0], one.steps[0], ...one.steps.slice(2)]), 'requests[0].steps[1].id');
  // Exactly one step stops the harm, and it is correct. A list needs a correct and an incorrect step.
  const { stops, ...cancel } = one.steps[0];
  bad(steps([cancel, ...one.steps.slice(1)]), 'requests[0].steps');
  bad(steps([one.steps[0], one.steps[1], { ...one.steps[2], stops: true }, one.steps[3]]), 'requests[0].steps');
  bad(steps([cancel, { ...one.steps[1], stops: true }, ...one.steps.slice(2)]), 'requests[0].steps');
  bad(steps(one.steps.map(step => ({ ...step, correct: true }))), 'requests[0].steps');
  for (const value of [null, [], 'colleague', undefined]) bad({ ...content, colleague: value }, 'colleague');
  bad(colleague({ extra: 1 }), 'colleague.extra');
  bad(colleague({ held: 'Held.' }), 'colleague.held');
  for (const field of ['name', 'title', 'summary', 'approved', 'stopped', 'notStopped']) for (const value of ['', ' ', null, undefined]) bad(colleague({ [field]: value }), `colleague.${field}`);
  bad(colleague({ checks: [] }), 'colleague.checks');
  bad(colleague({ steps: content.colleague.steps.map(step => ({ ...step, correct: true })) }), 'colleague.steps');
  for (const [value, valid, field] of fixtures) {
    assert.equal(matches(value, schema), valid, `schema: ${field}`);
    if (valid) assert.doesNotThrow(() => validateContent(value));
    else assert.throws(() => validateContent(value), error => error instanceof Error && error.message.includes(field), field);
  }
});

test('request 1, then request 2, each recovered after Approve; held requests need no recovery', () => {
  assert.deepEqual(start(), { decisions: [null, null], steps: [null, null, null] });
  assert.deepEqual(progress(content, start()), { stage: 'decide', item: 0, statuses: ['pending', null, null] });
  const approved = play('approve');
  assert.deepEqual(approved, { decisions: ['approve', null], steps: [null, null, null] });
  assert.deepEqual(progress(content, approved), { stage: 'recover', item: 0, statuses: ['approved', null, null] });
  // Request 2 waits until request 1 is recovered.
  assert.throws(() => decide(content, approved, 1, 'hold'), /not open/);
  assert.throws(() => decide(content, approved, 0, 'hold'), /not open/);
  const fixed = recover(content, approved, 0, ['invoice', 'cancel']);
  assert.deepEqual(fixed.steps, [['invoice', 'cancel'], null, null]);
  assert.deepEqual(progress(content, fixed), { stage: 'decide', item: 1, statuses: ['stopped', 'pending', null] });
  assert.throws(() => recover(content, fixed, 0, ['log']), /not open/);
  const missed = play('approve', ['invoice', 'log']);
  assert.deepEqual(progress(content, missed).statuses, ['notStopped', 'pending', null]);
  const held = play('hold');
  assert.deepEqual(progress(content, held), { stage: 'decide', item: 1, statuses: ['held', 'pending', null] });
  assert.throws(() => recover(content, held, 0, ['cancel']), /not open/);
  assert.deepEqual(progress(content, play('hold', 'approve')), { stage: 'recover', item: 1, statuses: ['held', 'approved', null] });
  assert.deepEqual(progress(content, play('approve', ['cancel'], 'hold')), { stage: 'done', item: null, statuses: ['stopped', 'held', null] });
  assert.deepEqual(progress(content, play('approve', ['keep'], 'approve', ['call'])), { stage: 'done', item: null, statuses: ['notStopped', 'notStopped', null] });
  // Transitions return new states and leave the old one alone.
  assert.deepEqual(approved, { decisions: ['approve', null], steps: [null, null, null] });
});

test('holding both requests opens the payment the colleague approved, so everyone recovers once', () => {
  const both = play('hold', 'hold');
  assert.deepEqual(progress(content, both), { stage: 'recover', item: 2, statuses: ['held', 'held', 'approved'] });
  const done = recover(content, both, 2, ['cancel', 'leave']);
  assert.deepEqual(progress(content, done), { stage: 'done', item: null, statuses: ['held', 'held', 'stopped'] });
  assert.deepEqual(progress(content, play('hold', 'hold', ['tell'])).statuses, ['held', 'held', 'notStopped']);
  // A learner who approved anything never sees the colleague's payment.
  assert.equal(progress(content, play('approve', ['cancel'], 'hold')).statuses[2], null);
  assert.throws(() => recover(content, play('approve', ['cancel'], 'hold'), 2, ['cancel']), /not open/);
});

test('decisions and recovery steps are checked', () => {
  assert.throws(() => decide(content, start(), 0, 'maybe'), /Invalid decision/);
  const approved = play('approve');
  for (const ids of [[], ['nope'], ['cancel', 'cancel'], 'cancel', [3]]) assert.throws(() => recover(content, approved, 0, ids), /Invalid steps/, JSON.stringify(ids));
  // Request 2's steps are its own: Log belongs to request 1 only.
  assert.throws(() => recover(content, play('hold', 'approve'), 1, ['log']), /Invalid steps/);
  assert.throws(() => decide(content, play('hold', 'hold'), 1, 'hold'), /not open/);
});

test('the closing sentence names each decision and whether each approved payment was stopped', () => {
  const end = (...moves) => summarize(content, play(...moves), strings.en);
  assert.equal(end('hold', 'hold', ['cancel']), 'You held both requests and stopped the payment Dana approved before it went out.');
  assert.equal(end('hold', 'hold', ['leave', 'tell']), 'You held both requests, and the payment Dana approved still goes out.');
  assert.equal(end('approve', ['cancel', 'log'], 'hold'), 'You approved request 1 and held request 2, and stopped the payment for request 1 before it went out.');
  assert.equal(end('approve', ['keep'], 'hold'), 'You approved request 1 and held request 2, and the payment for request 1 still goes out.');
  assert.equal(end('hold', 'approve', ['cancel']), 'You held request 1 and approved request 2, and stopped the payment for request 2 before it went out.');
  assert.equal(end('hold', 'approve', ['call', 'update']), 'You held request 1 and approved request 2, and the payment for request 2 still goes out.');
  assert.equal(end('approve', ['cancel'], 'approve', ['cancel']), 'You approved both requests and stopped both payments before they went out.');
  assert.equal(end('approve', ['cancel'], 'approve', ['call']), 'You approved both requests and stopped the payment for request 1 before it went out, but not the payment for request 2.');
  assert.equal(end('approve', ['log'], 'approve', ['cancel']), 'You approved both requests and stopped the payment for request 2 before it went out, but not the payment for request 1.');
  assert.equal(end('approve', ['log'], 'approve', ['call']), 'You approved both requests, and both payments still go out.');
  const fin = (...moves) => summarize(french, play(...moves), strings.fr).replace(nbsp, ' ');
  assert.equal(fin('hold', 'hold', ['cancel']), 'Vous avez mis les deux demandes en attente, puis vous avez arrêté le paiement approuvé par Dana avant son envoi.');
  assert.equal(fin('hold', 'hold', ['tell']), 'Vous avez mis les deux demandes en attente, mais le paiement approuvé par Dana sera quand même envoyé.');
  assert.equal(fin('approve', ['cancel'], 'hold'), 'Vous avez approuvé la demande 1 et mis la demande 2 en attente, puis vous avez arrêté le paiement de la demande 1 avant son envoi.');
  assert.equal(fin('hold', 'approve', ['call']), 'Vous avez mis la demande 1 en attente et approuvé la demande 2, mais le paiement de la demande 2 sera quand même envoyé.');
  assert.equal(fin('approve', ['cancel'], 'approve', ['cancel']), 'Vous avez approuvé les deux demandes, puis vous avez arrêté les deux paiements avant leur envoi.');
  assert.equal(fin('approve', ['log'], 'approve', ['cancel']), 'Vous avez approuvé les deux demandes, puis vous avez arrêté le paiement de la demande 2 avant son envoi, mais pas celui de la demande 1.');
  assert.equal(fin('approve', ['log'], 'approve', ['call']), 'Vous avez approuvé les deux demandes, mais les deux paiements seront quand même envoyés.');
  assert.throws(() => summarize(content, play('hold', 'hold'), strings.en), /No summary/);
});

test('every finished path has a complete sentence in both languages', () => {
  const walk = state => {
    const { stage, item } = progress(content, state);
    if (stage === 'done') {
      for (const lang of ['en', 'fr']) assert.doesNotMatch(summarize(content, state, strings[lang]), /undefined|NaN|[{}]/);
      return 1;
    }
    if (stage === 'decide') return walk(decide(content, state, item, 'approve')) + walk(decide(content, state, item, 'hold'));
    const ids = (item === 2 ? content.colleague : content.requests[item]).steps.map(step => step.id);
    return walk(recover(content, state, item, ids)) + walk(recover(content, state, item, ids.filter(id => id !== 'cancel')));
  };
  // Approve or hold twice, and two recovery outcomes for each payment that needs one.
  assert.equal(walk(start()), 2 + 2 + 2 + 4);
});

test('saved state is copied when the learner could have reached it, and ignored otherwise', () => {
  const valid = [start(), play('approve'), play('approve', ['cancel']), play('hold', 'approve'), play('hold', 'hold'), play('hold', 'hold', ['tell', 'cancel']), play('approve', ['log'], 'approve', ['call', 'update'])];
  for (const value of valid) {
    const copy = validateState(content, value);
    assert.deepEqual(copy, value);
    assert.notEqual(copy.decisions, value.decisions);
  }
  const invalid = [
    null, [], 'state', {}, { decisions: [null, null] }, { ...start(), extra: 1 },
    { decisions: [null], steps: [null, null, null] }, { decisions: [null, null], steps: [null, null] }, { decisions: 'hold', steps: [null, null, null] },
    { decisions: ['maybe', null], steps: [null, null, null] },
    // Request 2 is decided only after request 1 ends.
    { decisions: [null, 'hold'], steps: [null, null, null] }, { decisions: ['approve', 'hold'], steps: [null, null, null] },
    // Recovery belongs to an approved request, or to the colleague's payment after two holds.
    { decisions: ['hold', null], steps: [['cancel'], null, null] }, { decisions: ['approve', 'hold'], steps: [['cancel'], null, ['cancel']] },
    { decisions: ['approve', null], steps: [[], null, null] }, { decisions: ['approve', null], steps: [['nope'], null, null] }, { decisions: ['approve', null], steps: [['cancel', 'cancel'], null, null] }
  ];
  for (const value of invalid) assert.equal(validateState(content, value), null, JSON.stringify(value));
});

test('render escapes text and attributes; ids and checkbox groups are instance-specific', () => {
  const hostile = '<script>alert("x")</script> & \'quoted\'';
  const scrub = item => ({ ...item, title: hostile, summary: hostile, approved: hostile, stopped: hostile, notStopped: hostile, ...(item.held ? { held: hostile } : {}), checks: item.checks.map(() => ({ label: hostile, value: hostile })), steps: item.steps.map(step => ({ ...step, text: hostile, feedback: hostile })) });
  const value = { ...content, title: hostile, context: hostile, requests: content.requests.map(scrub), colleague: { ...scrub(content.colleague), name: hostile } };
  const output = render(value, Object.fromEntries(Object.keys(strings.en).map(key => [key, hostile])), { id: 'a"b', lang: 'en"x' });
  assert.doesNotMatch(output, /<script|"x"|'quoted'/);
  assert.match(output, /lang="en&quot;x"/);
  assert.match(output, /id="a&quot;b-request-0-title"/);
  const one = render(content, strings.en, { id: 'one', lang: 'en' }), two = render(content, strings.en, { id: 'two', lang: 'en' });
  const ids = markup => [...markup.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set([...ids(one), ...ids(two)]).size, ids(one).length * 2);
  for (const [, target] of one.matchAll(/ (?:for|aria-labelledby|aria-describedby)="([^"]+)"/g)) for (const id of target.split(' ')) assert.ok(ids(one).includes(id), id);
  assert.throws(() => render({ ...content, requests: [content.requests[0]] }, strings.en, { id: 'x', lang: 'en' }), /requests/);
});

for (const [lang, example] of [['en', content], ['fr', french]]) {
  test(`server HTML works without JavaScript: both records, then what approving does and how to recover (${lang})`, () => {
    const s = strings[lang], output = render(example, s, { id: 'pay', lang });
    const text = output.replace(nbsp, ' ');
    assert.match(output, new RegExp(`^<section class="lp lp-mistake-recover" data-lp-pattern="mistake-recover" lang="${lang}">`));
    assert.doesNotMatch(output, /lp-scene|lp-quote|lp-box/);
    assert.ok(output.indexOf('<h2 class="lp-heading">') < output.indexOf('<p class="lp-context">'));
    // Each record is a description list in its own section, with the request's title as its heading.
    assert.equal((output.match(/<dl class="lp-mistake-recover-record">/g) || []).length, 3);
    assert.equal((output.match(/<h3 /g) || []).length, 3);
    // Buttons, status lines, step groups, the colleague's payment and the result need JavaScript.
    assert.equal((output.match(/<button[^>]*data-lp-(approve|hold|check|restart)[^>]*>/g) || []).length, 2 + 2 + 3 + 1);
    for (const [tag] of output.matchAll(/<(?:div|p|section)[^>]*data-lp-(?:decide|status|recover|result|colleague)\b[^>]*>/g)) assert.match(tag, / hidden>$/, tag);
    assert.match(output, /<section class="lp-section lp-stack" aria-labelledby="pay-request-1-title" data-lp-item="1">/);
    assert.doesNotMatch(output, /<input[^>]*(checked|disabled)/);
    // Two closed disclosures per request: what approving does, and every step marked with its reason.
    assert.equal((output.match(/<details class="lp-details" data-lp-fallback>/g) || []).length, 4);
    assert.doesNotMatch(output, /<details[^>]* open/);
    const summaries = [...output.matchAll(/<summary>(.*?)<\/summary>/g)].map(match => match[1].replace(nbsp, ' '));
    assert.deepEqual(summaries, [s.ifApprove, s.howRecover, s.ifApprove, s.howRecover].map(value => value.replace(nbsp, ' ')));
    for (const request of example.requests) {
      assert.ok(text.includes(`<p>${request.approved.replace(nbsp, ' ').replace(/'/g, '&#39;')}</p>`), request.approved);
      for (const step of request.steps) {
        const mark = step.correct ? `<span class="lp-choice-mark lp-met">` : `<span class="lp-choice-mark lp-missed">`;
        assert.ok(output.includes(mark), step.id);
      }
    }
    assert.equal((output.match(/lp-choice-mark lp-met/g) || []).length, 5);
    assert.equal((output.match(/lp-choice-mark lp-missed/g) || []).length, 2);
    // One empty status region, and icons that stay out of the accessibility tree.
    assert.equal((output.match(/role="status"/g) || []).length, 1);
    assert.match(output, /<p class="lp-visually-hidden" role="status" aria-atomic="true"><\/p>/);
    for (const [svg] of output.matchAll(/<svg[^>]*>/g)) assert.match(svg, /aria-hidden="true"/);
  });
}

test('English and French strings have the same keys, and French uses its spacing', () => {
  assert.deepEqual(Object.keys(strings.fr), Object.keys(strings.en));
  for (const lang of ['en', 'fr']) for (const [key, value] of Object.entries(strings[lang])) assert.ok(value.trim(), `${lang}.${key}`);
  const output = render(french, strings.fr, { id: 'pay', lang: 'fr' });
  assert.match(output, /Statut :/);
  assert.match(output, /maintenant \?/);
  assert.match(output, /2 400 \$/);
  assert.doesNotMatch(render(content, strings.en, { id: 'pay', lang: 'en' }), / /);
});
