import test from 'node:test';
import assert from 'node:assert/strict';
import { start, turn, feedback, validateContent, validateState } from './logic.js';
import { readFile } from 'node:fs/promises';
import { BRANCHES, REPLY_LIMIT, confidenceGate } from '../../proxy/logic/03-contract.js';
import { MICHEL_REPLIES } from '../../proxy/src/demos/03-branch.js';
import { SECOND, EXAMPLES } from '../../proxy/logic/03-branch.js';
import { render, renderDebrief } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const answers = (choice, confidence) => ({ branch: { choice, confidence } });

test('default conversation feedback uses Jev gates for Perplexity', () => {
  assert.equal(feedback(answers('acknowledge', 0.6)), 'unsure');
  assert.equal(feedback(answers('acknowledge', 0.9)), 'acknowledge');
});

test('first reply records the learner move and shows Michel’s authored line', () => {
  const content = { branches: { acknowledge: { line: 'Let’s agree the plan.' } }, stageNotes: {} };
  const initial = start();
  const result = turn(content, initial, 'acknowledge', 'I changed it.');
  assert.deepEqual(initial, { node: 'opening', round: 0, history: [], end: false });
  assert.deepEqual(result.state, { node: 'acknowledge', round: 1, history: [{ branch: 'acknowledge', reply: 'I changed it.' }], end: false });
  assert.equal(result.line, 'Let’s agree the plan.');
});

test('every first and second branch completes two rounds with independent history', () => {
  for (const first of BRANCHES) for (const second of BRANCHES) {
    const initial = start();
    const one = turn(content, initial, first, 'First reply');
    assert.equal(one.line, MICHEL_REPLIES[first]);
    assert.equal(one.state.end, false);
    const two = turn(content, one.state, second, 'Second reply');
    assert.equal(two.line, content.branches[first].endings[second]);
    assert.deepEqual(two.state.history, [{ branch: first, reply: 'First reply' }, { branch: second, reply: 'Second reply' }]);
    assert.equal(two.state.node, second);
    assert.equal(two.state.round, 2);
    assert.equal(two.state.end, true);
    assert.equal(one.state.history.length, 1);
    assert.throws(() => turn(content, two.state, 'pause', 'Again'), /ended/);
    assert.deepEqual(start(), initial);
  }
  assert.equal(turn(content, turn(content, start(), 'attack', 'One').state, 'attack', 'Two').note, 'Michel leaves the meeting.');
});

test('unsure and off-script preserve each round and do not add learner bubbles', () => {
  for (const state of [start(), turn(content, start(), 'pause', 'Ten minutes?').state]) {
    for (const kind of ['unsure', 'off_script']) {
      const result = turn(content, state, kind, 'Unclear reply');
      assert.equal(result.state, state);
      assert.equal(result.line, '');
      assert.equal(result.note, kind === 'unsure' ? content.unsure : content.offScript);
    }
  }
});

test('model choices use proxy-owned inclusive gates; off-script always keeps the turn', () => {
  for (const model of ['pplx-decider-v1.1-27b', 'jev', '@cf/cloudflare/clef', '@cf/cloudflare/clef-flash']) {
    const gate = confidenceGate(model);
    for (const branch of BRANCHES) {
      assert.equal(feedback(answers(branch, gate), model), branch);
      assert.equal(feedback(answers(branch, gate - .0001), model), 'unsure');
    }
    for (const confidence of [0, gate, 1]) assert.equal(feedback(answers('off_script', confidence), model), 'off_script');
  }
  for (const value of [null, {}, { branch: null }, answers('invented', 1), answers('attack', NaN), answers('pause', 1.1), answers('defend', -.1), answers('withdraw', '1')]) assert.throws(() => feedback(value), /answers/);
});

