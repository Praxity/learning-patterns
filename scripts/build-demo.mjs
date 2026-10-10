// Builds the static demo site: one folder per pattern with English, French and two-instance pages,
// an index of every pattern, each pattern's raw README for agents, and headers that keep the
// unlisted preview out of search. Browser tests and the live preview both use this output.
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { escapeHtml } from '../lib/html.js';
import { readMeta } from './pattern-meta.mjs';
import { DEFAULT_MODEL } from '../proxy/src/prices.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'demo-dist');
const AI_PATTERNS = ['live-feedback', 'explain-back', 'misconception', 'conversation', 'journal', 'course-lookup'];
const liveAsk = process.argv.includes('--live-ask');
const COPIED = ['logic.js', 'render.js', 'enhance.js', 'strings.js', 'pattern.css'];

await rm(output, { recursive: true, force: true });
await copyInto('lib/html.js');
await copyInto('lib/text-limits.js');
await copyInto('lib/icons.js');
await copyInto('lib/course-lookup-icons.js');
await copyInto('lib/conversation-icons.js');
await copyInto('lib/write-distractors-icons.js');
await copyInto('lib/base.css');
await copyInto('lib/data-notice.js');
await copyInto('lib/notice-ui.js');
await copyInto('lib/ask.js');
await copyInto('lib/typing-pause.js');
await copyInto('proxy/logic/20-faq.js');
await copyInto('proxy/logic/21-sections.js');
await copyInto('proxy/logic/02-live.js');
await copyInto('lib/focus-after-layout.js');
await copyInto('lib/browser-state.js');
await copyInto('proxy/logic/07-explain-back.js');
await copyInto('proxy/logic/06-misconceptions.js');
await copyInto('proxy/logic/03-contract.js');
await copyInto('proxy/logic/13-journal.js');
await copyInto('proxy/logic/shared.js');
await copyInto('proxy/logic/rubric.js');
// The demo pages load the course fonts the base styles name. They are dev dependencies (OFL), not part of a pattern.
const FONTS = ['source-sans-3-latin-400-normal', 'source-sans-3-latin-600-normal', 'source-serif-4-latin-400-normal', 'source-serif-4-latin-600-normal'];
await mkdir(join(output, 'fonts'), { recursive: true });
for (const font of FONTS) {
  const pkg = font.startsWith('source-sans') ? 'source-sans-3' : 'source-serif-4';
  await copyFile(join(root, 'node_modules', '@fontsource', pkg, 'files', `${font}.woff2`), join(output, 'fonts', `${font}.woff2`));
}
const FONT_FACES = FONTS.map(font => {
  const family = font.startsWith('source-sans') ? 'Source Sans 3' : 'Source Serif 4';
  const weight = font.includes('-600-') ? 600 : 400;
  return `@font-face{font-family:"${family}";font-weight:${weight};font-display:swap;src:url(../fonts/${font}.woff2) format("woff2")}`;
}).join('');

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
    const sections = name === 'course-lookup' ? JSON.parse(await readFile(join(root, 'patterns', name, 'examples', `${lang}-sections.json`), 'utf8')) : null;
    const write = (file, ids) => writeFile(join(output, name, file), page({ name, lang, title: meta.title[lang], content, sections, ids, render, strings }));
    await write(`${lang}.html`, ['example']);
    if (lang === 'en') await write('two.html', ['first', 'second']);
  }
  const preview = AI_PATTERNS.includes(name) ? JSON.parse(await readFile(join(root, 'patterns', name, 'examples', 'en.json'), 'utf8')) : null;
  patterns.push({ name, meta, preview });
}

