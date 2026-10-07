import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { plan, score, validateContent, validateState, format } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const french = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
const all = pick => Object.fromEntries(content.questions.map(q => [q.id, pick(q)]));

test('demo rules: transitive credit, direct pass precedence, lowest numeric source and author refusal', () => {
  assert.deepEqual(plan(content.sections, [4]), { rows: [
    { id: 1, title: 'Writing an agenda', action: 'take' },
    { id: 2, title: 'Roles in a meeting', action: 'credited', by: 4 },
    { id: 3, title: 'Running the discussion', action: 'credited', by: 4 },
    { id: 4, title: 'Decisions and follow-up', action: 'passed' }
  ], skip: 3 });
  assert.equal(plan(content.sections, [4, 3]).rows[1].by, 3);
  assert.equal(plan(content.sections, [4, 2]).rows[1].action, 'passed');
  assert.equal(plan(content.sections, [4, 4]).skip, 3);
  assert.equal(plan(content.sections, []).skip, 0);
  assert.equal(plan(content.sections, [1, 2, 3, 4]).skip, 4);
  assert.deepEqual(plan(content.sections, [4], false).rows.map(r => r.action), ['take', 'take', 'take', 'take']);
  const chain = structuredClone(content.sections); chain[3].requires = [3];
  assert.equal(plan(chain, [4]).rows[1].by, 4);
  assert.equal(plan([...content.sections].reverse(), [4, 3]).rows[2].by, 3);
});

test('score groups keyed answers and requires all of a section’s one or two questions', () => {
  assert.deepEqual(score(content, {}).unanswered, ['agenda', 'roles', 'discussion', 'follow-up']);
  const result = score(content, { agenda: 'attendees', roles: 'decide', discussion: 'invite', 'follow-up': 'next-meeting' });
  assert.deepEqual(result.right, ['discussion']);
  assert.deepEqual(result.wrong, ['agenda', 'roles', 'follow-up']);
  assert.deepEqual(result.passed, [3]); assert.equal(result.skip, 2);
  assert.equal(score(content, all(q => q.correct)).skip, 4);
  assert.equal(score(content, all(q => q.options.find(o => o.id !== q.correct).id)).skip, 0);
  assert.equal(score({ ...content, allowTestOut: false }, all(q => q.correct)).skip, 0);
  const two = { ...content, questions: [...content.questions, { ...content.questions[0], id: 'agenda-two' }] };
  assert.deepEqual(score(two, all(q => q.correct)).passed, [2, 3, 4]);
  assert.deepEqual(score(two, { ...all(q => q.correct), 'agenda-two': 'attendees' }).passed, [2, 3, 4]);
  assert.deepEqual(score(two, { ...all(q => q.correct), 'agenda-two': 'outcomes' }).passed, [1, 2, 3, 4]);
});

test('every content guard catches a planted violation and names its field', () => {
  assert.doesNotThrow(() => validateContent(content)); assert.doesNotThrow(() => validateContent(french));
  const bad = (mutate, field) => {
    const value = structuredClone(content); mutate(value);
    assert.throws(() => validateContent(value), e => e instanceof Error && e.message.includes(field));
  };
  for (const value of [null, [], 1]) assert.throws(() => validateContent(value), /content/);
  bad(c => c.extra = 1, 'extra');
  for (const value of ['', ' ', null, 1, undefined]) bad(c => c.title = value, 'title');
  for (const value of [null, 1, 'yes', undefined]) bad(c => c.allowTestOut = value, 'allowTestOut');
  for (const value of [null, [], 'sections', undefined]) bad(c => c.sections = value, 'sections');
  bad(c => c.sections[0] = null, 'sections[0]');
  bad(c => delete c.sections[0], 'sections[0]');
  bad(c => c.sections[0].extra = 1, 'extra');
  for (const value of [0, -1, 1.5, '1', Infinity, Number.MAX_SAFE_INTEGER + 1, undefined]) bad(c => c.sections[0].id = value, 'id');
  bad(c => c.sections[1].id = 1, 'id');
  for (const value of ['', ' ', null, 1, undefined]) bad(c => c.sections[0].title = value, 'title');
  for (const value of [null, 'requires', undefined]) bad(c => c.sections[0].requires = value, 'requires');
  for (const value of [0, 1.5, '2', 99, undefined]) bad(c => c.sections[0].requires = [value], 'requires');
  bad(c => c.sections[0].requires = [2, 2], 'requires');
  bad(c => c.sections[0].requires = [1], 'requires');
  bad(c => { c.sections[1].requires = [4]; }, 'requires');
  for (const value of [null, [], 'questions', undefined]) bad(c => c.questions = value, 'questions');
  bad(c => c.questions[0] = null, 'questions[0]'); bad(c => c.questions[0].extra = 1, 'extra');
  bad(c => delete c.questions[0], 'questions[0]');
  for (const field of ['id', 'text', 'correct', 'explanation']) {
    for (const value of ['', ' ', null, 1, undefined]) bad(c => c.questions[0][field] = value, field);
  }
  bad(c => c.questions[0].id = 'bad id', 'id'); bad(c => c.questions[1].id = 'agenda', 'id');
  for (const value of [null, 99, '1', undefined]) bad(c => c.questions[0].section = value, 'section');
  bad(c => c.questions.shift(), 'questions');
  bad(c => c.questions.push({ ...c.questions[0], id: 'two' }, { ...c.questions[0], id: 'three' }), 'questions');
  bad(c => c.questions[0].correct = 'missing', 'correct');
  for (const value of [null, [], 'options', undefined]) bad(c => c.questions[0].options = value, 'options');
  bad(c => c.questions[0].options[0] = null, 'options[0]');
  bad(c => delete c.questions[0].options[0], 'options[0]');
  bad(c => c.questions[0].options[0].extra = 1, 'extra');
  for (const field of ['id', 'text']) for (const value of ['', ' ', null, 1, undefined]) bad(c => c.questions[0].options[0][field] = value, field);
  bad(c => c.questions[0].options[0].id = 'bad id', 'id');
  bad(c => c.questions[0].options[1].id = 'attendees', 'id');
});

