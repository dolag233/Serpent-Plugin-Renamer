'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderRenameDialog, optionsFromWidgetValues } = require('../src/dialog-ui');

function createFakeUi() {
  return {
    state(initial) {
      let value = initial;
      return { get: () => value, set: (next) => { value = next; } };
    },
    column(...children) { return { type: 'column', children }; },
    row(...children) { return { type: 'row', children }; },
    note(text) { return { type: 'note', text }; },
    heading(text) { return { type: 'heading', text }; },
    separator() { return { type: 'separator' }; },
    text(spec) { return { type: 'text', ...spec }; },
    list(spec) { return { type: 'list', ...spec }; },
  };
}

test('renders editable rename controls and a two-column preview list', () => {
  const tree = renderRenameDialog(createFakeUi(), [
    { id: 'asset-1', name: 'first.png' },
    { id: 'asset-2', name: 'second.jpg' },
  ]);
  const list = tree.children.find((child) => child?.type === 'list');
  assert.ok(list);
  assert.deepEqual(list.columns, ['原文件名', '重命名后']);
  assert.deepEqual(list.rows, [['first.png', 'first.png'], ['second.jpg', 'second.jpg']]);
  const fields = tree.children
    .flatMap((child) => child?.type === 'row' ? child.children : [])
    .filter((child) => child?.type === 'text');
  assert.deepEqual(fields.map((field) => field.id), [
    'prefix', 'suffix', 'keyword', 'keywordReplacement', 'regexPattern', 'regexReplacement', 'regexFlags',
  ]);
});

test('normalizes submitted widget values', () => {
  assert.deepEqual(optionsFromWidgetValues({ prefix: 'x-', keyword: 'old' }), {
    prefix: 'x-',
    suffix: '',
    keyword: 'old',
    keywordReplacement: '',
    regexPattern: '',
    regexReplacement: '',
    regexFlags: 'g',
  });
});
