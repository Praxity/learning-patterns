import { test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { startSession } from './session.js';

const patterns = ['dont-know', 'first-answer', 'formats', 'highlight', 'retrieval-sheet', 'review-prompts', 'self-check', 'test-out', 'write-distractors'];
for (const pattern of patterns) for (const lang of ['en', 'fr']) {
  test(`${pattern} ${lang}`, async ({ page, browser }, info) => {
    await page.goto(`/${pattern}/${lang}.html`);
    await page.waitForFunction(() => window.lpReady);
    await writeFile(info.outputPath('browser-version.txt'), browser.version());
    const content = JSON.parse(await readFile(new URL(`../../patterns/${pattern}/examples/${lang}.json`, import.meta.url), 'utf8'));
    const s = await startSession(page, info);
    try {
      await s.observe(); await s.enter();
      for (let i = 0; i < 8; i++) await s.next(`Arrival instructions and labels ${i + 1}`);
      await s.snapshot('arrival');
      await journey(s, page, pattern, lang, content);
      await s.snapshot('result');
      await s.read('Local feedback and closing summary');
      await writeFile(info.outputPath('journey-result.json'), JSON.stringify({ complete: true, pattern, lang }));
    } catch (error) {
      // A page or navigation finding is evidence, not a CI assertion failure.
      await writeFile(info.outputPath('journey-result.json'), JSON.stringify({ complete: false, pattern, lang, error: error.stack }));
      await s.snapshot('blocked');
      console.error(`${pattern} ${lang}: ${error.stack}`);
    } finally { await s.stop(); }
  });
}

async function journey(s, page, pattern, lang, content) {
  async function choose(inputs, index, label, inspect = false) {
    await s.seek(`[id="${await inputs.first().getAttribute('id')}"]`, label);
    await s.key('Space', `${label}: select A`);
    if (inspect) for (let i = 1; i < await inputs.count(); i++) await s.key('ArrowDown', `${label}: option ${i + 1}`);
    const active = await inputs.evaluateAll(elements => elements.indexOf(document.activeElement));
    if (active < 0) throw new Error(`${label}: radio focus lost`);
    const distance = (index - active + await inputs.count()) % await inputs.count();
    for (let i = 0; i < distance; i++) await s.key('ArrowDown', `${label}: choose answer ${i + 1}`);
    await s.key('Space', `${label}: confirm`);
  }
  if (pattern === 'dont-know') {
    await s.activate('[data-lp-check]', 'Incomplete submit'); await s.snapshot('incomplete');
    for (let q = 0; q < content.questions.length; q++) {
      const inputs = page.locator('fieldset').nth(q).locator('input');
      const index = q === 1 ? 0 : q === 2 ? await inputs.count() - 1 : content.questions[q].options.findIndex(option => option.id === content.questions[q].correct);
      await choose(inputs, index, `Question ${q + 1}`, true);
    }
    await s.activate('[data-lp-check]', 'Submit mixed right wrong and uncertain answers');
    await s.snapshot('mixed'); await s.read('Mixed answer local feedback');
    await s.activate('[data-lp-restart]', 'Start over');
    for (let q = 0; q < content.questions.length; q++) await choose(page.locator('fieldset').nth(q).locator('input'), content.questions[q].options.findIndex(option => option.id === content.questions[q].correct), `Correct question ${q + 1}`);
    await s.activate('[data-lp-check]', 'Submit all correct answers');
  } else if (pattern === 'self-check') {
    await s.activate('[data-lp-check]', 'Empty answer submit'); await s.snapshot('incomplete');
    await s.seek('textarea', 'Answer field');
    await s.type(lang === 'fr' ? 'Bonjour Sam, les données sont arrivées tard. Puis-je remettre le rapport demain?' : 'Hi Sam, the data arrived late. Could I submit the report tomorrow?', 'Write answer');
    await s.activate('[data-lp-check]', 'Check answer');
    const boxes = page.locator('input[type="checkbox"]');
    for (let i = 0; i < await boxes.count(); i++) {
      await s.seek(`[id="${await boxes.nth(i).getAttribute('id')}"]`, `Checklist ${i + 1}`);
      if (i === 0) await s.key('Space', 'Include first part');
    }
    await s.activate('[data-lp-show]', 'Submit partial checklist'); await s.snapshot('partial');
    await s.read('Partial checklist local hints and model');
    for (let i = 0; i < await boxes.count(); i++) {
      await s.seek(`[id="${await boxes.nth(i).getAttribute('id')}"]`, `Checklist ${i + 1} revisit`);
      if (!await boxes.nth(i).isChecked()) await s.key('Space', `Include part ${i + 1}`);
    }
    await s.activate('[data-lp-show]', 'Submit complete checklist');
  } else if (pattern === 'first-answer') {
    await s.activate('[data-lp-save-first]', 'Blank first answer submit'); await s.snapshot('incomplete');
    await s.seek('[data-lp-first-input]', 'First answer');
    await s.type(lang === 'fr' ? "Arrêtez de m'interrompre." : 'Stop interrupting me.', 'Write first answer');
    await s.activate('[data-lp-save-first]', 'Save first answer');
    await s.activate('[data-lp-skip]', 'Skip to end');
    await s.activate('[data-lp-compare]', 'Blank current answer submit');
    await s.seek('[data-lp-now-input]', 'Current answer');
    await s.type(lang === 'fr' ? 'Puis-je finir mon idée avant de vous écouter?' : 'Can I finish my thought, then hear your view?', 'Write current answer');
    await s.activate('[data-lp-compare]', 'Compare answers');
    for (const box of await page.locator('input[type="checkbox"]').all()) {
      await s.seek(`[id="${await box.getAttribute('id')}"]`, 'Improvement checkbox'); await s.key('Space', 'Tick improvement');
    }
  } else if (pattern === 'highlight') {
    await s.seek('[data-lp-chunk]', 'First passage chunk');
    await s.key('Space', 'Mark wrong passage'); await s.key('Tab', 'Next passage at limit');
    await s.key('Space', 'Attempt second mark at limit'); await s.snapshot('limit');
    await s.activate('[data-lp-check]', 'Check wrong mark'); await s.snapshot('partial');
    await s.read('Wrong mark local feedback'); await s.activate('[data-lp-restart]', 'Start over');
    for (const chunk of content.paragraphs.flat()) {
      await s.seek(`[data-lp-chunk="${chunk.id}"]`, `Passage ${chunk.id}`);
      if (chunk.key) await s.key('Space', 'Mark correct evidence');
    }
    await s.activate('[data-lp-check]', 'Check correct mark');
  } else if (pattern === 'review-prompts') {
    await s.activate('[data-lp-commit]', 'Reveal recalled answer');
    await s.activate('[data-lp-result="forgot"]', 'Rate forgot'); await s.snapshot('forgot');
    await s.activate('[data-lp-result="remembered"]', 'Rate remembered');
  } else if (pattern === 'retrieval-sheet') {
    await s.seek('[data-lp-date]', 'Date field'); await s.key('ArrowUp', 'Change date segment');
    await s.key('Tab', 'Leave date'); await s.seek('[data-lp-tab="front"]', 'Front tab');
    await s.key('ArrowRight', 'Back tab'); await s.key('ArrowLeft', 'Front tab');
    await s.key('End', 'Back tab End'); await s.key('Home', 'Front tab Home');
    await s.key('ArrowRight', 'Back answers'); await s.read('Back answers and print instructions');
    await s.seek('[data-lp-date]', 'Date revisit'); await s.key('Command+A', 'Select date');
    await s.key('Backspace', 'Clear date'); await s.key('Tab', 'Leave blank date');
    await s.snapshot('incomplete');
    await s.seek('[data-lp-date]', 'Invalid date error');
    await s.type('10152026', 'Recover date with keyboard'); await s.key('Tab', 'Leave recovered date');
  } else if (pattern === 'test-out') {
    await s.activate('[data-lp-start]', 'Start check');
    await s.activate('[data-lp-next]:visible', 'Missing first answer Next'); await s.snapshot('incomplete');
    for (let q = 0; q < content.questions.length; q++) {
      const index = q === 0 ? 0 : content.questions[q].options.findIndex(option => option.id === content.questions[q].correct);
      await choose(page.locator('fieldset').nth(q).locator('input'), index, `Question ${q + 1}`, true);
      if (q + 1 < content.questions.length) await s.activate('[data-lp-next]:visible', `Next to question ${q + 2}`);
    }
    await s.activate('[data-lp-check]', 'Submit placement check');
    await s.activate('[data-lp-review] > summary', 'Open Review answers', 'Space');
  } else if (pattern === 'write-distractors') {
    await s.activate('[data-lp-check]', 'Blank recall submit');
    await s.seek('[data-lp-answer]', 'Your answer'); await s.type(content.rightAnswer, 'Write recall');
    await s.activate('[data-lp-check]', 'Check recall');
    await s.activate('[data-lp-had-it]', 'Self-report Yes');
    await s.activate('[data-lp-compare]', 'Incomplete wrong options submit'); await s.snapshot('incomplete');
    for (let i = 0; i < content.count; i++) {
      await s.seek(`[id="example-option-${i}-text"]`, `Wrong option ${i + 2}`);
      await s.type(content.authorOptions[i].text, `Write wrong option ${i + 2}`);
      await s.seek(`[id="example-option-${i}-misconception"]`, `Misconception ${i + 2}`);
      await s.key('Space', 'Open misconception menu');
      await s.key('Home', 'First misconception');
      const index = content.misconceptions.findIndex(item => item.id === content.authorOptions[i].misconception);
      for (let j = 0; j <= index; j++) await s.key('ArrowDown', `Misconception option ${j + 1}`);
      await s.key('Enter', 'Commit misconception');
    }
    await s.activate('[data-lp-compare]', 'Compare valid options');
  } else if (pattern === 'formats') {
    for (const format of ['text', 'slides', 'audio', 'quiz']) await s.activate(`[data-lp-format="${format}"]`, `Choose ${format}`);
    await s.activate('[data-lp-check]:visible', 'Missing quiz answer submit'); await s.snapshot('incomplete');
    for (let q = 0; q < content.quiz.length; q++) {
      if (q === 1) { await s.activate('[data-lp-next]', 'Next section'); await s.activate('[data-lp-next]', 'Last section'); }
      const inputs = page.locator('[data-lp-question]:visible input');
      await choose(inputs, 0, `Quiz ${q + 1} wrong answer`);
      await s.activate('[data-lp-check]:visible', 'Check wrong quiz option'); await s.snapshot(`wrong-${q}`);
      await s.previous('Local wrong quiz feedback VO+Left');
      await choose(inputs, content.quiz[q].options.findIndex(option => option.correct), `Quiz ${q + 1} correct answer`, true);
      await s.activate('[data-lp-check]:visible', 'Check correct quiz option');
    }
  }
}
