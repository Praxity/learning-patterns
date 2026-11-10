import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { openHelp, progress, start, summarize, tryFirst, tryFollowUp, validateContent, validateState } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));
/** Apply steps in order: an option id checks the first question, 'help' opens the next help step. */
const play = (...steps) => steps.reduce((state, step) => step === 'help' ? openHelp(content, state) : tryFirst(content, state, step), start());

// Mirror only the schema keywords used here, including the documented cross-field annotations.
function matches(value, rule) {
  if (rule.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (rule.required.some(key => !Object.hasOwn(value, key))) return false;
    if (Object.keys(value).some(key => !Object.hasOwn(rule.properties, key))) return false;
    if (!Object.entries(rule.properties).every(([key, child]) => !Object.hasOwn(value, key) || matches(value[key], child))) return false;
    if (rule['x-optionReference'] && !value.options.some(option => option.id === value.correct)) return false;
    return !rule.properties.options?.['x-feedbackUnlessCorrect'] || value.options.every(option => Object.hasOwn(option, 'feedback') !== (option.id === value.correct));
  }
  if (rule.type === 'array') {
    if (!Array.isArray(value) || value.length < rule.minItems || value.length > rule.maxItems) return false;
    if (rule['x-uniqueBy'] && new Set(value.map(item => item?.id)).size !== value.length) return false;
    return value.every(item => matches(item, rule.items));
  }
  return typeof value === 'string' && value.trim().length >= rule.minLength && [...value].length <= rule.maxLength && (!rule.pattern || new RegExp(rule.pattern).test(value));
}

test('the examples share ids and answers, and stay short', () => {
  assert.equal(content.title, 'Find the shipping deadline');
  assert.equal(french.title, 'Trouver la date limite d’expédition');
  assert.deepEqual(french.options.map(o => o.id), content.options.map(o => o.id));
  assert.deepEqual(french.followUp.options.map(o => o.id), content.followUp.options.map(o => o.id));
  assert.deepEqual([french.correct, french.followUp.correct], [content.correct, content.followUp.correct]);
  assert.deepEqual([content.correct, content.followUp.correct], ['wednesday', 'tuesday']);
  assert.equal(french.hints.length, content.hints.length);
  for (const example of [content, french]) {
    assert.equal(example.options.length, 4);
    assert.equal(example.hints.length, 2);
    // The setup is at most two sentences, and no hint names the answer.
    assert.equal(example.context.split(/(?<=\.) /).length, 2);
    const answer = example.options.find(o => o.id === example.correct).text;
    for (const hint of example.hints) assert.ok(!hint.toLowerCase().includes(answer.toLowerCase()), hint);
    for (const option of example.options) if (option.feedback) assert.ok(!option.feedback.toLowerCase().includes(answer.toLowerCase()), option.feedback);
    assert.ok(example.worked.toLowerCase().includes(answer.toLowerCase()));
  }
});

