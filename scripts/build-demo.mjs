import { mkdir, copyFile, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '../patterns/self-check/render.js';
import { strings } from '../patterns/self-check/strings.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'demo-dist');
await rm(output, { recursive: true, force: true });
for (const path of ['lib/html.js', ...['logic.js', 'render.js', 'enhance.js', 'strings.js', 'pattern.css'].map(name => `patterns/self-check/${name}`)]) {
  await mkdir(dirname(join(output, path)), { recursive: true });
  await copyFile(join(root, path), join(output, path));
}
for (const lang of ['en', 'fr']) {
  const content = JSON.parse(await readFile(join(root, `patterns/self-check/examples/${lang}.json`), 'utf8'));
  await writeFile(join(output, `${lang}.html`), page(lang, content, false));
  if (lang === 'en') await writeFile(join(output, 'two.html'), page(lang, content, true));
}

// Unlisted live preview: an index, the raw pattern README for agents, and headers that keep it out of search.
await copyFile(join(root, 'patterns/self-check/README.md'), join(output, 'self-check.md'));
await writeFile(join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
await writeFile(join(output, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n/*.md\n  Content-Type: text/markdown; charset=utf-8\n');
await writeFile(join(output, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Learning patterns preview</title>
<style>body{margin:0;padding:1rem;color:#202124;font:1rem/1.5 system-ui,sans-serif}main{max-width:40rem;margin:auto}h1{font-size:1.5rem}</style></head>
<body><main><h1>Learning patterns preview</h1>
<p>Unlisted preview. Patterns are not tried with learners yet.</p>
<h2>Check your own answer</h2>
<ul><li><a href="./en">English demo</a></li><li><a href="./fr" hreflang="fr" lang="fr">Démo en français</a></li><li><a href="./two">Two on one page</a></li><li><a href="./self-check.md">Markdown for agents</a></li></ul>
</main></body></html>
`);

function page(lang, content, two) {
  const ids = two ? ['first', 'second'] : ['example'];
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${lang === 'fr' ? 'Vérifiez votre réponse' : 'Check your own answer'}</title>
<link rel="stylesheet" href="./patterns/self-check/pattern.css">
<style>body{margin:0;padding:1rem;background:#fff;color:#202124;font:1rem/1.5 system-ui,sans-serif}main{max-width:40rem;margin:auto}h1{font-size:1.5rem}</style></head>
<body><main><h1>${lang === 'fr' ? 'Vérifiez votre réponse' : 'Check your own answer'}</h1>
${ids.map(id => render(content, strings[lang], { id, lang })).join('\n')}
</main><script type="module">
import { enhance } from './patterns/self-check/enhance.js';
import { strings } from './patterns/self-check/strings.js';
const content = ${JSON.stringify(content).replaceAll('<', '\\u003c')};
let saved = window.lpSeed;
const state = { read: () => saved, write: value => { saved = value; window.lpSaved = value; } };
const roots = document.querySelectorAll('[data-lp-pattern]');
window.lpInstances = [...roots].map(root => enhance(root, { content, strings: strings.${lang}, state }));
window.lpEnhance = () => enhance(roots[0], { content, strings: strings.${lang}, state });
window.lpReady = true;
</script></body></html>`;
}
