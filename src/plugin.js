'use strict';

const { renderRenameDialog, optionsFromWidgetValues } = require('./dialog-ui');
const { buildRenamePreview, splitFileName } = require('./name-transform');
const { getCopy } = require('./copy');

const PLUGIN_ID = 'com.dolag.serpent.renamer';

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function unwrapDialogResult(value) {
  if (value === null || value === undefined || typeof value !== 'object') return null;
  if ('result' in value) return unwrapDialogResult(value.result);
  return value;
}

function normalizeAssetSummary(asset) {
  if (!asset || typeof asset !== 'object') return null;
  const value = asset;
  const assetId = typeof value.assetId === 'string'
    ? value.assetId
    : typeof value.id === 'string' ? value.id : '';
  if (assetId.length === 0) return null;
  const name = typeof value.displayName === 'string' && value.displayName.length > 0
    ? value.displayName
    : typeof value.name === 'string' && value.name.length > 0 ? value.name : assetId;
  return { assetId, displayName: name };
}

function resolveCommandTargets(context) {
  const invocation = context?.invocation;
  const targetLibraryId = typeof invocation?.libraryId === 'string' && invocation.libraryId.length > 0
    ? invocation.libraryId
    : typeof context?.targetLibraryId === 'string' ? context.targetLibraryId : '';
  const invocationAssetIds = invocation?.selection?.assetIds;
  const assetIds = Array.isArray(invocationAssetIds)
    ? [...invocationAssetIds]
    : Array.isArray(context?.assetIds) ? [...context.assetIds] : [];
  const assets = Array.isArray(invocation?.selection?.assets)
    ? invocation.selection.assets.map(normalizeAssetSummary).filter(Boolean)
    : [];
  return { targetLibraryId, assetIds, assets, locale: invocation?.app?.locale ?? context?.locale ?? 'zh-CN' };
}

function normalizeListedAssets(result) {
  const value = unwrapDialogResult(result);
  const items = value && typeof value === 'object' && Array.isArray(value.items) ? value.items : [];
  return items.map(normalizeAssetSummary).filter(Boolean);
}

function normalizeRenameResult(result) {
  const value = unwrapDialogResult(result);
  if (!value || typeof value !== 'object') return { renamedCount: 0, skipped: [] };
  const renamedCount = Number.isFinite(value.renamedCount) ? Math.max(0, Math.floor(value.renamedCount)) : 0;
  const skipped = Array.isArray(value.skipped) ? value.skipped : [];
  return { renamedCount, skipped };
}

async function notifyUser(serpent, input) {
  if (typeof serpent?.ui?.notify !== 'function') return;
  try {
    await serpent.ui.notify(input);
  } catch {
    // A notification failure must not turn a completed rename into an error.
  }
}

function createPluginRuntime() {
  let serpent;
  let lifecycleSignal;
  let initialized = false;
  let disposed = false;

  async function runRenameCommand(context) {
    const targets = resolveCommandTargets(context);
    const copy = getCopy(targets.locale);
    if (targets.targetLibraryId.length === 0) throw new Error(copy.targetMissing);
    if (targets.assetIds.length === 0) {
      await notifyUser(serpent, { severity: 'warning', title: copy.title, message: copy.chooseAssets });
      return;
    }
    if (typeof serpent?.ui?.openDialog !== 'function') {
      throw new Error(copy.dialogsUnavailable);
    }

    const scoped = serpent.forLibrary(targets.targetLibraryId);
    const byId = new Map(targets.assets.map((asset) => [asset.assetId, asset]));
    if (byId.size < targets.assetIds.length && typeof scoped?.assets?.list === 'function') {
      const missingIds = targets.assetIds.filter((assetId) => !byId.has(assetId));
      try {
        const listed = normalizeListedAssets(await scoped.assets.list({
          assetIds: missingIds,
          limit: missingIds.length,
          offset: 0,
        }));
        for (const asset of listed) byId.set(asset.assetId, asset);
      } catch {
        // The invocation snapshot remains a valid fallback for older Hosts.
      }
    }
    const assets = targets.assetIds.map((assetId) => byId.get(assetId) ?? {
      assetId,
      displayName: assetId,
    });
    const rawResult = await serpent.ui.openDialog({
      title: copy.title,
      submitLabel: copy.apply,
      render(ui) {
        return renderRenameDialog(ui, assets, targets.locale);
      },
    });
    const values = unwrapDialogResult(rawResult);
    if (values === null) return;
    const options = optionsFromWidgetValues(values);
    const previews = buildRenamePreview(assets, options);
    const invalid = previews.find((preview) => preview.invalidReason !== null);
    if (invalid !== undefined) {
      await notifyUser(scoped, {
        severity: 'warning',
        title: copy.title,
        message: copy.invalid(invalid.invalidReason),
      });
      return;
    }
    const items = previews
      .filter((preview) => preview.changed)
      .map((preview) => ({
        assetId: preview.assetId,
        newBaseName: splitFileName(preview.after).baseName,
      }));
    if (items.length === 0) {
      await notifyUser(scoped, { severity: 'info', title: copy.title, message: copy.noChanges });
      return;
    }
    const result = normalizeRenameResult(await scoped.assets.renameFiles(items));
    const skipped = result.skipped.length;
    await notifyUser(scoped, {
      severity: skipped > 0 ? 'warning' : 'info',
      title: copy.title,
      message: skipped > 0
        ? copy.completedWithSkipped(result.renamedCount, skipped)
        : copy.completed(result.renamedCount),
    });
    return result;
  }

  async function setup(context) {
    if (initialized) return;
    if (disposed) throw new Error('插件实例已被释放。');
    serpent = context?.serpent;
    if (!serpent || typeof serpent !== 'object') throw new TypeError('setup(context) 需要 context.serpent。');
    lifecycleSignal = context.signal;
    serpent.commands.register('rename-selected', runRenameCommand);
    serpent.commands.register('rename-selected-en', runRenameCommand);
    if (typeof lifecycleSignal?.addEventListener === 'function') {
      const onAbort = () => { void dispose('instance-aborted'); };
      lifecycleSignal.addEventListener('abort', onAbort, { once: true });
      context.subscriptions?.add?.(() => lifecycleSignal.removeEventListener('abort', onAbort));
    }
    initialized = true;
  }

  async function dispose() {
    if (disposed) return;
    disposed = true;
  }

  return {
    setup,
    dispose,
    runRenameCommand,
  };
}

const defaultRuntime = createPluginRuntime();

module.exports = {
  PLUGIN_ID,
  createPluginRuntime,
  normalizeAssetSummary,
  normalizeRenameResult,
  resolveCommandTargets,
  setup: defaultRuntime.setup,
  dispose: defaultRuntime.dispose,
};
