import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { readComponentMeta, readMeta } from '../scripts/pattern-meta.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const ownLink = /^(?:https:\/\/github\.com\/Praxity\/learning-patterns\b|(?![a-z]+:))/i;

function checkFrenchName(title, source) {
  const imperative = /^(?:(?!(?:chez|assez)(?![\p{L}\p{N}]))\p{L}+ez|faites|dites)(?![\p{L}\p{N}])/iu;
  assert.doesNotMatch(title, imperative, `${source}: title_fr "${title}" uses the vous imperative; use the infinitive`);
}

function checkSingularVoice(markdown, source) {
  const prose = markdown
    .replace(/^>.*$/gm, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, (link, text, url) => (ownLink.test(url) ? text : ''))
    .replace(/"[^"\n]*"/g, '')
    .replace(/“[^”\n]*”/g, '');
  const found = /(?<![\p{L}\p{N}])(?:[Ww]e|[Oo]urs?|[Uu]s)(?![\p{L}\p{N}])/u.exec(prose);
  assert.equal(found, null, `${source}: "${found?.[0]}" speaks for the author; use I, me or my`);
}

test('the French name guard rejects vous imperatives and accepts infinitives and nouns', () => {
  for (const title of ['Vérifiez votre réponse', 'Faites une estimation', 'Dites ce que vous savez']) {
    assert.throws(() => checkFrenchName(title, 'planted'), undefined, title);
  }
  for (const title of ['Vérifier sa réponse', 'Échelle d’indices', 'Chez le client', 'Assez de pratique']) {
    checkFrenchName(title, 'allowed');
  }
});

test('the author voice guard rejects a plural author and ignores quoted, cited and French text', () => {
  const feedback = 'https://github.com/Praxity/learning-patterns/issues/new?template=pattern-feedback.yml';
  assert.throws(() => checkSingularVoice(`Tried it? [Tell us what happened](${feedback}).`, 'planted'));
  assert.throws(() => checkSingularVoice('We have not measured it.', 'planted'));
  assert.throws(() => checkSingularVoice('See [our notes](../docs/adr/0001.md).', 'planted'));
  checkSingularVoice(`[Tell me what happened](${feedback}). See [the guide](https://example.org/how-our-ai-works). Perplexity (US).`, 'singular');
  checkSingularVoice('The sample reply says "please contact our team" and “we will call you back”.', 'quoted sample');
  checkSingularVoice('> We found no effect on retention.\n\nI cite this study.', 'blockquoted source');
  checkSingularVoice('This follows ([How we used a Kaggle challenge](https://example.org/kaggle)).', 'cited title');
  checkSingularVoice('title_fr: Messages reçus, aperçus, déçus et perçus', 'French words');
});

test('pattern and component French names use the infinitive, not the vous imperative', async () => {
  for (const kind of ['patterns', 'components']) {
    for (const name of await readdir(new URL(`${kind}/`, root))) {
      const readme = await read(`${kind}/${name}/README.md`);
      checkFrenchName((kind === 'patterns' ? readMeta : readComponentMeta)(name, readme).title.fr, `${kind}/${name}`);
    }
  }
});

test('public READMEs and docs speak as one author', async () => {
  const files = ['README.md'];
  for (const kind of ['patterns', 'components']) {
    for (const name of await readdir(new URL(`${kind}/`, root))) files.push(`${kind}/${name}/README.md`);
  }
  for (const file of await readdir(new URL('docs/adr/', root))) files.push(`docs/adr/${file}`);
  for (const file of files) checkSingularVoice(await read(file), file);
});