test('content validator and schema agree, with planted violations for every guard', () => {
  const [wrong, , right] = content.options;
  const fixtures = [[content, true], [french, true], [{ ...content, context: undefined }, true]];
  delete fixtures[2][0].context;
  fixtures.push([{ ...content, options: content.options.slice(0, 3) }, true]);
  fixtures.push([{ ...content, hints: ['One hint'] }, true], [{ ...content, hints: ['One', 'Two', 'Three'] }, true]);
  fixtures.push([{ ...content, followUp: { ...content.followUp, options: content.followUp.options.slice(1, 3) } }, true]);
  const bad = (value, field) => fixtures.push([value, false, field]);
  bad(null, 'content'); bad([], 'content'); bad({ ...content, extra: '' }, 'extra');
  for (const field of ['title', 'question', 'worked']) for (const value of ['', ' ', null, 3, undefined]) bad({ ...content, [field]: value }, field);
  for (const value of ['', ' ', null, 3]) bad({ ...content, context: value }, 'context');
  for (const value of [[], null, 'options', undefined, content.options.slice(0, 2), [...content.options, { id: 'saturday', text: 'Saturday', feedback: 'Closed.' }]]) bad({ ...content, options: value }, 'options');
  bad({ ...content, options: [null, wrong, right] }, 'options[0]');
  bad({ ...content, options: [{ ...wrong, extra: 1 }, right, content.options[3]] }, 'extra');
  for (const field of ['id', 'text']) for (const value of ['', null, 3, undefined]) bad({ ...content, options: [{ ...wrong, [field]: value }, right, content.options[3]] }, field);
  bad({ ...content, options: [{ ...wrong, id: 'bad id' }, right, content.options[3]] }, 'id');
  bad({ ...content, options: [wrong, wrong, right] }, 'id');
  for (const value of ['missing', '', null, undefined]) bad({ ...content, correct: value }, 'correct');
  // Every wrong option needs its reason, and the correct option takes none.
  for (const value of ['', ' ', null, 3]) bad({ ...content, options: [{ ...wrong, feedback: value }, right, content.options[3]] }, 'options[0].feedback');
  bad({ ...content, options: [{ id: wrong.id, text: wrong.text }, right, content.options[3]] }, 'options[0].feedback');
  bad({ ...content, options: [wrong, { ...right, feedback: 'Yes.' }, content.options[3]] }, 'options[1].feedback');
  for (const value of [[], null, 'hints', undefined, ['1', '2', '3', '4']]) bad({ ...content, hints: value }, 'hints');
  for (const value of ['', ' ', null, 3]) bad({ ...content, hints: ['A nudge', value] }, 'hints[1]');
  for (const value of [null, [], 'followUp', undefined]) bad({ ...content, followUp: value }, 'followUp');
  const followUp = value => ({ ...content, followUp: { ...content.followUp, ...value } });
  bad(followUp({ extra: 1 }), 'followUp.extra');
  for (const field of ['question', 'explanation']) for (const value of ['', ' ', null, 3, undefined]) bad(followUp({ [field]: value }), `followUp.${field}`);
  for (const value of [[], null, undefined, content.followUp.options.slice(0, 1), [...content.followUp.options, { id: 'thursday', text: 'Thursday' }]]) bad(followUp({ options: value }), 'followUp.options');
  bad(followUp({ options: [{ ...content.followUp.options[0], feedback: 'No.' }, ...content.followUp.options.slice(1)] }), 'followUp.options[0].feedback');
  bad(followUp({ options: [content.followUp.options[2], content.followUp.options[2]] }), 'followUp.options[1].id');
  for (const value of ['missing', null, undefined]) bad(followUp({ correct: value }), 'followUp.correct');
  for (const [value, valid, field] of fixtures) {
    assert.equal(matches(value, schema), valid, `schema: ${field}`);
    if (valid) assert.doesNotThrow(() => validateContent(value));
    else assert.throws(() => validateContent(value), error => error instanceof Error && error.message.includes(field), field);
  }
});

test('a wrong try closes that option and leaves the question open; the right answer solves it', () => {
  assert.deepEqual(start(), { tries: [], opened: 0, followUp: null });
  assert.deepEqual(progress(content, start()), { first: 'open', tries: 0, hints: 0, next: 'hint', gated: false, followUp: null, done: false });
  const one = play('tuesday');
  assert.deepEqual(one, { tries: ['tuesday'], opened: 0, followUp: null });
  assert.equal(progress(content, one).first, 'open');
  // Checking the same wrong option again is refused, so it can never count as another try.
  assert.throws(() => tryFirst(content, one, 'tuesday'), /Invalid try/);
  assert.throws(() => tryFirst(content, one, 'saturday'), /Invalid try/);
  const solved = tryFirst(content, one, 'wednesday');
  assert.deepEqual(progress(content, solved), { first: 'solved', tries: 2, hints: 0, next: null, gated: false, followUp: null, done: false });
  assert.throws(() => tryFirst(content, solved, 'monday'), /closed/);
  assert.throws(() => openHelp(content, solved), /closed/);
  // Transitions return new states and leave the old one alone.
  assert.deepEqual(one, { tries: ['tuesday'], opened: 0, followUp: null });
});

