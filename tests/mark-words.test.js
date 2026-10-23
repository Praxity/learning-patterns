import { test } from 'node:test';
import assert from 'node:assert/strict';

// One set of answer marks across patterns (owner, 2026-10-22): a chosen correct answer, a chosen
// incorrect answer, and a correct answer the learner didn't choose. Explanations go in the feedback
// text, never in the mark.
const MARKS = {
  en: { markCorrect: 'Correct', markWrong: 'Incorrect', markAnswer: 'Correct answer' },
  fr: { markCorrect: 'Correct', markWrong: 'Incorrect', markAnswer: 'Bonne réponse' }
};

for (const pattern of ['dont-know', 'highlight', 'test-out']) {
  test(`${pattern} marks answers with the shared words in English and French`, async () => {
    const { strings } = await import(`../patterns/${pattern}/strings.js`);
    for (const lang of ['en', 'fr']) {
      const marks = Object.fromEntries(Object.keys(MARKS[lang]).map(key => [key, strings[lang][key]]));
      assert.deepEqual(marks, MARKS[lang]);
    }
  });
}
