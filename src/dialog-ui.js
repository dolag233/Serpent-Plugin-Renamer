'use strict';

const { buildRenamePreview, compileRenamePattern } = require('./name-transform');

const PREVIEW_ROW_LIMIT = 500;

function textValue(values, key) {
  return typeof values?.[key] === 'string' ? values[key] : '';
}

function optionsFromWidgetValues(values = {}) {
  return {
    prefix: textValue(values, 'prefix'),
    suffix: textValue(values, 'suffix'),
    keyword: textValue(values, 'keyword'),
    keywordReplacement: textValue(values, 'keywordReplacement'),
    regexPattern: textValue(values, 'regexPattern'),
    regexReplacement: textValue(values, 'regexReplacement'),
    regexFlags: textValue(values, 'regexFlags') || 'g',
  };
}

function renderRenameDialog(ui, assets) {
  const prefix = ui.state('');
  const suffix = ui.state('');
  const keyword = ui.state('');
  const keywordReplacement = ui.state('');
  const regexPattern = ui.state('');
  const regexReplacement = ui.state('');
  const regexFlags = ui.state('g');
  const options = {
    prefix: prefix.get(),
    suffix: suffix.get(),
    keyword: keyword.get(),
    keywordReplacement: keywordReplacement.get(),
    regexPattern: regexPattern.get(),
    regexReplacement: regexReplacement.get(),
    regexFlags: regexFlags.get() || 'g',
  };
  const previews = buildRenamePreview(assets, options);
  const changedCount = previews.filter((preview) => preview.changed).length;
  const duplicateCount = previews.filter((preview) => preview.duplicate).length;
  const invalidReasons = [...new Set(
    previews.map((preview) => preview.invalidReason).filter((reason) => reason !== null),
  )];
  let regexError = null;
  if (options.regexPattern.length > 0) {
    try {
      compileRenamePattern(options.regexPattern, options.regexFlags);
    } catch (error) {
      regexError = error instanceof Error ? error.message : String(error);
    }
  }
  const visiblePreviews = previews.slice(0, PREVIEW_ROW_LIMIT);
  const rows = visiblePreviews.map((preview) => [preview.before, preview.after]);
  const notes = [
    ui.note(`已选 ${previews.length} 个资产，将重命名 ${changedCount} 个。扩展名会保持不变。`),
  ];
  if (duplicateCount > 0) notes.push(ui.note(`${duplicateCount} 个新文件名重复，确认后宿主会跳过冲突项。`));
  if (regexError !== null) notes.push(ui.note(`正则表达式无法使用：${regexError}`));
  else if (invalidReasons.length > 0) notes.push(ui.note(`部分文件名无法使用：${invalidReasons[0]}`));
  if (previews.length > PREVIEW_ROW_LIMIT) {
    notes.push(ui.note(`预览仅显示前 ${PREVIEW_ROW_LIMIT} 个资产，确认后仍会处理全部选中资产。`));
  }
  return ui.column(
    ...notes,
    ui.row(
      ui.text({ id: 'prefix', label: '添加前缀', value: prefix.get(), onChange: prefix.set }),
      ui.text({ id: 'suffix', label: '添加后缀', value: suffix.get(), onChange: suffix.set }),
    ),
    ui.row(
      ui.text({ id: 'keyword', label: '查找关键词', value: keyword.get(), onChange: keyword.set }),
      ui.text({ id: 'keywordReplacement', label: '关键词替换为', value: keywordReplacement.get(), onChange: keywordReplacement.set }),
    ),
    ui.row(
      ui.text({
        id: 'regexPattern',
        label: '正则匹配',
        value: regexPattern.get(),
        onChange: regexPattern.set,
        description: '留空表示不使用正则。',
      }),
      ui.text({
        id: 'regexReplacement',
        label: '正则替换为',
        value: regexReplacement.get(),
        onChange: regexReplacement.set,
      }),
    ),
    ui.row(
      ui.text({
        id: 'regexFlags',
        label: '正则选项',
        value: regexFlags.get(),
        onChange: regexFlags.set,
        description: '默认 g；可填写 gi、gm 等。',
      }),
    ),
    ui.separator(),
    ui.heading('命名预览'),
    ui.list({
      columns: ['原文件名', '重命名后'],
      rows,
      emptyText: '没有选中的资产',
    }),
  );
}

module.exports = {
  PREVIEW_ROW_LIMIT,
  optionsFromWidgetValues,
  renderRenameDialog,
};
