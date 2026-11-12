import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { answer, emptyState, format, learnerSteps, move, nextStep, reach, result, validateContent, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));

/** Answer the learner's steps in order. `picks` lists one option per learner step across cases. */
function play(picks, state = emptyState(content)) {
  const queue = [...picks];
  while (queue.length) {
    const c = reach(content, state);
    state = answer(content, state, c, nextStep(content, state, c), queue.shift());
  }
  return state;
}

test('the sample fades the last step first, then hands over the whole case, in both languages', () => {
  for (const example of [content, french]) {
    assert.doesNotThrow(() => validateContent(example));
    assert.deepEqual(example.cases.map((_, c) => learnerSteps(example, c)), [[], [2], [0, 1, 2]]);
    assert.deepEqual(example.cases.map(item => item.steps.map(step => step.answer)), [[0, 0, 0], [0, 1, 1], [1, 0, 2]]);
  }
  assert.deepEqual(Object.keys(strings.fr), Object.keys(strings.en));
  assert.deepEqual([strings.en.markCorrect, strings.en.markWrong, strings.en.markAnswer], ['Correct', 'Incorrect', 'Correct answer']);
  assert.deepEqual([strings.fr.markCorrect, strings.fr.markWrong, strings.fr.markAnswer], ['Correct', 'Incorrect', 'Bonne réponse']);
});

test('validateContent names the bad field', () => {
  const bad = (edit, field) => {
    const copy = structuredClone(content);
    edit(copy);
    assert.throws(() => validateContent(copy), error => error instanceof Error && error.message.includes(field), field);
  };
  for (const value of [null, [], 3]) assert.throws(() => validateContent(value), /content/);
  bad(c => { c.extra = true; }, 'extra');
  for (const field of ['title', 'context']) for (const value of ['', '   ', null, 3, undefined]) bad(c => { c[field] = value; }, field);
  bad(c => { c.steps[0].extra = 1; }, 'steps[0].extra');
  bad(c => { c.steps[0].question = ' '; }, 'steps[0].question');
  bad(c => { c.steps[1].options[1] = ''; }, 'steps[1].options[1]');
  bad(c => { c.steps[0].options[1] = c.steps[0].options[0]; }, 'steps[0].options');
  bad(c => { c.cases[0].extra = 1; }, 'cases[0].extra');
  bad(c => { c.cases[1].facts[0].label = ''; }, 'cases[1].facts[0].label');
  bad(c => { c.cases[1].facts[0].text = 3; }, 'cases[1].facts[0].text');
  bad(c => { c.cases[1].facts[0].extra = 1; }, 'cases[1].facts[0].extra');
  bad(c => { c.cases[1].steps.pop(); }, 'cases[1].steps');
  bad(c => { c.cases[1].steps[0].reason = ' '; }, 'cases[1].steps[0].reason');
  bad(c => { c.cases[1].steps[0].worked = 'yes'; }, 'cases[1].steps[0].worked');
  bad(c => { c.cases[1].steps[0].extra = 1; }, 'cases[1].steps[0].extra');
  // The second step has two options, so its answer is 0 or 1.
  for (const value of [2, -1, 0.5, '0', null]) bad(c => { c.cases[1].steps[1].answer = value; }, 'cases[1].steps[1].answer');
});

