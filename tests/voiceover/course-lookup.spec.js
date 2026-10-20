import { test } from '@playwright/test';
import { voiceOver } from '@guidepup/guidepup';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { startSession } from './session.js';
import { ENTRY_IDS as faqIds } from '../../proxy/logic/20-faq.js';

for (const lang of ['en', 'fr']) for (const kind of ['sections', 'faq']) {
  test(`course-lookup ${kind} ${lang}`, async ({ page, browser }, info) => {
    const matched = lang === 'fr' ? 'Comment refuser du travail de plus' : 'How do I refuse extra work';
    const unmatched = lang === 'fr' ? 'Quelle est la météo sur Mars' : 'What is the weather on Mars';
    const content = JSON.parse(await readFile(new URL(`../../patterns/course-lookup/examples/${lang}-sections.json`, import.meta.url), 'utf8'));
    const ids = kind === 'faq' ? faqIds : content.entries.map(entry => entry.id);
    // The demo always selects its first entry. Inject fixed answers to exercise no-match too.
    await page.addInitScript(({ matched, ids }) => {
      window.lpAsk = async (block, { question }) => {
        const choice = block === '21-sections' && question === matched ? 'boundaries' : 'none';
        return { lookup: { choice, confidence: 1, probabilities: Object.fromEntries([...ids, 'none'].map(id => [id, id === choice ? 1 : 0])) } };
      };
    }, { matched, ids });
    await page.goto(`/course-lookup/${lang}.html`);
    await page.waitForFunction(() => window.lpReady);
    await writeFile(info.outputPath('browser-version.txt'), browser.version());
    const s = await startSession(page, info);
    const root = `[data-lp-kind="${kind}"]`;
    try {
      await s.observe(); await s.enter(); await s.snapshot('arrival');
      await s.seek(`${root} textarea`, `${kind}: question field`);
      if (kind === 'sections') {
        await s.type(matched, 'Sections: type matching question');
        await s.key('Enter', 'Sections: matching result announcement');
        await page.locator(`${root} [data-lp-result] a`).waitFor({ state: 'visible' });
        await s.snapshot('section-match');
        const title = content.entries.find(entry => entry.id === 'boundaries').title;
        let reached = false;
        for (let i = 0; i < 12; i++) {
          const row = await s.next(`Sections: reach result link VO+Right ${i + 1}`, true);
          if ([...row.speech, ...row.cursor].some(text => text.includes(title) && /link/i.test(text))) { reached = true; break; }
        }
        assert.equal(reached, true, 'VoiceOver did not reach and name the matching section link');
        await s.seek(`${root} textarea`, 'Sections: return to question field');
        await s.key('Command+A', 'Sections: select previous question');
      }
      await s.type(unmatched, `${kind}: type off-topic question`);
      await s.key('Enter', `${kind}: no-match announcement`);
      await page.locator(`${root} [data-lp-add]`).waitFor({ state: 'visible' });
      await s.snapshot('no-match');
      if (kind === 'faq') {
        const added = await s.activate(`${root} [data-lp-add]`, 'FAQ: activate Add and capture cursor', 'Control+Alt+Space');
        const cursor = await voiceOver.itemText();
        const next = await s.next('FAQ: first VO+Right after Add', true);
        await writeFile(info.outputPath('add-cursor.json'), JSON.stringify({ question: unmatched, domFocus: added.after.active, cursor, speech: added.speech, nextSpeech: next.speech, nextCursor: next.cursor }, null, 2));
        await s.snapshot('added');
      } else {
        for (let i = 0; i < 5; i++) await s.next(`Sections: off-topic reachable content VO+Right ${i + 1}`, true);
      }
      await writeFile(info.outputPath('journey-result.json'), JSON.stringify({ complete: true, pattern: 'course-lookup', kind, lang }));
    } catch (error) {
      // A page or navigation finding is evidence, not a CI assertion failure.
      await writeFile(info.outputPath('journey-result.json'), JSON.stringify({ complete: false, pattern: 'course-lookup', kind, lang, error: error.stack }));
      await s.snapshot('blocked');
      console.error(`course-lookup ${kind} ${lang}: ${error.stack}`);
    } finally { await s.stop(); }
  });
}