test('plan and score refuse invalid host input, including unknown references and inherited picks', () => {
  for (const passed of [null, '4', [99], ['4'], [undefined], Array(1)]) assert.throws(() => plan(content.sections, passed), /passed/);
  assert.throws(() => plan(content.sections, [], 'yes'), /allowTestOut/);
  assert.throws(() => plan([{ ...content.sections[0], requires: [99] }], []), /requires/);
  for (const picks of [null, [], { agenda: null }, { agenda: 1 }, { agenda: 'missing' }, { other: 'outcomes' }, { agenda: undefined }]) assert.throws(() => score(content, picks), /picks/);
  assert.equal(score(content, Object.create({ agenda: 'outcomes' })).unanswered.length, 4);
});

test('state copies valid partial and shown picks and ignores every invalid saved value', () => {
  for (const value of [null, [], {}, { picks: [], shown: false }, { picks: {}, shown: 'yes' }, { picks: {}, shown: true }, { picks: { agenda: 'missing' }, shown: false }, { picks: { other: 'outcomes' }, shown: false }, { picks: { agenda: 'outcomes' }, shown: true }, { picks: {}, shown: false, extra: 1 }]) assert.equal(validateState(content, value && !Array.isArray(value) ? { ...value, step: value.shown === true ? 5 : 0 } : value), null);
  const partial = { picks: { agenda: 'outcomes' }, shown: false, step: 2 };
  assert.deepEqual(validateState(content, partial), partial);
  const saved = { picks: all(q => q.correct), shown: true, step: 5 };
  assert.deepEqual(validateState(content, saved), saved); assert.notEqual(validateState(content, saved).picks, saved.picks);
});

test('saved step rejects out-of-range, inconsistent and disabled placement panels', () => {
  for (const step of [-1, 6, 1.5, '2', null, undefined, NaN]) {
    assert.equal(validateState(content, { picks: {}, shown: false, step }), null);
  }
  assert.equal(validateState(content, { picks: {}, shown: false, step: 5 }), null);
  assert.equal(validateState(content, { picks: all(q => q.correct), shown: true, step: 2 }), null);
  assert.equal(validateState({ ...content, allowTestOut: false }, { picks: {}, shown: false, step: 1 }), null);
  assert.deepEqual(validateState(content, { picks: {}, shown: false, step: 0 }), { picks: {}, shown: false, step: 0 });
});

test('server outline is clean, scene is shared, and Start is absent when required', () => {
  const output = render(content, strings.en, { id: 'stepper', lang: 'en' });
  for (const name of ['lp-scene', 'lp-scene-icon', 'lp-scene-title']) assert.ok(output.includes(`class="${name}"`));
  assert.ok(output.includes("What you&#39;ll cover"));
  assert.ok(output.includes('Start the check'));
  assert.equal(output.includes('To do'), false);
  assert.equal((output.match(/data-lp-panel="question"/g) || []).length, 4);
  assert.equal((output.match(/aria-hidden="true" class="lp-test-out-progress"/g) || []).length, 4);
  const required = render({ ...content, allowTestOut: false }, strings.en, { id: 'required', lang: 'en' });
  assert.equal(required.includes('data-lp-start'), false);
  assert.ok(required.includes(strings.en.required));
});

