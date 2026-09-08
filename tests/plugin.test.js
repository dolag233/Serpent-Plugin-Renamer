'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createPluginRuntime } = require('../src/plugin');

test('opens a preview for selected assets and submits changed base names', async () => {
  const commands = new Map();
  const notifications = [];
  let renameItems = null;
  const runtime = createPluginRuntime();
  await runtime.setup({
    serpent: {
      commands: { register(id, handler) { commands.set(id, handler); } },
      ui: {
        async openDialog({ render }) {
          const ui = {
            state(initial) { let value = initial; return { get: () => value, set: (next) => { value = next; } }; },
            column(...children) { return { type: 'column', children }; },
            row(...children) { return { type: 'row', children }; },
            note(text) { return { type: 'note', text }; },
            heading(text) { return { type: 'heading', text }; },
            separator() { return { type: 'separator' }; },
            text(spec) { return { type: 'text', ...spec }; },
            list(spec) { return { type: 'list', ...spec }; },
          };
          const tree = render(ui);
          assert.equal(tree.children.find((child) => child.type === 'list').rows.length, 2);
          return { prefix: 'draft-', suffix: '', keyword: '', keywordReplacement: '', regexPattern: '', regexReplacement: '', regexFlags: 'g' };
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
  await commands.get('rename-selected')({
    invocation: {
      libraryId: 'library-1',
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
        async openDialog() { return { prefix: '', suffix: '', keyword: '', keywordReplacement: '', regexPattern: '', regexReplacement: '', regexFlags: 'g' }; },
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
