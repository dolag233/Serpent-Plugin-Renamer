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

function replacementModeFromValues(values) {
  // A malformed or stale Host snapshot must still resolve to one matching
  // mode. Regex wins over the legacy pair if both flags are present.
  if (booleanValue(values, 'replacementRegex', false)) return 'regex';
  if (booleanValue(values, 'replacementCaseSensitive', true)) return 'caseSensitive';
  return 'caseInsensitive';
}

function optionsFromWidgetValues(values = {}) {
  const replacementMode = replacementModeFromValues(values);
  return {
    prefix: textValue(values, 'prefix'),
    suffix: textValue(values, 'suffix'),
    replacementPattern: textValue(values, 'replacementPattern') || textValue(values, 'keyword'),
    replacementText: textValue(values, 'replacementText')
      || textValue(values, 'keywordReplacement')
      || textValue(values, 'replacement'),
    replacementCaseSensitive: replacementMode === 'caseSensitive',
    replacementRegex: replacementMode === 'regex',
    numberingEnabled: booleanValue(values, 'numberingEnabled', false),
    numberingStart: Number.isFinite(Number(values.numberingStart)) ? Math.floor(Number(values.numberingStart)) : 1,
    numberingWidth: Number.isFinite(Number(values.numberingWidth)) ? Math.max(1, Math.floor(Number(values.numberingWidth))) : 3,
    numberingFormat: textValue(values, 'numberingFormat') || 'plain',
    numberingDirection: textValue(values, 'numberingDirection')
      || (booleanValue(values, 'numberingDirectionReverse', false) ? 'reverse' : 'forward'),
    numberingPosition: textValue(values, 'numberingPosition')
      || (booleanValue(values, 'numberingPositionSuffix', true) ? 'suffix' : 'prefix'),
    numberingSeparator: textValue(values, 'numberingSeparator') || 'before',
  };
}

