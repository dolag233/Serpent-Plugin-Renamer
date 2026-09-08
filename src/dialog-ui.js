'use strict';

const { buildRenamePreview, compileRenamePattern } = require('./name-transform');
const { getCopy } = require('./copy');

const PREVIEW_ROW_LIMIT = 500;

function textValue(values, key) {
  return typeof values?.[key] === 'string' ? values[key] : '';
}

function booleanValue(values, key, fallback) {
  return typeof values?.[key] === 'boolean' ? values[key] : fallback;
}

function optionsFromWidgetValues(values = {}) {
  return {
    prefix: textValue(values, 'prefix'),
    suffix: textValue(values, 'suffix'),
    replacementPattern: textValue(values, 'replacementPattern') || textValue(values, 'keyword'),
    replacementText: textValue(values, 'replacementText')
      || textValue(values, 'keywordReplacement')
      || textValue(values, 'replacement'),
    replacementCaseSensitive: booleanValue(values, 'replacementCaseSensitive', true),
    replacementRegex: booleanValue(values, 'replacementRegex', false),
  };
}

function renderRenameDialog(ui, assets, locale = 'zh-CN') {
  const copy = getCopy(locale);
  const prefix = ui.state('');
  const suffix = ui.state('');
  const replacementPattern = ui.state('');
  const replacementText = ui.state('');
  const replacementCaseSensitive = ui.state(true);
  const replacementRegex = ui.state(false);
  const options = {
    prefix: prefix.get(),
    suffix: suffix.get(),
    replacementPattern: replacementPattern.get(),
    replacementText: replacementText.get(),
    replacementCaseSensitive: replacementCaseSensitive.get(),
    replacementRegex: replacementRegex.get(),
  };
  const previews = buildRenamePreview(assets, options);
  const changedCount = previews.filter((preview) => preview.changed).length;
  const duplicateCount = previews.filter((preview) => preview.duplicate).length;
  const invalidReasons = [...new Set(
    previews.map((preview) => preview.invalidReason).filter((reason) => reason !== null),
  )];
  let regexError = null;
  if (options.replacementRegex && options.replacementPattern.length > 0) {
    try {
      compileRenamePattern(options.replacementPattern, `g${options.replacementCaseSensitive ? '' : 'i'}`);
    } catch (error) {
      regexError = error instanceof Error ? error.message : String(error);
    }
  }
  const visiblePreviews = previews.slice(0, PREVIEW_ROW_LIMIT);
  const rows = visiblePreviews.map((preview) => [
    { segments: preview.beforeSegments },
    { segments: preview.afterSegments },
  ]);
  const notes = [ui.note(copy.selected(previews.length, changedCount))];
  if (duplicateCount > 0) notes.push(ui.note(copy.duplicate(duplicateCount)));
  if (regexError !== null) notes.push(ui.note(copy.regexInvalid(regexError)));
  else if (invalidReasons.length > 0) notes.push(ui.note(copy.invalid(invalidReasons[0])));
  if (previews.length > PREVIEW_ROW_LIMIT) notes.push(ui.note(copy.truncated(PREVIEW_ROW_LIMIT)));
  return ui.column(
    ...notes,
    ui.heading(copy.prefixSuffix),
    ui.row(
      ui.text({ id: 'prefix', label: copy.prefix, value: prefix.get(), onChange: prefix.set }),
      ui.text({ id: 'suffix', label: copy.suffix, value: suffix.get(), onChange: suffix.set }),
    ),
    ui.separator(),
    ui.heading(copy.replacement),
    ui.row(
      ui.text({ id: 'replacementPattern', label: copy.find, value: replacementPattern.get(), onChange: replacementPattern.set }),
      ui.text({ id: 'replacementText', label: copy.replace, value: replacementText.get(), onChange: replacementText.set }),
      ui.toggle({ id: 'replacementCaseSensitive', label: 'Aa', value: replacementCaseSensitive.get(), description: copy.caseSensitive, onChange: replacementCaseSensitive.set }),
      ui.toggle({ id: 'replacementRegex', label: '.*', value: replacementRegex.get(), description: copy.regularExpression, onChange: replacementRegex.set }),
    ),
    ui.separator(),
    ui.heading(copy.preview),
    ui.list({
      columns: [copy.original, copy.renamed],
      rows,
      emptyText: copy.empty,
    }),
  );
}

module.exports = {
  PREVIEW_ROW_LIMIT,
  optionsFromWidgetValues,
  renderRenameDialog,
};
