import assert from 'node:assert/strict';

/** @param {string} markdown @param {string} heading */
function bullets(markdown, heading) {
  const part = markdown.split(new RegExp(`^## ${heading}\\r?$`, 'm'))[1];
  return part === undefined ? [] : part.split(/^## /m)[0].trim().split(/\r?\n/).filter(Boolean);
}

const FRENCH = [['Quand l’utiliser', 'Use it when'], ['Quand l’éviter', 'Avoid it when']];
const PATTERN_LINK = /\[([^\]]*)\]\((?:\.\.\/)+(?:patterns\/)?([^/)]+)\/README\.md\)/g;

/** @param {string} fr @param {string} readme @param {Record<string, string>} titlesFr title_fr by folder */
export function checkFrenchSections(fr, readme, titlesFr) {
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
      const words = item.replace(PATTERN_LINK, 'X');
      assert.doesNotMatch(words, /\p{L}'\p{L}/u, `${heading}: straight apostrophe`);
      assert.doesNotMatch(words, /[^ ]:|[^ ][;!?]|«[^ ]|[^ ]»/u, `${heading}: French spacing needs a no-break space before ":" and a narrow one before ";!?" and inside « »`);
    }
    if (english === 'Avoid it when') {
      assert.ok(items.every(item => /^- (?:Si|Lorsque|Lorsqu’|Quand)\s*\S[^\r\n]*[.!?]$/.test(item)), 'Each Quand l’éviter bullet must be a condition starting with Si, Lorsque or Quand');
    }
  }
}