test('limits keep the activity short: two to four steps and options, three or four cases, one to four facts', () => {
  const sized = (steps, cases, options = 2, facts = 1) => ({
    title: 'T', context: 'C',
    steps: Array.from({ length: steps }, (_, s) => ({ question: `Q${s}`, options: Array.from({ length: options }, (_, n) => `O${n}`) })),
    // Each case hands over one more step from the end, and the last hands over the rest.
    cases: Array.from({ length: cases }, (_, c) => ({
      facts: Array.from({ length: facts }, (_, n) => ({ label: `L${n}`, text: 'F' })),
      steps: Array.from({ length: steps }, (_, s) => ({ answer: 0, reason: 'R', worked: c < cases - 1 && s < steps - c }))
    }))
  });
  for (const [steps, cases] of [[2, 3], [3, 3], [3, 4], [4, 3], [4, 4]]) assert.doesNotThrow(() => validateContent(sized(steps, cases)), `${steps} steps, ${cases} cases`);
  assert.doesNotThrow(() => validateContent(sized(3, 3, 4, 4)));
  assert.throws(() => validateContent(sized(1, 3)), /steps/);
  assert.throws(() => validateContent(sized(5, 3)), /steps/);
  assert.throws(() => validateContent(sized(3, 2)), /cases/);
  assert.throws(() => validateContent(sized(4, 5)), /cases/);
  assert.throws(() => validateContent(sized(3, 3, 1)), /steps\[0\]\.options/);
  assert.throws(() => validateContent(sized(3, 3, 5)), /steps\[0\]\.options/);
  assert.throws(() => validateContent(sized(3, 3, 2, 0)), /cases\[0\]\.facts/);
  assert.throws(() => validateContent(sized(3, 3, 2, 5)), /cases\[0\]\.facts/);
  assert.deepEqual([schema.properties.steps.minItems, schema.properties.steps.maxItems], [2, 4]);
  assert.deepEqual([schema.properties.cases.minItems, schema.properties.cases.maxItems], [3, 4]);
  const caseRule = schema.properties.cases.items.properties;
  assert.deepEqual([caseRule.facts.minItems, caseRule.facts.maxItems], [1, 4]);
  assert.equal(caseRule.steps['x-lengthFrom'], 'steps');
  assert.equal(schema.properties.cases['x-fading'], 'steps');
  const option = schema.properties.steps.items.properties.options;
  assert.deepEqual([option.minItems, option.maxItems, option.uniqueItems], [2, 4, true]);
  assert.deepEqual([schema.properties.title.maxLength, schema.properties.context.maxLength, schema.properties.steps.items.properties.question.maxLength, option.items.maxLength, caseRule.facts.items.properties.label.maxLength, caseRule.facts.items.properties.text.maxLength, caseRule.steps.items.properties.reason.maxLength], [120, 300, 120, 80, 40, 120, 200]);
});

test('fading is checked: first case worked, last case the learner’s, each case adds steps and keeps earlier ones', () => {
  const worked = flags => {
    const copy = structuredClone(content);
    flags.forEach((row, c) => [...row].forEach((value, s) => { copy.cases[c].steps[s].worked = value === 'w'; }));
    return copy;
  };
  // Forward fading and a middle step first are the author's choice.
  assert.doesNotThrow(() => validateContent(worked(['www', 'yww', 'yyy'])));
  assert.doesNotThrow(() => validateContent(worked(['www', 'wyw', 'yyy'])));
  assert.throws(() => validateContent(worked(['wwy', 'wyy', 'yyy'])), /cases\[0\]\.steps: the first case is fully worked/);
  assert.throws(() => validateContent(worked(['www', 'wwy', 'wyy'])), /cases\[2\]\.steps: the learner does every step of the last case/);
  assert.throws(() => validateContent(worked(['www', 'www', 'yyy'])), /cases\[1\]\.steps: each case keeps/);
  const four = structuredClone(content);
  four.cases.splice(2, 0, structuredClone(content.cases[1]));
  assert.throws(() => validateContent(four), /cases\[2\]\.steps: each case keeps/, 'a repeated level adds length without fading');
  four.cases[2].steps.forEach((step, s) => { step.worked = s !== 0; });
  assert.throws(() => validateContent(four), /cases\[2\]\.steps: each case keeps/, 'a step once handed over stays with the learner');
  four.cases[2].steps.forEach((step, s) => { step.worked = s === 0; });
  assert.doesNotThrow(() => validateContent(four));
});

test('the learner answers steps in order, one case after another, and wrong answers do not block', () => {
  let state = emptyState(content);
  assert.deepEqual(state, { at: 0, picks: [[null, null, null], [null, null, null], [null, null, null]] });
  assert.equal(nextStep(content, state, 0), -1, 'the worked case has nothing to answer');
  assert.equal(reach(content, state), 1);
  assert.equal(nextStep(content, state, 1), 2);
  assert.throws(() => answer(content, state, 2, 0, 1), /next step/, 'case 3 waits for case 2');
  assert.throws(() => answer(content, state, 1, 1, 1), /next step/, 'a worked step takes no answer');
  for (const pick of [3, -1, 1.5, null]) assert.throws(() => answer(content, state, 1, 2, pick), /pick/);
  const before = structuredClone(state);
  state = answer(content, state, 1, 2, 0);
  assert.deepEqual(before, emptyState(content), 'answer returns a copy');
  assert.deepEqual(state.picks, [[null, null, null], [null, null, 0], [null, null, null]]);
  assert.throws(() => answer(content, state, 1, 2, 1), /next step/, 'a checked step is not answered again');
  assert.equal(reach(content, state), 2, 'a wrong answer still opens the next case');
  assert.throws(() => answer(content, state, 2, 1, 0), /next step/, 'step 2 waits for step 1');
  state = play([1, 0], state);
  assert.equal(nextStep(content, state, 2), 2);
  assert.deepEqual(result(content, state), { right: 2, total: 4, done: false });
  state = play([2], state);
  assert.deepEqual(result(content, state), { right: 3, total: 4, done: true });
  assert.deepEqual(result(content, play([1, 1, 0, 2])), { right: 4, total: 4, done: true });
  assert.deepEqual(result(content, play([0, 0, 1, 0])), { right: 0, total: 4, done: true });
  assert.deepEqual(result(content, emptyState(content)), { right: 0, total: 4, done: false });
});

