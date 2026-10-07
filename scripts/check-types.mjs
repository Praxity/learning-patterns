import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

async function files(root, prefix = '') {
  const result = new Map();
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) {
      for (const [key, value] of await files(root, path)) result.set(key, value);
    } else result.set(path, (await readFile(join(root, path), 'utf8')).replaceAll('\r\n', '\n'));
  }
  return result;
}

export async function compareTypes(actual, expected) {
  const [a, b] = await Promise.all([files(actual), files(expected)]);
  if (a.size !== b.size || [...b].some(([key, value]) => a.get(key) !== value)) {
    throw new Error('types/ is stale. Run npm run types and commit the declarations.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const temporary = await mkdtemp(join(tmpdir(), 'lp-types-'));
  try {
    execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.types.json', '--outDir', temporary], { cwd: root, stdio: 'inherit' });
    await compareTypes(join(root, 'types'), temporary);
    console.log('types/ matches the source.');
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
