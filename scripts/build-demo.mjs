// Builds the static demo site: one folder per pattern with English, French and two-instance pages,
// an index of every pattern, each pattern's raw README for agents, and headers that keep the
// unlisted preview out of search. Browser tests and the live preview both use this output.
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { escapeHtml } from '../lib/html.js';
import { readMeta } from './pattern-meta.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'demo-dist');
const COPIED = ['logic.js', 'render.js', 'enhance.js', 'strings.js', 'pattern.css'];

await rm(output, { recursive: true, force: true });
await copyInto('lib/html.js');

const patterns = [];
for (const entry of await readdir(join(root, 'patterns'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const name = entry.name;
  const meta = readMeta(name, await readFile(join(root, 'patterns', name, 'README.md'), 'utf8'));
  for (const file of COPIED) await copyInto(`patterns/${name}/${file}`);
  await copyFile(join(root, 'patterns', name, 'README.md'), join(output, `${name}.md`));
  const { render } = await import(pathToFileURL(join(root, 'patterns', name, 'render.js')).href);
  const { strings } = await import(pathToFileURL(join(root, 'patterns', name, 'strings.js')).href);
  await mkdir(join(output, name), { recursive: true });
  for (const lang of ['en', 'fr']) {
    const content = JSON.parse(await readFile(join(root, 'patterns', name, 'examples', `${lang}.json`), 'utf8'));
    const write = (file, ids) => writeFile(join(output, name, file), page({ name, lang, title: meta.title[lang], content, ids, render, strings }));
    await write(`${lang}.html`, ['example']);
    if (lang === 'en') await write('two.html', ['first', 'second']);
  }
  patterns.push({ name, meta });
}

await writeFile(join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
await writeFile(join(output, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n/*.md\n  Content-Type: text/markdown; charset=utf-8\n');
await writeFile(join(output, 'index.html'), index(patterns));

async function copyInto(path) {
  await mkdir(dirname(join(output, path)), { recursive: true });
  await copyFile(join(root, path), join(output, path));
}

function page({ name, lang, title, content, ids, render, strings }) {
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="../patterns/${name}/pattern.css">
<style>body{margin:0;padding:1rem;background:#fff;color:#202124;font:1rem/1.5 system-ui,sans-serif}main{max-width:40rem;margin:auto}h1{font-size:1.5rem}</style></head>
<body><main><h1>${escapeHtml(title)}</h1>
${ids.map(id => render(content, strings[lang], { id, lang })).join('\n')}
</main><script type="module">
import { enhance } from '../patterns/${name}/enhance.js';
import { strings } from '../patterns/${name}/strings.js';
const content = ${JSON.stringify(content).replaceAll('<', '\\u003c')};
let saved = window.lpSeed;
const state = { read: () => saved, write: value => { saved = value; window.lpSaved = value; } };
const roots = document.querySelectorAll('[data-lp-pattern]');
window.lpInstances = [...roots].map(root => enhance(root, { content, strings: strings.${lang}, state }));
window.lpEnhance = () => enhance(roots[0], { content, strings: strings.${lang}, state });
window.lpReady = true;
</script></body></html>`;
}

function index(list) {
  const items = list.map(({ name, meta }) => `<h2>${escapeHtml(meta.title.en)}</h2>
<p>${escapeHtml(meta.summary)}</p>
<ul><li><a href="./${name}/en">English demo</a></li><li><a href="./${name}/fr" hreflang="fr" lang="fr">${escapeHtml(meta.title.fr)}</a></li><li><a href="./${name}.md">Markdown for agents</a></li></ul>`).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Learning patterns preview</title>
<style>body{margin:0;padding:1rem;color:#202124;font:1rem/1.5 system-ui,sans-serif}main{max-width:40rem;margin:auto}h1{font-size:1.5rem}h2{font-size:1.2rem;margin-top:2rem}</style></head>
<body><main><h1>Learning patterns preview</h1>
<p>Unlisted preview. None of these patterns has been tried with learners yet.</p>
${items}
</main></body></html>
`;
}
