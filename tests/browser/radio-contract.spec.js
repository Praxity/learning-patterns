import { readFile } from 'node:fs/promises';
import { bindRadioContract } from './contracts/radio-group-runner.js';
import { strings as dontKnow } from '../../patterns/dont-know/strings.js';
import { strings as testOut } from '../../patterns/test-out/strings.js';

for (const pattern of ['dont-know', 'test-out']) {
  const cases = [];
  for (const lang of ['en', 'fr']) {
    const content = JSON.parse(await readFile(new URL(`../../patterns/${pattern}/examples/${lang}.json`, import.meta.url)));
    for (const [index, question] of content.questions.entries()) {
      for (const selected of [null, 1]) cases.push({
        name: `${lang}, question ${index + 1}, ${selected === null ? 'unselected' : 'selected'}`,
        async load(page, js) {
          await page.goto(`/${pattern}/${lang}.html`);
          if (js) await page.waitForFunction(() => window.lpReady);
          if (js && pattern === 'test-out') {
            await page.getByRole('button', { name: testOut[lang].start, exact: true }).click();
            for (let i = 0; i < index; i++) {
              await page.getByRole('radio').first().check();
              await page.getByRole('button', { name: testOut[lang].next, exact: true }).click();
            }
          }
          const legend = pattern === 'dont-know'
            ? dontKnow[lang].questionNumber.replace('{number}', index + 1).replace('{total}', content.questions.length) + ', ' + question.text
            : question.text;
          const group = page.getByRole('group', { name: legend, exact: true });
          if (selected !== null) await group.getByRole('radio').nth(selected).check();
          return { group, legend, selected, names: [
            ...question.options.map(option => option.text),
            ...(pattern === 'dont-know' ? [dontKnow[lang].unknown] : [])
          ] };
        }
      });
    }
  }
  bindRadioContract({ name: pattern, cases });
}
