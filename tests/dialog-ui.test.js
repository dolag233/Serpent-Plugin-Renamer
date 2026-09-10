'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { renderRenameDialog, optionsFromWidgetValues } = require('../src/dialog-ui');

function createFakeUi() {
  let stateCursor = 0;
  const stateValues = [];
  return {
    reset() { stateCursor = 0; },
    state(initial) {
      const index = stateCursor;
      stateCursor += 1;
      stateValues[index] ??= { value: initial };
      return {
        get: () => stateValues[index].value,
        set: (next) => { stateValues[index].value = next; },
      };
    },
    column(...children) { return { type: 'column', children }; },
    row(...children) { return { type: 'row', children }; },
    group(title, ...children) { return { type: 'group', title, children }; },
    tabs(spec) { return { type: 'tabs', ...spec }; },
    note(text) { return { type: 'note', text }; },
    heading(text) { return { type: 'heading', text }; },
    separator() { return { type: 'separator' }; },
    text(spec) { return { type: 'text', ...spec }; },
    number(spec) { return { type: 'number', ...spec }; },
    select(spec) { return { type: 'select', ...spec }; },
    switch(spec) { return { type: 'switch', ...spec }; },
    toggle(spec) { return { type: 'toggle', ...spec }; },
    list(spec) { return { type: 'list', ...spec }; },
  };
}

function findTabs(tree) {
  const parameters = tree.children.find((child) => child?.type === 'group');
  return parameters?.children.find((child) => child?.type === 'tabs');
}

test('renders tabs, a plain control column, and a two-column preview list', () => {
  const tree = renderRenameDialog(createFakeUi(), [
    { id: 'asset-1', name: 'first.png' },
    { id: 'asset-2', name: 'second.jpg' },
  ]);
  const tabs = findTabs(tree);
  const previewGroup = tree.children.find((child) => child?.type === 'group' && child.title === '命名预览');
  const list = previewGroup?.children.find((child) => child?.type === 'list');
  assert.ok(tabs);
  assert.ok(previewGroup);
  assert.ok(list);
  assert.deepEqual(list.columns, ['原文件名', '重命名后']);
  assert.deepEqual(list.rows, [
    [{ segments: [{ text: 'first.png' }] }, { segments: [{ text: 'first.png' }] }],
    [{ segments: [{ text: 'second.jpg' }] }, { segments: [{ text: 'second.jpg' }] }],
  ]);
  assert.deepEqual(tabs.tabs.map((tab) => tab.id), ['prefixSuffix', 'replacement', 'numbering']);
  assert.equal(tabs.tabs[2].children[0].type, 'column');
});

test('normalizes submitted widget values', () => {
  assert.deepEqual(optionsFromWidgetValues({ prefix: 'x-', keyword: 'old' }), {
    prefix: 'x-',
    suffix: '',
    replacementPattern: 'old',
    replacementText: '',
    replacementCaseSensitive: true,
    replacementRegex: false,
    numberingEnabled: false,
    numberingStart: 1,
    numberingWidth: 3,
    numberingFormat: 'plain',
    numberingDirection: 'forward',
    numberingPosition: 'suffix',
    numberingSeparator: 'before',
  });
});

test('normalizes matching mode and radio-like numbering controls from submitted widgets', () => {
  assert.deepEqual(optionsFromWidgetValues({
    replacementCaseSensitive: true,
    replacementRegex: true,
    numberingDirectionReverse: true,
    numberingPositionSuffix: true,
  }), {
    prefix: '',
    suffix: '',
    replacementPattern: '',
    replacementText: '',
    replacementCaseSensitive: false,
    replacementRegex: true,
    numberingEnabled: false,
    numberingStart: 1,
    numberingWidth: 3,
    numberingFormat: 'plain',
    numberingDirection: 'reverse',
    numberingPosition: 'suffix',
    numberingSeparator: 'before',
  });
});

test('localizes dialog labels and keeps replacement toggles compact', () => {
  const tree = renderRenameDialog(createFakeUi(), [{ id: 'asset-1', name: 'shot.png' }], 'en-US');
  const tabs = findTabs(tree);
  assert.equal(tabs.tabs.find((tab) => tab.id === 'prefixSuffix')?.label, 'Prefix and suffix');
  const replacement = tabs.tabs.find((tab) => tab.id === 'replacement');
  const replacementColumn = replacement.children[0];
  const toggles = replacementColumn.children.flatMap((child) => child?.type === 'row' ? child.children : [])
    .filter((child) => child?.type === 'toggle');
  assert.deepEqual(toggles.map((toggle) => toggle.label), ['Aa', '.*']);
});

