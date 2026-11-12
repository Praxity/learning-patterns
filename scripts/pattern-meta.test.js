import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { readMeta } from './pattern-meta.mjs';

const valid = `---
title: Check your own answer
title_fr: Vérifiez votre réponse
summary: Write an answer, tick the parts it includes, then compare.
section: question
ai: no
offline: yes
learners: not tried
---
# Check your own answer
`;

test('reads titles, summary, section and facets', () => {
  assert.deepEqual(readMeta('x', valid), {
    title: { en: 'Check your own answer', fr: 'Vérifiez votre réponse' },
    summary: 'Write an answer, tick the parts it includes, then compare.',
    section: 'question',
    ai: false,
    offline: true,
    learners: 'not tried'
  });
});

test('refuses missing front matter, missing keys, bad values and unknown keys', () => {
  assert.throws(() => readMeta('x', '# Title\n'), /x\/README.md: missing front matter/);
  assert.throws(() => readMeta('x', valid.replace('summary: Write an answer, tick the parts it includes, then compare.\n', '')), /needs summary/);
  assert.throws(() => readMeta('x', valid.replace('section: question', 'section: widgets')), /section must be one of/);
  assert.throws(() => readMeta('x', valid.replace('ai: no', 'ai: maybe')), /ai must be one of/);
  assert.throws(() => readMeta('x', valid.replace('learners: not tried', 'learners: not tried\nicon: bulb')), /unknown front matter key icon/);
});

// GitHub and site builds parse front matter as YAML, so values must mean the same there.
test('reads quoted values as YAML does and refuses values YAML would misread', () => {
  const meta = (title) => readMeta('x', valid.replace('title: Check your own answer', `title: ${title}`));
  assert.equal(meta(`'"I don''t know" as an answer'`).title.en, `"I don't know" as an answer`);
  assert.equal(meta(`"Say \\"no\\" first"`).title.en, 'Say "no" first');
  assert.throws(() => meta(`"I don't know" as an answer`), /title is not valid YAML/);
  assert.throws(() => meta(`Note: read first`), /title is not valid YAML/);
  assert.throws(() => meta(`Read # first`), /title is not valid YAML/);
  assert.throws(() => meta(`[Draft] title`), /title is not valid YAML/);
});

test('every pattern README has valid front matter', async () => {
  const root = new URL('../patterns/', import.meta.url);
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const readme = await readFile(new URL(`${entry.name}/README.md`, root), 'utf8');
    assert.doesNotThrow(() => readMeta(entry.name, readme), entry.name);
  }
});

const README_SECTIONS = [
  'Use it when', 'Avoid it when', 'Before you use it', 'How it works', 'Evidence', 'Accessibility',
  'Content fields', 'Logic', 'Use it', 'Adapt it with your agent',
  'Related patterns', 'Help improve this pattern', 'Licence'
];

