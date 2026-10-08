import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateContent, validateState, lookup } from './logic.js';
import { render } from './render.js';
import { strings } from './strings.js';
import { ENTRY_IDS, MATCH_GATE, faqLookup } from '../../proxy/logic/20-faq.js';
import { ENTRY_IDS as SECTION_IDS, sectionLookup } from '../../proxy/logic/21-sections.js';

const example = JSON.parse(await readFile(new URL('./examples/en.json', import.meta.url)));
const answer = (scores, ids = ENTRY_IDS, confidence = 1) => {
  const probabilities = Object.fromEntries([...ids, 'none'].map(id => [id, scores[id] ?? 0]));
  const choice = Object.keys(probabilities).sort((a, b) => probabilities[b] - probabilities[a])[0];
  return { lookup: { choice, confidence, probabilities } };
};

test('inclusive probability gates and close runner-up rule share the proxy decision owner', () => {
  assert.equal(MATCH_GATE, .35);
  for (const [scores, expected] of [
    [{ deadline: .9, none: .1 }, ['deadline']],
    [{ deadline: .55, time: .35, none: .10 }, ['deadline', 'time']],
    [{ deadline: .56, time: .35, none: .09 }, ['deadline']],
    [{ deadline: .5, time: .3499, none: .1501 }, ['deadline']],
    [{ deadline: .34, time: .33, none: .33 }, []],
    [{ none: .7, time: .3 }, []],
    [{ none: .5, time: .5 }, []]
  ]) {
    assert.deepEqual(faqLookup(answer(scores)).ids, expected);
    assert.deepEqual(lookup(example, answer(scores)).map(item => item.id), expected);
  }
  assert.deepEqual(faqLookup(answer({ deadline: .9, none: .1 }, ENTRY_IDS, .3499)), { ids: [] });
  assert.deepEqual(sectionLookup(answer({ speaking: .5, needs: .4, none: .1 }, SECTION_IDS)).ids, ['speaking', 'needs']);
});

test('malformed Choice distributions fail loudly', () => {
  const good = answer({ deadline: .9, none: .1 });
  for (const value of [null, {}, { ...good, extra: {} }, { lookup: { choice: 'deadline', confidence: 1 } }]) assert.throws(() => faqLookup(value), /Invalid/);
  for (const mutate of [a => { a.lookup.probabilities.deadline = NaN; }, a => { a.lookup.probabilities.deadline = 1.1; }, a => { a.lookup.probabilities.none = .5; }, a => { a.lookup.choice = 'help'; }, a => { a.lookup.probabilities.extra = 0; }]) {
    const bad = structuredClone(good); mutate(bad); assert.throws(() => faqLookup(bad), /Invalid/);
  }
});

test('content and browser bank guards reject planted violations', () => {
  validateContent(example);
  for (const mutate of [c => { c.extra = true; }, c => { c.kind = 'other'; }, c => { c.entries.pop(); }, c => { c.entries[0].id = 'time'; }, c => { c.entries[0].answer = ''; }, c => { c.seeds[0].author = 'Bot'; }, c => { c.seeds[0].id = c.seeds[1].id; }]) {
    const bad = structuredClone(example); mutate(bad); assert.throws(() => validateContent(bad), /Invalid/);
  }
  const saved = { questions: ['Can I study with a partner?'] };
  assert.deepEqual(validateState(saved), saved);
  for (const value of [null, {}, { questions: ['', 'x'] }, { questions: ['x'.repeat(501)] }, { questions: ['same', 'same'] }, { questions: [1] }, { questions: Array(101).fill('x') }]) assert.equal(validateState(value), null);
});

test('bilingual no-JS markup contains full FAQ, outline links and one empty status per instance', async () => {
  assert.deepEqual(Object.keys(strings.en), Object.keys(strings.fr));
  for (const lang of ['en', 'fr']) {
    const faq = JSON.parse(await readFile(new URL(`./examples/${lang}.json`, import.meta.url)));
    const sections = JSON.parse(await readFile(new URL(`./examples/${lang}-sections.json`, import.meta.url)));
    for (const content of [faq, sections]) {
      const markup = render(content, strings[lang], { id: 'one', lang });
      assert.equal([...markup.matchAll(/role="status"/g)].length, 1);
      for (const [, id] of markup.matchAll(/\sid="([^"]+)"/g)) assert.ok(id.startsWith('one-'));
      for (const entry of content.entries) assert.ok(markup.includes(entry.title));
      assert.match(markup, /data-lp-controls hidden/);
      if (content.kind === 'faq') assert.equal([...markup.matchAll(/<details/g)].length, 8);
      else for (const entry of content.entries) assert.ok(markup.includes(`href="#one-section-${entry.id}"`));
    }
    const escaped = render({ ...faq, prompt: '<script>x</script>' }, strings[lang], { id: 'one', lang });
    assert.match(escaped, /&lt;script&gt;x&lt;\/script&gt;/);
    // The course name is the only markup in the prompt, and it is escaped too.
    const course = render({ ...faq, course: '<b>x</b>' }, strings[lang], { id: 'one', lang });
    assert.match(course, /<em>&lt;b&gt;x&lt;\/b&gt;<\/em>/);
    assert.throws(() => render({ ...faq, course: undefined }, strings[lang], { id: 'one', lang }), /Invalid prompt/);
  }
});