test('server HTML has scene, outline, grouped keyed questions, native answers and one empty status', () => {
  const a = render(content, strings.en, { id: 'first', lang: 'en' });
  assert.match(a, /class="lp lp-test-out"/); assert.match(a, /data-lp-pattern="test-out" lang="en"/);
  assert.doesNotMatch(a, /Placement check/); assert.match(a, /Meetings: a refresher/);
  assert.equal((a.match(/data-lp-section-status/g) || []).length, 4);
  assert.equal((a.match(/class="lp-choices"/g) || []).length, 4);
  assert.equal((a.match(/class="lp-choice"/g) || []).length, 12);
  assert.equal((a.match(/role="status"/g) || []).length, 1);
  assert.match(a, /role="status"[^>]*><\/p>/); assert.match(a, /<details[^>]*data-lp-fallback/);
  assert.match(a, /data-lp-restart hidden/); assert.match(a, /data-lp-start-actions hidden/);
  const b = render(french, strings.fr, { id: 'second', lang: 'fr' });
  const ids = [...(a + b).matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every(id => /^(first|second)-/.test(id)));
  assert.match(b, /lang="fr"/); assert.equal(b.includes('Vérification des acquis'), false);
});

test('advanced answer explanations describe course credit without claiming mastery evidence', () => {
  const en = render(content, strings.en, { id: 'en', lang: 'en' });
  const fr = render(french, strings.fr, { id: 'fr', lang: 'fr' });
  assert.ok(en.includes('Passing this section also credits Roles in a meeting.'));
  assert.ok(en.includes('Passing this section also credits Roles in a meeting and Running the discussion.'));
  assert.ok(fr.includes('Réussir cette section vous donne aussi le crédit pour la section sur les rôles en réunion.'));
  assert.ok(fr.includes('Réussir cette section vous donne aussi le crédit pour les sections sur les rôles et la discussion.'));
});

test('render escapes authored content, status templates and attributes; inserted placeholders stay literal', () => {
  const hostile = '<script>alert("x")</script> & \'quoted\' {section}';
  const c = structuredClone(content); c.title = hostile; c.sections[0].title = hostile;
  c.questions[0].text = hostile; c.questions[0].explanation = hostile; c.questions[0].options[0].text = hostile;
  const ui = Object.fromEntries(Object.keys(strings.en).map(k => [k, hostile]));
  const output = render(c, ui, { id: 'a"', lang: 'fr"' });
  assert.equal(output.includes('<script>'), false); assert.ok(output.includes('&lt;script&gt;'));
  assert.match(output, /lang="fr&quot;"/); assert.match(output, /id="a&quot;-/);
  assert.equal(format('{section} {unknown}', { section: '<b>{unknown}</b>' }), '<b>{unknown}</b> {unknown}');
});

test('bilingual strings, example identities and schema fields agree', async () => {
  assert.deepEqual(Object.keys(strings.en), Object.keys(strings.fr));
  for (const key of Object.keys(strings.en)) assert.deepEqual(strings.en[key].match(/\{\w+\}/g), strings.fr[key].match(/\{\w+\}/g));
  assert.deepEqual(content.sections.map(s => [s.id, s.requires]), french.sections.map(s => [s.id, s.requires]));
  assert.deepEqual(content.questions.map(q => [q.id, q.section, q.correct, q.options.map(o => o.id)]), french.questions.map(q => [q.id, q.section, q.correct, q.options.map(o => o.id)]));
  const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));
  assert.deepEqual(schema.required, ['title', 'allowTestOut', 'sections', 'questions']);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.questions.items.required, ['id', 'section', 'text', 'options', 'correct', 'explanation']);
});

test('owner audit: scene contains only icon and title', () => {
  for (const lang of ['en', 'fr']) {
    const markup = render(content, strings[lang], { id: 'audit', lang });
    assert.doesNotMatch(markup, /lp-scene-label/);
  }
});

test('owner audit: question carries its context and outline has no credit message', () => {
  const markup = render(content, strings.en, { id: 'audit', lang: 'en' });
  assert.doesNotMatch(markup, /data-lp-credit/);
  assert.doesNotMatch(markup, /<p class="lp-small">Writing an agenda<\/p>/);
  for (const lang of ['en', 'fr']) {
    assert.equal(Object.hasOwn(strings[lang], 'credited'), false);
    assert.equal(Object.hasOwn(strings[lang], 'creditFrom'), false);
  }
});