/** @param {string} readme @param {string} [name] */
function checkReadmeStructure(readme, name = 'pattern') {
  const meta = readMeta(name, readme);
  assert.match(readme, /^---\r?\n[\s\S]*?\r?\n---\r?\n# [^\r\n]+\r?\n/);
  // Code examples may contain Markdown headings; they are not README sections.
  const prose = readme.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, '');
  const sections = [...prose.matchAll(/^## ([^\r\n]+)\r?$/gm)].map(match => match[1]);
  const expected = [...README_SECTIONS];
  if (sections.includes('Write this in .prax')) expected.splice(expected.indexOf('Evidence'), 0, 'Write this in .prax');
  assert.deepEqual(sections, expected);
  for (const heading of ['Use it when', 'Avoid it when', 'Before you use it', 'Related patterns', 'Help improve this pattern']) {
    const content = prose.split(`## ${heading}`)[1].split(/^## /m)[0].trim();
    assert.ok(content, `${heading} is empty`);
    if (heading === 'Use it when' || heading === 'Avoid it when') {
      const items = content.split(/\r?\n/);
      assert.ok(items.length <= 4 && items.every(item => /^- \S/.test(item)), `${heading} needs one to four single-line bullets`);
    }
  }
  const avoid = prose.split('## Avoid it when')[1].split(/^## /m)[0].trim().split(/\r?\n/);
  // An explicit If/When clause distinguishes a use condition from a property, without parsing English.
  assert.ok(avoid.every(item => /^- (?:If|When)\s+\S[^\r\n]*[.!?]$/.test(item)), 'Each Avoid it when bullet must be a condition starting with If or When');
  if (meta.ai) {
    const before = prose.split('## Before you use it')[1].split(/^## /m)[0].trim();
    assert.match(before, /^It needs a server running a model\.\s+\S/, 'AI setup must open with the server requirement and a fallback');
  }
  const how = readme.split(/^## How it works\r?$/m)[1].split(/^## /m)[0];
  assert.doesNotMatch(how, /`|\b[A-Za-z_$][\w.$]*\s*\(/, 'How it works contains code');
  const [steps, ...fallback] = how.trim().split(/\r?\n\s*\r?\n/);
  const items = steps.split(/\r?\n/);
  assert.ok(items.length <= 6 && items.every((item, i) => item.startsWith(`${i + 1}. `) && item.trim().length > 3), 'How it works needs one ordered list of one to six steps');
  assert.ok(fallback.length <= 1 && fallback.every(text => !/^(?:\s*\d+[.)]\s|\s*[-*+]\s|\s*#|\s*>|\s*\|)/m.test(text)), 'How it works allows at most one fallback paragraph');
  const accessibility = readme.split(/^## Accessibility\r?$/m)[1].split(/^## /m)[0].split(/^### Known issues\r?$/m)[0];
  assert.doesNotMatch(accessibility, /`|\b[A-Za-z_$][\w.$]*\s*\(/, 'Accessibility contains code');
  const useIt = prose.split(/^## Use it\r?$/m)[1].split(/^## /m)[0];
  const details = prose.match(/^### Accessibility details\r?$/gm) ?? [];
  assert.ok(details.length === 0 || (details.length === 1 && /^### Accessibility details\r?$/m.test(useIt)), 'Accessibility details belongs under Use it');
  assert.doesNotMatch(readme, /still to come|separate human check|requires a separate human|checks remain separate/i, 'README contains stale screen reader wording');
  // READMEs are public. They never mention how they were written or where files sit on a machine.
  assert.doesNotMatch(prose, INTERNAL, 'README contains internal phrasing');
  assert.doesNotMatch(prose, /—/, 'README contains an em dash');
}

const INTERNAL = /\bsupplied\b|\bresearch notes?\b|\bdemo \d+\b|\bworkers?\b|\bthe brief\b|codex-runs|\b[A-Z]:[\\/]/i;

test('README structure guard catches missing, reordered and technical sections', () => {
  const readme = `${valid}\nA short description.\n\n${README_SECTIONS.map(section =>
    `## ${section}\n\n${section === 'How it works' ? '1. You read the question.' : section === 'Avoid it when' ? '- When you need a grade, use an assessment.' : section === 'Use it when' ? '- Plain text.' : 'Plain text.'}\n`
  ).join('\n')}`;
  assert.doesNotThrow(() => checkReadmeStructure(readme));
  const withPrax = readme.replace('## Evidence', '## Write this in .prax\n\nPlain text.\n\n## Evidence');
  assert.doesNotThrow(() => checkReadmeStructure(withPrax));
  assert.doesNotThrow(() => checkReadmeStructure(withPrax.replaceAll('\n', '\r\n')));
  assert.throws(() => checkReadmeStructure(readme.replace('## Before you use it', '## Setting it up')));
  assert.throws(() => checkReadmeStructure(readme.replace('## Logic', '## Write this in .prax\n\nPlain text.\n\n## Logic')));
  assert.throws(() => checkReadmeStructure(withPrax.replace('## Evidence', '## Write this in .prax\n\nPlain text.\n\n## Evidence')));
  assert.doesNotThrow(() => checkReadmeStructure(readme.replace('## Use it\n\nPlain text.', '## Use it\n\n```js\n## Example heading inside code\n```')));
  for (const section of README_SECTIONS) {
    assert.throws(() => checkReadmeStructure(readme.replace(`## ${section}\n`, '')), section);
  }
  for (const heading of ['Use it when', 'Avoid it when', 'Before you use it', 'Related patterns', 'Help improve this pattern']) {
    assert.throws(() => checkReadmeStructure(readme.replace(`## ${heading}\n\n${heading === 'Avoid it when' ? '- When you need a grade, use an assessment.' : heading === 'Use it when' ? '- Plain text.' : 'Plain text.'}`, `## ${heading}\n`)), /is empty/);
  }
  for (const content of ['Plain text.', '- One.\n- Two.\n- Three.\n- Four.\n- Five.']) {
    assert.throws(() => checkReadmeStructure(readme.replace('- Plain text.', content)), /needs one to four single-line bullets/);
  }
  assert.throws(() => checkReadmeStructure(readme.replace('- When you need a grade, use an assessment.', '- When you need a grade, use an assessment.\n- It gives no grade.')), /Each Avoid it when bullet/);
  const condition = 'When you need a grade, use an assessment.';
  for (const property of ['It gives no grade.', 'The pattern does not judge text.', 'Sometimes the model is unavailable.']) {
    assert.throws(() => checkReadmeStructure(readme.replace(condition, property)), /Each Avoid it when bullet/);
  }
  assert.doesNotThrow(() => checkReadmeStructure(readme.replace(condition, 'If you need a grade, use an assessment.')));
  const ai = readme.replace('ai: no', 'ai: yes');
  assert.throws(() => checkReadmeStructure(ai), /server requirement/);
  assert.throws(() => checkReadmeStructure(ai.replace('## Before you use it\n\nPlain text.', '## Before you use it\n\nIt needs a server running a model.')), /server requirement/);
  assert.doesNotThrow(() => checkReadmeStructure(ai.replace('## Before you use it\n\nPlain text.', '## Before you use it\n\nIt needs a server running a model. Without one, learners see a checklist.')));
  assert.throws(() => checkReadmeStructure(readme.replace('## Evidence', '## Temporary').replace('## Logic', '## Evidence').replace('## Temporary', '## Logic')));
  assert.doesNotThrow(() => checkReadmeStructure(readme.replaceAll('\n', '\r\n')));
  for (const code of ['`answer`', 'readingMinutes(content)', 'scheduleReview (date)']) {
    assert.throws(() => checkReadmeStructure(readme.replace('1. You read the question.', `1. You use ${code}.`)), /contains code/);
    assert.throws(() => checkReadmeStructure(readme.replace('## Accessibility\n\nPlain text.', `## Accessibility\n\nUse ${code}.`)), /Accessibility contains code/);
  }
  for (const how of ['A paragraph.', '1. One.\n3. Three.', '1. One.\n\n2. Two.', '1. One.\n- Two.', '1. One.\n2. Two.\n3. Three.\n4. Four.\n5. Five.\n6. Six.\n7. Seven.', '1. One.\n\nFallback.\n\nAnother paragraph.', '1. One.\n\n### Limits']) {
    assert.throws(() => checkReadmeStructure(readme.replace('1. You read the question.', how)), /How it works/);
  }
  assert.doesNotThrow(() => checkReadmeStructure(readme.replace('1. You read the question.', '1. One.\n2. Two.\n\nWithout JavaScript, read the answers.')));
  assert.doesNotThrow(() => checkReadmeStructure(readme.replace('## Accessibility\n\nPlain text.', '## Accessibility\n\nPlain text.\n\n### Known issues\n\nThe reader repeats `button`.')));
  assert.throws(() => checkReadmeStructure(readme.replace('## Accessibility\n\nPlain text.', '## Accessibility\n\nPlain text.\n\n### Accessibility details\n\nMore.')), /under Use it/);
  assert.doesNotThrow(() => checkReadmeStructure(readme.replace('## Use it\n\nPlain text.', '## Use it\n\nPlain text.\n\n### Accessibility details\n\nMore.')));
  for (const phrase of ['still to come', 'separate human check', 'requires a separate human', 'checks remain separate']) {
    assert.throws(() => checkReadmeStructure(readme.replace('## Accessibility\n\nPlain text.', `## Accessibility\n\nScreen reader checks ${phrase}.`)), /stale screen reader wording/);
  }
  for (const phrase of ['The supplied research notes say so.', 'See demo 21.', 'A worker wrote this.', 'Logs are in D:/tmp/x.', 'As the brief asks.', 'Short \u2014 long.']) {
    assert.throws(() => checkReadmeStructure(readme.replace('## Licence\n\nPlain text.', `## Licence\n\n${phrase}`)), /internal phrasing|em dash/, phrase);
  }
  assert.throws(() => checkReadmeStructure(readme.replace(/^---\n[\s\S]*?\n---\n/, '')), /missing front matter/);
  assert.throws(() => checkReadmeStructure(readme.replace('# Check your own answer\n', '')));
});

test('every pattern README has the shared structure and plain learner steps', async () => {
  const root = new URL('../patterns/', import.meta.url);
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const readme = await readFile(new URL(`${entry.name}/README.md`, root), 'utf8');
    assert.doesNotThrow(() => checkReadmeStructure(readme, entry.name), `${entry.name}/README.md`);
  }
});

/** A section's bullet lines. @param {string} markdown @param {string} heading */
function bullets(markdown, heading) {
  const part = markdown.split(new RegExp(`^## ${heading}\\r?$`, 'm'))[1];
  return part === undefined ? [] : part.split(/^## /m)[0].trim().split(/\r?\n/).filter(Boolean);
}

const FRENCH = [['Quand l’utiliser', 'Use it when'], ['Quand l’éviter', 'Avoid it when']];
const PATTERN_LINK = /\[([^\]]*)\]\(\.\.\/([^/]+)\/README\.md\)/g;

/**
 * README.fr.md holds the French "Use it when" and "Avoid it when", which praxity.io shows on French
 * pages. Each bullet translates the English one in the same place, so counts and links must match.
 * @param {string} fr @param {string} readme @param {Record<string, string>} titlesFr title_fr by folder
 */
function checkFrenchSections(fr, readme, titlesFr) {
  assert.deepEqual([...fr.matchAll(/^## ([^\r\n]+)\r?$/gm)].map(match => match[1]), FRENCH.map(([heading]) => heading));
  assert.match(fr, /^## /, 'README.fr.md has text before its first section');
  for (const [heading, english] of FRENCH) {
    const items = bullets(fr, heading);
    assert.ok(items.length && items.every(item => /^- \S/.test(item)), `${heading} needs single-line bullets`);
    assert.equal(items.length, bullets(readme, english).length, `${heading} needs one bullet per ${english} bullet`);
    for (const [i, item] of items.entries()) {
      const links = [...item.matchAll(PATTERN_LINK)];
      assert.deepEqual(links.map(link => link[2]), [...bullets(readme, english)[i].matchAll(PATTERN_LINK)].map(link => link[2]), `${heading} bullet ${i + 1} links other patterns than the English`);
      for (const [, text, name] of links) assert.equal(text, titlesFr[name], `${heading}: link to ${name} needs its title_fr`);
      // Link text is title_fr, which the front matter owns, so only the bullet's own words are checked.
      const words = item.replace(PATTERN_LINK, 'X');
      assert.doesNotMatch(words, /\p{L}'\p{L}/u, `${heading}: straight apostrophe`);
      assert.doesNotMatch(words, /[^ ]:|[^ ][;!?]|«[^ ]|[^ ]»/u, `${heading}: French spacing needs a no-break space before ":" and a narrow one before ";!?" and inside « »`);
    }
    if (english === 'Avoid it when') {
      assert.ok(items.every(item => /^- (?:Si|Lorsque|Lorsqu’|Quand)\s*\S[^\r\n]*[.!?]$/.test(item)), 'Each Quand l’éviter bullet must be a condition starting with Si, Lorsque or Quand');
    }
  }
}

test('French section guard catches missing, empty, mismatched and badly typeset sections', () => {
  const readme = '## Use it when\n\n- Learners mix things up.\n\n## Avoid it when\n\n- When you need recall, use [Recall](../recall/README.md).\n\n## Before you use it\n\nText.\n';
  const fr = '## Quand l’utiliser\n\n- Les personnes apprenantes confondent.\n\n## Quand l’éviter\n\n- Lorsque vous voulez un rappel, utilisez [Rappel](../recall/README.md).\n';
  const titles = { recall: 'Rappel' };
  assert.doesNotThrow(() => checkFrenchSections(fr, readme, titles));
  assert.doesNotThrow(() => checkFrenchSections(fr.replaceAll('\n', '\r\n'), readme, titles));
  assert.throws(() => checkFrenchSections(fr.replace(/## Quand l’éviter[\s\S]*/, ''), readme, titles));
  assert.throws(() => checkFrenchSections(`# Titre\n\n${fr}`, readme, titles), /text before/);
  assert.throws(() => checkFrenchSections(fr.replace('- Les personnes apprenantes confondent.', ''), readme, titles), /single-line bullets/);
  assert.throws(() => checkFrenchSections(fr.replace('confondent.', 'confondent.\n- Deux.'), readme, titles), /one bullet per/);
  assert.throws(() => checkFrenchSections(fr.replace('[Rappel](../recall/README.md)', 'un rappel'), readme, titles), /links other patterns/);
  assert.throws(() => checkFrenchSections(fr.replace('[Rappel]', '[Recall]'), readme, titles), /title_fr/);
  assert.throws(() => checkFrenchSections(fr.replace('Lorsque vous', 'Vous'), readme, titles), /starting with Si/);
  assert.doesNotThrow(() => checkFrenchSections(fr.replace('Lorsque vous', 'Si vous'), readme, titles));
  for (const bad of ['l\'erreur', 'rappel : oui', 'rappel ;', 'vraiment?', '« Pas sûr »']) {
    assert.throws(() => checkFrenchSections(fr.replace('confondent', `confondent ${bad}`), readme, titles), /apostrophe|French spacing/, bad);
  }
  assert.doesNotThrow(() => checkFrenchSections(fr.replace('confondent', 'confondent l’erreur : « Pas sûr » ?'), readme, titles));
});

test('every pattern has French Use it when and Avoid it when sections', async () => {
  const root = new URL('../patterns/', import.meta.url);
  const folders = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
  /** @type {Record<string, string>} */
  const titlesFr = {};
  for (const name of folders) titlesFr[name] = readMeta(name, await readFile(new URL(`${name}/README.md`, root), 'utf8')).title.fr;
  for (const name of folders) {
    const readme = await readFile(new URL(`${name}/README.md`, root), 'utf8');
    // A missing README.fr.md rejects here, so a new pattern can't ship without its French sections.
    const fr = await readFile(new URL(`${name}/README.fr.md`, root), 'utf8');
    assert.doesNotThrow(() => checkFrenchSections(fr, readme, titlesFr), `${name}/README.fr.md`);
  }
});

test('the root README lists every pattern folder', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  assert.doesNotMatch(readme, /still to come|separate human check|requires a separate human|checks remain separate/i, 'README contains stale screen reader wording');
  for (const entry of await readdir(new URL('../patterns/', import.meta.url), { withFileTypes: true })) {
    if (entry.isDirectory()) assert.ok(readme.includes(`](patterns/${entry.name}/README.md)`), `README.md does not list ${entry.name}`);
  }
  const folders = new Set((await readdir(new URL('../patterns/', import.meta.url), { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name));
  for (const [, name] of readme.matchAll(/\]\(patterns\/([^/]+)\/README\.md\)/g)) assert.ok(folders.has(name), `README.md lists missing pattern ${name}`);
});

/** @param {string} readme @param {Set<string>} folders */
function checkPatternLinks(readme, folders) {
  const links = text => [...text.matchAll(/\]\(\.\.\/([^/]+)\/README\.md\)/g)].map(match => match[1]);
  for (const name of links(readme)) assert.ok(folders.has(name), `missing related pattern ${name}`);
  const avoid = readme.split('## Avoid it when')[1].split(/^## /m)[0];
  const related = links(readme.split('## Related patterns')[1].split(/^## /m)[0]);
  assert.ok(related.length, 'Related patterns needs links');
  for (const name of links(avoid)) assert.ok(related.includes(name), `${name} alternative missing from Related patterns`);
}

test('pattern link guard catches broken targets and omitted alternatives', () => {
  const readme = '## Avoid it when\nWhen you need recall, use [Recall](../recall/README.md).\n## Related patterns\n- [Recall](../recall/README.md)\n## Licence\nMIT.';
  assert.doesNotThrow(() => checkPatternLinks(readme, new Set(['recall'])));
  assert.throws(() => checkPatternLinks(readme, new Set()), /missing related pattern recall/);
  assert.throws(() => checkPatternLinks(readme.replace('- [Recall](../recall/README.md)', '- [Other](../other/README.md)'), new Set(['recall', 'other'])), /alternative missing/);
});

test('pattern alternatives exist, appear in Related patterns and feedback links prefill the form', async () => {
  const root = new URL('../patterns/', import.meta.url);
  const folders = new Set((await readdir(root, { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name));
  const form = await readFile(new URL('../.github/ISSUE_TEMPLATE/pattern-feedback.yml', import.meta.url), 'utf8');
  assert.match(form, /id: pattern/);
  for (const name of folders) {
    const readme = await readFile(new URL(`${name}/README.md`, root), 'utf8');
    checkPatternLinks(readme, folders);
    const help = readme.split('## Help improve this pattern')[1].split(/^## /m)[0];
    const found = /\]\((https:\/\/github\.com\/Praxity\/learning-patterns\/issues\/new[^)]+)\)/.exec(help);
    assert.ok(found, `${name}: feedback link`);
    const feedback = new URL(found[1]);
    assert.equal(feedback.searchParams.get('template'), 'pattern-feedback.yml', name);
    assert.equal(feedback.searchParams.get('pattern'), readMeta(name, readme).title.en, name);
    assert.ok(help.includes(`https://github.com/Praxity/learning-patterns/edit/main/patterns/${name}/README.md`), name);
  }
});