test('move opens only cases the learner has reached', () => {
  const start = emptyState(content);
  assert.equal(move(content, start, 1).at, 1);
  assert.equal(start.at, 0, 'move returns a copy');
  for (const index of [2, 3, -1, 0.5]) assert.throws(() => move(content, start, index), /reached/);
  const second = play([1]);
  assert.equal(move(content, second, 2).at, 2);
  assert.equal(move(content, move(content, second, 2), 0).at, 0, 'the worked case stays open for reference');
});

test('validateState copies valid saved state and ignores anything else', () => {
  const saved = { at: 2, picks: [[null, null, null], [null, null, 0], [1, null, null]] };
  const restored = validateState(content, saved);
  assert.deepEqual(restored, saved);
  assert.notEqual(restored.picks[1], saved.picks[1]);
  assert.deepEqual(validateState(content, { at: 0, picks: emptyState(content).picks, extra: 1 }), emptyState(content));
  assert.deepEqual(validateState(content, { ...play([1, 1, 0, 2]), at: 2 }).at, 2);
  const empty = emptyState(content).picks;
  for (const value of [
    null, undefined, 'x', [], {}, { at: 0 }, { at: 0, picks: [] }, { at: 0, picks: [[null, null, null], [null, null, null]] },
    { at: 0, picks: [[null, null], [null, null, null], [null, null, null]] },
    { at: '0', picks: empty }, { at: 0.5, picks: empty }, { at: -1, picks: empty },
    { at: 2, picks: empty },
    { at: 0, picks: [[0, null, null], [null, null, null], [null, null, null]] },
    { at: 0, picks: [[null, null, null], [0, null, null], [null, null, null]] },
    { at: 0, picks: [[null, null, null], [null, null, 3], [null, null, null]] },
    { at: 0, picks: [[null, null, null], [null, null, '1'], [null, null, null]] },
    { at: 0, picks: [[null, null, null], [null, null, null], [1, null, null]] },
    { at: 0, picks: [[null, null, null], [null, null, 1], [null, 0, null]] },
    { at: 0, picks: [[null, null, null], [null, null, 1], [1, 2, null]] }
  ]) assert.equal(validateState(content, value), null, JSON.stringify(value));
});

test('format fills placeholders and keeps inserted text literally', () => {
  assert.equal(format('Step {number}: {answer}', { number: 2, answer: '{number} $& items' }), 'Step 2: {number} $& items');
  assert.equal(format('{missing} stays', {}), '{missing} stays');
});

