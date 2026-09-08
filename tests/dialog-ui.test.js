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
    toggle(spec) { return { type: 'toggle', ...spec }; },
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
  assert.deepEqual(list.rows, [
    [{ segments: [{ text: 'first.png' }] }, { segments: [{ text: 'first.png' }] }],
    [{ segments: [{ text: 'second.jpg' }] }, { segments: [{ text: 'second.jpg' }] }],
  ]);
  const fields = tree.children
    .flatMap((child) => child?.type === 'row' ? child.children : [])
    .filter((child) => child?.type === 'text' || child?.type === 'toggle');
  assert.deepEqual(fields.map((field) => field.id), [
    'prefix', 'suffix', 'replacementPattern', 'replacementText',
    'replacementCaseSensitive', 'replacementRegex',
  ]);
});

test('normalizes submitted widget values', () => {
  assert.deepEqual(optionsFromWidgetValues({ prefix: 'x-', keyword: 'old' }), {
    prefix: 'x-',
    suffix: '',
    replacementPattern: 'old',
    replacementText: '',
    replacementCaseSensitive: true,
    replacementRegex: false,
  });
});

test('localizes dialog labels and keeps replacement toggles compact', () => {
  const tree = renderRenameDialog(createFakeUi(), [{ id: 'asset-1', name: 'shot.png' }], 'en-US');
  assert.equal(tree.children.find((child) => child?.type === 'heading')?.text, 'Prefix and suffix');
  const toggles = tree.children.flatMap((child) => child?.type === 'row' ? child.children : [])
    .filter((child) => child?.type === 'toggle');
  assert.deepEqual(toggles.map((toggle) => toggle.label), ['Aa', '.*']);
});
