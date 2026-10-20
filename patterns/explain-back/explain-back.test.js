import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { feedback, validateContent, validateState } from './logic.js';
import { MET, MISSED } from '../../proxy/logic/shared.js';
import { render } from './render.js';
import { strings } from './strings.js';

const content = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const answers = value => Object.fromEntries(['stonewalling', 'pause', 'return'].map(id => [id, { noul: value }]));

test('each idea uses the owning gate, including both boundaries', () => {
  for (const [value, mark] of [[1, 'met'], [MET, 'met'], [MET - .0001, 'unsure'], [MISSED + .0001, 'unsure'], [MISSED, 'missed'], [0, 'missed']]) {
    const result = feedback(content, answers(value));
    assert.deepEqual(result.items.map(item => item.mark), [mark, mark, mark]);
    assert.equal(result.count, mark === 'met' ? 3 : 0);
    assert.equal(result.allFound, mark === 'met');
    for (const item of result.items) assert.equal(item.text, content.ideas.find(idea => idea.id === item.id)[mark]);
  }
  const partial = feedback(content, { stonewalling: { noul: 1 }, pause: { noul: 0 }, return: { noul: .5 } });
  assert.equal(partial.count, 1);
  assert.deepEqual(partial.items.map(item => item.mark), ['met', 'missed', 'unsure']);
});

test('invalid or missing model answers fail rather than inventing feedback', () => {
  for (const value of [null, {}, { stonewalling: { noul: 2 } }, answers(NaN), answers('1'), answers(-.1)]) {
    assert.throws(() => feedback(content, value), /answers/);
  }
});

test('content guard rejects unknown fields, wrong identities and missing authored lines', () => {
  assert.doesNotThrow(() => validateContent(content));
  for (const mutate of [c => { c.extra = true; }, c => { c.task = ''; }, c => { c.ideas.pop(); }, c => { c.ideas[0].id = 'pause'; }, c => { c.ideas[0].unsure = ''; }, c => { c.ideas[0].extra = true; }]) {
    const copy = structuredClone(content); mutate(copy);
    assert.throws(() => validateContent(copy), /Invalid/);
  }
});

test('saved drafts and ticks validate through the interface', () => {
  const saved = { answer: 'Draft', ticked: ['pause'] };
  assert.deepEqual(validateState(saved), saved);
  assert.notEqual(validateState(saved).ticked, saved.ticked);
  for (const value of [null, {}, { answer: 'x', ticked: ['unknown'] }, { answer: 'x', ticked: ['pause', 'pause'] }, { answer: 'x'.repeat(1501), ticked: [] }]) assert.equal(validateState(value), null);
});

test('server HTML is escaped, prefixed, bilingual and usable without JavaScript', async () => {
  for (const lang of ['en', 'fr']) {
    const example = JSON.parse(await readFile(new URL(`./examples/${lang}.json`, import.meta.url)));
    const markup = render({ ...example, task: '<script>bad</script>' }, strings[lang], { id: 'one', lang });
    assert.match(markup, /&lt;script&gt;bad&lt;\/script&gt;/);
    assert.match(markup, new RegExp(`lang="${lang}"`));
    assert.equal([...markup.matchAll(/role="status"/g)].length, 1);
    assert.equal([...markup.matchAll(/type="checkbox"/g)].length, 3);
    assert.match(markup, /data-lp-fallback/);
    for (const [, id] of markup.matchAll(/\sid="([^"]+)"/g)) assert.ok(id.startsWith('one-'), id);
  }
});

test('the return and stonewalling lines say only what the learner wrote', async () => {
  const fr = JSON.parse(await readFile(new URL('./examples/fr.json', import.meta.url)));
  const line = (c, id, mark) => c.ideas.find(idea => idea.id === id)[mark];
  assert.equal(line(content, 'return', 'unsure'), "You said to come back. Say when, too: agree on a time so they aren't left waiting.");
  assert.equal(line(content, 'stonewalling', 'met'), 'You explained that stonewalling means going silent or withdrawing.');
  assert.equal(line(fr, 'return', 'unsure'), "Vous avez dit de revenir. Précisez aussi quand : convenez d'un moment pour que l'autre personne ne reste pas à attendre.");
  assert.equal(line(fr, 'stonewalling', 'met'), "Vous avez expliqué que l'évitement consiste à se taire ou à se retirer.");
});