test('render gives a complete page without JavaScript: every case, radio groups for the learner’s steps, answers in a disclosure', () => {
  const markup = render(content, strings.en, { id: 'pay', lang: 'en' });
  assert.match(markup, /^<section class="lp lp-finish-worked-example" data-lp-pattern="finish-worked-example" lang="en">/);
  assert.equal((markup.match(/role="status"/g) ?? []).length, 1);
  assert.match(markup, /<p class="lp-visually-hidden" role="status" aria-atomic="true"><\/p>/);
  for (const [, id] of markup.matchAll(/\sid="([^"]+)"/g)) assert.match(id, /^pay-/);
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  const cases = markup.split('data-lp-case>').slice(1);
  assert.equal(cases.length, 3);
  assert.deepEqual(cases.map(part => (part.match(/<fieldset/g) ?? []).length), [0, 1, 3]);
  assert.deepEqual(cases.map(part => (part.match(/type="radio"/g) ?? []).length), [0, 3, 8]);
  assert.deepEqual(cases.map(part => (part.match(/data-lp-fallback/g) ?? []).length), [0, 1, 1]);
  assert.deepEqual(cases.map(part => (part.match(/Done for you/g) ?? []).length), [3, 2, 0]);
  assert.deepEqual(cases.map(part => (part.match(/Your step/g) ?? []).length), [0, 1, 3]);
  assert.match(cases[0], /Case 1 of 3<span class="lp-visually-hidden">\. <\/span><span class="lp-small lp-finish-worked-example-share">All 3 steps are done for you\. Read the reason for each one\.<\/span>/);
  assert.match(cases[1], /You do 1 of the 3 steps\./);
  assert.match(cases[2], /You do all 3 steps\./);
  // The legend names the step, whose it is and the question, so a screen reader hears all three with the first radio.
  assert.match(cases[1], /<legend><span class="lp-finish-worked-example-head"><span class="lp-label">Step 3<\/span><span class="lp-visually-hidden">, <\/span><span class="lp-finish-worked-example-tag" data-lp-yours><svg[^>]*aria-hidden="true"[^]*?<span>Your step<\/span><\/span><\/span><span class="lp-visually-hidden">, <\/span><span class="lp-run-in">What do you do\?<\/span><\/legend>/);
  assert.match(cases[1], /<p class="lp-finish-worked-example-answer">Some items are missing<\/p>\s*<p>Only 8 of the 10 cartridges arrived\.<\/p>/);
  // The answers the learner has not been shown are only in the disclosure.
  const [visible, answers] = cases[1].split('data-lp-fallback');
  assert.ok(!visible.includes('You pay $320'));
  assert.match(answers, /<summary>Answers for case 2<\/summary>/);
  assert.match(answers, /Step 3: Pay only for what arrived<\/strong><p>The invoice matches the order, so you do not hold it\. You pay \$320 for the 8 cartridges that arrived\.<\/p>/);
  assert.ok(!answers.includes('Step 1:'));
  // Controls that need JavaScript start hidden.
  assert.equal((markup.match(/data-lp-step-actions hidden/g) ?? []).length, 4);
  assert.equal((markup.match(/data-lp-nav hidden/g) ?? []).length, 3);
  assert.equal((markup.match(/data-lp-feedback hidden/g) ?? []).length, 4);
  assert.equal((markup.match(/data-lp-question-error hidden/g) ?? []).length, 4);
  assert.equal((markup.match(/data-lp-result hidden/g) ?? []).length, 1);
  assert.equal((markup.match(/data-lp-body hidden/g) ?? []).length, 0);
});

test('a worked step after one of the learner’s stays out of sight until it cannot give the answer away', () => {
  const forward = structuredClone(content);
  forward.cases[1].steps.forEach((step, s) => { step.worked = s !== 0; });
  const second = render(forward, strings.en, { id: 'pay', lang: 'en' }).split('data-lp-case>')[2];
  assert.equal((second.match(/data-lp-body hidden/g) ?? []).length, 2);
  const [visible, answers] = second.split('data-lp-fallback');
  assert.ok(!visible.replace(/<div data-lp-body hidden>[^]*?<\/div>/g, '').includes('Only 8 of the 10'));
  for (const line of ['Step 1: It matches', 'Step 2: Some items are missing', 'Step 3: Pay only for what arrived']) assert.ok(answers.includes(line), line);
});

test('render escapes authored text and sets French typography', () => {
  const hostile = structuredClone(content);
  hostile.title = '<img src=x onerror=alert(1)>';
  hostile.steps[0].options[0] = '"><script>';
  hostile.cases[0].facts[0].label = '<b>';
  hostile.cases[1].steps[2].reason = '</details><script>';
  const markup = render(hostile, strings.en, { id: '"><i>', lang: 'en"><i>' });
  assert.doesNotMatch(markup, /<img|<script|<b>|<i>/);
  assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/);
  const fr = render(french, strings.fr, { id: 'payer', lang: 'fr' });
  assert.match(fr, /lang="fr"/);
  // A no-break space before ":" and "$", a narrow one before "?" and inside numbers.
  const wide = String.fromCharCode(0xa0), narrow = String.fromCharCode(0x202f);
  assert.ok(fr.includes(`Que devez-vous faire${narrow}?`));
  assert.ok(fr.includes(`total 1${narrow}700${wide}$`));
  assert.ok(fr.includes(`Étape 3${wide}: Payer seulement ce qui est arrivé`));
  assert.match(fr, /Vous faites 1 des 3 étapes\./);
  assert.match(fr, /Cas 2 sur 3/);
  assert.match(fr, /Vérifier l’étape 3/);
  assert.doesNotMatch(fr, /Done for you|Your step|Next case|Start over/);
  assert.throws(() => render({ ...content, cases: content.cases.slice(0, 2) }, strings.en, { id: 'pay', lang: 'en' }), /cases/);
});