await writeFile(join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
await writeFile(join(output, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n/*.md\n  Content-Type: text/markdown; charset=utf-8\n');
await writeFile(join(output, 'index.html'), index(patterns));

async function copyInto(path) {
  await mkdir(dirname(join(output, path)), { recursive: true });
  await copyFile(join(root, path), join(output, path));
}

function page({ name, lang, title, content, sections, ids, render, strings }) {
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="../lib/base.css">
<link rel="stylesheet" href="../patterns/${name}/pattern.css">
<style>${FONT_FACES}body{margin:0;padding:1rem;background:#fff;color:#1b1e23;font:1.1875rem/1.55 "Source Sans 3",system-ui,sans-serif}main{max-width:46rem;margin:auto}h1{font:600 2.375rem/1.2 "Source Serif 4",Georgia,serif;overflow-wrap:break-word}</style></head>
<body><main><h1>${escapeHtml(title)}</h1>
${ids.map(id => name === 'course-lookup' ? render(content, strings[lang], { id: `${id}-faq`, lang }) + render(sections, strings[lang], { id: `${id}-sections`, lang }) : render(content, strings[lang], { id, lang })).join('\n')}
</main><script type="module">
import { enhance } from '../patterns/${name}/enhance.js';
import { strings } from '../patterns/${name}/strings.js';
const content = ${JSON.stringify(content).replaceAll('<', '\\u003c')};
${name === 'course-lookup' ? `const sections = ${JSON.stringify(sections).replaceAll('<', '\\u003c')};` : ''}
const contentFor = root => ${name === 'course-lookup' ? `root.dataset.lpKind === 'sections' ? sections : content` : 'content'};
let saved = window.lpSeed;
const state = { read: () => saved, write: value => { saved = value; window.lpSaved = value; } };
${AI_PATTERNS.includes(name) ? liveAsk ? `import { createAsk } from '../lib/ask.js';
const injectedAsk = createAsk();` : `const mockConfig = {
  model: ${JSON.stringify(DEFAULT_MODEL)},
  siteKey: '', provider: 'mock', providerName: 'Offline example',
  dataNotice: ${name === 'course-lookup' ? `{ en: "This demo uses fixed matches. Lookup sends no text. Your questions stay in this tab until you close it.", fr: "Cette démo utilise des résultats fixes. La recherche n’envoie aucun texte. Vos questions restent dans cet onglet jusqu’à sa fermeture." }` : name === 'journal' ? `{ en: "This demo uses fixed suggestions. Get a suggestion sends no text. Your entry stays in this tab and clears when you close it.", fr: "Cette démo utilise des suggestions fixes. Obtenir une suggestion n’envoie aucun texte. Votre entrée reste dans cet onglet et s’efface quand vous le fermez." }` : `{ en: "This demo uses fixed feedback. Your answer stays in this page and isn't sent to a server.", fr: "Cette démo utilise une rétroaction fixe. Votre réponse reste dans cette page et n'est pas envoyée à un serveur." }`}
};
const fakeAsk = ${name === 'course-lookup' ? `async block => {
  const ids = block === '20-faq' ? content.entries.map(entry => entry.id) : sections.entries.map(entry => entry.id);
  return { lookup: { choice: ids[0], confidence: 1, probabilities: Object.fromEntries([...ids, 'none'].map((id, index) => [id, index === 0 ? 1 : 0])) } };
}` : `async () => (${name === 'journal' ? '{ situation: { noul: 1 }, action: { noul: 1 }, next_step: { noul: 0 }, when: { noul: 0 }, distress: { noul: 0 } }' : name === 'conversation' ? "{ branch: { choice: 'acknowledge', confidence: 1 } }" : name === 'live-feedback' ? '{ three_actions: { noul: 1 }, observable: { noul: 1 }, when: { noul: 0 }, commitments: { noul: 1 } }' : name === 'misconception' ? "{ misconception: { choice: 'rereading', confidence: 1 } }" : '{ stonewalling: { noul: 1 }, pause: { noul: 1 }, return: { noul: 0 } }'})`};
const injectedAsk = window.lpAsk === null ? undefined : Object.assign(window.lpAsk ?? fakeAsk, { config: async () => mockConfig });` : ''}
const roots = document.querySelectorAll('[data-lp-pattern]');
${name === 'journal' ? `import { browserState } from '../lib/browser-state.js';
// A reload keeps the entry; closing the tab clears it.
const states = [...roots].map(root => window.lpState ?? (stored => ({
  read: () => window.lpSeed ?? stored.read(),
  write: value => { stored.write(value); window.lpSaved = value; }
}))(browserState({ pattern: 'journal', lang: '${lang}', id: root.querySelector('textarea').id })));` : ''}
window.lpInstances = [...roots].map((root, index) => enhance(root, { content: contentFor(root), strings: strings.${lang}, state${name === 'course-lookup' ? ': window.lpState' : name === 'journal' ? ': states[index]' : ''}${AI_PATTERNS.includes(name) ? ', ask: injectedAsk' : ''} }));
window.lpEnhance = () => enhance(roots[0], { content: contentFor(roots[0]), strings: strings.${lang}, state${name === 'course-lookup' ? ': window.lpState' : name === 'journal' ? ': states[0]' : ''}${AI_PATTERNS.includes(name) ? ', ask: injectedAsk' : ''} });
window.lpReady = true;
</script></body></html>`;
}

function index(list) {
  const items = list.map(({ name, meta, preview }) => `<h2>${escapeHtml(meta.title.en)}</h2>
<p>${escapeHtml(meta.summary)}</p>
${preview ? name === 'course-lookup' ? `<div class="lp lp-preview"><p class="lp-stem" id="lookup-preview-prompt">${escapeHtml(preview.prompt)}</p><textarea class="lp-input" rows="2" aria-labelledby="lookup-preview-prompt" readonly></textarea></div>` : name === 'live-feedback' ? `<div class="lp lp-preview lp-live-feedback" aria-label="Feedback while you type preview"><p class="lp-stem" id="live-preview-prompt">${escapeHtml(preview.prompt)}</p><textarea class="lp-input" rows="5" aria-labelledby="live-preview-prompt" placeholder="I will…" readonly></textarea><ul class="lp-live-feedback-results" role="list">${preview.criteria.map(item => `<li class="lp-live-feedback-item" data-lp-mark="todo"><span class="lp-live-feedback-bullet" aria-hidden="true"></span><span>${escapeHtml(item.todo)}</span></li>`).join('')}</ul></div>` : name === 'journal' ? `<div class="lp lp-preview lp-journal" aria-label="Journal with one nudge preview"><p class="lp-stem" id="journal-preview-prompt">${escapeHtml(preview.prompt)}</p><textarea class="lp-input lp-journal-page" rows="5" aria-labelledby="journal-preview-prompt" placeholder="This week, I…" readonly></textarea><p class="lp-journal-result">${escapeHtml(preview.questions[2].text)}</p></div>` : name === 'conversation' ? `<div class="lp lp-preview lp-conversation" aria-label="Talk it through preview"><header class="lp-scene"><span class="lp-conversation-avatar" aria-hidden="true">${escapeHtml(preview.person.initial)}</span><div><p class="lp-scene-title">${escapeHtml(preview.person.name)}</p></div></header><p>${escapeHtml(preview.setup)}</p><p class="lp-conversation-bubble">${escapeHtml(preview.opening)}</p></div>` : name === 'misconception' ? `<div class="lp lp-preview" aria-label="Spot the misconception preview"><p class="lp-stem" id="misconception-preview-question">${escapeHtml(preview.question)}</p><textarea class="lp-input" rows="3" aria-labelledby="misconception-preview-question" placeholder="Type your answer here…" readonly></textarea><p class="lp-run-in lp-misconception-heading">${escapeHtml(preview.misconceptions[0].label)}</p><p>${escapeHtml(preview.misconceptions[0].why)}</p></div>` : `<div class="lp lp-box lp-preview" aria-label="Explain it back preview"><p class="lp-stem">${escapeHtml(preview.task)}</p><ol class="lp-choices" style="list-style:none">${preview.ideas.map((idea, index) => `<li class="lp-choice"><span class="lp-choice-key" aria-hidden="true">${index + 1}</span><span>${escapeHtml(idea.label)}</span></li>`).join('')}</ol></div>` : ''}
<ul><li><a href="./${name}/en">English demo</a></li><li><a href="./${name}/fr" hreflang="fr" lang="fr">${escapeHtml(meta.title.fr)}</a></li><li><a href="./${name}.md">Markdown for agents</a></li></ul>`).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Learning patterns preview</title>
<link rel="stylesheet" href="./lib/base.css">
<link rel="stylesheet" href="./patterns/live-feedback/pattern.css">
<link rel="stylesheet" href="./patterns/misconception/pattern.css">
<link rel="stylesheet" href="./patterns/conversation/pattern.css">
<link rel="stylesheet" href="./patterns/journal/pattern.css">
<style>body{margin:0;padding:1rem;color:#202124;font:1rem/1.5 system-ui,sans-serif}main{max-width:40rem;margin:auto}h1{font-size:1.5rem}h2{font-size:1.2rem;margin-top:2rem}</style></head>
<body><main><h1>Learning patterns preview</h1>
<p>Unlisted preview. None of these patterns has been tried with learners yet.</p>
${items}
</main></body></html>
`;
}
