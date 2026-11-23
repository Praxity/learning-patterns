import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { posix } from 'node:path';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const rootReadme = await read('README.md');
const rootUse = rootReadme.split('## Use a pattern')[1].split('## ')[0];

function copyPaths(text, name) {
  const line = text.split(/\r?\n/).find(line => line.startsWith('Copy '));
  assert.ok(line, `${name}: missing copy instructions`);
  const paths = [...line.matchAll(/`([^`]+)`/g)].map(match => match[1]);
  if (/this folder|its folder/.test(line)) paths.push(`patterns/${name}/`);
  return paths;
}

async function imports(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  const source = await read(file);
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](\.[^"']+)["']/g)) {
    await imports(posix.normalize(posix.join(posix.dirname(file), match[1])), seen);
  }
  return seen;
}

for (const name of await readdir(new URL('patterns/', root))) {
  test(`${name} README copy list covers every relative runtime import`, async () => {
    const readme = await read(`patterns/${name}/README.md`);
    const lists = [copyPaths(readme, name)];
    if (/^Copy /m.test(rootUse)) lists.push(copyPaths(rootUse, name));
    else assert.match(rootUse, /copy list in (?:the|each) pattern's README/);
    const graph = new Set();
    for (const entry of ['render.js', 'enhance.js', 'logic.js', 'strings.js']) {
      await imports(`patterns/${name}/${entry}`, graph);
    }
    for (const paths of lists) for (const file of graph) {
      assert.ok(paths.some(path => file === path || (path.endsWith('/') && file.startsWith(path))), `${name}: copy list omits ${file}`);
    }
  });
}