test('hints open in order at any time; the worked answer waits for one checked answer and ends the question', () => {
  const hinted = play('help', 'help');
  assert.deepEqual(progress(content, hinted), { first: 'open', tries: 0, hints: 2, next: 'worked', gated: true, followUp: null, done: false });
  assert.throws(() => openHelp(content, hinted), /after one checked answer/);
  const tried = tryFirst(content, hinted, 'monday');
  assert.deepEqual(progress(content, tried), { first: 'open', tries: 1, hints: 2, next: 'worked', gated: false, followUp: null, done: false });
  const shown = openHelp(content, tried);
  assert.deepEqual(shown, { tries: ['monday'], opened: 3, followUp: null });
  assert.deepEqual(progress(content, shown), { first: 'shown', tries: 1, hints: 2, next: null, gated: false, followUp: null, done: false });
  assert.throws(() => tryFirst(content, shown, 'wednesday'), /closed/);
  assert.throws(() => openHelp(content, shown), /closed/);
  // One hint then the right answer: the hint count is what the learner opened.
  assert.deepEqual(progress(content, play('help', 'wednesday')), { first: 'solved', tries: 1, hints: 1, next: null, gated: false, followUp: null, done: false });
});

test('when only the correct option is left, the question ends with the worked answer shown', () => {
  const two = play('monday', 'tuesday');
  assert.equal(progress(content, two).first, 'open');
  const out = tryFirst(content, two, 'thursday');
  assert.deepEqual(progress(content, out), { first: 'shown', tries: 3, hints: 0, next: null, gated: false, followUp: null, done: false });
  assert.throws(() => tryFirst(content, out, 'wednesday'), /closed/);
  // With three options the second wrong try is the last.
  const three = { ...content, options: content.options.slice(0, 3) };
  assert.equal(progress(three, tryFirst(three, tryFirst(three, start(), 'monday'), 'tuesday')).first, 'shown');
  // The correct option on the last possible try still counts as solved.
  assert.equal(progress(content, play('monday', 'tuesday', 'wednesday')).first, 'solved');
});

test('the question without hints opens when the first one ends and takes one answer', () => {
  assert.throws(() => tryFollowUp(content, play('monday'), 'tuesday'), /not open/);
  const solved = play('wednesday');
  assert.throws(() => tryFollowUp(content, solved, 'thursday'), /Invalid follow-up answer/);
  const right = tryFollowUp(content, solved, 'tuesday');
  assert.deepEqual(progress(content, right), { first: 'solved', tries: 1, hints: 0, next: null, gated: false, followUp: 'right', done: true });
  assert.throws(() => tryFollowUp(content, right, 'monday'), /not open/);
  assert.equal(progress(content, tryFollowUp(content, solved, 'monday')).followUp, 'wrong');
});

test('the closing sentence gives tries and hints for the first question and the unaided result', () => {
  const end = (state, option) => summarize(content, tryFollowUp(content, state, option), strings.en);
  assert.equal(end(play('wednesday'), 'tuesday'), 'You answered the first question correctly in 1 try with no hints, then answered the question without hints correctly.');
  assert.equal(end(play('monday', 'help', 'wednesday'), 'monday'), 'You answered the first question correctly in 2 tries with 1 hint, then answered the question without hints incorrectly.');
  assert.equal(end(play('help', 'monday', 'help', 'tuesday', 'wednesday'), 'tuesday'), 'You answered the first question correctly in 3 tries with 2 hints, then answered the question without hints correctly.');
  assert.equal(end(play('help', 'help', 'thursday', 'help'), 'tuesday'), 'You saw the worked answer to the first question after 1 try, then answered the question without hints correctly.');
  assert.equal(end(play('monday', 'tuesday', 'thursday'), 'friday'), 'You saw the worked answer to the first question after 3 tries, then answered the question without hints incorrectly.');
  const fin = (state, option) => summarize(french, tryFollowUp(french, state, option), strings.fr);
  assert.equal(fin(play('wednesday'), 'tuesday'), 'Vous avez répondu correctement à la première question en 1 essai sans indice, puis vous avez répondu correctement à la question sans indice.');
  assert.equal(fin(play('monday', 'help', 'help', 'wednesday'), 'monday'), 'Vous avez répondu correctement à la première question en 2 essais avec 2 indices, puis vous avez répondu incorrectement à la question sans indice.');
  assert.equal(fin(play('monday', 'help', 'help', 'help'), 'tuesday'), 'Vous avez vu la solution détaillée de la première question après 1 essai, puis vous avez répondu correctement à la question sans indice.');
  assert.throws(() => summarize(content, play('wednesday'), strings.en), /No summary/);
});

