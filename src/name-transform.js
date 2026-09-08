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
  return new RegExp(source, String(flags ?? 'g'));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mergeSegments(segments) {
  const merged = [];
  for (const segment of segments) {
    if (!segment || segment.text.length === 0) continue;
    const previous = merged.at(-1);
    if (previous && previous.tone === segment.tone) previous.text += segment.text;
    else merged.push({ text: segment.text, ...(segment.tone ? { tone: segment.tone } : {}) });
  }
  return merged.length > 0 ? merged : [{ text: '' }];
}

function appendExtension(segments, extension) {
  return mergeSegments([...segments, { text: extension }]);
}

function expandedReplacement(template, match) {
  const source = String(template ?? '');
  return source.replace(/\$(\$|&|`|'|[0-9]{1,2})/g, (_token, key) => {
    if (key === '$') return '$';
    if (key === '&') return match[0];
    if (key === '`') return match.input.slice(0, match.index);
    if (key === "'") return match.input.slice(match.index + match[0].length);
    const group = Number(key);
    return Number.isInteger(group) && group < match.length && match[group] !== undefined
      ? match[group]
      : '';
  });
}

function regexForReplace(isRegex, source, caseSensitive) {
  return compileRenamePattern(isRegex ? source : escapeRegExp(source), `g${caseSensitive ? '' : 'i'}`);
}

function applyRegexOperation(baseName, pattern, replacement, caseSensitive, isRegex) {
  const source = String(pattern ?? '');
  if (source.length === 0) {
    return { value: baseName, beforeSegments: [{ text: baseName }], afterSegments: [{ text: baseName }] };
  }
  const regex = regexForReplace(isRegex, source, caseSensitive);
  const beforeSegments = [];
  const afterSegments = [];
  let cursor = 0;
  let match;
  while ((match = regex.exec(baseName)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    beforeSegments.push({ text: baseName.slice(cursor, start) }, { text: match[0], tone: 'match' });
    afterSegments.push(
      { text: baseName.slice(cursor, start) },
      { text: isRegex ? expandedReplacement(replacement, match) : String(replacement), tone: 'change' },
    );
    cursor = end;
    if (match[0].length === 0) regex.lastIndex += 1;
  }
  beforeSegments.push({ text: baseName.slice(cursor) });
  afterSegments.push({ text: baseName.slice(cursor) });
  return {
    value: baseName.replace(
      regexForReplace(isRegex, source, caseSensitive),
      isRegex ? replacement : () => String(replacement),
    ),
    beforeSegments: mergeSegments(beforeSegments),
    afterSegments: mergeSegments(afterSegments),
  };
}

function transformFileName(fileName, options = {}) {
  const { baseName, extension } = splitFileName(fileName);
  const prefix = String(options.prefix ?? '');
  const suffix = String(options.suffix ?? '');
  const replacementPattern = String(options.replacementPattern ?? options.keyword ?? options.regexPattern ?? '');
  const replacementText = String(options.replacementText
    ?? options.keywordReplacement
    ?? options.regexReplacement
    ?? options.replacement
    ?? '');
  const legacyRegex = String(options.regexPattern ?? '') !== '' && options.replacementPattern === undefined;
  const replacementRegex = options.replacementRegex === true || legacyRegex;
  const replacementCaseSensitive = options.replacementCaseSensitive !== false;
  const operation = applyRegexOperation(
    baseName,
    replacementPattern,
    replacementText,
    replacementCaseSensitive,
    replacementRegex,
  );
  const nextBaseName = `${prefix}${operation.value}${suffix}`;
  const afterSegments = mergeSegments([
    { text: prefix, tone: prefix.length > 0 ? 'change' : undefined },
    ...operation.afterSegments,
    { text: suffix, tone: suffix.length > 0 ? 'change' : undefined },
  ]);
  return {
    fileName: `${nextBaseName}${extension}`,
    baseName: nextBaseName,
    extension,
    regex: replacementPattern.length > 0 ? regexForReplace(replacementRegex, replacementPattern, replacementCaseSensitive) : null,
    beforeSegments: appendExtension(operation.beforeSegments, extension),
    afterSegments: appendExtension(afterSegments, extension),
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
      beforeSegments: transformed.beforeSegments,
      afterSegments: transformed.afterSegments,
      changed: transformed.fileName !== before,
      invalidReason,
    };
  } catch (error) {
    return {
      assetId,
      before,
      after: before,
      beforeSegments: [{ text: before }],
      afterSegments: [{ text: before }],
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
