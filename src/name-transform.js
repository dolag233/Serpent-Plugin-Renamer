'use strict';

function splitFileName(fileName) {
  const value = String(fileName ?? '');
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return { baseName: value, extension: '' };
  return { baseName: value.slice(0, dot), extension: value.slice(dot) };
}

function compileRenamePattern(pattern, flags = 'g') {
  const source = String(pattern ?? '');
  if (source.length === 0) return null;
  const normalizedFlags = String(flags ?? 'g');
  return new RegExp(source, normalizedFlags);
}

function transformFileName(fileName, options = {}) {
  const { baseName, extension } = splitFileName(fileName);
  const keyword = String(options.keyword ?? '');
  const keywordReplacement = String(options.keywordReplacement ?? options.replacement ?? '');
  const pattern = String(options.regexPattern ?? '');
  const regexFlags = String(options.regexFlags ?? 'g');
  const regexReplacement = String(options.regexReplacement ?? options.replacement ?? '');
  const prefix = String(options.prefix ?? '');
  const suffix = String(options.suffix ?? '');
  let next = baseName;
  let regex = null;

  if (keyword.length > 0) next = next.split(keyword).join(keywordReplacement);
  if (pattern.length > 0) {
    regex = compileRenamePattern(pattern, regexFlags);
    next = next.replace(regex, regexReplacement);
  }
  next = `${prefix}${next}${suffix}`;
  return {
    fileName: `${next}${extension}`,
    baseName: next,
    extension,
    regex,
  };
}

function validateFileName(fileName) {
  const value = String(fileName ?? '');
  if (value.trim().length === 0) return '文件名不能为空';
  if (/[\\/\u0000]/u.test(value)) return '文件名不能包含路径分隔符';
  return null;
}

function previewRename(asset, options = {}) {
  const assetId = String(asset?.assetId ?? asset?.id ?? '');
  const before = String(asset?.displayName ?? asset?.name ?? assetId);
  try {
    const transformed = transformFileName(before, options);
    const invalidReason = validateFileName(transformed.fileName);
    return {
      assetId,
      before,
      after: transformed.fileName,
      changed: transformed.fileName !== before,
      invalidReason,
    };
  } catch (error) {
    return {
      assetId,
      before,
      after: before,
      changed: false,
      invalidReason: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildRenamePreview(assets, options = {}) {
  const previews = (Array.isArray(assets) ? assets : []).map((asset) => previewRename(asset, options));
  const names = new Map();
  for (const preview of previews) {
    if (!preview.changed || preview.invalidReason !== null) continue;
    const key = preview.after.toLocaleLowerCase();
    const matching = names.get(key) ?? [];
    matching.push(preview.assetId);
    names.set(key, matching);
  }
  const duplicateAssetIds = new Set();
  for (const matching of names.values()) {
    if (matching.length < 2) continue;
    for (const assetId of matching) duplicateAssetIds.add(assetId);
  }
  return previews.map((preview) => ({
    ...preview,
    duplicate: duplicateAssetIds.has(preview.assetId),
  }));
}

module.exports = {
  buildRenamePreview,
  compileRenamePattern,
  previewRename,
  splitFileName,
  transformFileName,
  validateFileName,
};
