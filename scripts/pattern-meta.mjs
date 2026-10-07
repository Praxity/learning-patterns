// Each pattern README starts with flat front matter. It owns the facts the index and the
// praxity.io cards show: titles, one-line summary, section, and the three facets.
export const SECTIONS = ['question', 'reading', 'conversation', 'course', 'authors'];
const YES_NO = ['yes', 'no'];
const REQUIRED = {
  title: null,
  title_fr: null,
  summary: null,
  section: SECTIONS,
  ai: YES_NO,
  offline: YES_NO,
  learners: ['not tried', 'tried']
};

/**
 * @param {string} name pattern folder name, used in error messages
 * @param {string} readme the README text
 * @returns {{ title: { en: string, fr: string }, summary: string, section: string, ai: boolean, offline: boolean, learners: string }}
 */
export function readMeta(name, readme) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(readme);
  if (!match) throw new Error(`${name}/README.md: missing front matter`);
  /** @type {Record<string, string>} */
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([a-z_]+):\s*(.+)$/.exec(line);
    if (!pair) throw new Error(`${name}/README.md: unreadable front matter line "${line}"`);
    fields[pair[1]] = pair[2].trim();
  }
  for (const [key, allowed] of Object.entries(REQUIRED)) {
    const value = fields[key];
    if (!value) throw new Error(`${name}/README.md: front matter needs ${key}`);
    if (allowed && !allowed.includes(value)) throw new Error(`${name}/README.md: ${key} must be one of ${allowed.join(', ')}`);
  }
  for (const key of Object.keys(fields)) {
    if (!(key in REQUIRED)) throw new Error(`${name}/README.md: unknown front matter key ${key}`);
  }
  return {
    title: { en: fields.title, fr: fields.title_fr },
    summary: fields.summary,
    section: fields.section,
    ai: fields.ai === 'yes',
    offline: fields.offline === 'yes',
    learners: fields.learners
  };
}