test('every state a learner can reach has a complete sentence, whatever the option and hint counts', () => {
  // The gallery prototype read "Right on your undefined try" after a fifth check.
  for (const options of [content.options.slice(0, 3), content.options]) for (const hints of [['a'], ['a', 'b'], ['a', 'b', 'c']]) {
    const sample = { ...content, options, hints };
    const walk = state => {
      const now = progress(sample, state);
      if (now.first !== 'open') {
        for (const option of sample.followUp.options) for (const lang of ['en', 'fr']) {
          const sentence = summarize(sample, tryFollowUp(sample, state, option.id), strings[lang]);
          assert.doesNotMatch(sentence, /undefined|NaN|[{}]/);
          assert.ok(now.tries >= 1 && now.tries <= options.length - 1, sentence);
        }
        return;
      }
      if (!now.gated) walk(openHelp(sample, state));
      for (const option of options) if (!state.tries.includes(option.id)) walk(tryFirst(sample, state, option.id));
    };
    walk(start());
  }
});

test('saved state is copied when the learner could have reached it, and ignored otherwise', () => {
  const valid = [
    start(), play('help'), play('help', 'help'), play('tuesday'), play('tuesday', 'help', 'help', 'help'), play('monday', 'tuesday', 'thursday'),
    tryFollowUp(content, play('wednesday'), 'friday'), tryFollowUp(content, play('help', 'monday', 'help', 'help'), 'tuesday')
  ];
  for (const value of valid) {
    const copy = validateState(content, value);
    assert.deepEqual(copy, value);
    assert.notEqual(copy.tries, value.tries);
  }
  const invalid = [
    null, [], 'state', {}, { tries: [], opened: 0 }, { tries: [], opened: 0, followUp: null, extra: 1 },
    { tries: 'monday', opened: 0, followUp: null }, { tries: ['saturday'], opened: 0, followUp: null }, { tries: [3], opened: 0, followUp: null },
    { tries: ['monday', 'monday'], opened: 0, followUp: null },
    // Nothing follows the right answer, the worked answer or the last wrong option.
    { tries: ['wednesday', 'monday'], opened: 0, followUp: null },
    { tries: ['monday', 'tuesday', 'thursday', 'wednesday'], opened: 0, followUp: null },
    { tries: ['wednesday'], opened: 3, followUp: null },
    { tries: ['monday', 'tuesday', 'thursday'], opened: 3, followUp: null },
    // The worked answer needs a checked answer.
    { tries: [], opened: 3, followUp: null },
    { tries: [], opened: -1, followUp: null }, { tries: [], opened: 4, followUp: null }, { tries: [], opened: 1.5, followUp: null }, { tries: [], opened: '1', followUp: null },
    // The second question needs the first to have ended, and an option of its own.
    { tries: ['monday'], opened: 0, followUp: 'tuesday' }, { tries: ['wednesday'], opened: 0, followUp: 'thursday' }, { tries: ['wednesday'], opened: 0, followUp: 2 }
  ];
  for (const value of invalid) assert.equal(validateState(content, value), null, JSON.stringify(value));
});

