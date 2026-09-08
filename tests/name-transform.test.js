'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRenamePreview,
  previewRename,
  splitFileName,
  transformFileName,
} = require('../src/name-transform');

test('preserves extensions while applying literal replacements and affixes', () => {
  assert.deepEqual(splitFileName('character-idle.png'), {
    baseName: 'character-idle',
    extension: '.png',
  });
  assert.equal(transformFileName('character-idle.png', {
    keyword: 'idle',
    keywordReplacement: 'walk',
    prefix: 'hero-',
    suffix: '-v2',
  }).fileName, 'hero-character-walk-v2.png');
  assert.equal(transformFileName('.env', { prefix: 'copy-' }).fileName, 'copy-.env');
});

test('supports global regular expression replacement and reports invalid patterns', () => {
  assert.equal(transformFileName('shot-01-01.exr', {
    regexPattern: '01',
    regexFlags: 'g',
    regexReplacement: '02',
  }).fileName, 'shot-02-02.exr');
  const preview = previewRename({ id: 'asset-1', name: 'shot.png' }, {
    regexPattern: '[',
    regexFlags: 'g',
  });
  assert.match(preview.invalidReason, /unterminated|regular expression|正则/iu);
  assert.equal(preview.after, preview.before);
});

test('marks duplicate proposed names without changing the source summaries', () => {
  const assets = [
    { id: 'asset-a', name: 'one.png' },
    { id: 'asset-b', name: 'two.png' },
  ];
  const preview = buildRenamePreview(assets, { prefix: 'same-' });
  assert.equal(preview[0].after, 'same-one.png');
  assert.equal(preview[0].duplicate, false);
  assert.equal(preview[1].duplicate, false);
  const duplicate = buildRenamePreview([
    { id: 'asset-a', name: 'one.png' },
    { id: 'asset-b', name: 'two.png' },
  ], { regexPattern: '^(one|two)$', regexFlags: 'g', regexReplacement: 'same' });
  assert.equal(duplicate[0].duplicate, true);
  assert.equal(duplicate[1].duplicate, true);
});

test('supports case and regular-expression toggles with preview highlights', () => {
  const literal = previewRename({ id: 'asset-1', name: 'Shot_01.PNG' }, {
    replacementPattern: 'shot',
    replacementText: 'Take',
    replacementCaseSensitive: false,
  });
  assert.equal(literal.after, 'Take_01.PNG');
  assert.deepEqual(literal.beforeSegments, [
    { text: 'Shot', tone: 'match' },
    { text: '_01.PNG' },
  ]);
  assert.deepEqual(literal.afterSegments, [
    { text: 'Take', tone: 'change' },
    { text: '_01.PNG' },
  ]);

  const regex = previewRename({ id: 'asset-2', name: 'shot-01.exr' }, {
    replacementPattern: '(shot)-(\\d+)',
    replacementText: '$1-final-$2',
    replacementRegex: true,
  });
  assert.equal(regex.after, 'shot-final-01.exr');
  assert.equal(regex.beforeSegments[0].tone, 'match');
  assert.equal(regex.afterSegments[0].tone, 'change');
});