test('keeps case-sensitive and regular-expression matching mutually exclusive', () => {
  const ui = createFakeUi();
  const first = renderRenameDialog(ui, [{ id: 'asset-1', name: 'shot.png' }]);
  const tabs = findTabs(first);
  const replacement = tabs.tabs.find((tab) => tab.id === 'replacement');
  const replacementColumn = replacement.children[0];
  const toggles = replacementColumn.children
    .flatMap((child) => child?.type === 'row' ? child.children : [])
    .filter((child) => child?.type === 'toggle');
  const caseToggle = toggles.find((toggle) => toggle.id === 'replacementCaseSensitive');
  const regexToggle = toggles.find((toggle) => toggle.id === 'replacementRegex');
  assert.ok(caseToggle);
  assert.ok(regexToggle);

  regexToggle.onChange(true);
  ui.reset();
  const regexEnabled = renderRenameDialog(ui, [{ id: 'asset-1', name: 'shot.png' }]);
  const regexTabs = findTabs(regexEnabled);
  const regexColumn = regexTabs.tabs.find((tab) => tab.id === 'replacement').children[0];
  const regexEnabledToggles = regexColumn.children
    .flatMap((child) => child?.type === 'row' ? child.children : [])
    .filter((child) => child?.type === 'toggle');
  assert.equal(regexEnabledToggles.find((toggle) => toggle.id === 'replacementRegex')?.value, true);
  assert.equal(regexEnabledToggles.find((toggle) => toggle.id === 'replacementCaseSensitive')?.value, false);

  regexEnabledToggles.find((toggle) => toggle.id === 'replacementCaseSensitive')?.onChange(true);
  ui.reset();
  const caseEnabled = renderRenameDialog(ui, [{ id: 'asset-1', name: 'shot.png' }]);
  const caseTabs = findTabs(caseEnabled);
  const caseColumn = caseTabs.tabs.find((tab) => tab.id === 'replacement').children[0];
  const caseEnabledToggles = caseColumn.children
    .flatMap((child) => child?.type === 'row' ? child.children : [])
    .filter((child) => child?.type === 'toggle');
  assert.equal(caseEnabledToggles.find((toggle) => toggle.id === 'replacementCaseSensitive')?.value, true);
  assert.equal(caseEnabledToggles.find((toggle) => toggle.id === 'replacementRegex')?.value, false);
});

test('keeps numbering disabled by default and disables dependent controls', () => {
  const ui = createFakeUi();
  const tree = renderRenameDialog(ui, [{ id: 'asset-1', name: 'shot.png' }]);
  const tabs = findTabs(tree);
  const numbering = tabs.tabs.find((tab) => tab.id === 'numbering');
  const panel = numbering.children[0];
  const header = panel.children[0];
  assert.equal(header.type, 'row');
  assert.equal(header.children.find((child) => child?.id === 'numberingEnabled')?.value, false);
  assert.equal(numbering.children.length, 1);
  const disabledControls = panel.children[1].children.flatMap((row) => row.children).filter(Boolean);
  assert.ok(disabledControls.length >= 5);
  assert.ok(disabledControls.every((control) => control.disabled === true));
  assert.equal(disabledControls.find((control) => control.id === 'numberingPosition').value, 'suffix');
  assert.equal(disabledControls.find((control) => control.id === 'numberingSeparator').value, 'before');
  assert.deepEqual(disabledControls.find((control) => control.id === 'numberingSeparator').options.map((option) => option.label), ['1', '_1', '1_', '_1_']);

  header.children.find((child) => child?.id === 'numberingEnabled')?.onChange(true);
  ui.reset();
  const enabledTree = renderRenameDialog(ui, [{ id: 'asset-1', name: 'shot.png' }]);
  const preview = enabledTree.children.find((child) => child?.type === 'group' && child.title === '命名预览').children[0];
  assert.equal(preview.rows[0][1].segments.map((segment) => segment.text).join(''), 'shot_1.png');
  const enabled = findTabs(enabledTree).tabs.find((tab) => tab.id === 'numbering');
  const enabledColumn = enabled.children[0].children[1];
  const enabledControls = enabledColumn.children.flatMap((child) => child?.type === 'row' ? child.children : []);
  assert.equal(enabledControls.find((control) => control.id === 'numberingStart')?.disabled, false);
  assert.equal(enabledControls.find((control) => control.id === 'numberingFormat')?.disabled, false);
  assert.equal(enabledControls.find((control) => control?.id === 'numberingWidth'), undefined);

  enabledControls.find((control) => control.id === 'numberingFormat')?.onChange('padded');
  ui.reset();
  const paddedTree = renderRenameDialog(ui, [{ id: 'asset-1', name: 'shot.png' }]);
  const padded = findTabs(paddedTree).tabs.find((tab) => tab.id === 'numbering');
  const paddedRows = padded.children[0].children[1].children;
  const width = paddedRows[2].children.find((control) => control.id === 'numberingWidth');
  assert.equal(width?.value, 3);
  assert.deepEqual(paddedRows[1].children.find((control) => control.id === 'numberingPosition')?.options, [
    { value: 'prefix', label: '文件名前' },
    { value: 'suffix', label: '文件名后' },
  ]);
});