test('saved conversation accepts coherent history and rejects planted invalid state', () => {
  const valid = { conversation: turn(content, start(), 'acknowledge', 'My reply').state, draft: 'Next reply' };
  assert.deepEqual(validateState(valid), valid);
  for (const value of [null, {}, { ...valid, draft: 'x'.repeat(1201) }, { ...valid, conversation: { ...valid.conversation, round: 2 } }, { ...valid, conversation: { ...valid.conversation, node: 'pause' } }, { ...valid, conversation: { ...valid.conversation, end: true } }, { ...valid, conversation: { ...valid.conversation, history: [{ branch: 'unknown', reply: 'x' }] } }]) assert.equal(validateState(value), null);
});

test('schema guard rejects missing, extra, empty and misidentified authored fields', () => {
  assert.doesNotThrow(() => validateContent(content));
  for (const mutate of [c => { c.setup = ''; }, c => { c.extra = true; }, c => { delete c.person.initial; }, c => { c.person.extra = true; }, c => { delete c.branches.pause; }, c => { c.branches.attack.endings.extra = 'x'; }, c => { c.examples.opening.withdraw = ''; }, c => { delete c.examples.pause; }, c => { c.stageNotes['unknown:attack'] = 'x'; }, c => { c.offScript = ''; }]) {
    const copy = structuredClone(content); mutate(copy);
    assert.throws(() => validateContent(copy), /Invalid .*\w/);
  }
  assert.equal(content.opening, MICHEL_REPLIES.opening);
  assert.deepEqual(content.examples, EXAMPLES);
  for (const branch of BRANCHES) assert.deepEqual(content.branches[branch].endings, SECOND[branch]);
});

test('bilingual server markup escapes content and provides a complete static branching script', async () => {
  const schema = JSON.parse(await readFile(new URL('./content.schema.json', import.meta.url)));
  for (const branch of BRANCHES) assert.equal(schema.$defs.exampleReplies.properties[branch].maxLength, REPLY_LIMIT);
  assert.deepEqual(Object.keys(strings.en), Object.keys(strings.fr));
  for (const lang of ['en', 'fr']) {
    const example = JSON.parse(await readFile(new URL(`./examples/${lang}.json`, import.meta.url)));
    assert.doesNotThrow(() => validateContent(example));
    const markup = render({ ...example, setup: '<script>bad</script>' }, strings[lang], { id: 'one', lang });
    assert.match(markup, /&lt;script&gt;bad&lt;\/script&gt;/);
    assert.match(markup, new RegExp(`lang="${lang}"`));
    assert.equal([...markup.matchAll(/role="status"/g)].length, 1);
    assert.equal([...markup.matchAll(/data-lp-static-end/g)].length, 25);
    assert.match(markup, /data-lp-composer hidden/);
    assert.match(markup, /data-lp-script/);
    for (const [, id] of markup.matchAll(/\sid="([^"]+)"/g)) assert.ok(id.startsWith('one-'), id);
  }
});

test('a spoken reply has no email header, and its label names the person', () => {
  const output = render(content, strings.en, { id: 't', lang: 'en' });
  assert.doesNotMatch(output, />Subject</);
  assert.match(output, /<label class="lp-visually-hidden" for="t-reply">Your reply to Michel<\/label>/);
});

test('the debrief names each distinct move once', () => {
  const twice = { history: [{ branch: 'acknowledge' }, { branch: 'acknowledge' }] };
  assert.equal(renderDebrief(content, strings.en, twice).match(/<li>/g).length, 1);
  const two = { history: [{ branch: 'defend' }, { branch: 'acknowledge' }] };
  assert.equal(renderDebrief(content, strings.en, two).match(/<li>/g).length, 2);
});


test('avatar initials accept two characters and reject a third', () => {
  const value = structuredClone(content);
  value.person.initial = 'AW'; assert.doesNotThrow(() => validateContent(value));
  for (const initial of ['Dr.', 'Dr. W']) assert.throws(() => validateContent({ ...value, person: { ...value.person, initial } }), /person.initial/);
});
