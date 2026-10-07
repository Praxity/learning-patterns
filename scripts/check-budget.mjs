import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';

export const BUDGET = 10 * 1024;

// Measure each shipped module separately, as browsers receive separate ES modules.
export async function checkBudget(root) {
  const results = [];
  for (const block of await readdir(resolve(root, 'blocks'), { withFileTypes: true })) {
    if (!block.isDirectory()) continue;
    const seen = new Set();
    let bytes = 0;
    async function visit(file) {
      if (seen.has(file)) return;
      seen.add(file);
      const source = await readFile(file, 'utf8');
      bytes += gzipSync(source).length;
      const imports = [];
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
      function scan(node) {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
          imports.push(node.moduleSpecifier);
        }
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          imports.push(node.arguments[0]);
        }
        ts.forEachChild(node, scan);
      }
      scan(tree);
      for (const spec of imports) {
        if (!spec || !ts.isStringLiteralLike(spec)) throw new Error(`Unmeasurable import in ${relative(root, file)}`);
        if (!spec.text.startsWith('.')) throw new Error(`Runtime dependency import: ${spec.text}`);
        const dependency = resolve(dirname(file), spec.text);
        const path = relative(root, dependency);
        if (path === '..' || path.startsWith(`..${sep}`) || resolve(root, path) !== dependency) {
          throw new Error(`Outside-root import: ${spec.text}`);
        }
        await visit(dependency);
      }
    }
    await visit(resolve(root, 'blocks', block.name, 'enhance.js'));
    if (bytes > BUDGET) throw new Error(`${block.name}: ${bytes} gzip bytes exceeds ${BUDGET}`);
    results.push({ block: block.name, bytes, modules: seen.size });
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  for (const result of await checkBudget(root)) console.log(`${result.block}: ${result.bytes}/${BUDGET} gzip bytes (${result.modules} modules)`);
}
