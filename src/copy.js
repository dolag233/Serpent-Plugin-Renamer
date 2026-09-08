'use strict';

const COPY = {
  'zh-CN': {
    title: '批量重命名',
    apply: '应用',
    selected: (count, changed) => `已选 ${count} 个资产，将重命名 ${changed} 个。扩展名会保持不变。`,
    duplicate: (count) => `${count} 个新文件名重复，确认后宿主会跳过冲突项。`,
    invalid: (reason) => `部分文件名无法使用：${reason}`,
    regexInvalid: (reason) => `匹配表达式无法使用：${reason}`,
    truncated: (limit) => `预览显示前 ${limit} 个资产，确认后仍会处理全部选中资产。`,
    chooseAssets: '请先选择要重命名的资产。',
    noChanges: '没有需要重命名的资产。',
    completed: (count) => `${count} 个资产已重命名。`,
    completedWithSkipped: (renamed, skipped) => `${renamed} 个资产已重命名，${skipped} 个因冲突或文件名无效而跳过。`,
    prefixSuffix: '前缀和后缀',
    replacement: '字符串替换',
    preview: '命名预览',
    prefix: '添加前缀',
    suffix: '添加后缀',
    find: '查找内容',
    replace: '替换为',
    caseSensitive: '区分大小写',
    regularExpression: '正则匹配',
    original: '原文件名',
    renamed: '重命名后',
    empty: '没有选中的资产',
    targetMissing: '未找到目标资源库。',
    dialogsUnavailable: '当前 Serpent 未提供对话框接口。',
  },
  en: {
    title: 'Batch Rename',
    apply: 'Apply',
    selected: (count, changed) => `${count} assets selected; ${changed} will be renamed. Extensions stay unchanged.`,
    duplicate: (count) => `${count} proposed names are duplicates. Conflicting items will be skipped.`,
    invalid: (reason) => `Some file names cannot be used: ${reason}`,
    regexInvalid: (reason) => `The matching expression cannot be used: ${reason}`,
    truncated: (limit) => `Showing the first ${limit} assets; applying will still process the full selection.`,
    chooseAssets: 'Select one or more assets to rename first.',
    noChanges: 'There are no assets to rename.',
    completed: (count) => `${count} assets renamed.`,
    completedWithSkipped: (renamed, skipped) => `${renamed} assets renamed; ${skipped} skipped because of conflicts or invalid names.`,
    prefixSuffix: 'Prefix and suffix',
    replacement: 'String replacement',
    preview: 'Name preview',
    prefix: 'Add prefix',
    suffix: 'Add suffix',
    find: 'Find text',
    replace: 'Replace with',
    caseSensitive: 'Match case',
    regularExpression: 'Regular expression',
    original: 'Original name',
    renamed: 'Renamed name',
    empty: 'No assets selected',
    targetMissing: 'No target library was found.',
    dialogsUnavailable: 'This Serpent version does not provide dialogs.',
  },
};

function normalizeLocale(locale) {
  return String(locale ?? '').toLowerCase().startsWith('en') ? 'en' : 'zh-CN';
}

function getCopy(locale) {
  return COPY[normalizeLocale(locale)];
}

module.exports = { COPY, getCopy, normalizeLocale };
