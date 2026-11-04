import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearQuestionLink, focusQuestion, questionLinks } from '../lib/question-errors.js';

// Only the DOM operations used by the helper; pattern interactions run in browser specs.
function element(tag, document) {
  return {
    tag, ownerDocument: document, dataset: {}, children: [], hidden: false,
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } },
    remove() { this.parent.children = this.parent.children.filter(node => node !== this); },
    querySelectorAll(tag) { return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.querySelectorAll(tag)]); },
    querySelector(tag) { return this.querySelectorAll(tag)[0] ?? null; },
    addEventListener(name, callback) { this[name] = callback; }
  };
}

test('summary clears only the answered entry and hides after the last answer', () => {
  const document = { createElement(tag) { return element(tag, this); } };
  const summary = element('div', document);
  const questions = ['one', 'two', 'three'].map(id => ({ fieldset: { id }, text: id, focus() {} }));
  questionLinks(summary, questions);
  clearQuestionLink(summary, questions[0].fieldset);
  assert.deepEqual(summary.querySelectorAll('li').map(item => item.dataset.lpQuestionTarget), ['two', 'three']);
  assert.equal(summary.hidden, false);
  clearQuestionLink(summary, questions[1].fieldset);
  assert.equal(summary.hidden, false);
  clearQuestionLink(summary, questions[2].fieldset);
  assert.equal(summary.hidden, true);
});

test('summary uses focus buttons without a navigable URL', () => {
  const document = { createElement(tag) { return element(tag, this); } };
  const summary = element('div', document);
  let focused = false;
  questionLinks(summary, [{ fieldset: { id: 'one' }, text: 'Question one', focus() { focused = true; } }]);
  const button = summary.querySelector('button');
  assert.equal(button.type, 'button');
  assert.equal(button.href, undefined);
  button.click({ preventDefault() {} });
  assert.equal(focused, true);
});

for (const [top, bottom, scrolls] of [[30, 100, false], [19, 100, false], [18, 100, true], [30, 602, true]]) {
  test(`question focus scrolls only outside the padded viewport: ${top}, ${bottom}`, () => {
    const events = [];
    const legend = { getBoundingClientRect: () => ({ top }), scrollIntoView: options => events.push(['scroll', options]) };
    const input = { closest: () => ({ getBoundingClientRect: () => ({ bottom }) }), focus: options => events.push(['focus', options]) };
    focusQuestion({
      querySelector: selector => selector === 'legend' ? legend : input,
      ownerDocument: { documentElement: {}, defaultView: { innerHeight: 600, getComputedStyle: () => ({ scrollPaddingTop: '20px' }) } }
    });
    assert.deepEqual(events, [...(scrolls ? [['scroll', { block: 'start' }]] : []), ['focus', { preventScroll: true }]]);
  });
}

test('after-layout question action scrolls before focus and can be cancelled', async () => {
  const { focusAfterLayout } = await import('../lib/focus-after-layout.js');
  const originalRequest = globalThis.requestAnimationFrame;
  const originalCancel = globalThis.cancelAnimationFrame;
  const frames = new Map();
  let id = 0;
  globalThis.requestAnimationFrame = action => { frames.set(++id, action); return id; };
  globalThis.cancelAnimationFrame = frame => frames.delete(frame);
  const runFrame = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(action => action()); };
  try {
    const events = [];
    const target = { isConnected: true, focus() { events.push('default'); } };
    focusAfterLayout(target, () => events.push('after'), new AbortController().signal, () => events.push('question'));
    runFrame();
    assert.deepEqual(events, []);
    runFrame();
    assert.deepEqual(events, ['question', 'after']);
    const cancel = focusAfterLayout(target, () => {}, new AbortController().signal);
    runFrame(); cancel(); runFrame();
    assert.deepEqual(events, ['question', 'after']);
  } finally {
    globalThis.requestAnimationFrame = originalRequest;
    globalThis.cancelAnimationFrame = originalCancel;
  }
});