function renderRenameDialog(ui, assets, locale = 'zh-CN', onRenderOptions) {
  const copy = getCopy(locale);
  const prefix = ui.state('');
  const suffix = ui.state('');
  const replacementPattern = ui.state('');
  const replacementText = ui.state('');
  const replacementMode = ui.state('caseSensitive');
  const activeTab = ui.state('prefixSuffix');
  const numberingEnabled = ui.state(false);
  const numberingStart = ui.state(1);
  const numberingWidth = ui.state(3);
  const numberingFormat = ui.state('plain');
  const numberingDirection = ui.state('forward');
  const numberingPosition = ui.state('suffix');
  const numberingSeparator = ui.state('before');
  const setReplacementMode = (mode) => {
    if (mode === 'caseSensitive' || mode === 'regex' || mode === 'caseInsensitive') {
      replacementMode.set(mode);
    }
  };
  const options = {
    prefix: prefix.get(),
    suffix: suffix.get(),
    replacementPattern: replacementPattern.get(),
    replacementText: replacementText.get(),
    replacementCaseSensitive: replacementMode.get() === 'caseSensitive',
    replacementRegex: replacementMode.get() === 'regex',
    numberingEnabled: numberingEnabled.get(),
    numberingStart: numberingStart.get(),
    numberingWidth: numberingWidth.get(),
    numberingFormat: numberingFormat.get(),
    numberingDirection: numberingDirection.get(),
    numberingPosition: numberingPosition.get(),
    numberingSeparator: numberingSeparator.get(),
  };
  onRenderOptions?.(options);
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
  const prefixSuffixPanel = ui.column(
    ui.row(
      ui.text({ id: 'prefix', label: copy.prefix, value: prefix.get(), onChange: prefix.set }),
      ui.text({ id: 'suffix', label: copy.suffix, value: suffix.get(), onChange: suffix.set }),
    ),
  );
  const replacementPanel = ui.column(
    ui.row(
      ui.text({ id: 'replacementPattern', label: copy.find, value: replacementPattern.get(), onChange: replacementPattern.set }),
      ui.toggle({
        id: 'replacementCaseSensitive',
        label: 'Aa',
        value: replacementMode.get() === 'caseSensitive',
        description: copy.caseSensitive,
        onChange: (value) => setReplacementMode(value ? 'caseSensitive' : 'caseInsensitive'),
      }),
      ui.toggle({
        id: 'replacementRegex',
        label: '.*',
        value: replacementMode.get() === 'regex',
        description: copy.regularExpression,
        onChange: (value) => setReplacementMode(value ? 'regex' : 'caseInsensitive'),
      }),
    ),
    ui.row(
      ui.text({ id: 'replacementText', label: copy.replace, value: replacementText.get(), onChange: replacementText.set }),
    ),
  );
  const numberingPanel = ui.column(
    ui.row(
      ui.switch({ id: 'numberingEnabled', label: copy.numbering, value: numberingEnabled.get(), onChange: numberingEnabled.set }),
    ),
    ui.column(
      ui.row(
        ui.number({ id: 'numberingStart', label: copy.numberingStart, value: numberingStart.get(), min: 0, step: 1, disabled: !numberingEnabled.get(), onChange: numberingStart.set }),
        ui.select({
          id: 'numberingFormat',
          label: copy.numberingFormat,
          value: numberingFormat.get(),
          disabled: !numberingEnabled.get(),
          options: [
            { value: 'plain', label: copy.plainNumber },
            { value: 'padded', label: copy.paddedNumber },
            { value: 'parenthesized', label: copy.parenthesizedNumber },
          ],
          onChange: numberingFormat.set,
        }),
      ),
      ui.row(
        ui.select({
          id: 'numberingPosition',
          label: copy.numberingPosition,
          value: numberingPosition.get(),
          disabled: !numberingEnabled.get(),
          options: [
            { value: 'prefix', label: copy.numberingBefore },
            { value: 'suffix', label: copy.numberingAfter },
          ],
          onChange: numberingPosition.set,
        }),
        ui.select({
          id: 'numberingDirection',
          label: copy.numberingDirection,
          value: numberingDirection.get(),
          disabled: !numberingEnabled.get(),
          options: [
            { value: 'forward', label: copy.forward },
            { value: 'reverse', label: copy.reverse },
          ],
          onChange: numberingDirection.set,
        }),
      ),
      ui.row(
        ui.select({
          id: 'numberingSeparator',
          label: copy.numberingSeparator,
          value: numberingSeparator.get(),
          disabled: !numberingEnabled.get(),
          options: [
            { value: 'none', label: copy.separatorNone },
            { value: 'before', label: copy.separatorBefore },
            { value: 'after', label: copy.separatorAfter },
            { value: 'both', label: copy.separatorBoth },
          ],
          onChange: numberingSeparator.set,
        }),
        numberingFormat.get() === 'padded'
          ? ui.number({ id: 'numberingWidth', label: copy.numberingWidth, value: numberingWidth.get(), min: 1, max: 64, step: 1, disabled: !numberingEnabled.get(), onChange: numberingWidth.set })
          : null,
      ),
    ),
  );
  const previewPanel = ui.group(
    copy.preview,
    ui.list({
      columns: [copy.original, copy.renamed],
      rows,
      emptyText: copy.empty,
    }),
  );
  return ui.column(
    ui.group(
      copy.parameters,
      ui.tabs({
        id: 'renameMode',
        value: activeTab.get(),
        onChange: activeTab.set,
        tabs: [
          { id: 'prefixSuffix', label: copy.prefixSuffix, children: [prefixSuffixPanel] },
          { id: 'replacement', label: copy.replacement, children: [replacementPanel] },
          { id: 'numbering', label: copy.numbering, children: [numberingPanel] },
        ],
      }),
    ),
    previewPanel,
    ...notes,
  );
}

module.exports = {
  PREVIEW_ROW_LIMIT,
  optionsFromWidgetValues,
  renderRenameDialog,
};
