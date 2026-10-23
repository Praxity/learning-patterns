import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import ts from 'typescript';

// These are different rules: uncertainty has no answer state; explanation feedback is Found/To add/
// Not sure; live feedback marks checklist progress as done/todo, without answer-row badges.
const exceptions = {
  'dont-know': [/^mark\.className = 'lp-choice-mark lp-neutral';$/],
  'explain-back': [/^return `<li class="lp-choice" data-lp-mark="\$\{found \? 'correct' : missed \? 'missing' : 'unsure'\}"/],
  'live-feedback': [/^row\.dataset\.lpMark = item\.mark;$/]
};
function violations(source, pattern) {
  const tree = ts.createSourceFile('enhance.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const lines = source.split(/\r?\n/), found = new Set();
  function visit(node) {
    const datasetWrite = ts.isBinaryExpression(node)
      && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
      && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      && /\bdataset\s*(?:\.\s*lpMark|\[\s*['"]lpMark['"]\s*\])$/.test(node.left.getText(tree));
    const attributeWrite = ts.isCallExpression(node)
      && /\.(?:setAttribute|removeAttribute)$/.test(node.expression.getText(tree))
      && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]) && node.arguments[0].text === 'data-lp-mark';
    const badgeWrite = (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node))
      && (/\blp-choice-mark\b/.test(node.text) && !/\.lp-choice-mark/.test(node.text)
        || /\bdata-lp-mark\s*=/.test(node.text));
    if (datasetWrite || attributeWrite || badgeWrite) {
      const line = lines[tree.getLineAndCharacterOfPosition(node.getStart(tree)).line].trim();
      if (!(exceptions[pattern] ?? []).some(allowed => allowed.test(line))) found.add(line);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return [...found];
}

test('enhancers delegate answer-row marks to lib/choice-mark.js', async () => {
  const patterns = new URL('../patterns/', import.meta.url);
  for (const entry of await readdir(patterns, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const source = await readFile(new URL(`${entry.name}/enhance.js`, patterns), 'utf8');
    assert.deepEqual(violations(source, entry.name), [], entry.name);
  }
});

test('mark guard catches planted markup, attribute and dataset writes', () => {
  for (const source of [
    'mark.className = "lp-choice-mark lp-met";',
    'row.innerHTML = `<span class="lp-choice-mark lp-met">Correct</span>`;',
    'row.dataset.lpMark = "correct";',
    'row.dataset["lpMark"] = "wrong";',
    'row.setAttribute("data-lp-mark", "correct");',
    'row.removeAttribute("data-lp-mark");',
    'row.innerHTML = `<li data-lp-mark="correct">Answer</li>`;',
    'row.innerHTML = `<span class="lp-choice-mark ${tone}">${word}</span>`;',
    'row.classList.add("lp-choice-mark");'
  ]) assert.deepEqual(violations(source, 'new-pattern'), [source]);
  assert.deepEqual(violations('row.querySelector(".lp-choice-mark");', 'new-pattern'), []);
  assert.notDeepEqual(violations('row.dataset\n.lpMark = "correct";', 'new-pattern'), []);
  assert.notDeepEqual(violations('mark.className =\n "lp-choice-mark lp-met";', 'new-pattern'), []);
  // An exception does not permit another answer-mark implementation in the same pattern.
  assert.deepEqual(violations('row.dataset.lpMark = "correct";', 'dont-know'), ['row.dataset.lpMark = "correct";']);
});
