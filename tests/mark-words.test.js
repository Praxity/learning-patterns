import { test } from 'node:test';
import assert from 'node:assert/strict';

const MARKS = {
  en: { markCorrect: 'Correct', markWrong: 'Incorrect', markAnswer: 'Correct answer' },
  fr: { markCorrect: 'Correct', markWrong: 'Incorrect', markAnswer: 'Bonne réponse' }
};

for (const pattern of ['answer-with-confidence', 'change-one-detail', 'dont-know', 'highlight', 'hint-ladder', 'mistake-recover', 'sort-by-principle', 'test-out', 'which-is-better']) {
  test(`${pattern} marks answers with the shared words in English and French`, async () => {
    const { strings } = await import(`../patterns/${pattern}/strings.js`);
    for (const lang of ['en', 'fr']) {
      const marks = Object.fromEntries(Object.keys(MARKS[lang]).map(key => [key, strings[lang][key]]));
      assert.deepEqual(marks, MARKS[lang]);
    }
  });
}
