import { expect } from '@playwright/test';

export async function expectChoiceMarks(page) {
  const marks = await page.evaluate(async () => {
    const { renderChoiceMark } = await import('/lib/choice-mark.js');
    const words = { correct: 'markCorrect', wrong: 'markWrong', missed: 'markAnswer' };
    const results = [];
    for (const root of document.querySelectorAll('[data-lp-pattern]')) {
      const pattern = root.dataset.lpPattern, lang = root.lang;
      // Explain-back's Found/To add/Not sure are explanation feedback, not answer marks.
      if (pattern === 'explain-back') continue;
      const { strings } = await import(`/patterns/${pattern}/strings.js`);
      for (const row of root.querySelectorAll('.lp-choice[data-lp-mark]')) {
        const kind = row.dataset.lpMark;
        // Live-feedback's done/todo checklist progress is not an answer mark either.
        if (!Object.hasOwn(words, kind)) continue;
        const word = pattern === 'write-distractors'
          ? strings[lang][row.matches(':first-child') ? 'correctAnswer' : 'match']
          : strings[lang][words[kind]];
        const template = document.createElement('template');
        template.innerHTML = renderChoiceMark(kind, word, lang);
        results.push({
          pattern, kind,
          actual: [...row.querySelectorAll(':scope > .lp-choice-mark')].map(mark => mark.outerHTML),
          expected: [template.content.firstElementChild.outerHTML]
        });
      }
    }
    return results;
  });
  expect(marks.length, 'checked choice rows').toBeGreaterThan(0);
  for (const { pattern, kind, actual, expected } of marks) {
    expect(actual, `${pattern}: ${kind} choice mark`).toEqual(expected);
  }
}
