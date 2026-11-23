import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import { icons } from '../lib/icons.js';
import { frenchTypography } from '../lib/html.js';
import { readComponentMeta, readMeta } from '../scripts/pattern-meta.mjs';
import { checkFrenchSections } from './readme-checks.js';

const root = new URL('../', import.meta.url);
const COMPONENTS = ['buttons', 'choice', 'feedback', 'progress', 'text-response'];
const SECTIONS = ['Use it when', 'Avoid it when', 'Markup', 'Accessibility', 'Copy these files', 'Used by', 'Licence'];
const ICONS = new Set(Object.values(icons));

/** @param {string} html */
function tags(html) {
  return [...html.matchAll(/<([a-z][a-z0-9]*)((?:\s+[^\s=>/]+(?:="[^"]*")?)*)\s*\/?>/gi)].map(([source, name, rest]) => ({
    source,
    name: name.toLowerCase(),
    attrs: Object.fromEntries([...rest.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)].map(([, key, value]) => [key, value ?? '']))
  }));
}

/** @param {string} html */
function textNodes(html) {
  return [...html.replace(/<(style|title)>[\s\S]*?<\/\1>/g, '').matchAll(/>([^<]+)</g)].map(match => match[1]).filter(text => text.trim());
}

/** @param {string} html @param {{ name: string, lang: string, css: boolean }} options */
function checkExample(html, { name, lang, css }) {
  assert.match(html, new RegExp(`^<!doctype html>\\r?\\n<html lang="${lang}">`), 'page language');
  assert.ok(html.includes('<link rel="stylesheet" href="../../lib/base.css">'), 'links lib/base.css');
  assert.equal(html.includes('<link rel="stylesheet" href="component.css">'), css, 'links component.css exactly when the component has one');
  assert.doesNotMatch(html, /<script/i, 'works without JavaScript');
  const all = tags(html);
  const sections = all.filter(tag => tag.name === 'section');
  assert.ok(sections.length, 'has an example section');
  for (const section of sections) assert.deepEqual(section.attrs, { class: 'lp', lang, 'data-lp-component': name }, section.source);
  const ids = all.map(tag => tag.attrs.id).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  const known = new Set(ids);
  const inside = tags(html.slice(html.indexOf('<section')));
  for (const tag of inside) {
    for (const token of (tag.attrs.class ?? '').split(/\s+/).filter(Boolean)) assert.match(token, /^lp(?:-|$)/, `class ${token} uses the lp prefix`);
    for (const key of ['aria-describedby', 'aria-labelledby', 'for']) {
      for (const id of (tag.attrs[key] ?? '').split(/\s+/).filter(Boolean)) assert.ok(known.has(id), `${key} points at missing id ${id}`);
    }
  }
  const labelled = new Set(all.filter(tag => tag.name === 'label').map(tag => tag.attrs.for));
  for (const control of all.filter(tag => ['input', 'textarea', 'select'].includes(tag.name))) {
    assert.ok(labelled.has(control.attrs.id) || control.attrs['aria-labelledby'], `${control.source} has a label`);
  }
  const described = all.flatMap(tag => (tag.attrs['aria-describedby'] ?? '').split(/\s+/).map(id => ({ id, invalid: tag.attrs['aria-invalid'] === 'true' })));
  for (const error of all.filter(tag => /\blp-error-text\b/.test(tag.attrs.class ?? '') && tag.attrs.id)) {
    const links = described.filter(entry => entry.id === error.attrs.id);
    if ('hidden' in error.attrs) assert.equal(links.length, 0, `hidden error ${error.attrs.id} is not yet a description`);
    else assert.ok(links.length && links.every(entry => entry.invalid), `shown error ${error.attrs.id} describes an invalid control`);
  }
  for (const [svg] of html.matchAll(/<svg[\s\S]*?<\/svg>/g)) assert.ok(ICONS.has(svg), 'each icon is copied unchanged from lib/icons.js');
  if (lang === 'fr') {
    for (const text of textNodes(html)) {
      assert.doesNotMatch(text, /\p{L}'\p{L}/u, `straight apostrophe in "${text}"`);
      assert.equal(frenchTypography(text, 'fr'), text, `French spacing in "${text}"`);
    }
  }
}

/** @param {string} html */
const skeleton = html => html.replace(/<title>[^<]*<\/title>/, '').replace(/lang="(?:en|fr)"/g, 'lang').replace(/>[^<]*</g, '><');

const sample = await readFile(new URL('components/text-response/en.html', root), 'utf8');
const frenchSample = await readFile(new URL('components/text-response/fr.html', root), 'utf8');

test('example guard accepts the sample and catches planted violations', () => {
  const options = { name: 'text-response', lang: 'en', css: false };
  assert.doesNotThrow(() => checkExample(sample, options));
  const planted = [
    [sample.replace('<html lang="en">', '<html>'), /page language/],
    [sample.replace('href="../../lib/base.css"', 'href="base.css"'), /lib\/base.css/],
    [sample.replace('</head>', '<link rel="stylesheet" href="component.css">\n</head>'), /component.css/],
    [sample.replace('</main>', '<script>1</script></main>'), /without JavaScript/],
    [sample.replace('data-lp-component="text-response"', 'data-lp-component="choice"'), /<section/],
    [sample.replace('id="invalid-hint"', 'id="empty-hint"'), /unique/],
    [sample.replace('class="lp-label" for="empty-answer"', 'class="label" for="empty-answer"'), /lp prefix/],
    [sample.replace('aria-describedby="empty-hint"', 'aria-describedby="empty-tip"'), /missing id empty-tip/],
    [sample.replace('<label class="lp-label" for="empty-answer">', '<label class="lp-label">'), /has a label/],
    [sample.replace('aria-describedby="empty-hint"', 'aria-describedby="empty-hint empty-error"'), /hidden error empty-error/],
    [sample.replace(' aria-invalid="true"', ''), /shown error invalid-error/],
    [sample.replace('stroke-width="2"', 'stroke-width="1.5"'), /lib\/icons.js/]
  ];
  for (const [html, message] of planted) assert.throws(() => checkExample(html, options), message);
  assert.doesNotThrow(() => checkExample(frenchSample, { ...options, lang: 'fr' }));
  assert.throws(() => checkExample(frenchSample.replace('Deux ou trois phrases suffisent.', 'C\'est assez.'), { ...options, lang: 'fr' }), /straight apostrophe/);
  assert.throws(() => checkExample(frenchSample.replace('Deux ou trois phrases suffisent.', 'Deux phrases suffisent ?'), { ...options, lang: 'fr' }), /French spacing/);
});

test('the components folder holds exactly the documented components', async () => {
  const folders = (await readdir(new URL('components/', root), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
  assert.deepEqual(folders.sort(), COMPONENTS);
});

for (const name of COMPONENTS) test(`${name} examples work without JavaScript and match across languages`, async () => {
  const css = await access(new URL(`components/${name}/component.css`, root)).then(() => true, () => false);
  const pages = {};
  for (const lang of ['en', 'fr']) {
    pages[lang] = await readFile(new URL(`components/${name}/${lang}.html`, root), 'utf8');
    checkExample(pages[lang], { name, lang, css });
  }
  assert.equal(skeleton(pages.fr), skeleton(pages.en), 'English and French examples have the same structure');
});

test('feedback examples keep one empty status region per activity', async () => {
  for (const lang of ['en', 'fr']) {
    const html = await readFile(new URL(`components/feedback/${lang}.html`, root), 'utf8');
    for (const section of html.split('<section').slice(1)) {
      assert.equal(section.match(/role="status"/g)?.length, 1);
      assert.match(section, /<p class="lp-visually-hidden" role="status" aria-atomic="true"><\/p>/);
    }
  }
});

test('the progress line puts the count first and hides the bar', async () => {
  for (const [lang, text] of [['en', 'Question 2 of 5'], ['fr', 'Question 2 sur 5']]) {
    const html = await readFile(new URL(`components/progress/${lang}.html`, root), 'utf8');
    assert.ok(html.includes(`<p class="lp-progress"><span>${text}</span><span class="lp-progress-bar" aria-hidden="true"><span style="inline-size: 40%"></span></span></p>`));
    assert.doesNotMatch(html, /role="progressbar"|aria-live|role="status"|<progress/);
  }
});

test('component meta reads titles and summary and refuses pattern keys', () => {
  const readme = '---\ntitle: Progress line\ntitle_fr: Ligne de progression\nsummary: Where learners are.\n---\n# Progress line\n';
  assert.deepEqual(readComponentMeta('progress', readme), { title: { en: 'Progress line', fr: 'Ligne de progression' }, summary: 'Where learners are.' });
  assert.throws(() => readComponentMeta('progress', readme.replace('summary: Where learners are.\n', '')), /needs summary/);
  assert.throws(() => readComponentMeta('progress', readme.replace('---\n#', 'section: question\n---\n#')), /unknown front matter key section/);
  assert.throws(() => readComponentMeta('progress', '# Progress line\n'), /missing front matter/);
});

/** @param {string} readme @param {string} name */
function checkReadme(readme, name) {
  const prose = readme.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, '');
  assert.match(readme, new RegExp(`^---\\r?\\n[\\s\\S]*?\\r?\\n---\\r?\\n# ${readComponentMeta(name, readme).title.en}\\r?\\n`), 'front matter, then the title');
  assert.deepEqual([...prose.matchAll(/^## ([^\r\n]+)\r?$/gm)].map(match => match[1]), SECTIONS);
  const section = heading => prose.split(new RegExp(`^## ${heading}\\r?$`, 'm'))[1].split(/^## /m)[0].trim();
  for (const heading of SECTIONS) assert.ok(section(heading), `${heading} is empty`);
  const use = section('Use it when').split(/\r?\n/);
  assert.ok(use.length <= 4 && use.every(item => /^- \S/.test(item)), 'Use it when needs one to four single-line bullets');
  assert.ok(section('Avoid it when').split(/\r?\n/).every(item => /^- (?:If|When)\s+\S[^\r\n]*[.!?]$/.test(item)), 'Each Avoid it when bullet is a condition starting with If or When');
  assert.match(section('Copy these files'), /`lib\/base\.css`/, 'Copy these files names lib/base.css');
  assert.doesNotMatch(prose, /—/, 'em dash');
  const snippets = [...readme.matchAll(/^```html\r?\n([\s\S]*?)^```/gm)].map(match => match[1].trim().split(/\r?\n/));
  assert.ok(snippets.length, 'Markup has an HTML snippet');
  for (const lines of snippets) {
    const wrapped = lines[0] === '<section class="lp" lang="en">' && lines.at(-1) === '</section>' && lines.slice(1, -1).every(line => /^\s+\S/.test(line));
    assert.ok(wrapped, 'each HTML snippet sits inside one .lp section');
  }
}

test('README guard catches missing sections, wrong order and em dashes', async () => {
  const readme = await readFile(new URL('components/progress/README.md', root), 'utf8');
  assert.doesNotThrow(() => checkReadme(readme, 'progress'));
  assert.throws(() => checkReadme(readme.replace('## Used by', '## Patterns'), 'progress'));
  assert.throws(() => checkReadme(readme.replace('## Markup', '## Temporary').replace('## Accessibility', '## Markup').replace('## Temporary', '## Accessibility'), 'progress'));
  assert.throws(() => checkReadme(readme.replace('# Progress line', '# Progress'), 'progress'), /front matter, then the title/);
  assert.throws(() => checkReadme(readme.replace('- When all the questions', '- All the questions'), 'progress'), /Avoid it when/);
  assert.throws(() => checkReadme(readme.replaceAll('`lib/base.css`', 'the base styles'), 'progress'), /lib\/base.css/);
  const unwrapped = readme.replace('<section class="lp" lang="en">\n  <p class="lp-progress">', '<p class="lp-progress">').replace('</p>\n</section>\n```', '</p>\n```');
  assert.throws(() => checkReadme(unwrapped, 'progress'), /inside one .lp section/);
  assert.throws(() => checkReadme(readme.replace('</section>\n```', '</section>\n<p class="lp-small">Outside.</p>\n```'), 'progress'), /inside one .lp section/);
  assert.throws(() => checkReadme(readme.replace('```html', '```text'), 'progress'), /HTML snippet/);
  assert.throws(() => checkReadme(readme.replace('A line of text', 'A line — of text'), 'progress'), /em dash/);
});

test('component READMEs have the shared sections, working links, files to copy and French sections', async () => {
  /** @type {Record<string, string>} */
  const titlesFr = {};
  for (const entry of await readdir(new URL('patterns/', root), { withFileTypes: true })) {
    if (entry.isDirectory()) titlesFr[entry.name] = readMeta(entry.name, await readFile(new URL(`patterns/${entry.name}/README.md`, root), 'utf8')).title.fr;
  }
  for (const name of COMPONENTS) titlesFr[name] = readComponentMeta(name, await readFile(new URL(`components/${name}/README.md`, root), 'utf8')).title.fr;
  for (const name of COMPONENTS) {
    const folder = new URL(`components/${name}/`, root);
    const readme = await readFile(new URL('README.md', folder), 'utf8');
    checkReadme(readme, name);
    for (const [, target] of readme.matchAll(/\]\((?!https?:)([^)#]+)\)/g)) await access(new URL(target, folder));
    const copy = readme.split(/^## Copy these files\r?$/m)[1].split(/^## /m)[0];
    for (const [, path] of copy.matchAll(/`((?:lib|components)\/[^`]+)`/g)) await access(new URL(path, root));
    const fr = await readFile(new URL('README.fr.md', folder), 'utf8');
    assert.doesNotThrow(() => checkFrenchSections(fr, readme, titlesFr), `${name}/README.fr.md`);
  }
});

test('the root README lists every component', async () => {
  const readme = await readFile(new URL('README.md', root), 'utf8');
  for (const name of COMPONENTS) assert.ok(readme.includes(`](components/${name}/README.md)`), `README.md does not list ${name}`);
});
