import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { readComponentMeta, readMeta } from '../scripts/pattern-meta.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

function checkFrenchName(title, source) {
  assert.doesNotMatch(title, /^\p{L}+ez\b/u, `${source}: title_fr "${title}" uses the vous imperative; use the infinitive`);
}

function checkSingularVoice(markdown, source) {
  const prose = markdown.replace(/\]\([^)]*\)/g, ']').replace(/`[^`]*`/g, '');
  const found = /\b(?:[Ww]e|[Oo]urs?|[Uu]s)\b/.exec(prose);
  assert.equal(found, null, `${source}: "${found?.[0]}" speaks for the author; use I, me or my`);
}

test('the guards reject a vous imperative name and a plural author voice', () => {
  assert.throws(() => checkFrenchName('Vérifiez votre réponse', 'planted'));
  checkFrenchName('Vérifier sa réponse', 'infinitive');
  checkFrenchName('Échelle d’indices', 'noun');
  assert.throws(() => checkSingularVoice('Tried it? [Tell us what happened](https://example.org).', 'planted'));
  assert.throws(() => checkSingularVoice('We have not measured it.', 'planted'));
  checkSingularVoice('[Tell me what happened](https://example.org/how-our-ai-works). Perplexity (US).', 'singular');
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
