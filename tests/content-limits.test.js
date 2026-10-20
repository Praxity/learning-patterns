import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

for (const pattern of await readdir(new URL('../patterns/', import.meta.url))) {
  const base = new URL(`../patterns/${pattern}/`, import.meta.url);
  const schema = JSON.parse(await readFile(new URL('content.schema.json', base)));
  const { validateContent } = await import(new URL('logic.js', base));
  function resolve(node) {
    if (!node.$ref) return node;
    const base = resolve(schema.$defs[node.$ref.split('/').at(-1)]);
    return { ...base, ...node, properties: { ...base.properties, ...node.properties } };
  }
  function visit(value, node, path, set, root) {
    node = resolve(node);
    if (typeof value === 'string' && !node.enum && !Object.hasOwn(node, 'const')) {
      assert.ok(Number.isInteger(node.maxLength), `${pattern}.${path} has a schema limit`);
      const field = path.split('.').at(-1);
      // Identities and evidence also have reference constraints, checked by their pattern tests.
      if (!['id', 'correct', 'misconception', 'evidence'].includes(field)) {
        const boundary = structuredClone(root);
        set(boundary, value + 'x'.repeat(node.maxLength - [...value].length));
        assert.doesNotThrow(() => validateContent(boundary), `${pattern}.${path} accepts its schema limit`);
      }
      const planted = structuredClone(root);
      set(planted, 'x'.repeat(node.maxLength + 1));
      assert.throws(() => validateContent(planted), error => error.message.includes(path.split('.').at(-1)), `${pattern}.${path} rejects an overlong string`);
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => visit(item, node.prefixItems?.[i] ?? node.items, `${path}[${i}]`, (copy, text) => {
        const array = [...path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)].map(match => match[1] ?? Number(match[2])).reduce((v, key) => v[key], copy);
        array[i] = text;
      }, root));
    } else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        const child = node.properties?.[key] ?? node.additionalProperties;
        if (!child || typeof child !== 'object') continue;
        const keys = [...path.matchAll(/([^.[\]]+)|\[(\d+)\]/g)].map(match => match[1] ?? Number(match[2]));
        visit(item, child, path ? `${path}.${key}` : key, (copy, text) => {
          const parent = keys.reduce((v, key) => v[key], copy); parent[key] = text;
        }, root);
      }
    }
  }
  test(`${pattern}: every shipped authored string is bounded in schema and validator`, async () => {
    for (const name of await readdir(new URL('examples/', base))) {
      const content = JSON.parse(await readFile(new URL(`examples/${name}`, base)));
      assert.doesNotThrow(() => validateContent(content));
      visit(content, schema, '', () => {}, content);
    }
  });
}
