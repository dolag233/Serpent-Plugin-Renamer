'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createPluginRuntime } = require('../src/plugin');

test('opens a preview for selected assets and submits changed base names', async () => {
  const commands = new Map();
  const notifications = [];
  let renameItems = null;
  let dialogInput = null;
  const runtime = createPluginRuntime();
  await runtime.setup({
    serpent: {
      commands: { register(id, handler) { commands.set(id, handler); } },
      ui: {
        async openDialog(input) {
          dialogInput = { title: input.title, submitLabel: input.submitLabel };
          const { render } = input;
          const ui = {
            state(initial) { let value = initial; return { get: () => value, set: (next) => { value = next; } }; },
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
          const tree = render(ui);
          const previewGroup = tree.children.find((child) => child.type === 'group' && child.title === 'Name preview');
          assert.equal(previewGroup.children.find((child) => child.type === 'list').rows.length, 2);
          return { prefix: 'draft-', suffix: '', replacementPattern: '', replacementText: '', replacementCaseSensitive: true, replacementRegex: false };
        },
        async notify(input) { notifications.push(input); },
      },
      forLibrary() {
        return {
          assets: {
            async renameFiles(items) {
              renameItems = items;
              return { renamedCount: items.length, skipped: [] };
            },
          },
          ui: { async notify(input) { notifications.push(input); } },
        };
      },
    },
    signal: new AbortController().signal,
    subscriptions: { add() {} },
  });
  assert.equal(typeof commands.get('rename-selected'), 'function');
  assert.equal(commands.get('rename-selected-en'), commands.get('rename-selected'));
  await commands.get('rename-selected')({
    invocation: {
      libraryId: 'library-1',
      app: { locale: 'en-US' },
      selection: {
        assetIds: ['asset-1', 'asset-2'],
        assets: [
          { id: 'asset-1', name: 'one.png' },
          { id: 'asset-2', name: 'two.jpg' },
        ],
      },
    },
  });
  assert.deepEqual(renameItems, [
    { assetId: 'asset-1', newBaseName: 'draft-one' },
    { assetId: 'asset-2', newBaseName: 'draft-two' },
  ]);
  assert.deepEqual(dialogInput, { title: 'Batch Rename', submitLabel: 'Apply' });
  assert.equal(notifications.at(-1).severity, 'info');
  await runtime.dispose();
});

test('does not call the Host when all names stay unchanged', async () => {
  const commands = new Map();
  let renameCalled = false;
  const runtime = createPluginRuntime();
  await runtime.setup({
    serpent: {
      commands: { register(id, handler) { commands.set(id, handler); } },
      ui: {
        async openDialog() { return { prefix: '', suffix: '', replacementPattern: '', replacementText: '', replacementCaseSensitive: true, replacementRegex: false }; },
        async notify(input) { assert.equal(input.severity, 'info'); },
      },
      forLibrary() {
        return { assets: { async renameFiles() { renameCalled = true; } }, ui: { async notify(input) { assert.equal(input.severity, 'info'); } } };
      },
    },
    signal: new AbortController().signal,
    subscriptions: { add() {} },
  });
  await commands.get('rename-selected')({
    targetLibraryId: 'library-1',
    assetIds: ['asset-1'],
    invocation: { selection: { assetIds: ['asset-1'], assets: [{ id: 'asset-1', name: 'one.png' }] } },
  });
  assert.equal(renameCalled, false);
  await runtime.dispose();
});

test('submits selected numbering direction and position from widget values', async () => {
  const commands = new Map();
  let renameItems = null;
  const runtime = createPluginRuntime();
  await runtime.setup({
    serpent: {
      commands: { register(id, handler) { commands.set(id, handler); } },
      ui: {
        async openDialog() {
          return {
            numberingEnabled: true,
            numberingStart: 1,
            numberingWidth: 2,
            numberingFormat: 'padded',
            numberingDirectionForward: false,
            numberingDirectionReverse: true,
            numberingPositionPrefix: false,
            numberingPositionSuffix: true,
            numberingSeparator: 'none',
          };
        },
        async notify() {},
      },
      forLibrary() {
        return {
          assets: {
            async renameFiles(items) {
              renameItems = items;
              return { renamedCount: items.length, skipped: [] };
            },
          },
          ui: { async notify() {} },
        };
      },
    },
    signal: new AbortController().signal,
    subscriptions: { add() {} },
  });
  await commands.get('rename-selected')({
    targetLibraryId: 'library-1',
    assetIds: ['asset-1', 'asset-2'],
    invocation: {
      selection: {
        assetIds: ['asset-1', 'asset-2'],
        assets: [{ id: 'asset-1', name: 'one.png' }, { id: 'asset-2', name: 'two.png' }],
      },
    },
  });
  assert.deepEqual(renameItems, [
    { assetId: 'asset-1', newBaseName: 'one02' },
    { assetId: 'asset-2', newBaseName: 'two01' },
  ]);
  await runtime.dispose();
});
