import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import ts from 'typescript';

// These are different rules: uncertainty has no answer state; explanation feedback is Found/To add/
// Not sure; live feedback marks checklist progress as done/todo, without answer-row badges.
// write-distractors owns the server row's opening tag; its badge uses renderChoiceMark.
const exceptions = {
  'dont-know': [/^mark\.className = 'lp-choice-mark lp-neutral';$/],
  'explain-back': [/^return `<li class="lp-choice" data-lp-mark="\$\{found \? 'correct' : missed \? 'missing' : 'unsure'\}"/],
  'live-feedback': [
    /^row\.dataset\.lpMark = item\.mark;$/,
    // The initial todo is checklist progress, not an answer mark.
    /^<ul class="lp-live-feedback-results".*data-lp-mark="todo"/
  ],
  'write-distractors': [/^return `<li class="lp-choice lp-write-distractors-preview-row"\$\{mark \? ' data-lp-mark="correct"' : ''\}>$/]
};
function memberName(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) return node.argumentExpression.text;
}
function datasetMark(node) {
  return memberName(node) === 'lpMark' && memberName(node.expression) === 'dataset';
}
function allowedRead(node) {
  let argument = node, parent = node.parent;
  // Only expressions that pass text through to the read argument inherit its exemption.
  while (parent && (ts.isParenthesizedExpression(parent)
    || ts.isConditionalExpression(parent) && (parent.whenTrue === argument || parent.whenFalse === argument)
    || ts.isTemplateSpan(parent) || ts.isTemplateExpression(parent))) {
    argument = parent;
    parent = parent.parent;
  }
  return parent && ts.isCallExpression(parent) && parent.arguments.includes(argument)
    && (['querySelector', 'querySelectorAll', 'closest', 'matches', 'getElementsByClassName'].includes(memberName(parent.expression))
      || memberName(parent.expression) === 'contains' && memberName(parent.expression.expression) === 'classList');
}
function violations(source, pattern) {
  const tree = ts.createSourceFile('pattern.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const lines = source.split(/\r?\n/), found = new Set();
  function visit(node) {
    const assignment = ts.isBinaryExpression(node)
      && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
      && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment;
    const datasetWrite = assignment && datasetMark(node.left)
      || ts.isDeleteExpression(node) && datasetMark(node.expression);
    const attribute = ts.isCallExpression(node)
      ? node.arguments[['setAttributeNS', 'removeAttributeNS'].includes(memberName(node.expression)) ? 1 : 0] : undefined;
    const attributeWrite = ts.isCallExpression(node)
      && ['setAttribute', 'removeAttribute', 'toggleAttribute', 'setAttributeNS', 'removeAttributeNS'].includes(memberName(node.expression))
      && attribute && ts.isStringLiteralLike(attribute) && attribute.text === 'data-lp-mark';
    const propertyWrite = (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node))
      && (node.name.text === 'lpMark' || ts.isComputedPropertyName(node.name)
        && ts.isStringLiteralLike(node.name.expression) && node.name.expression.text === 'lpMark');
    const read = allowedRead(node);
    // Join only the template's own text, leaving nested expressions to their own visits.
    const text = ts.isTemplateExpression(node)
      ? [node.head.text, ...node.templateSpans.map(span => span.literal.text)].join('${}')
      : ts.isStringLiteralLike(node) ? node.text : '';
    const classWrite = /(?:^|\s)lp-choice-mark(?:\s|$)/.test(text) && !read;
    const badgeWrite = (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node))
      && (/<[^>]*\blp-choice-mark\b/.test(node.text)
        || /(?:<[^>]*|^\s*)\bdata-lp-mark\s*=/.test(node.text))
      || ts.isTemplateExpression(node) && (/<[^>]*\blp-choice-mark\b/.test(text) || /<[^>]*\bdata-lp-mark\s*=/.test(text));
    if (datasetWrite || attributeWrite || propertyWrite || classWrite || badgeWrite) {
      const line = lines[tree.getLineAndCharacterOfPosition(node.getStart(tree)).line].trim();
      if (!(exceptions[pattern] ?? []).some(allowed => allowed.test(line))) found.add(line);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return [...found];
}

test('pattern scripts delegate answer-row marks to lib/choice-mark.js', async () => {
  const patterns = new URL('../patterns/', import.meta.url);
  for (const entry of await readdir(patterns, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const folder = new URL(`${entry.name}/`, patterns);
    for (const file of await readdir(folder, { recursive: true })) {
      if (!file.endsWith('.js') || file.endsWith('.test.js') || file.split(/[\\/]/).at(-1) === 'strings.js') continue;
      const source = await readFile(new URL(file.replaceAll('\\', '/'), folder), 'utf8');
      assert.deepEqual(violations(source, entry.name), [], `${entry.name}/${file}`);
    }
  }
});

test('mark guard catches planted markup, attribute and dataset writes', () => {
  for (const source of [
    'mark.className = "lp-choice-mark lp-met";',
    'row.innerHTML = `<span class="lp-choice-mark lp-met">Correct</span>`;',
    'row.dataset.lpMark = "correct";',
    'row.dataset["lpMark"] = "wrong";',
    'delete row.dataset.lpMark;',
    'delete row["dataset"]["lpMark"];',
    'row.setAttribute("data-lp-mark", "correct");',
    'row.removeAttribute("data-lp-mark");',
    'row["setAttribute"]("data-lp-mark", "correct");',
    'row["removeAttribute"]("data-lp-mark");',
    'row.innerHTML = `<li data-lp-mark="correct">Answer</li>`;',
    'row.innerHTML = `<span class="lp-choice-mark ${tone}">${word}</span>`;',
    'row.classList.add("lp-choice-mark");',
    'row.classList.add(`lp-choice-mark ${tone}`);',
    'row["classList"]["toggle"]("lp-choice-mark");',
    'row.setAttribute("class", "lp-choice-mark lp-met");',
    'row["setAttribute"]("class", `lp-choice-mark ${tone}`);'
  ]) assert.deepEqual(violations(source, 'new-pattern'), [source]);
  assert.deepEqual(violations('row.querySelector(".lp-choice-mark");', 'new-pattern'), []);
  assert.notDeepEqual(violations('row.dataset\n.lpMark = "correct";', 'new-pattern'), []);
  assert.notDeepEqual(violations('mark.className =\n "lp-choice-mark lp-met";', 'new-pattern'), []);
  // An exception does not permit another answer-mark implementation in the same pattern.
  assert.deepEqual(violations('row.dataset.lpMark = "correct";', 'dont-know'), ['row.dataset.lpMark = "correct";']);
});

test('mark guard allows class, dataset and selector reads', () => {
  for (const source of [
    'row.classList.contains("lp-choice-mark");',
    'row.classList.contains(("lp-choice-mark"));',
    'row.classList.contains(x ? "lp-choice-mark" : "lp-met");',
    'row["classList"]["contains"]("lp-choice-mark");',
    'row.dataset.lpMark === "wrong";',
    'row.getAttribute("data-lp-mark");',
    'row.querySelector(".lp-choice-mark");',
    'row.querySelector("lp-choice-mark");',
    'row.querySelectorAll("lp-choice-mark");',
    'row.closest("lp-choice-mark");',
    'row.matches("lp-choice-mark");',
    'row.querySelectorAll(`lp-choice-mark ${selector}`);',
    'row.querySelectorAll(`.${x ? "lp-choice-mark" : "lp-met"}`);',
    'row.getElementsByClassName("lp-choice-mark");',
    'row.matches(".lp-choice-mark");',
    'row["querySelectorAll"](".lp-choice-mark");',
    'row.closest(".lp-choice-mark");',
    'row.classList.contains(`lp-choice-mark`);',
    'row.classList.contains("lp-choice-mark-other");',
    'const tone = "lp-choice-mark-other";',
    'const d = row.dataset; d.lpMark = "correct";',
    'const A = "data-lp-mark"; row.setAttribute(A, "correct");',
    `row.querySelector('.lp-choice[data-lp-mark="wrong"]');`,
    `row.querySelectorAll('[data-lp-mark="correct"]');`,
    `row.closest(':is(.lp-choice[data-lp-mark="missed"])');`
  ]) assert.deepEqual(violations(source, 'new-pattern'), [], source);
});

for (const source of [
  'row.innerHTML = `<span ${attrs} class="lp-choice-mark lp-met">Correct</span>`;',
  'row.innerHTML = `<li ${attrs} data-lp-mark="correct">Answer</li>`;',
  'row.innerHTML = `<li ${attrs} title="hint" data-lp-mark="correct">A</li>`;',
  'mark.classList.value = "lp-choice-mark lp-met";',
  'mark["classList"]["value"] = "lp-choice-mark lp-met";',
  'el("span", { className: "lp-choice-mark lp-met" });',
  'el("li", { dataset: { lpMark: "correct" } });',
  'el("li", { dataset: { "lpMark": "correct" } });',
  'el("li", { dataset: { ["lpMark"]: "correct" } });',
  'Object.assign(row.dataset, { lpMark: "correct" });',
  'const lpMark = "correct"; el("li", { dataset: { lpMark } });',
  'const classes = "lp-choice-mark lp-met";',
  'mark.className = ("lp-choice-mark");',
  'mark.className = x ? "lp-choice-mark" : "lp-met";',
  'mark.className = `${x ? "lp-choice-mark" : "lp-met"}`;',
  'row.classList.contains(write("lp-choice-mark"));',
  'row.toggleAttribute("data-lp-mark", true);',
  'row["toggleAttribute"]("data-lp-mark");',
  'row.setAttributeNS(null, "data-lp-mark", "correct");',
  'row["setAttributeNS"](null, "data-lp-mark", "correct");',
  'row.removeAttributeNS(null, "data-lp-mark");',
  'row["removeAttributeNS"](null, "data-lp-mark");'
]) {
  test(`mark guard catches ${source}`, () => {
    assert.deepEqual(violations(source, 'new-pattern'), [source]);
  });
}