test('render escapes text and attributes; ids and radio groups are instance-specific', () => {
  const hostile = '<script>alert("x")</script> & \'quoted\'';
  const value = {
    ...content, title: hostile, context: hostile, question: hostile, worked: hostile, hints: [hostile],
    options: content.options.map(o => ({ ...o, text: hostile, ...(o.feedback ? { feedback: hostile } : {}) })),
    followUp: { ...content.followUp, question: hostile, explanation: hostile, options: content.followUp.options.map(o => ({ ...o, text: hostile })) }
  };
  const output = render(value, Object.fromEntries(Object.keys(strings.en).map(key => [key, hostile])), { id: 'a"b', lang: 'en"x' });
  assert.doesNotMatch(output, /<script|"x"|'quoted'/);
  assert.match(output, /lang="en&quot;x"/);
  assert.match(output, /id="a&quot;b-first"/);
  const one = render(content, strings.en, { id: 'one', lang: 'en' }), two = render(content, strings.en, { id: 'two', lang: 'en' });
  const ids = markup => [...markup.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set([...ids(one), ...ids(two)]).size, ids(one).length * 2);
  assert.deepEqual([...new Set([...one.matchAll(/ name="([^"]+)"/g)].map(match => match[1]))], ['one-first', 'one-follow-up']);
  for (const [, target] of one.matchAll(/ for="([^"]+)"/g)) assert.ok(ids(one).includes(target));
  assert.throws(() => render({ ...content, hints: [] }, strings.en, { id: 'x', lang: 'en' }), /hints/);
});

for (const [lang, example] of [['en', content], ['fr', french]]) {
  test(`server HTML works without JavaScript: both questions, hints and answers behind closed disclosures (${lang})`, () => {
    const s = strings[lang], output = render(example, s, { id: 'quiz', lang });
    assert.match(output, new RegExp(`^<section class="lp lp-hint-ladder" data-lp-pattern="hint-ladder" lang="${lang}">`));
    // No scene bar: the title, the context, then the question as the group's legend.
    assert.doesNotMatch(output, /lp-scene/);
    assert.ok(output.indexOf('<h2 class="lp-heading">') < output.indexOf('<p class="lp-context">'));
    assert.ok(output.indexOf('<p class="lp-context">') < output.indexOf('<fieldset'));
    assert.equal((output.match(/<fieldset/g) || []).length, 2);
    assert.equal((output.match(/type="radio"/g) || []).length, 8);
    assert.doesNotMatch(output, /<input[^>]*(checked|disabled)/);
    // Buttons need JavaScript, so they start hidden, and so does everything a check or hint reveals.
    assert.equal((output.match(/<button[^>]*data-lp-(check|hint)[^>]* hidden>/g) || []).length, 3);
    assert.equal((output.match(/data-lp-reason hidden>/g) || []).length, 3);
    assert.match(output, /<ol class="lp-hint-ladder-steps" role="list" data-lp-steps hidden>/);
    assert.equal((output.match(/<li tabindex="-1" hidden>/g) || []).length, 3);
    assert.match(output, /data-lp-gate hidden>/); assert.match(output, /data-lp-feedback hidden>/); assert.match(output, /data-lp-result hidden>/);
    // The follow-up question is on the page, and nothing is open until the learner opens it.
    assert.match(output, /<div class="lp-section" data-lp-follow-up>/);
    assert.equal((output.match(/<details class="lp-details"/g) || []).length, 4);
    assert.doesNotMatch(output, /<details[^>]* open/);
    const summaries = [...output.matchAll(/<summary>(.*?)<\/summary>/g)].map(match => match[1].replace(/ /g, ' '));
    assert.deepEqual(summaries, lang === 'en' ? ['Hint 1 of 2', 'Hint 2 of 2', 'Worked answer', 'Show the answer'] : ['Indice 1 sur 2', 'Indice 2 sur 2', 'Solution détaillée', 'Afficher la réponse']);
    assert.match(output.replace(/ /g, ' '), lang === 'en' ? /<p>Correct answer: Wednesday\.<\/p>/ : /<p>Bonne réponse : Mercredi\.<\/p>/);
    assert.match(output.replace(/ /g, ' '), lang === 'en' ? /<p>Correct answer: Tuesday\.<\/p>/ : /<p>Bonne réponse : Mardi\.<\/p>/);
    // One empty status region, and icons that stay out of the accessibility tree.
    assert.equal((output.match(/role="status"/g) || []).length, 1);
    assert.match(output, /<p class="lp-visually-hidden" role="status" aria-atomic="true"><\/p>/);
    for (const [svg] of output.matchAll(/<svg[^>]*>/g)) assert.match(svg, /aria-hidden="true"/);
  });
}

test('English and French strings have the same keys, and French uses a no-break space before a colon', () => {
  assert.deepEqual(Object.keys(strings.fr), Object.keys(strings.en));
  for (const lang of ['en', 'fr']) for (const [key, value] of Object.entries(strings[lang])) assert.ok(value.trim(), `${lang}.${key}`);
  const output = render(french, strings.fr, { id: 'quiz', lang: 'fr' });
  assert.match(output, /Bonne réponse : Mercredi\./);
  assert.match(output, /être expédiée \?/);
  assert.doesNotMatch(render(content, strings.en, { id: 'quiz', lang: 'en' }), / /);
});
